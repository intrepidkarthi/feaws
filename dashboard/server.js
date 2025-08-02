const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

// Import our 1inch ecosystem components
const ecosystemPath = path.join(__dirname, '..', 'scripts', 'fusion-integration.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global state for dashboard
let dashboardState = {
    isRunning: false,
    currentExecution: null,
    executionHistory: [],
    walletInfo: {
        maker: null,
        taker: null,
        balances: {}
    },
    ecosystemStatus: {
        fusion: { available: false },
        aggregator: { available: false },
        limitOrders: { available: false }
    },
    liveOrders: [],
    statistics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        totalVolume: '0',
        protocolsUsed: {}
    }
};

// Initialize wallet connections
async function initializeWallets() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
        
        dashboardState.walletInfo.maker = makerWallet.address;
        dashboardState.walletInfo.taker = takerWallet.address;
        
        // Get initial balances
        await updateBalances();
        
        console.log('✅ Wallets initialized');
        console.log('   Maker:', makerWallet.address);
        console.log('   Taker:', takerWallet.address);
        
    } catch (error) {
        console.error('❌ Wallet initialization failed:', error.message);
    }
}

// Update wallet balances
async function updateBalances() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
        
        // Token contracts
        const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        
        const usdcContract = new ethers.Contract(
            USDC_ADDRESS,
            ['function balanceOf(address) view returns (uint256)'],
            provider
        );
        
        const wpolContract = new ethers.Contract(
            WPOL_ADDRESS,
            ['function balanceOf(address) view returns (uint256)'],
            provider
        );
        
        const makerUSDC = await usdcContract.balanceOf(makerWallet.address);
        const makerWPOL = await wpolContract.balanceOf(makerWallet.address);
        const takerWPOL = await wpolContract.balanceOf(takerWallet.address);
        const makerPOL = await provider.getBalance(makerWallet.address);
        const takerPOL = await provider.getBalance(takerWallet.address);
        
        dashboardState.walletInfo.balances = {
            maker: {
                USDC: ethers.formatUnits(makerUSDC, 6),
                WPOL: ethers.formatEther(makerWPOL),
                POL: ethers.formatEther(makerPOL)
            },
            taker: {
                WPOL: ethers.formatEther(takerWPOL),
                POL: ethers.formatEther(takerPOL)
            }
        };
        
        // Broadcast updated balances
        io.emit('balances_updated', dashboardState.walletInfo.balances);
        
    } catch (error) {
        console.error('❌ Balance update failed:', error.message);
    }
}

// API Routes
app.get('/api/status', (req, res) => {
    res.json(dashboardState);
});

app.get('/api/balances', async (req, res) => {
    await updateBalances();
    res.json(dashboardState.walletInfo.balances);
});

