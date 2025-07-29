#!/usr/bin/env node

/**
 * COMPLETE STRATEGY ENGINE
 * End-to-end real DeFi strategies with live tracking for demo presentation
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { TreasuryManager } = require('./treasury-manager');
const { RealYieldManager } = require('./real-yield-manager');
const fs = require('fs');
const path = require('path');

class CompleteStrategyEngine {
    constructor() {
        this.treasuryManager = new TreasuryManager();
        this.yieldManager = new RealYieldManager();
        this.strategies = {
            executed: [],
            active: [],
            performance: {
                totalYieldGenerated: 0,
                totalGasSpent: 0,
                totalTransactions: 0,
                successRate: 100
            }
        };
        this.demoData = {
            startTime: new Date().toISOString(),
            timeline: [],
            realTransactions: [],
            yieldPositions: []
        };
    }

    /**
     * Execute complete demo strategy sequence
     */
    async executeCompleteDemo() {
        console.log('🎯 COMPLETE STRATEGY ENGINE DEMO');
        console.log('================================');
        console.log(`📍 Wallet: ${this.treasuryManager.wallet.address}`);
        console.log(`🕐 Demo Start: ${new Date().toLocaleString()}`);
        
        try {
            // Phase 1: Initial Treasury Assessment
            await this.phase1_TreasuryAssessment();
            
            // Phase 2: TWAP Strategy Execution
            await this.phase2_TWAPExecution();
            
            // Phase 3: Yield Deployment
            await this.phase3_YieldDeployment();
            
            // Phase 4: Performance Analysis
            await this.phase4_PerformanceAnalysis();
            
            // Phase 5: Save Demo Results
            await this.phase5_SaveResults();
            
            console.log('\n🎉 COMPLETE DEMO EXECUTED SUCCESSFULLY!');
            console.log('📊 Check frontend/complete-demo-results.json for full data');
            
        } catch (error) {
            console.error('❌ Demo execution failed:', error.message);
            await this.saveErrorState(error);
        }
    }

    async phase1_TreasuryAssessment() {
        console.log('\n📊 PHASE 1: TREASURY ASSESSMENT');
        console.log('================================');
        
        const balances = await this.treasuryManager.getBalances();
        const assessment = {
            timestamp: new Date().toISOString(),
            phase: 'TREASURY_ASSESSMENT',
            balances: balances,
            totalValue: this.calculateTotalValue(balances),
            recommendations: this.generateRecommendations(balances)
        };
        
        this.demoData.timeline.push(assessment);
        
        console.log(`💰 Total Treasury Value: $${assessment.totalValue}`);
        console.log(`💵 USDC: ${balances.USDC.balance}`);
        console.log(`🔷 WMATIC: ${parseFloat(balances.WMATIC.balance).toFixed(6)}`);
        console.log(`📈 Yield Opportunities Identified: ${assessment.recommendations.length}`);
        
        assessment.recommendations.forEach((rec, i) => {
            console.log(`  ${i + 1}. ${rec.strategy}: ${rec.expectedAPY}% APY`);
        });
        
        await this.sleep(2000); // Demo pause
    }

    async phase2_TWAPExecution() {
        console.log('\n🌊 PHASE 2: TWAP STRATEGY EXECUTION');
        console.log('===================================');
        
        const twapParams = {
            fromToken: 'USDC',
            toToken: 'WMATIC',
            totalAmount: 3,
            tranches: 3,
            intervalMinutes: 1, // Faster for demo
            yieldTarget: 5.0
        };
        
        console.log(`🎯 Executing TWAP: ${twapParams.totalAmount} ${twapParams.fromToken} → ${twapParams.toToken}`);
        console.log(`📊 Strategy: ${twapParams.tranches} tranches, ${twapParams.intervalMinutes}min intervals`);
        
        try {
            const twapResult = await this.treasuryManager.executeTWAPWithYield(
                twapParams.fromToken,
                twapParams.toToken,
                twapParams.totalAmount,
                twapParams.tranches,
                twapParams.intervalMinutes,
                twapParams.yieldTarget
            );
            
            const twapData = {
                timestamp: new Date().toISOString(),
                phase: 'TWAP_EXECUTION',
                strategy: 'TWAP_WITH_YIELD',
                status: 'SUCCESS',
                params: twapParams,
                result: twapResult,
                realTransactions: twapResult.executedTranches || []
            };
            
            this.demoData.timeline.push(twapData);
            this.strategies.executed.push(twapData);
            
            // Track real transactions
            if (twapResult.executedTranches) {
                twapResult.executedTranches.forEach(tranche => {
                    if (tranche.transactionHash) {
                        this.demoData.realTransactions.push({
                            type: 'TWAP_TRANCHE',
                            hash: tranche.transactionHash,
                            amount: `${tranche.amountIn} USDC → ${tranche.amountOut.toFixed(6)} WMATIC`,
                            priceImprovement: tranche.priceImprovement,
                            timestamp: tranche.timestamp
                        });
                        this.strategies.performance.totalTransactions++;
                    }
                });
            }
            
            console.log(`✅ TWAP Completed: ${twapResult.executedTranches?.length || 0} tranches executed`);
            console.log(`📈 Yield Generated: ${twapResult.totalYieldGenerated?.toFixed(4) || '0.0000'}%`);
            
        } catch (error) {
            console.log(`❌ TWAP Failed: ${error.message}`);
            this.strategies.performance.successRate = 75;
        }
        
        await this.sleep(3000); // Demo pause
    }

    async phase3_YieldDeployment() {
        console.log('\n🌾 PHASE 3: YIELD DEPLOYMENT');
        console.log('============================');
        
        const yieldStrategies = [
            { protocol: 'aave', token: 'USDC', amount: 5, expectedAPY: 2.8 },
            { protocol: 'aave', token: 'USDC', amount: 3, expectedAPY: 2.8 }
        ];
        
        for (const strategy of yieldStrategies) {
            console.log(`\n🏦 Deploying ${strategy.amount} ${strategy.token} to ${strategy.protocol.toUpperCase()}`);
            
            try {
                const yieldResult = await this.yieldManager.lendToAave(strategy.token, strategy.amount);
                
                const yieldData = {
                    timestamp: new Date().toISOString(),
                    phase: 'YIELD_DEPLOYMENT',
                    strategy: strategy.protocol.toUpperCase(),
                    status: 'SUCCESS',
                    token: strategy.token,
                    amount: strategy.amount,
                    expectedAPY: strategy.expectedAPY,
                    result: yieldResult
                };
                
                this.demoData.timeline.push(yieldData);
                this.strategies.executed.push(yieldData);
                
                // Track yield position
                this.demoData.yieldPositions.push({
                    protocol: strategy.protocol.toUpperCase(),
                    token: strategy.token,
                    amount: strategy.amount,
                    apy: strategy.expectedAPY,
                    transactionHash: yieldResult.transactionHash,
                    timestamp: yieldResult.timestamp
                });
                
                // Track real transaction
                this.demoData.realTransactions.push({
                    type: 'YIELD_DEPLOYMENT',
                    hash: yieldResult.transactionHash,
                    amount: `${strategy.amount} ${strategy.token} → ${strategy.protocol.toUpperCase()}`,
                    apy: `${strategy.expectedAPY}% APY`,
                    timestamp: yieldResult.timestamp
                });
                
                this.strategies.performance.totalTransactions++;
                this.strategies.performance.totalYieldGenerated += strategy.expectedAPY;
                
                console.log(`✅ Deployed: ${strategy.amount} ${strategy.token}`);
                console.log(`📋 TX: ${yieldResult.transactionHash}`);
                console.log(`📈 Expected APY: ${strategy.expectedAPY}%`);
                
                await this.sleep(2000); // Demo pause between deployments
                
            } catch (error) {
                console.log(`❌ Deployment Failed: ${error.message}`);
                this.strategies.performance.successRate -= 10;
            }
        }
    }

    async phase4_PerformanceAnalysis() {
        console.log('\n📊 PHASE 4: PERFORMANCE ANALYSIS');
        console.log('=================================');
        
        const finalBalances = await this.treasuryManager.getBalances();
        const totalDeployed = this.demoData.yieldPositions.reduce((sum, pos) => sum + pos.amount, 0);
        const averageAPY = this.demoData.yieldPositions.reduce((sum, pos) => sum + pos.apy, 0) / this.demoData.yieldPositions.length;
        
        const performance = {
            timestamp: new Date().toISOString(),
            phase: 'PERFORMANCE_ANALYSIS',
            metrics: {
                totalTransactions: this.strategies.performance.totalTransactions,
                successRate: this.strategies.performance.successRate,
                totalDeployed: totalDeployed,
                averageAPY: averageAPY,
                yieldPositions: this.demoData.yieldPositions.length,
                realTransactionHashes: this.demoData.realTransactions.map(tx => tx.hash)
            },
            comparison: {
                traditionalTreasury: {
                    apy: 0.1,
                    annualYield: totalDeployed * 0.001
                },
                feawsTreasury: {
                    apy: averageAPY,
                    annualYield: totalDeployed * (averageAPY / 100)
                }
            }
        };
        
        performance.improvement = {
            apyMultiplier: averageAPY / 0.1,
            additionalYield: performance.comparison.feawsTreasury.annualYield - performance.comparison.traditionalTreasury.annualYield
        };
        
        this.demoData.timeline.push(performance);
        
        console.log(`📈 Total Transactions: ${performance.metrics.totalTransactions}`);
        console.log(`✅ Success Rate: ${performance.metrics.successRate}%`);
        console.log(`💰 Total Deployed: $${totalDeployed}`);
        console.log(`📊 Average APY: ${averageAPY.toFixed(2)}%`);
        console.log(`🚀 APY Improvement: ${performance.improvement.apyMultiplier.toFixed(1)}x vs traditional`);
        console.log(`💎 Additional Annual Yield: $${performance.improvement.additionalYield.toFixed(2)}`);
        
        await this.sleep(2000);
    }

    async phase5_SaveResults() {
        console.log('\n💾 PHASE 5: SAVING DEMO RESULTS');
        console.log('===============================');
        
        const completeResults = {
            demo: {
                title: 'FEAWS Complete Strategy Demo',
                executedAt: this.demoData.startTime,
                completedAt: new Date().toISOString(),
                wallet: this.treasuryManager.wallet.address,
                duration: this.calculateDuration()
            },
            timeline: this.demoData.timeline,
            realTransactions: this.demoData.realTransactions,
            yieldPositions: this.demoData.yieldPositions,
            performance: this.strategies.performance,
            verification: {
                polygonscanWallet: `https://polygonscan.com/address/${this.treasuryManager.wallet.address}`,
                transactionLinks: this.demoData.realTransactions.map(tx => ({
                    type: tx.type,
                    link: `https://polygonscan.com/tx/${tx.hash}`
                }))
            }
        };
        
        // Save complete results
        fs.writeFileSync(
            path.join(__dirname, '../frontend/complete-demo-results.json'),
            JSON.stringify(completeResults, null, 2)
        );
        
        // Save simplified dashboard data
        const dashboardData = {
            summary: {
                totalTransactions: this.strategies.performance.totalTransactions,
                totalDeployed: this.demoData.yieldPositions.reduce((sum, pos) => sum + pos.amount, 0),
                averageAPY: this.demoData.yieldPositions.reduce((sum, pos) => sum + pos.apy, 0) / this.demoData.yieldPositions.length,
                successRate: this.strategies.performance.successRate
            },
            recentTransactions: this.demoData.realTransactions.slice(-5),
            activePositions: this.demoData.yieldPositions,
            lastUpdated: new Date().toISOString()
        };
        
        fs.writeFileSync(
            path.join(__dirname, '../frontend/live-demo-data.json'),
            JSON.stringify(dashboardData, null, 2)
        );
        
        console.log('✅ Complete demo results saved');
        console.log('✅ Live dashboard data updated');
        console.log(`📊 Total files created: 2`);
    }

    calculateTotalValue(balances) {
        const usdcValue = parseFloat(balances.USDC?.balance || 0);
        const wmaticValue = parseFloat(balances.WMATIC?.balance || 0) * 0.4; // Approximate WMATIC price
        return (usdcValue + wmaticValue).toFixed(2);
    }

    generateRecommendations(balances) {
        const recommendations = [];
        const usdcBalance = parseFloat(balances.USDC?.balance || 0);
        const wmaticBalance = parseFloat(balances.WMATIC?.balance || 0);
        
        if (usdcBalance > 5) {
            recommendations.push({
                strategy: 'Aave USDC Lending',
                expectedAPY: 2.8,
                amount: Math.min(usdcBalance * 0.3, 10)
            });
        }
        
        if (usdcBalance > 2) {
            recommendations.push({
                strategy: 'TWAP to WMATIC',
                expectedAPY: 2.3,
                amount: Math.min(usdcBalance * 0.2, 5)
            });
        }
        
        return recommendations;
    }

    calculateDuration() {
        const start = new Date(this.demoData.startTime);
        const end = new Date();
        const durationMs = end - start;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    async saveErrorState(error) {
        const errorData = {
            timestamp: new Date().toISOString(),
            error: error.message,
            completedPhases: this.demoData.timeline.length,
            partialResults: this.demoData
        };
        
        fs.writeFileSync(
            path.join(__dirname, '../frontend/demo-error.json'),
            JSON.stringify(errorData, null, 2)
        );
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI execution
async function main() {
    const engine = new CompleteStrategyEngine();
    await engine.executeCompleteDemo();
}

if (require.main === module) {
    main();
}

module.exports = { CompleteStrategyEngine };
