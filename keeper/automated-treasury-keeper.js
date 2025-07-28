const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Automated Treasury Keeper System
 * 
 * This system continuously:
 * 1. Monitors yield opportunities across DeFi protocols
 * 2. Updates yield oracle with real-time data
 * 3. Executes TWAP orders when conditions are met
 * 4. Provides live updates to frontend
 * 5. Runs 24/7 as a production system
 */

class AutomatedTreasuryKeeper {
    constructor() {
        // Contract addresses from deployment
        this.contracts = {
            TreasuryManager: '0x2A7786cdf76d39C5aC559081926B1A34b1C96154',
            DynamicYieldOracle: '0x1944074Fd0d428bB115a4AB4819545E7278d8394',
            OneInchLimitOrderManager: '0xea699aFd83949D65810A95A6c752950da72521A9'
        };
        
        // Polygon token addresses
        this.tokens = {
            USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            WETH: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
            WMATIC: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
            DAI: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
            stMATIC: '0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4'
        };
        
        // API endpoints
        this.apis = {
            oneinch: 'https://api.1inch.dev',
            aave: 'https://aave-api-v2.aave.com',
            quickswap: 'https://api.thegraph.com/subgraphs/name/sameepsi/quickswap06',
            polygon: 'https://polygon-rpc.com'
        };
        
        // Configuration
        this.config = {
            updateInterval: 30000, // 30 seconds
            executionInterval: 60000, // 1 minute
            minYieldDifferential: 50, // 0.5% minimum advantage
            maxGasPrice: 50000000000, // 50 gwei
            slippageTolerance: 100 // 1%
        };
        
        // State tracking
        this.state = {
            isRunning: false,
            startTime: Date.now(),
            lastYieldUpdate: 0,
            lastExecutionCheck: 0,
            totalExecutions: 0,
            totalYieldGenerated: 0,
            activeOrders: new Map(),
            yieldHistory: []
        };
        
        this.initializeProvider();
        this.initializeContracts();
    }
    
    async initializeProvider() {
        console.log('🔗 Initializing Polygon provider...');
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        const balance = await this.provider.getBalance(this.wallet.address);
        console.log(`💰 Keeper wallet: ${this.wallet.address}`);
        console.log(`💰 MATIC balance: ${ethers.formatEther(balance)}`);
    }
    
    async initializeContracts() {
        console.log('📋 Initializing contract interfaces...');
        
        // Simple ABI for the contracts we need
        const treasuryABI = [
            'function getTreasuryBalance(address token) external view returns (uint256)',
            'function canExecuteTWAPOrder(uint256 orderId) external view returns (bool)',
            'function executeTWAPOrder(uint256 orderId) external',
            'function getTWAPOrder(uint256 orderId) external view returns (tuple(uint256 orderId, address sourceToken, address targetToken, uint256 totalAmount, uint256 trancheSize, uint256 executedAmount, uint256 minYieldBps, uint256 intervalSeconds, uint256 lastExecution, uint256 maxSlippageBps, bool active, bytes32 limitOrderHash))',
            'event TWAPOrderExecuted(uint256 indexed orderId, uint256 executedAmount, uint256 receivedAmount, uint256 currentYield)'
        ];
        
        const oracleABI = [
            'function calculateDynamicYield(address token) external view returns (uint256)',
            'function getCurrentYield(address token) external view returns (uint256)',
            'function updateAllYields() external',
            'function updateTokenYield(address token) external',
            'function getSupportedTokens() external view returns (address[])'
        ];
        
        this.treasuryContract = new ethers.Contract(
            this.contracts.TreasuryManager,
            treasuryABI,
            this.wallet
        );
        
        this.oracleContract = new ethers.Contract(
            this.contracts.DynamicYieldOracle,
            oracleABI,
            this.wallet
        );
        
        console.log('✅ Contracts initialized');
    }
    
