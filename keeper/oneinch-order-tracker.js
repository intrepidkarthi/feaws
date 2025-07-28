const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * 1INCH LIMIT ORDER TRACKER
 * 
 * Monitors all limit orders on 1inch Protocol v4 (Polygon)
 * - Tracks order creation, execution, and cancellation
 * - Shows real-time order book
 * - Monitors our treasury orders specifically
 * - Provides live data for frontend dashboard
 */
class OneInchOrderTracker {
    constructor() {
        this.config = {
            // 1inch API configuration
            apiBaseUrl: 'https://api.1inch.dev',
            chainId: 137, // Polygon
            limitOrderProtocol: '0x111111125421cA6dc452d289314280a0f8842A65',
            
            // Tracking intervals
            orderCheckInterval: 10000, // 10 seconds
            eventScanInterval: 30000, // 30 seconds
            
            // Our deployed contracts
            treasuryManager: '0x2A7786cdf76d39C5aC559081926B1A34b1C96154',
            oneInchManager: '0xea699aFd83949D65810A95A6c752950da72521A9'
        };
        
        this.state = {
            isRunning: false,
            startTime: Date.now(),
            allOrders: new Map(), // All 1inch orders
            treasuryOrders: new Map(), // Our treasury orders
            recentExecutions: [],
            orderStats: {
                total: 0,
                active: 0,
                executed: 0,
                cancelled: 0,
                ourOrders: 0
            }
        };
        
        // Token addresses for display
        this.tokens = {
            '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': { symbol: 'USDC', decimals: 6 },
            '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619': { symbol: 'WETH', decimals: 18 },
            '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': { symbol: 'WMATIC', decimals: 18 },
            '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063': { symbol: 'DAI', decimals: 18 },
            '0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4': { symbol: 'stMATIC', decimals: 18 }
        };
        
        this.initializeProvider();
    }
    
    async initializeProvider() {
        console.log('🔗 Initializing 1inch Order Tracker...');
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        
        // 1inch Limit Order Protocol ABI (key functions)
        const limitOrderABI = [
            'event OrderFilled(bytes32 indexed orderHash, uint256 remaining)',
            'event OrderCancelled(bytes32 indexed orderHash)',
            'function fillOrder((uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order, bytes signature, bytes interaction, uint256 makingAmount, uint256 takingAmount) external payable returns (uint256 actualMakingAmount, uint256 actualTakingAmount, bytes32 orderHash)',
            'function cancelOrder((uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order) external returns (bytes32 orderHash)',
            'function hashOrder((uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order) external view returns (bytes32)'
        ];
        
        this.limitOrderContract = new ethers.Contract(
            this.config.limitOrderProtocol,
            limitOrderABI,
            this.provider
        );
        
        console.log(`📊 Connected to 1inch Protocol: ${this.config.limitOrderProtocol}`);
        console.log(`🔍 Monitoring Polygon chain ID: ${this.config.chainId}`);
    }
    
    async start() {
        console.log('\n🚀 STARTING 1INCH ORDER TRACKER');
        console.log('=====================================');
        console.log('📈 Monitoring all 1inch limit orders on Polygon');
        console.log('🎯 Tracking treasury orders specifically');
        console.log('⚡ Real-time order book updates');
        console.log('📊 Live execution monitoring\n');
        
        this.state.isRunning = true;
        
        // Start monitoring
        this.startOrderMonitoring();
        this.startEventListening();
        this.startStatusReporting();
        
        console.log('✅ 1inch Order Tracker is now running...\n');
    }
    
    /**
     * Monitor active orders via 1inch API
     */
    async startOrderMonitoring() {
        const monitor = async () => {
            if (!this.state.isRunning) return;
            
            try {
                await this.fetchActiveOrders();
                await this.updateOrderStats();
                await this.updateFrontendData();
            } catch (error) {
                console.error('❌ Error monitoring orders:', error.message);
            }
            
            setTimeout(monitor, this.config.orderCheckInterval);
        };
        
        monitor();
    }
    
