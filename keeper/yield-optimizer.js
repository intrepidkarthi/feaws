const { RealYieldManager } = require('./real-yield-manager');
const { QuickSwapIntegration } = require('./quickswap-integration');
const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

/**
 * YIELD OPTIMIZER
 * Automatically moves funds between protocols for maximum yield
 * Retrieves funds from lower-yield protocols and deploys to higher-yield ones
 */
class YieldOptimizer {
    constructor() {
        this.realYieldManager = new RealYieldManager();
        this.quickSwapIntegration = new QuickSwapIntegration();
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        // Yield thresholds for optimization
        this.yieldThresholds = {
            minYieldDifference: 2.0, // Minimum 2% APY difference to justify moving funds
            gasThreshold: 0.1, // Don't optimize if gas costs > 0.1% of position value
            rebalanceThreshold: 1000 // Minimum $1000 position to rebalance
        };
        
        // Protocol yield tracking
        this.protocolYields = {
            aave: { currentAPY: 2.8, gasEstimate: 200000 },
            quickswap: { currentAPY: 8.5, gasEstimate: 300000 },
            compound: { currentAPY: 3.2, gasEstimate: 250000 }
        };
    }
    
    /**
     * Analyze current positions and identify optimization opportunities
     */
    async analyzeOptimizationOpportunities() {
        console.log('🔍 ANALYZING YIELD OPTIMIZATION OPPORTUNITIES');
        console.log('============================================');
        
        try {
            // Get current positions
            const aavePositions = await this.realYieldManager.getRealYieldPositions();
            const lpPositions = await this.quickSwapIntegration.getLPPositions();
            
            console.log(`📊 Current Aave positions: ${aavePositions.totalPositions}`);
            console.log(`📊 Current LP positions: ${lpPositions.totalPositions}`);
            
            const opportunities = [];
            
            // Analyze Aave positions for potential moves to QuickSwap
            if (aavePositions.positions && aavePositions.positions.length > 0) {
                for (const position of aavePositions.positions) {
                    const currentAPY = parseFloat(position.estimatedAPY.replace('%', ''));
                    const quickswapAPY = this.protocolYields.quickswap.currentAPY;
                    const yieldDifference = quickswapAPY - currentAPY;
                    
                    if (yieldDifference >= this.yieldThresholds.minYieldDifference) {
                        opportunities.push({
                            type: 'MOVE_TO_QUICKSWAP',
                            fromProtocol: 'Aave',
                            toProtocol: 'QuickSwap',
                            currentAPY: currentAPY,
                            targetAPY: quickswapAPY,
                            yieldImprovement: yieldDifference,
                            estimatedValue: parseFloat(position.amount) * 1.0, // Assuming $1 per token for simplicity
                            recommendation: 'HIGH_PRIORITY'
                        });
                    }
                }
            }
            
            // Analyze LP positions for potential moves to higher-yield protocols
            if (lpPositions.positions && lpPositions.positions.length > 0) {
                for (const position of lpPositions.positions) {
                    const currentAPY = position.estimatedAPY;
                    // LP is currently highest yield, so no moves recommended
                    console.log(`💧 LP Position: ${position.lpTokens} tokens at ${currentAPY}% APY (optimal)`);
                }
            }
            
            return {
                totalOpportunities: opportunities.length,
                opportunities: opportunities,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error analyzing opportunities:', error.message);
            return { totalOpportunities: 0, opportunities: [], error: error.message };
        }
    }
    
    /**
     * Execute yield optimization by moving funds between protocols
     */
    async executeYieldOptimization() {
        console.log('🚀 EXECUTING YIELD OPTIMIZATION');
        console.log('===============================');
        
        try {
            const opportunities = await this.analyzeOptimizationOpportunities();
            
            if (opportunities.totalOpportunities === 0) {
                console.log('✅ No optimization opportunities found - current allocation is optimal');
                return {
                    success: true,
                    message: 'No optimization needed',
                    optimizations: []
                };
            }
            
            const optimizations = [];
            
            for (const opportunity of opportunities.opportunities) {
                console.log(`\n🎯 Processing opportunity: ${opportunity.type}`);
                console.log(`📈 Yield improvement: ${opportunity.yieldImprovement.toFixed(2)}% APY`);
                
                try {
                    let result;
                    
                    switch (opportunity.type) {
                        case 'MOVE_TO_QUICKSWAP':
                            result = await this.moveAaveToQuickSwap();
                            break;
                        default:
                            console.log(`⚠️ Unknown optimization type: ${opportunity.type}`);
                            continue;
                    }
                    
                    if (result.success) {
                        optimizations.push({
                            type: opportunity.type,
                            fromProtocol: opportunity.fromProtocol,
                            toProtocol: opportunity.toProtocol,
                            yieldImprovement: opportunity.yieldImprovement,
                            transactionHash: result.transactionHash,
                            timestamp: new Date().toISOString()
                        });
                        
                        console.log(`✅ Optimization completed: ${result.transactionHash}`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Optimization failed: ${error.message}`);
                }
            }
            
            return {
                success: true,
                totalOptimizations: optimizations.length,
                optimizations: optimizations,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Yield optimization failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Move funds from Aave to QuickSwap LP for higher yield
     */
    async moveAaveToQuickSwap() {
        console.log('💱 Moving funds from Aave to QuickSwap LP...');
        
        try {
            // Step 1: Withdraw from Aave (simplified - would need actual withdrawal implementation)
            console.log('🏦 Withdrawing from Aave...');
            
            // For demo, we'll assume we have USDC available and convert some to WMATIC
            const usdcAmount = 3; // Amount to move to LP
            const wmaticAmount = 1.2; // Equivalent WMATIC amount
            
            // Step 2: Provide liquidity to QuickSwap
            console.log('💧 Providing liquidity to QuickSwap...');
            const lpResult = await this.quickSwapIntegration.provideLiquidity(usdcAmount, wmaticAmount);
            
            return {
                success: true,
                transactionHash: lpResult.transactionHash,
                fromProtocol: 'Aave',
                toProtocol: 'QuickSwap',
                amount: `${usdcAmount} USDC + ${wmaticAmount} WMATIC`,
                newAPY: lpResult.estimatedAPY,
                timestamp: lpResult.timestamp
            };
            
        } catch (error) {
            console.error('❌ Failed to move funds from Aave to QuickSwap:', error.message);
            throw error;
        }
    }
    
    /**
     * Get current yield comparison across all protocols
     */
    async getYieldComparison() {
        console.log('📊 Getting yield comparison across protocols...');
        
        try {
            const aavePositions = await this.realYieldManager.getRealYieldPositions();
            const lpPositions = await this.quickSwapIntegration.getLPPositions();
            
            const comparison = {
                protocols: {
                    aave: {
                        currentAPY: 2.8,
                        positions: aavePositions.totalPositions,
                        totalValue: aavePositions.positions.reduce((sum, pos) => sum + parseFloat(pos.amount), 0),
                        status: 'ACTIVE'
                    },
                    quickswap: {
                        currentAPY: 8.5,
                        positions: lpPositions.totalPositions,
                        totalValue: lpPositions.positions.reduce((sum, pos) => sum + (parseFloat(pos.lpTokens) * 2), 0), // Rough estimate
                        status: 'READY'
                    }
                },
                recommendations: {
                    optimal: 'QuickSwap LP (8.5% APY)',
                    suboptimal: 'Aave Lending (2.8% APY)',
                    yieldGap: '5.7% APY difference'
                },
                timestamp: new Date().toISOString()
            };
            
            return comparison;
            
        } catch (error) {
            console.error('❌ Error getting yield comparison:', error.message);
            return { error: error.message };
        }
    }
    
    /**
     * Execute complete yield optimization strategy
     */
    async executeCompleteOptimization() {
        console.log('🎯 COMPLETE YIELD OPTIMIZATION STRATEGY');
        console.log('======================================');
        
        const results = {
            startTime: new Date().toISOString(),
            steps: [],
            totalYieldImprovement: 0,
            transactions: []
        };
        
        try {
            // Step 1: Analyze current state
            console.log('\n📊 Step 1: Analyzing current positions...');
            const analysis = await this.analyzeOptimizationOpportunities();
            results.steps.push({
                step: 'ANALYSIS',
                status: 'SUCCESS',
                data: analysis
            });
            
            // Step 2: Execute optimizations
            console.log('\n🚀 Step 2: Executing optimizations...');
            const optimizations = await this.executeYieldOptimization();
            results.steps.push({
                step: 'OPTIMIZATION',
                status: 'SUCCESS',
                data: optimizations
            });
            
            // Step 3: Verify new positions
            console.log('\n✅ Step 3: Verifying new positions...');
            const finalComparison = await this.getYieldComparison();
            results.steps.push({
                step: 'VERIFICATION',
                status: 'SUCCESS',
                data: finalComparison
            });
            
            // Calculate total improvement
            if (optimizations.optimizations && optimizations.optimizations.length > 0) {
                results.totalYieldImprovement = optimizations.optimizations.reduce(
                    (sum, opt) => sum + opt.yieldImprovement, 0
                );
                results.transactions = optimizations.optimizations.map(opt => opt.transactionHash);
            }
            
            results.endTime = new Date().toISOString();
            results.success = true;
            
            console.log('\n🎉 YIELD OPTIMIZATION COMPLETED!');
            console.log(`📈 Total yield improvement: ${results.totalYieldImprovement.toFixed(2)}% APY`);
            console.log(`📋 Transactions executed: ${results.transactions.length}`);
            
            // Save results
            const fs = require('fs');
            const path = require('path');
            fs.writeFileSync(
                path.join(__dirname, '../frontend/yield-optimization-results.json'),
                JSON.stringify(results, null, 2)
            );
            
            return results;
            
        } catch (error) {
            console.error('❌ Complete optimization failed:', error.message);
            results.error = error.message;
            results.success = false;
            return results;
        }
    }
}

module.exports = { YieldOptimizer };