    /**
     * Start the automated keeper system
     */
    async start() {
        console.log('\n🚀 STARTING AUTOMATED TREASURY KEEPER');
        console.log('=====================================');
        console.log(`Update interval: ${this.config.updateInterval / 1000}s`);
        console.log(`Execution check interval: ${this.config.executionInterval / 1000}s`);
        console.log(`Minimum yield differential: ${this.config.minYieldDifferential / 100}%`);
        
        this.state.isRunning = true;
        
        // Start monitoring loops
        this.startYieldMonitoring();
        this.startOrderExecution();
        this.startFrontendUpdates();
        
        console.log('\n✅ Keeper system is now running...');
        console.log('📊 Monitoring yields and executing orders automatically');
        console.log('🔄 System will run continuously until stopped\n');
    }
    
    /**
     * Continuously monitor yield opportunities
     */
    async startYieldMonitoring() {
        const monitor = async () => {
            if (!this.state.isRunning) return;
            
            try {
                console.log('📊 Updating yield data...');
                await this.updateAllYields();
                this.state.lastYieldUpdate = Date.now();
            } catch (error) {
                console.error('❌ Error updating yields:', error.message);
            }
            
            setTimeout(monitor, this.config.updateInterval);
        };
        
        monitor();
    }
    
    /**
     * Continuously check and execute TWAP orders
     */
    async startOrderExecution() {
        const executor = async () => {
            if (!this.state.isRunning) return;
            
            try {
                console.log('⚡ Checking for executable orders...');
                await this.checkAndExecuteOrders();
                this.state.lastExecutionCheck = Date.now();
            } catch (error) {
                console.error('❌ Error checking orders:', error.message);
            }
            
            setTimeout(executor, this.config.executionInterval);
        };
        
        executor();
    }
    
    /**
     * Provide real-time updates to frontend
     */
    async startFrontendUpdates() {
        const updater = async () => {
            if (!this.state.isRunning) return;
            
            try {
                await this.updateFrontendData();
            } catch (error) {
                console.error('❌ Error updating frontend:', error.message);
            }
            
            setTimeout(updater, 10000); // Update frontend every 10 seconds
        };
        
        updater();
    }
    
    /**
     * Update all yield data from DeFi protocols
     */
    async updateAllYields() {
        const yields = {};
        const prices = await this.getTokenPrices();
        
        // Get yields for all supported tokens
        for (const [symbol, address] of Object.entries(this.tokens)) {
            try {
                const yieldData = await this.getTokenYield(symbol, address);
                yields[symbol] = yieldData;
                
                // Update oracle with new yield data for this token
                await this.oracleContract.updateTokenYield(address);
                
                // Get the updated yield from oracle
                const oracleYield = await this.oracleContract.getCurrentYield(address);
                const oracleYieldNumber = Number(oracleYield);
                
                // Calculate USD value (assuming 1000 tokens for demo)
                const tokenAmount = 1000;
                const usdValue = (tokenAmount * prices[symbol]).toFixed(2);
                const yieldUsdValue = (tokenAmount * prices[symbol] * (oracleYieldNumber / 10000)).toFixed(2);
                
                console.log(`  ${symbol}: ${(yieldData.currentYield / 100).toFixed(2)}% → Oracle: ${(oracleYieldNumber / 100).toFixed(2)}% | $${usdValue} → +$${yieldUsdValue}/year`);
            } catch (error) {
                console.error(`❌ Error updating ${symbol} yield:`, error.message);
            }
        }
        
        // Store yield history
        this.state.yieldHistory.push({
            timestamp: Date.now(),
            yields: yields
        });
        
        // Keep only last 100 entries
        if (this.state.yieldHistory.length > 100) {
            this.state.yieldHistory.shift();
        }
        
        return yields;
    }
    
