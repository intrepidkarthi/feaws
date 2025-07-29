#!/usr/bin/env node

/**
 * COMPREHENSIVE STRATEGY TRACKER
 * Track all deployed funds across protocols and build complete yield strategies
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { ethers } = require('ethers');
const { TreasuryManager } = require('./treasury-manager');

class StrategyTracker {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.treasuryManager = new TreasuryManager();
        
        // All protocol contracts for tracking
        this.contracts = {
            // Aave v3 Pool
            aavePool: {
                address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
                abi: [
                    'function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
                    'function getReserveData(address asset) external view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowRate, uint128 stableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)'
                ]
            },
            
            // USDC token
            USDC: {
                address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                abi: [
                    'function balanceOf(address account) external view returns (uint256)',
                    'function decimals() external view returns (uint8)'
                ]
            },
            
            // WMATIC token
            WMATIC: {
                address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
                abi: [
                    'function balanceOf(address account) external view returns (uint256)',
                    'function decimals() external view returns (uint8)'
                ]
            }
        };
        
        this.initializeContracts();
    }
    
    initializeContracts() {
        this.aavePoolContract = new ethers.Contract(
            this.contracts.aavePool.address,
            this.contracts.aavePool.abi,
            this.wallet
        );
        
        this.usdcContract = new ethers.Contract(
            this.contracts.USDC.address,
            this.contracts.USDC.abi,
            this.wallet
        );
        
        this.wmaticContract = new ethers.Contract(
            this.contracts.WMATIC.address,
            this.contracts.WMATIC.abi,
            this.wallet
        );
    }
    
    /**
     * Get comprehensive treasury status
     */
    async getComprehensiveTreasuryStatus() {
        console.log('📊 COMPREHENSIVE TREASURY STATUS');
        console.log('================================');
        console.log(`📍 Wallet: ${this.wallet.address}`);
        
        try {
            // Get basic balances
            const balances = await this.treasuryManager.getBalances();
            
            // Get Aave position details
            const aaveData = await this.getAavePositionDetails();
            
            // Calculate total value
            const totalValue = this.calculateTotalValue(balances, aaveData);
            
            const status = {
                wallet: this.wallet.address,
                timestamp: new Date().toISOString(),
                balances: {
                    liquid: {
                        USDC: {
                            amount: balances.USDC.balance,
                            value: parseFloat(balances.USDC.balance),
                            status: 'LIQUID'
                        },
                        WMATIC: {
                            amount: balances.WMATIC.balance,
                            value: parseFloat(balances.WMATIC.balance) * 0.4,
                            status: 'LIQUID'
                        }
                    },
                    deployed: {
                        aave: aaveData
                    }
                },
                totalValue: totalValue,
                yieldStrategies: await this.analyzeYieldStrategies(balances, aaveData),
                recommendations: await this.generateRecommendations(balances, aaveData)
            };
            
            return status;
            
        } catch (error) {
            console.error('❌ Error getting treasury status:', error.message);
            return { error: error.message };
        }
    }
    
    /**
     * Get detailed Aave position information
     */
    async getAavePositionDetails() {
        console.log('🏦 Checking Aave position details...');
        
        try {
            // Get user account data from Aave
            const accountData = await this.aavePoolContract.getUserAccountData(this.wallet.address);
            
            const totalCollateral = ethers.formatUnits(accountData.totalCollateralBase, 8); // Base currency has 8 decimals
            const totalDebt = ethers.formatUnits(accountData.totalDebtBase, 8);
            const availableBorrows = ethers.formatUnits(accountData.availableBorrowsBase, 8);
            const healthFactor = ethers.formatUnits(accountData.healthFactor, 18);
            
            console.log(`💰 Aave Collateral: $${totalCollateral}`);
            console.log(`💸 Aave Debt: $${totalDebt}`);
            console.log(`📊 Health Factor: ${healthFactor}`);
            
            // Get USDC reserve data to find aToken address
            const reserveData = await this.aavePoolContract.getReserveData(this.contracts.USDC.address);
            const aTokenAddress = reserveData.aTokenAddress;
            
            console.log(`🎫 aUSDC Token Address: ${aTokenAddress}`);
            
            // Check aToken balance
            let aTokenBalance = 0;
            if (aTokenAddress !== ethers.ZeroAddress) {
                const aTokenContract = new ethers.Contract(
                    aTokenAddress,
                    ['function balanceOf(address account) external view returns (uint256)'],
                    this.wallet
                );
                
                const balance = await aTokenContract.balanceOf(this.wallet.address);
                aTokenBalance = ethers.formatUnits(balance, 6);
                console.log(`💎 aUSDC Balance: ${aTokenBalance}`);
            }
            
            return {
                totalCollateral: parseFloat(totalCollateral),
                totalDebt: parseFloat(totalDebt),
                availableBorrows: parseFloat(availableBorrows),
                healthFactor: parseFloat(healthFactor),
                aTokenAddress: aTokenAddress,
                aUSDCBalance: parseFloat(aTokenBalance),
                currentAPY: 2.8,
                status: parseFloat(totalCollateral) > 0 ? 'ACTIVE' : 'INACTIVE'
            };
            
        } catch (error) {
            console.error('❌ Error getting Aave details:', error.message);
            return {
                totalCollateral: 0,
                totalDebt: 0,
                aUSDCBalance: 0,
                status: 'ERROR',
                error: error.message
            };
        }
    }
    
    /**
     * Calculate total treasury value
     */
    calculateTotalValue(balances, aaveData) {
        const liquidValue = parseFloat(balances.USDC.balance) + 
                           (parseFloat(balances.WMATIC.balance) * 0.4);
        const aaveValue = aaveData.totalCollateral || 0;
        
        return liquidValue + aaveValue;
    }
    
    /**
     * Analyze current yield strategies
     */
    async analyzeYieldStrategies(balances, aaveData) {
        const strategies = [];
        
        // Current Aave position
        if (aaveData.status === 'ACTIVE' && aaveData.totalCollateral > 0) {
            strategies.push({
                protocol: 'Aave v3',
                type: 'LENDING',
                amount: aaveData.totalCollateral,
                apy: 2.8,
                status: 'ACTIVE',
                yieldPerYear: aaveData.totalCollateral * 0.028
            });
        }
        
        // Potential strategies for liquid funds
        const liquidUSDC = parseFloat(balances.USDC.balance);
        const liquidWMATIC = parseFloat(balances.WMATIC.balance);
        
        if (liquidUSDC > 1) {
            strategies.push({
                protocol: 'Available for deployment',
                type: 'LIQUID',
                amount: liquidUSDC,
                apy: 0,
                status: 'AVAILABLE',
                potentialStrategies: [
                    { name: 'QuickSwap LP', apy: 8.5, improvement: 8.5 },
                    { name: 'Compound v3', apy: 3.2, improvement: 3.2 },
                    { name: 'Additional Aave', apy: 2.8, improvement: 2.8 }
                ]
            });
        }
        
        return strategies;
    }
    
    /**
     * Generate optimization recommendations
     */
    async generateRecommendations(balances, aaveData) {
        const recommendations = [];
        
        // If we have Aave position, recommend moving to higher yield
        if (aaveData.status === 'ACTIVE' && aaveData.totalCollateral > 0) {
            recommendations.push({
                priority: 'HIGH',
                action: 'YIELD_OPTIMIZATION',
                description: `Move $${aaveData.totalCollateral.toFixed(2)} from Aave (2.8% APY) to QuickSwap LP (8.5% APY)`,
                yieldImprovement: 5.7,
                additionalYearlyIncome: aaveData.totalCollateral * 0.057,
                steps: [
                    'Withdraw USDC from Aave',
                    'Convert portion to WMATIC via 1inch',
                    'Provide liquidity to USDC-WMATIC pool on QuickSwap'
                ]
            });
        }
        
        // If we have liquid USDC, recommend deployment
        const liquidUSDC = parseFloat(balances.USDC.balance);
        if (liquidUSDC > 5) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'DEPLOY_LIQUID_FUNDS',
                description: `Deploy $${liquidUSDC.toFixed(2)} liquid USDC to yield-generating strategies`,
                potentialYield: liquidUSDC * 0.085,
                recommendedStrategy: 'QuickSwap LP (8.5% APY)'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Execute complete strategy analysis and save results
     */
    async executeCompleteAnalysis() {
        console.log('🎯 COMPLETE STRATEGY ANALYSIS');
        console.log('=============================');
        
        try {
            const status = await this.getComprehensiveTreasuryStatus();
            
            // Display results
            console.log('\n📊 TREASURY ANALYSIS RESULTS:');
            console.log(`💰 Total Value: $${status.totalValue?.toFixed(2) || '0.00'}`);
            console.log(`💵 Liquid USDC: ${status.balances?.liquid?.USDC?.amount || '0'}`);
            console.log(`🔷 Liquid WMATIC: ${parseFloat(status.balances?.liquid?.WMATIC?.amount || 0).toFixed(6)}`);
            console.log(`🏦 Aave Position: $${status.balances?.deployed?.aave?.totalCollateral?.toFixed(2) || '0.00'}`);
            
            console.log('\n🎯 ACTIVE STRATEGIES:');
            if (status.yieldStrategies && status.yieldStrategies.length > 0) {
                status.yieldStrategies.forEach((strategy, i) => {
                    console.log(`  ${i + 1}. ${strategy.protocol}: $${strategy.amount.toFixed(2)} at ${strategy.apy}% APY`);
                });
            } else {
                console.log('  No active yield strategies found');
            }
            
            console.log('\n💡 RECOMMENDATIONS:');
            if (status.recommendations && status.recommendations.length > 0) {
                status.recommendations.forEach((rec, i) => {
                    console.log(`  ${i + 1}. [${rec.priority}] ${rec.description}`);
                    if (rec.yieldImprovement) {
                        console.log(`     💰 Additional yield: +${rec.yieldImprovement}% APY ($${rec.additionalYearlyIncome?.toFixed(2)}/year)`);
                    }
                });
            } else {
                console.log('  Current allocation is optimal');
            }
            
            // Save comprehensive results
            const fs = require('fs');
            const path = require('path');
            
            fs.writeFileSync(
                path.join(__dirname, '../frontend/comprehensive-strategy-analysis.json'),
                JSON.stringify(status, null, 2)
            );
            
            console.log('\n💾 Complete analysis saved to frontend/comprehensive-strategy-analysis.json');
            console.log('\n✅ STRATEGY ANALYSIS COMPLETED!');
            
            return status;
            
        } catch (error) {
            console.error('❌ Strategy analysis failed:', error.message);
            throw error;
        }
    }
}

async function main() {
    const tracker = new StrategyTracker();
    await tracker.executeCompleteAnalysis();
}

if (require.main === module) {
    main();
}

module.exports = { StrategyTracker };
