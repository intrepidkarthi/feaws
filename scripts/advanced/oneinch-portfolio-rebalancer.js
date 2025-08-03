/**
 * @fileoverview Advanced Portfolio Rebalancer using 1inch Protocol
 * @description Automated portfolio rebalancing with dynamic allocation strategies
 * @author FEAWS Development Team
 */

const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class OneInchPortfolioRebalancer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.apiUrl = 'https://api.1inch.dev/swap/v6.0/137';
        this.apiKey = process.env.ONEINCH_API_KEY;
        
        // Portfolio configuration
        this.targetAllocations = {
            'USDC': 40, // 40% stable
            'WMATIC': 35, // 35% native token
            'WETH': 20, // 20% ETH
            'DAI': 5   // 5% additional stable
        };
        
        this.tokens = {
            USDC: {
                address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
                decimals: 6,
                symbol: 'USDC'
            },
            WMATIC: {
                address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
                decimals: 18,
                symbol: 'WMATIC'
            },
            WETH: {
                address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
                decimals: 18,
                symbol: 'WETH'
            },
            DAI: {
                address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
                decimals: 18,
                symbol: 'DAI'
            }
        };
        
        // Rebalancing parameters
        this.rebalanceThreshold = 5; // 5% deviation triggers rebalance
        this.maxSlippage = 200; // 2% max slippage
        this.minTradeSize = ethers.parseUnits('1', 6); // Minimum 1 USDC equivalent
        
        // Historical data
        this.rebalanceHistory = [];
        this.priceHistory = new Map();
        this.allocationHistory = [];
        
        // Risk management
        this.riskMetrics = {
            maxDailyRebalances: 5,
            maxRebalanceSize: ethers.parseUnits('1000', 6), // 1000 USDC
            cooldownPeriod: 3600 // 1 hour between rebalances
        };
        
        this.dailyRebalanceCount = 0;
        this.lastRebalanceTime = 0;
    }

    /**
     * Analyze current portfolio and determine rebalancing needs
     */
    async analyzePortfolio() {
        console.log('📊 Analyzing portfolio allocation...');
        
        try {
            // Get current balances
            const balances = await this.getCurrentBalances();
            
            // Get current prices
            const prices = await this.getCurrentPrices();
            
            // Calculate current allocations
            const currentAllocations = this.calculateCurrentAllocations(balances, prices);
            
            // Determine rebalancing needs
            const rebalanceNeeds = this.calculateRebalanceNeeds(currentAllocations);
            
            const analysis = {
                timestamp: new Date().toISOString(),
                totalValue: this.calculateTotalValue(balances, prices),
                balances,
                prices,
                currentAllocations,
                targetAllocations: this.targetAllocations,
                rebalanceNeeds,
                needsRebalancing: this.needsRebalancing(rebalanceNeeds)
            };
            
            console.log('💰 Total Portfolio Value:', ethers.formatUnits(analysis.totalValue, 6), 'USDC');
            console.log('📈 Current Allocations:', currentAllocations);
            console.log('🎯 Rebalance Needs:', rebalanceNeeds);
            
            return analysis;
            
        } catch (error) {
            console.error('❌ Portfolio analysis failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute portfolio rebalancing
     */
    async executeRebalancing(analysis) {
        if (!analysis.needsRebalancing) {
            console.log('✅ Portfolio is already balanced');
            return { rebalanced: false, reason: 'No rebalancing needed' };
        }
        
        // Check risk limits
        if (!this.canRebalance()) {
            console.log('⚠️ Rebalancing blocked by risk limits');
            return { rebalanced: false, reason: 'Risk limits exceeded' };
        }
        
        console.log('🔄 Executing portfolio rebalancing...');
        
        try {
            const trades = this.planRebalancingTrades(analysis);
            const results = [];
            
            for (const trade of trades) {
                console.log(`🔄 Executing: ${trade.fromSymbol} → ${trade.toSymbol}`);
                console.log(`💰 Amount: ${ethers.formatUnits(trade.amount, trade.fromDecimals)}`);
                
                const result = await this.executeTrade(trade);
                results.push(result);
                
                // Small delay between trades
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Update tracking
            this.dailyRebalanceCount++;
            this.lastRebalanceTime = Date.now();
            
            // Record rebalancing
            const rebalanceRecord = {
                timestamp: new Date().toISOString(),
                beforeAllocations: analysis.currentAllocations,
                afterAllocations: await this.getCurrentAllocations(),
                trades: results,
                totalValue: analysis.totalValue
            };
            
            this.rebalanceHistory.push(rebalanceRecord);
            
            // Save execution proof
            await this.saveExecutionProof('portfolio-rebalance', rebalanceRecord);
            
            console.log('✅ Portfolio rebalancing completed');
            return { rebalanced: true, trades: results, record: rebalanceRecord };
            
        } catch (error) {
            console.error('❌ Rebalancing execution failed:', error.message);
            throw error;
        }
    }

    /**
     * Get current token balances
     */
    async getCurrentBalances() {
        const balances = {};
        
        for (const [symbol, token] of Object.entries(this.tokens)) {
            try {
                const contract = new ethers.Contract(
                    token.address,
                    ['function balanceOf(address) view returns (uint256)'],
                    this.provider
                );
                
                const balance = await contract.balanceOf(this.wallet.address);
                balances[symbol] = balance.toString();
                
            } catch (error) {
                console.error(`Error getting ${symbol} balance:`, error.message);
                balances[symbol] = '0';
            }
        }
        
        return balances;
    }

    /**
     * Get current token prices from 1inch
     */
    async getCurrentPrices() {
        const prices = {};
        const baseAmount = ethers.parseUnits('1', 18).toString();
        
        for (const [symbol, token] of Object.entries(this.tokens)) {
            if (symbol === 'USDC') {
                prices[symbol] = 1.0; // USDC is our base currency
                continue;
            }
            
            try {
                const response = await axios.get(`${this.apiUrl}/quote`, {
                    params: {
                        src: token.address,
                        dst: this.tokens.USDC.address,
                        amount: baseAmount
                    },
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                });
                
                prices[symbol] = parseFloat(ethers.formatUnits(response.data.dstAmount, 6));
                
            } catch (error) {
                console.error(`Error getting ${symbol} price:`, error.message);
                prices[symbol] = 0;
            }
        }
        
        // Store price history
        this.priceHistory.set(Date.now(), { ...prices });
        
        return prices;
    }

    /**
     * Calculate current portfolio allocations
     */
    calculateCurrentAllocations(balances, prices) {
        const totalValue = this.calculateTotalValue(balances, prices);
        const allocations = {};
        
        for (const [symbol, balance] of Object.entries(balances)) {
            const token = this.tokens[symbol];
            const balanceFormatted = parseFloat(ethers.formatUnits(balance, token.decimals));
            const value = balanceFormatted * prices[symbol];
            const allocation = totalValue > 0 ? (value / parseFloat(ethers.formatUnits(totalValue, 6))) * 100 : 0;
            
            allocations[symbol] = {
                balance: balanceFormatted,
                value: value,
                allocation: allocation
            };
        }
        
        return allocations;
    }

    /**
     * Calculate total portfolio value in USDC
     */
    calculateTotalValue(balances, prices) {
        let totalValue = 0;
        
        for (const [symbol, balance] of Object.entries(balances)) {
            const token = this.tokens[symbol];
            const balanceFormatted = parseFloat(ethers.formatUnits(balance, token.decimals));
            totalValue += balanceFormatted * prices[symbol];
        }
        
        return ethers.parseUnits(totalValue.toFixed(6), 6);
    }

    /**
     * Calculate rebalancing needs
     */
    calculateRebalanceNeeds(currentAllocations) {
        const needs = {};
        
        for (const [symbol, targetAllocation] of Object.entries(this.targetAllocations)) {
            const currentAllocation = currentAllocations[symbol]?.allocation || 0;
            const deviation = currentAllocation - targetAllocation;
            
            needs[symbol] = {
                current: currentAllocation,
                target: targetAllocation,
                deviation: deviation,
                needsAdjustment: Math.abs(deviation) > this.rebalanceThreshold
            };
        }
        
        return needs;
    }

    /**
     * Check if portfolio needs rebalancing
     */
    needsRebalancing(rebalanceNeeds) {
        return Object.values(rebalanceNeeds).some(need => need.needsAdjustment);
    }

    /**
     * Plan rebalancing trades
     */
    planRebalancingTrades(analysis) {
        const trades = [];
        const totalValue = parseFloat(ethers.formatUnits(analysis.totalValue, 6));
        
        // Identify tokens to sell (over-allocated)
        const toSell = [];
        const toBuy = [];
        
        for (const [symbol, need] of Object.entries(analysis.rebalanceNeeds)) {
            if (need.needsAdjustment) {
                const targetValue = totalValue * (need.target / 100);
                const currentValue = analysis.currentAllocations[symbol]?.value || 0;
                const difference = currentValue - targetValue;
                
                if (difference > 0) {
                    // Over-allocated, need to sell
                    toSell.push({
                        symbol,
                        amount: difference,
                        token: this.tokens[symbol]
                    });
                } else {
                    // Under-allocated, need to buy
                    toBuy.push({
                        symbol,
                        amount: Math.abs(difference),
                        token: this.tokens[symbol]
                    });
                }
            }
        }
        
        // Create trade pairs
        for (const sellItem of toSell) {
            for (const buyItem of toBuy) {
                if (sellItem.amount > 0 && buyItem.amount > 0) {
                    const tradeAmount = Math.min(sellItem.amount, buyItem.amount);
                    
                    if (tradeAmount >= parseFloat(ethers.formatUnits(this.minTradeSize, 6))) {
                        const sellAmountInTokens = ethers.parseUnits(
                            (tradeAmount / analysis.prices[sellItem.symbol]).toFixed(sellItem.token.decimals),
                            sellItem.token.decimals
                        );
                        
                        trades.push({
                            fromToken: sellItem.token.address,
                            toToken: buyItem.token.address,
                            fromSymbol: sellItem.symbol,
                            toSymbol: buyItem.symbol,
                            amount: sellAmountInTokens,
                            fromDecimals: sellItem.token.decimals,
                            toDecimals: buyItem.token.decimals,
                            expectedValue: tradeAmount
                        });
                        
                        sellItem.amount -= tradeAmount;
                        buyItem.amount -= tradeAmount;
                    }
                }
            }
        }
        
        return trades;
    }

    /**
     * Execute individual trade
     */
    async executeTrade(trade) {
        try {
            // Get swap data from 1inch
            const swapResponse = await axios.get(`${this.apiUrl}/swap`, {
                params: {
                    src: trade.fromToken,
                    dst: trade.toToken,
                    amount: trade.amount.toString(),
                    from: this.wallet.address,
                    slippage: this.maxSlippage / 100,
                    disableEstimate: false
                },
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            const swapData = swapResponse.data;
            
            // Execute transaction
            const tx = {
                to: swapData.tx.to,
                data: swapData.tx.data,
                value: swapData.tx.value || '0',
                gasLimit: swapData.tx.gas,
                gasPrice: swapData.tx.gasPrice
            };
            
            const txResponse = await this.wallet.sendTransaction(tx);
            const receipt = await txResponse.wait();
            
            const result = {
                txHash: txResponse.hash,
                blockNumber: receipt.blockNumber,
                fromToken: trade.fromSymbol,
                toToken: trade.toSymbol,
                amountIn: trade.amount.toString(),
                expectedAmountOut: swapData.toAmount,
                gasUsed: receipt.gasUsed.toString(),
                success: true
            };
            
            console.log(`✅ Trade executed: ${result.txHash}`);
            return result;
            
        } catch (error) {
            console.error(`❌ Trade failed: ${error.message}`);
            return {
                fromToken: trade.fromSymbol,
                toToken: trade.toSymbol,
                amountIn: trade.amount.toString(),
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get current allocations (helper method)
     */
    async getCurrentAllocations() {
        const balances = await this.getCurrentBalances();
        const prices = await this.getCurrentPrices();
        return this.calculateCurrentAllocations(balances, prices);
    }

    /**
     * Check if rebalancing is allowed
     */
    canRebalance() {
        // Check daily limit
        if (this.dailyRebalanceCount >= this.riskMetrics.maxDailyRebalances) {
            return false;
        }
        
        // Check cooldown period
        if (Date.now() - this.lastRebalanceTime < this.riskMetrics.cooldownPeriod * 1000) {
            return false;
        }
        
        return true;
    }

    /**
     * Update target allocations
     */
    updateTargetAllocations(newAllocations) {
        // Validate allocations sum to 100%
        const total = Object.values(newAllocations).reduce((sum, allocation) => sum + allocation, 0);
        
        if (Math.abs(total - 100) > 0.01) {
            throw new Error('Target allocations must sum to 100%');
        }
        
        this.targetAllocations = { ...newAllocations };
        console.log('🎯 Target allocations updated:', this.targetAllocations);
    }

    /**
     * Get rebalancing statistics
     */
    getRebalancingStats() {
        const stats = {
            totalRebalances: this.rebalanceHistory.length,
            dailyRebalanceCount: this.dailyRebalanceCount,
            lastRebalanceTime: this.lastRebalanceTime,
            averageTradesPerRebalance: 0,
            successRate: 0,
            currentAllocations: null,
            targetAllocations: this.targetAllocations,
            riskMetrics: this.riskMetrics
        };
        
        if (this.rebalanceHistory.length > 0) {
            const totalTrades = this.rebalanceHistory.reduce((sum, record) => sum + record.trades.length, 0);
            stats.averageTradesPerRebalance = totalTrades / this.rebalanceHistory.length;
            
            const successfulTrades = this.rebalanceHistory.reduce((sum, record) => 
                sum + record.trades.filter(trade => trade.success).length, 0
            );
            stats.successRate = (successfulTrades / totalTrades) * 100;
        }
        
        return stats;
    }

    /**
     * Start automated rebalancing
     */
    async startAutomatedRebalancing(intervalMinutes = 60) {
        console.log(`🤖 Starting automated rebalancing (every ${intervalMinutes} minutes)...`);
        
        const intervalMs = intervalMinutes * 60 * 1000;
        
        setInterval(async () => {
            try {
                console.log('🔍 Checking portfolio for rebalancing...');
                const analysis = await this.analyzePortfolio();
                
                if (analysis.needsRebalancing) {
                    await this.executeRebalancing(analysis);
                } else {
                    console.log('✅ Portfolio is balanced, no action needed');
                }
                
            } catch (error) {
                console.error('❌ Automated rebalancing error:', error.message);
            }
        }, intervalMs);
    }

    /**
     * Save execution proof
     */
    async saveExecutionProof(type, data) {
        const proofDir = path.join(__dirname, '../../execution-proofs');
        const filename = `rebalancer-${type}-${Date.now()}.json`;
        const filepath = path.join(proofDir, filename);

        const proof = {
            type,
            timestamp: new Date().toISOString(),
            wallet: this.wallet.address,
            chainId: 137,
            protocol: '1inch-portfolio-rebalancer',
            ...data
        };

        try {
            await fs.writeFile(filepath, JSON.stringify(proof, null, 2));
            console.log(`📄 Rebalancing proof saved: ${filename}`);
        } catch (error) {
            console.error('Error saving proof:', error.message);
        }
    }
}

// Export for use in other modules
module.exports = OneInchPortfolioRebalancer;

// CLI execution
if (require.main === module) {
    async function main() {
        const rebalancer = new OneInchPortfolioRebalancer();
        
        console.log('⚖️ FEAWS Portfolio Rebalancer');
        console.log('=============================');
        
        try {
            // Analyze current portfolio
            const analysis = await rebalancer.analyzePortfolio();
            
            if (analysis.needsRebalancing) {
                // Execute rebalancing
                const result = await rebalancer.executeRebalancing(analysis);
                console.log('Rebalancing result:', result);
            }
            
            // Show statistics
            console.log('📊 Rebalancing Statistics:', rebalancer.getRebalancingStats());
            
            // Start automated rebalancing (optional)
            // rebalancer.startAutomatedRebalancing(60); // Every hour
            
        } catch (error) {
            console.error('Portfolio rebalancing failed:', error.message);
            process.exit(1);
        }
    }
    
    main().catch(console.error);
}