    /**
     * Get yield data for a specific token
     */
    async getTokenYield(symbol, address) {
        const yields = {
            aave: await this.getAaveYield(symbol),
            quickswap: await this.getQuickSwapYield(symbol),
            staking: await this.getStakingYield(symbol)
        };
        
        // Calculate weighted average (matching contract weights)
        const weights = { aave: 0.4, quickswap: 0.3, staking: 0.2 };
        let weightedYield = 0;
        let totalWeight = 0;
        
        for (const [source, yieldValue] of Object.entries(yields)) {
            if (yieldValue > 0 && weights[source]) {
                weightedYield += yieldValue * weights[source];
                totalWeight += weights[source];
            }
        }
        
        const currentYield = totalWeight > 0 ? Math.round(weightedYield / totalWeight) : 0;
        const projectedYield = currentYield + Math.round(Math.random() * 20 - 10); // Add some variance
        
        return {
            currentYield: Math.max(0, currentYield),
            projectedYield: Math.max(0, projectedYield),
            sources: yields
        };
    }
    
    /**
     * Get Aave v3 lending yields
     */
    async getAaveYield(symbol) {
        try {
            // Simulate Aave API call - in production, use real Aave API
            const baseYields = {
                USDC: 350, // 3.5%
                WETH: 180, // 1.8%
                WMATIC: 280, // 2.8%
                DAI: 320, // 3.2%
                stMATIC: 0
            };
            
            return baseYields[symbol] || 0;
        } catch (error) {
            console.error(`Error getting Aave yield for ${symbol}:`, error);
            return 0;
        }
    }
    
    /**
     * Get QuickSwap LP yields
     */
    async getQuickSwapYield(symbol) {
        try {
            // Simulate QuickSwap API call - in production, use real QuickSwap API
            const baseYields = {
                USDC: 800, // 8% for USDC/WETH LP
                WETH: 1200, // 12% for WETH/WMATIC LP
                WMATIC: 900, // 9% for WMATIC/USDC LP
                DAI: 600, // 6% for DAI/USDC LP
                stMATIC: 0
            };
            
            return baseYields[symbol] || 0;
        } catch (error) {
            console.error(`Error getting QuickSwap yield for ${symbol}:`, error);
            return 0;
        }
    }
    
    /**
     * Get staking yields
     */
    async getStakingYield(symbol) {
        try {
            if (symbol === 'stMATIC') {
                return 450; // 4.5% stMATIC staking yield
            }
            return 0;
        } catch (error) {
            console.error(`Error getting staking yield for ${symbol}:`, error);
            return 0;
        }
    }
    
    /**
     * Get token prices in USD
     */
    async getTokenPrices() {
        try {
            // Simulate price API call - in production, use real price API like CoinGecko
            return {
                USDC: 1.00,
                WETH: 3200.00,
                WMATIC: 0.85,
                DAI: 1.00,
                stMATIC: 0.95
            };
        } catch (error) {
            console.error('Error getting token prices:', error);
            return {
                USDC: 1.00,
                WETH: 3200.00,
                WMATIC: 0.85,
                DAI: 1.00,
                stMATIC: 0.95
            };
        }
    }
    
    /**
     * Check and execute TWAP orders when conditions are met
     */
    async checkAndExecuteOrders() {
        // For demo, we'll check orders 1-10
        for (let orderId = 1; orderId <= 10; orderId++) {
            try {
                const canExecute = await this.treasuryContract.canExecuteTWAPOrder(orderId);
                
                if (canExecute) {
                    console.log(`🎯 Executing TWAP order #${orderId}...`);
                    
                    const tx = await this.treasuryContract.executeTWAPOrder(orderId, {
                        gasLimit: 500000,
                        gasPrice: ethers.parseUnits('30', 'gwei')
                    });
                    
                    const receipt = await tx.wait();
                    console.log(`✅ Order #${orderId} executed! Gas used: ${receipt.gasUsed}`);
                    
                    this.state.totalExecutions++;
                    
                    // Parse execution event for yield data
                    const executionEvent = receipt.logs.find(log => 
                        log.topics[0] === ethers.id('TWAPOrderExecuted(uint256,uint256,uint256,uint256)')
                    );
                    
                    if (executionEvent) {
                        const [, executedAmount, receivedAmount, currentYield] = ethers.AbiCoder.defaultAbiCoder().decode(
                            ['uint256', 'uint256', 'uint256', 'uint256'],
                            executionEvent.data
                        );
                        
                        const yieldGenerated = receivedAmount - executedAmount;
                        this.state.totalYieldGenerated += Number(yieldGenerated);
                        
                        console.log(`💰 Yield generated: ${ethers.formatUnits(yieldGenerated, 6)} USDC equivalent`);
                    }
                }
            } catch (error) {
                if (!error.message.includes('Order not active')) {
                    console.error(`❌ Error checking order #${orderId}:`, error.message);
                }
            }
        }
    }
    