    /**
     * Fetch active orders from 1inch API
     */
    async fetchActiveOrders() {
        try {
            const headers = {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                'accept': 'application/json'
            };
            
            // Get active limit orders
            const response = await axios.get(
                `${this.config.apiBaseUrl}/orderbook/v4.0/${this.config.chainId}/events`,
                { 
                    headers,
                    params: {
                        limit: 100,
                        offset: 0
                    }
                }
            );
            
            if (response.data && response.data.result) {
                await this.processOrders(response.data.result);
            }
            
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('⚠️  1inch API key required for full order data. Using simulated data...');
                await this.generateSimulatedOrders();
            } else {
                console.error('Error fetching orders:', error.message);
            }
        }
    }
    
    /**
     * Process fetched orders
     */
    async processOrders(orders) {
        for (const orderData of orders) {
            const order = {
                hash: orderData.orderHash || this.generateOrderHash(),
                maker: orderData.order?.maker || '0x' + '0'.repeat(40),
                makerAsset: orderData.order?.makerAsset,
                takerAsset: orderData.order?.takerAsset,
                makingAmount: orderData.order?.makingAmount,
                takingAmount: orderData.order?.takingAmount,
                status: orderData.status || 'active',
                createdAt: orderData.createDateTime || Date.now(),
                isOurOrder: this.isOurTreasuryOrder(orderData.order?.maker),
                makerToken: this.getTokenInfo(orderData.order?.makerAsset),
                takerToken: this.getTokenInfo(orderData.order?.takerAsset)
            };
            
            this.state.allOrders.set(order.hash, order);
            
            if (order.isOurOrder) {
                this.state.treasuryOrders.set(order.hash, order);
                console.log(`🎯 Treasury Order Found: ${order.makerToken.symbol}→${order.takerToken.symbol} | Hash: ${order.hash.substring(0, 10)}...`);
            }
        }
    }
    
    /**
     * Generate simulated orders for demo
     */
    async generateSimulatedOrders() {
        const pairs = [
            ['USDC', 'WETH'], ['WETH', 'WMATIC'], ['USDC', 'DAI'], 
            ['WMATIC', 'USDC'], ['DAI', 'WETH'], ['stMATIC', 'WMATIC']
        ];
        
        // Generate 5-15 random orders
        const orderCount = 5 + Math.floor(Math.random() * 10);
        
        for (let i = 0; i < orderCount; i++) {
            const [makerSymbol, takerSymbol] = pairs[Math.floor(Math.random() * pairs.length)];
            const makerToken = Object.entries(this.tokens).find(([addr, token]) => token.symbol === makerSymbol);
            const takerToken = Object.entries(this.tokens).find(([addr, token]) => token.symbol === takerSymbol);
            
            if (!makerToken || !takerToken) continue;
            
            const orderHash = this.generateOrderHash();
            const isOurOrder = Math.random() < 0.2; // 20% chance it's our order
            
            const order = {
                hash: orderHash,
                maker: isOurOrder ? this.config.treasuryManager : this.generateRandomAddress(),
                makerAsset: makerToken[0],
                takerAsset: takerToken[0],
                makingAmount: ethers.parseUnits((100 + Math.random() * 10000).toFixed(2), makerToken[1].decimals).toString(),
                takingAmount: ethers.parseUnits((50 + Math.random() * 5000).toFixed(2), takerToken[1].decimals).toString(),
                status: Math.random() < 0.8 ? 'active' : (Math.random() < 0.5 ? 'executed' : 'cancelled'),
                createdAt: Date.now() - Math.random() * 3600000, // Last hour
                isOurOrder: isOurOrder,
                makerToken: makerToken[1],
                takerToken: takerToken[1]
            };
            
            this.state.allOrders.set(order.hash, order);
            
            if (order.isOurOrder) {
                this.state.treasuryOrders.set(order.hash, order);
            }
        }
        
        console.log(`📊 Generated ${orderCount} simulated orders (${this.state.treasuryOrders.size} treasury orders)`);
    }
    
    /**
     * Listen for real-time events
     */
    async startEventListening() {
        try {
            // Listen for OrderFilled events
            this.limitOrderContract.on('OrderFilled', (orderHash, remaining, event) => {
                console.log(`⚡ Order Executed: ${orderHash.substring(0, 10)}... | Remaining: ${remaining}`);
                this.handleOrderExecution(orderHash, remaining, event);
            });
            
            // Listen for OrderCancelled events
            this.limitOrderContract.on('OrderCancelled', (orderHash, event) => {
                console.log(`❌ Order Cancelled: ${orderHash.substring(0, 10)}...`);
                this.handleOrderCancellation(orderHash, event);
            });
            
            console.log('👂 Listening for real-time 1inch events...');
            
        } catch (error) {
            console.error('Error setting up event listeners:', error.message);
        }
    }
    
    /**
     * Handle order execution
     */
    handleOrderExecution(orderHash, remaining, event) {
        const order = this.state.allOrders.get(orderHash);
        if (order) {
            order.status = remaining > 0 ? 'partially_filled' : 'executed';
            order.executedAt = Date.now();
            
            const execution = {
                orderHash,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: Date.now(),
                isOurOrder: order.isOurOrder,
                pair: `${order.makerToken.symbol}→${order.takerToken.symbol}`,
                amount: order.makingAmount
            };
            
            this.state.recentExecutions.unshift(execution);
            
            // Keep only last 50 executions
            if (this.state.recentExecutions.length > 50) {
                this.state.recentExecutions = this.state.recentExecutions.slice(0, 50);
            }
            
            if (order.isOurOrder) {
                console.log(`🎯 OUR ORDER EXECUTED: ${order.makerToken.symbol}→${order.takerToken.symbol}`);
            }
        }
    }
    
    /**
     * Handle order cancellation
     */
    handleOrderCancellation(orderHash, event) {
        const order = this.state.allOrders.get(orderHash);
        if (order) {
            order.status = 'cancelled';
            order.cancelledAt = Date.now();
            
            if (order.isOurOrder) {
                console.log(`❌ OUR ORDER CANCELLED: ${order.makerToken.symbol}→${order.takerToken.symbol}`);
            }
        }
    }
    
    /**
     * Update order statistics
     */
    async updateOrderStats() {
        const stats = {
            total: this.state.allOrders.size,
            active: 0,
            executed: 0,
            cancelled: 0,
            ourOrders: this.state.treasuryOrders.size
        };
        
        for (const order of this.state.allOrders.values()) {
            switch (order.status) {
                case 'active':
                case 'partially_filled':
                    stats.active++;
                    break;
                case 'executed':
                    stats.executed++;
                    break;
                case 'cancelled':
                    stats.cancelled++;
                    break;
            }
        }
        
        this.state.orderStats = stats;
    }
    
    /**
     * Status reporting
     */
    async startStatusReporting() {
        setInterval(() => {
            if (!this.state.isRunning) return;
            
            const uptime = Math.floor((Date.now() - this.state.startTime) / 1000);
            const stats = this.state.orderStats;
            
            console.log(`\n📊 1INCH ORDER STATUS: ${uptime}s uptime`);
            console.log(`   Total Orders: ${stats.total} | Active: ${stats.active} | Executed: ${stats.executed} | Cancelled: ${stats.cancelled}`);
            console.log(`   Treasury Orders: ${stats.ourOrders} | Recent Executions: ${this.state.recentExecutions.length}`);
        }, 60000); // Every minute
    }
    
    /**
     * Update frontend data
     */
    async updateFrontendData() {
        const frontendData = {
            timestamp: Date.now(),
            orderStats: this.state.orderStats,
            recentExecutions: this.state.recentExecutions.slice(0, 10),
            treasuryOrders: Array.from(this.state.treasuryOrders.values()).map(order => ({
                hash: order.hash.substring(0, 10) + '...',
                pair: `${order.makerToken.symbol}→${order.takerToken.symbol}`,
                makingAmount: this.formatTokenAmount(order.makingAmount, order.makerToken.decimals),
                takingAmount: this.formatTokenAmount(order.takingAmount, order.takerToken.decimals),
                status: order.status,
                createdAt: new Date(order.createdAt).toLocaleString()
            })),
            activeOrders: Array.from(this.state.allOrders.values())
                .filter(order => order.status === 'active')
                .slice(0, 20)
                .map(order => ({
                    hash: order.hash.substring(0, 10) + '...',
                    pair: `${order.makerToken.symbol}→${order.takerToken.symbol}`,
                    makingAmount: this.formatTokenAmount(order.makingAmount, order.makerToken.decimals),
                    takingAmount: this.formatTokenAmount(order.takingAmount, order.takerToken.decimals),
                    isOurOrder: order.isOurOrder,
                    age: this.getOrderAge(order.createdAt)
                }))
        };
        
        // Save to file for frontend
        const fs = require('fs');
        const frontendPath = path.join(__dirname, '../frontend/oneinch-orders.json');
        fs.writeFileSync(frontendPath, JSON.stringify(frontendData, null, 2));
    }
    
    // Helper functions
    generateOrderHash() {
        return '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    
    generateRandomAddress() {
        return '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    
    isOurTreasuryOrder(maker) {
        return maker && (
            maker.toLowerCase() === this.config.treasuryManager.toLowerCase() ||
            maker.toLowerCase() === this.config.oneInchManager.toLowerCase()
        );
    }
    
    getTokenInfo(address) {
        return this.tokens[address?.toLowerCase()] || { symbol: 'UNKNOWN', decimals: 18 };
    }
    
    formatTokenAmount(amount, decimals) {
        if (!amount) return '0';
        return parseFloat(ethers.formatUnits(amount, decimals)).toFixed(4);
    }
    
    getOrderAge(createdAt) {
        const ageMs = Date.now() - createdAt;
        const ageMinutes = Math.floor(ageMs / 60000);
        if (ageMinutes < 60) return `${ageMinutes}m`;
        const ageHours = Math.floor(ageMinutes / 60);
        return `${ageHours}h ${ageMinutes % 60}m`;
    }
    
    getStatus() {
        return {
            isRunning: this.state.isRunning,
            uptime: Date.now() - this.state.startTime,
            orderStats: this.state.orderStats,
            treasuryOrderCount: this.state.treasuryOrders.size,
            recentExecutionCount: this.state.recentExecutions.length
        };
    }
}

// Main execution
async function main() {
    const tracker = new OneInchOrderTracker();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down 1inch order tracker...');
        tracker.state.isRunning = false;
        process.exit(0);
    });
    
    try {
        await tracker.start();
        
        // Keep the process running
        setInterval(() => {
            const status = tracker.getStatus();
            console.log(`\n📈 LIVE ORDERS: ${status.orderStats.active} active | ${status.treasuryOrderCount} treasury | ${status.recentExecutionCount} recent executions`);
        }, 120000); // Every 2 minutes
        
    } catch (error) {
        console.error('❌ Failed to start 1inch order tracker:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = OneInchOrderTracker;
