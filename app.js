#!/usr/bin/env node

/**
 * FEAWS Treasury Management System
 * Production-ready treasury automation with real 1inch integration
 */

require('dotenv').config();
const { TreasuryManager } = require('./keeper/treasury-manager');
const { YieldStrategyManager } = require('./keeper/yield-strategy-manager');
const { OneInchAutomatedTreasury } = require('./keeper/oneinch-automated-treasury');
const { Real1inchLimitOrders } = require('./keeper/real-1inch-limit-orders');
const express = require('express');
const path = require('path');

class FEAWSApp {
    constructor() {
        // Initialize managers
        const treasuryManager = new TreasuryManager();
        const yieldManager = new YieldStrategyManager();
        const oneInchTreasury = new OneInchAutomatedTreasury();
        this.treasuryManager = treasuryManager;
        this.yieldManager = yieldManager;
        this.oneInchTreasury = oneInchTreasury;
        this.app = express();
        this.port = process.env.PORT || 3000;
        
        this.setupExpress();
        this.setupRoutes();
    }
    
    setupExpress() {
        this.app.use(express.static(path.join(__dirname, 'frontend')));
        this.app.use(express.json());
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'operational',
                timestamp: new Date().toISOString(),
                wallet: this.treasuryManager.wallet.address
            });
        });
        
        // Treasury status
        this.app.get('/api/treasury', async (req, res) => {
            try {
                const balances = await this.treasuryManager.getBalances();
                res.json({
                    wallet: this.treasuryManager.wallet.address,
                    balances,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Execute TWAP strategy
        this.app.post('/api/twap', async (req, res) => {
            try {
                const { fromToken, toToken, amount, tranches, interval } = req.body;
                const result = await this.yieldManager.executeTWAPWithYield(
                    fromToken, toToken, amount, tranches, interval, 5.0
                );
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Get yield opportunities
        this.app.get('/api/yield', async (req, res) => {
            try {
                const opportunities = await this.yieldManager.calculateYieldOpportunities();
                res.json(opportunities);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Execute yield strategy
        this.app.post('/api/yield/execute', async (req, res) => {
            try {
                const { strategy, amount } = req.body;
                const result = await this.yieldManager.executeYieldFarming(strategy, amount);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // 1inch Automated Treasury Endpoints
        this.app.post('/api/treasury/start-automated', async (req, res) => {
            try {
                await this.oneInchTreasury.startAutomatedScanning();
                res.json({ success: true, message: 'Automated scanning started' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        this.app.post('/api/treasury/stop-automated', async (req, res) => {
            try {
                this.oneInchTreasury.isRunning = false;
                res.json({ success: true, message: 'Automated scanning stopped' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        this.app.post('/api/treasury/single-scan', async (req, res) => {
            try {
                await this.oneInchTreasury.scanOpportunities();
                res.json({ success: true, message: 'Single scan completed' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        this.app.get('/api/treasury/status', async (req, res) => {
            try {
                const status = await this.oneInchTreasury.getStatus();
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Create real 1inch limit order
        this.app.post('/api/limit-order/create', async (req, res) => {
            try {
                const { fromToken, toToken, makingAmount, takingAmount, duration } = req.body;
                
                const orderSystem = new Real1inchLimitOrders();
                const result = await orderSystem.createLimitOrder(
                    fromToken, 
                    toToken, 
                    makingAmount, 
                    takingAmount, 
                    duration
                );
                
                res.json({
                    success: true,
                    result
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });
    }
    
    async start() {
        console.log('🎯 FEAWS Treasury Management System');
        console.log('===================================');
        
        // Initialize treasury
        console.log('📍 Initializing treasury...');
        const balances = await this.treasuryManager.getBalances();
        console.log(`💰 Treasury loaded: ${balances.USDC.balance} USDC, ${balances.WMATIC.balance} WMATIC`);
        
        // Start web server
        this.app.listen(this.port, () => {
            console.log(`🌐 Dashboard running at http://localhost:${this.port}`);
            console.log(`📊 API endpoints available at http://localhost:${this.port}/api/`);
            console.log(`💎 Wallet: ${this.treasuryManager.wallet.address}`);
            console.log('✅ System operational');
        });
        
        // Start periodic updates
        this.startPeriodicUpdates();
    }
    
    startPeriodicUpdates() {
        // Update treasury data every 30 seconds
        setInterval(async () => {
            try {
                const balances = await this.treasuryManager.getBalances();
                const opportunities = await this.yieldManager.calculateYieldOpportunities();
                
                // Save to files for frontend
                require('fs').writeFileSync(
                    path.join(__dirname, 'frontend/treasury-status.json'),
                    JSON.stringify({
                        wallet: this.treasuryManager.wallet.address,
                        balances,
                        timestamp: new Date().toISOString()
                    }, null, 2)
                );
                
                require('fs').writeFileSync(
                    path.join(__dirname, 'frontend/yield-opportunities.json'),
                    JSON.stringify(opportunities, null, 2)
                );
                
            } catch (error) {
                console.error('❌ Update failed:', error.message);
            }
        }, 30000);
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            new FEAWSApp().start();
            break;
            
        case 'status':
            (async () => {
                const treasury = new TreasuryManager();
                const balances = await treasury.getBalances();
                console.log('📊 Treasury Status:');
                console.log(`💰 USDC: ${balances.USDC.balance}`);
                console.log(`💰 WMATIC: ${balances.WMATIC.balance}`);
                console.log(`📍 Wallet: ${treasury.wallet.address}`);
            })();
            break;
            
        case 'twap':
            (async () => {
                const yieldManager = new YieldStrategyManager();
                const result = await yieldManager.executeTWAPWithYield('USDC', 'WMATIC', 2, 3, 2, 5.0);
                console.log('🎯 TWAP Result:', result);
            })();
            break;
            
        case 'yield':
            (async () => {
                const yieldManager = new YieldStrategyManager();
                const opportunities = await yieldManager.calculateYieldOpportunities();
                console.log('💰 Yield Opportunities:', opportunities);
            })();
            break;
            
        case 'limit-order':
            (async () => {
                const { createVisibleRealLimitOrder } = require('./keeper/visible-real-limit-orders');
                try {
                    await createVisibleRealLimitOrder();
                } catch (error) {
                    console.error('❌ Limit order creation failed:', error.message);
                    process.exit(1);
                }
            })();
            break;

        default:
            console.log('Usage: node app.js [start|status|twap|yield|limit-order]');
            console.log('  start       - Start web dashboard');
            console.log('  status      - Check treasury status');
            console.log('  twap        - Execute TWAP strategy');
            console.log('  yield       - Show yield opportunities');
            console.log('  limit-order - Create a visible real 1inch limit order');
    }
}

module.exports = { FEAWSApp };