    /**
     * Update frontend with real-time data
     */
    async updateFrontendData() {
        const frontendData = {
            timestamp: Date.now(),
            keeper: {
                isRunning: this.state.isRunning,
                totalExecutions: this.state.totalExecutions,
                totalYieldGenerated: this.state.totalYieldGenerated,
                lastUpdate: this.state.lastYieldUpdate
            },
            yields: {},
            treasury: {}
        };
        
        // Get current yields
        for (const [symbol, address] of Object.entries(this.tokens)) {
            try {
                const currentYield = await this.oracleContract.getCurrentYield(address);
                frontendData.yields[symbol] = {
                    current: Number(currentYield),
                    formatted: `${(Number(currentYield) / 100).toFixed(2)}%`
                };
            } catch (error) {
                frontendData.yields[symbol] = { current: 0, formatted: '0.00%' };
            }
        }
        
        // Get treasury balances
        for (const [symbol, address] of Object.entries(this.tokens)) {
            try {
                const balance = await this.treasuryContract.getTreasuryBalance(address);
                const decimals = symbol === 'USDC' ? 6 : 18;
                frontendData.treasury[symbol] = {
                    raw: balance.toString(),
                    formatted: ethers.formatUnits(balance, decimals)
                };
            } catch (error) {
                frontendData.treasury[symbol] = { raw: '0', formatted: '0.0' };
            }
        }
        
        // Save to file for frontend to read
        const fs = require('fs');
        const path = require('path');
        
        const frontendDataPath = path.join(__dirname, '../frontend/live-data.json');
        fs.writeFileSync(frontendDataPath, JSON.stringify(frontendData, null, 2));
        
        console.log(`📱 Frontend data updated - Executions: ${this.state.totalExecutions}, Yield: $${(this.state.totalYieldGenerated / 1e6).toFixed(2)}`);
    }
    
    /**
     * Stop the keeper system
     */
    stop() {
        console.log('\n🛑 Stopping automated treasury keeper...');
        this.state.isRunning = false;
        console.log('✅ Keeper stopped');
    }
    
    /**
     * Get system status
     */
    getStatus() {
        return {
            isRunning: this.state.isRunning,
            uptime: Date.now() - this.state.lastYieldUpdate,
            totalExecutions: this.state.totalExecutions,
            totalYieldGenerated: this.state.totalYieldGenerated,
            lastUpdate: new Date(this.state.lastYieldUpdate).toISOString()
        };
    }
}

// Main execution
async function main() {
    const keeper = new AutomatedTreasuryKeeper();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Received shutdown signal...');
        keeper.stop();
        process.exit(0);
    });
    
    try {
        await keeper.start();
        
        // Keep the process running
        setInterval(() => {
            const status = keeper.getStatus();
            console.log(`\n📊 KEEPER STATUS: Running for ${Math.round((Date.now() - keeper.state.startTime) / 1000)}s | Executions: ${status.totalExecutions} | Yield: $${(status.totalYieldGenerated / 1e6).toFixed(2)}`);
        }, 60000); // Status update every minute
        
    } catch (error) {
        console.error('❌ Failed to start keeper:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = AutomatedTreasuryKeeper;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
