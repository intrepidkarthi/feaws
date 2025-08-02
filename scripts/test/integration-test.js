#!/usr/bin/env node

/**
 * FEAWS Integration Test Suite
 * Tests all major components working together
 */

const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

// Import all modules
const EnhancedLimitOrder = require('../core/enhanced-limit-order');
const ProductionTWAP = require('../core/production-twap');
const RiskManagement = require('../core/risk-management');
const AdvancedFeatures = require('../core/advanced-features');

class IntegrationTest {
    constructor() {
        this.results = {
            enhancedLimitOrder: null,
            productionTWAP: null,
            riskManagement: null,
            advancedFeatures: null,
            overall: null
        };
    }

    async runAllTests() {
        console.log('🧪 FEAWS Integration Test Suite Starting...\n');
        
        try {
            // Test 1: Enhanced Limit Order
            await this.testEnhancedLimitOrder();
            
            // Test 2: Production TWAP
            await this.testProductionTWAP();
            
            // Test 3: Risk Management
            await this.testRiskManagement();
            
            // Test 4: Advanced Features
            await this.testAdvancedFeatures();
            
            // Generate final report
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Integration test failed:', error.message);
            this.results.overall = 'FAILED';
        }
    }

    async testEnhancedLimitOrder() {
        console.log('🔄 Testing Enhanced Limit Order...');
        
        try {
            const enhancedOrder = new EnhancedLimitOrder();
            
            // Test order creation without actual submission
            const testOrder = {
                makerAsset: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
                takerAsset: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
                makingAmount: ethers.parseEther('0.1'),
                takingAmount: ethers.parseUnits('0.2', 6),
                expiration: Math.floor(Date.now() / 1000) + 3600
            };
            
            // Test order validation
            const isValid = await enhancedOrder.validateOrderParameters(testOrder);
            
            if (isValid) {
                console.log('✅ Enhanced Limit Order: Order validation passed');
                this.results.enhancedLimitOrder = 'PASSED';
            } else {
                throw new Error('Order validation failed');
            }
            
        } catch (error) {
            console.log('❌ Enhanced Limit Order: Failed -', error.message);
            this.results.enhancedLimitOrder = 'FAILED';
        }
    }

    async testProductionTWAP() {
        console.log('🔄 Testing Production TWAP...');
        
        try {
            const twap = new ProductionTWAP();
            
            // Test TWAP configuration
            const config = {
                totalAmount: ethers.parseUnits('1', 6), // 1 USDC
                sliceCount: 5,
                intervalMinutes: 10,
                fromToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
                toToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
                slippageTolerance: 1.0
            };
            
            // Test configuration validation
            const isValidConfig = await twap.validateConfiguration(config);
            
            if (isValidConfig) {
                console.log('✅ Production TWAP: Configuration validation passed');
                this.results.productionTWAP = 'PASSED';
            } else {
                throw new Error('TWAP configuration validation failed');
            }
            
        } catch (error) {
            console.log('❌ Production TWAP: Failed -', error.message);
            this.results.productionTWAP = 'FAILED';
        }
    }

    async testRiskManagement() {
        console.log('🔄 Testing Risk Management...');
        
        try {
            const riskMgmt = new RiskManagement();
            
            // Test portfolio risk assessment
            const mockPortfolio = {
                totalValue: ethers.parseEther('1000'),
                positions: [
                    { token: 'WMATIC', value: ethers.parseEther('500'), percentage: 50 },
                    { token: 'USDC', value: ethers.parseEther('300'), percentage: 30 },
                    { token: 'WETH', value: ethers.parseEther('200'), percentage: 20 }
                ]
            };
            
            // Test risk calculation
            const riskAssessment = await riskMgmt.calculatePortfolioRisk(mockPortfolio);
            
            if (riskAssessment && riskAssessment.overallRisk !== undefined) {
                console.log('✅ Risk Management: Portfolio assessment passed');
                this.results.riskManagement = 'PASSED';
            } else {
                throw new Error('Risk assessment failed');
            }
            
        } catch (error) {
            console.log('❌ Risk Management: Failed -', error.message);
            this.results.riskManagement = 'FAILED';
        }
    }

    async testAdvancedFeatures() {
        console.log('🔄 Testing Advanced Features...');
        
        try {
            const advanced = new AdvancedFeatures();
            
            // Test arbitrage opportunity scanning
            const mockTokenPairs = [
                { tokenA: 'WMATIC', tokenB: 'USDC' },
                { tokenA: 'WETH', tokenB: 'USDC' }
            ];
            
            // Test arbitrage scanning
            const opportunities = await advanced.scanArbitrageOpportunities(mockTokenPairs);
            
            if (Array.isArray(opportunities)) {
                console.log('✅ Advanced Features: Arbitrage scanning passed');
                this.results.advancedFeatures = 'PASSED';
            } else {
                throw new Error('Arbitrage scanning failed');
            }
            
        } catch (error) {
            console.log('❌ Advanced Features: Failed -', error.message);
            this.results.advancedFeatures = 'FAILED';
        }
    }

    async generateReport() {
        console.log('\n📊 Integration Test Results:');
        console.log('================================');
        
        const passedTests = Object.values(this.results).filter(result => result === 'PASSED').length;
        const totalTests = Object.keys(this.results).length - 1; // Exclude 'overall'
        
        console.log(`Enhanced Limit Order: ${this.results.enhancedLimitOrder}`);
        console.log(`Production TWAP: ${this.results.productionTWAP}`);
        console.log(`Risk Management: ${this.results.riskManagement}`);
        console.log(`Advanced Features: ${this.results.advancedFeatures}`);
        
        console.log('\n================================');
        console.log(`Tests Passed: ${passedTests}/${totalTests}`);
        
        if (passedTests === totalTests) {
            this.results.overall = 'ALL TESTS PASSED';
            console.log('🎉 ALL INTEGRATION TESTS PASSED!');
        } else {
            this.results.overall = 'SOME TESTS FAILED';
            console.log('⚠️ Some tests failed. Check individual results above.');
        }
        
        // Save results to file
        const reportPath = path.join(__dirname, '../../test-results/integration-test-results.json');
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            results: this.results,
            summary: {
                passed: passedTests,
                total: totalTests,
                status: this.results.overall
            }
        }, null, 2));
        
        console.log(`\n📄 Test results saved to: ${reportPath}`);
    }
}

// Run tests if called directly
if (require.main === module) {
    const test = new IntegrationTest();
    test.runAllTests().catch(console.error);
}

module.exports = IntegrationTest;