app.post('/api/execute-twap', async (req, res) => {
    if (dashboardState.isRunning) {
        return res.status(400).json({ error: 'TWAP execution already running' });
    }
    
    const { totalAmount, slices, strategy, intervalSeconds } = req.body;
    
    try {
        dashboardState.isRunning = true;
        dashboardState.currentExecution = {
            id: Date.now(),
            totalAmount,
            slices,
            strategy,
            intervalSeconds,
            startTime: new Date().toISOString(),
            status: 'running',
            completedSlices: 0,
            results: []
        };
        
        // Broadcast execution started
        io.emit('execution_started', dashboardState.currentExecution);
        
        // Start TWAP execution in background
        executeTWAPBackground(totalAmount, slices, strategy, intervalSeconds);
        
        res.json({ success: true, executionId: dashboardState.currentExecution.id });
        
    } catch (error) {
        dashboardState.isRunning = false;
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/create-limit-order', async (req, res) => {
    const { fromToken, toToken, makingAmount, takingAmount } = req.body;
    
    try {
        // Create limit order (demonstration)
        const order = {
            id: Date.now(),
            fromToken,
            toToken,
            makingAmount,
            takingAmount,
            status: 'created',
            timestamp: new Date().toISOString(),
            orderHash: ethers.keccak256(ethers.toUtf8Bytes(`order_${Date.now()}`))
        };
        
        dashboardState.liveOrders.push(order);
        
        // Broadcast new order
        io.emit('order_created', order);
        
        res.json({ success: true, order });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Background TWAP execution
async function executeTWAPBackground(totalAmount, slices, strategy, intervalSeconds) {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        
        const amount = ethers.parseUnits(totalAmount.toString(), 6);
        const sliceAmount = amount / BigInt(slices);
        
        for (let i = 0; i < slices; i++) {
            const sliceInfo = {
                slice: i + 1,
                amount: ethers.formatUnits(sliceAmount, 6),
                status: 'executing',
                timestamp: new Date().toISOString()
            };
            
            // Broadcast slice started
            io.emit('slice_started', sliceInfo);
            
            try {
                // Execute slice based on strategy
                let result;
                if (strategy === 'aggregator' || i % 2 === 0) {
                    result = await executeAggregatorSlice(USDC_ADDRESS, WPOL_ADDRESS, sliceAmount, wallet);
                } else {
                    result = await createLimitOrderSlice(USDC_ADDRESS, WPOL_ADDRESS, sliceAmount, wallet);
                }
                
                sliceInfo.status = result.success ? 'completed' : 'failed';
                sliceInfo.hash = result.hash;
                sliceInfo.protocol = result.protocol;
                sliceInfo.error = result.error;
                
                dashboardState.currentExecution.results.push(sliceInfo);
                dashboardState.currentExecution.completedSlices++;
                
                // Update statistics
                if (result.success) {
                    dashboardState.statistics.successfulExecutions++;
                    dashboardState.statistics.totalVolume = (
                        parseFloat(dashboardState.statistics.totalVolume) + 
                        parseFloat(sliceInfo.amount)
                    ).toString();
                    
                    const protocol = result.protocol || 'Unknown';
                    dashboardState.statistics.protocolsUsed[protocol] = 
                        (dashboardState.statistics.protocolsUsed[protocol] || 0) + 1;
                }
                
                dashboardState.statistics.totalExecutions++;
                
                // Broadcast slice completed
                io.emit('slice_completed', sliceInfo);
                io.emit('statistics_updated', dashboardState.statistics);
                
                // Update balances
                await updateBalances();
                
            } catch (error) {
                sliceInfo.status = 'failed';
                sliceInfo.error = error.message;
                
                io.emit('slice_completed', sliceInfo);
            }
            
            // Wait between slices
            if (i < slices - 1) {
                io.emit('waiting_for_next_slice', { 
                    remainingSeconds: intervalSeconds,
                    nextSlice: i + 2 
                });
                
                await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
            }
        }
        
        // Execution completed
        dashboardState.currentExecution.status = 'completed';
        dashboardState.currentExecution.endTime = new Date().toISOString();
        
        dashboardState.executionHistory.push({...dashboardState.currentExecution});
        dashboardState.isRunning = false;
        dashboardState.currentExecution = null;
        
        io.emit('execution_completed', dashboardState.executionHistory[dashboardState.executionHistory.length - 1]);
        
    } catch (error) {
        dashboardState.isRunning = false;
        dashboardState.currentExecution = null;
        
        io.emit('execution_error', { error: error.message });
    }
}

// Execute slice via 1inch Aggregator
async function executeAggregatorSlice(fromToken, toToken, amount, wallet) {
    try {
        const axios = require('axios');
        const headers = { 'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}` };
        
        // Get swap transaction
        const swapUrl = `https://api.1inch.dev/swap/v6.0/137/swap?src=${fromToken}&dst=${toToken}&amount=${amount.toString()}&from=${wallet.address}&slippage=1`;
        const swapResponse = await axios.get(swapUrl, { headers });
        
        const txData = swapResponse.data.tx;
        
        // Execute swap
        const swapTx = await wallet.sendTransaction({
            to: txData.to,
            data: txData.data,
            value: txData.value,
            gasLimit: txData.gas
        });
        
        const receipt = await swapTx.wait();
        
        return {
            success: receipt.status === 1,
            hash: swapTx.hash,
            protocol: '1inch Aggregator'
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            protocol: '1inch Aggregator'
        };
    }
}

// Create limit order slice
async function createLimitOrderSlice(fromToken, toToken, amount, wallet) {
    try {
        // Create limit order (demonstration)
        const orderHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'address', 'uint256', 'uint256'],
                [fromToken, toToken, amount, amount * BigInt(5)]
            )
        );
        
        return {
            success: true,
            orderHash: orderHash,
            protocol: '1inch Limit Order Protocol'
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            protocol: '1inch Limit Order Protocol'
        };
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('📱 Dashboard client connected');
    
    // Send current state to new client
    socket.emit('dashboard_state', dashboardState);
    
    socket.on('request_balance_update', async () => {
        await updateBalances();
    });
    
    socket.on('disconnect', () => {
        console.log('📱 Dashboard client disconnected');
    });
});

// Initialize and start server
async function startServer() {
    await initializeWallets();
    
    const PORT = process.env.PORT || 3001;
    
    server.listen(PORT, () => {
        console.log('🚀 1INCH ECOSYSTEM TWAP DASHBOARD STARTED');
        console.log('');
        console.log(`📊 Dashboard: http://localhost:${PORT}`);
        console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
        console.log('');
        console.log('🎯 Features:');
        console.log('   ✅ Real-time TWAP execution');
        console.log('   ✅ Live balance monitoring');
        console.log('   ✅ Multi-protocol integration');
        console.log('   ✅ Order management');
        console.log('   ✅ Execution statistics');
        console.log('');
        console.log('🏦 Wallets:');
        console.log('   Maker:', dashboardState.walletInfo.maker);
        console.log('   Taker:', dashboardState.walletInfo.taker);
    });
}

// Periodic balance updates
setInterval(updateBalances, 30000); // Update every 30 seconds

startServer().catch(console.error);
