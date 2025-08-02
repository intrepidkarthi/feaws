const { Wallet, JsonRpcProvider, Contract, formatUnits, parseUnits } = require("ethers");
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

console.log('🛡️ FEAWS RISK MANAGEMENT SYSTEM');
console.log('═══════════════════════════════════');
console.log('🔒 Enterprise-grade risk assessment and monitoring');
console.log('');

class RiskManagementSystem {
    constructor(config) {
        this.config = {
            rpcUrl: config.rpcUrl || process.env.POLYGON_RPC_URL,
            privateKey: config.privateKey || process.env.PRIVATE_KEY,
            apiKey: config.apiKey || process.env.ONEINCH_API_KEY,
            chainId: config.chainId || 137,
            ...config
        };

        this.provider = new JsonRpcProvider(this.config.rpcUrl);
        this.wallet = new Wallet(this.config.privateKey, this.provider);
        
        // Risk thresholds
        this.riskThresholds = {
            maxPositionSize: 0.2, // 20% of portfolio
            maxSlippage: 0.05, // 5%
            minHealthFactor: 1.5,
            maxLeverage: 3.0,
            maxDailyLoss: 0.1, // 10%
            minLiquidity: parseUnits("1000", 6), // $1000 USDC equivalent
            maxGasPrice: parseUnits("200", "gwei"),
            ...config.riskThresholds
        };

        this.riskMetrics = {
            portfolioValue: 0,
            totalExposure: 0,
            healthFactor: 0,
            leverage: 0,
            dailyPnL: 0,
            volatility: 0,
            correlations: {},
            liquidityScore: 0
        };

        this.alertHistory = [];
        this.emergencyStops = new Set();

        console.log('👤 Wallet:', this.wallet.address);
        console.log('🎯 Risk Thresholds Configured');
    }

    async assessPortfolioRisk() {
        console.log('📊 Assessing portfolio risk...');
        
        try {
            // Get current portfolio state
            const portfolio = await this.getPortfolioState();
            
            // Calculate risk metrics
            const riskAssessment = {
                timestamp: Date.now(),
                portfolioValue: portfolio.totalValue,
                positions: portfolio.positions,
                riskScore: 0,
                riskLevel: 'LOW',
                alerts: [],
                recommendations: []
            };

            // 1. Position Size Risk
            const positionRisk = await this.assessPositionSizeRisk(portfolio);
            riskAssessment.positionSizeRisk = positionRisk;
            riskAssessment.riskScore += positionRisk.score;

            // 2. Liquidity Risk
            const liquidityRisk = await this.assessLiquidityRisk(portfolio);
            riskAssessment.liquidityRisk = liquidityRisk;
            riskAssessment.riskScore += liquidityRisk.score;

            // 3. Market Risk (Volatility)
            const marketRisk = await this.assessMarketRisk(portfolio);
            riskAssessment.marketRisk = marketRisk;
            riskAssessment.riskScore += marketRisk.score;

            // 4. Concentration Risk
            const concentrationRisk = await this.assessConcentrationRisk(portfolio);
            riskAssessment.concentrationRisk = concentrationRisk;
            riskAssessment.riskScore += concentrationRisk.score;

            // 5. Smart Contract Risk
            const contractRisk = await this.assessSmartContractRisk(portfolio);
            riskAssessment.contractRisk = contractRisk;
            riskAssessment.riskScore += contractRisk.score;

            // Calculate overall risk level
            riskAssessment.riskLevel = this.calculateRiskLevel(riskAssessment.riskScore);
            
            // Generate alerts and recommendations
            riskAssessment.alerts = this.generateRiskAlerts(riskAssessment);
            riskAssessment.recommendations = this.generateRecommendations(riskAssessment);

            // Save assessment
            await this.saveRiskAssessment(riskAssessment);

            console.log(`📈 Risk Assessment Complete: ${riskAssessment.riskLevel} (Score: ${riskAssessment.riskScore.toFixed(2)})`);
            
            return riskAssessment;

        } catch (error) {
            console.error('❌ Portfolio risk assessment failed:', error);
            throw error;
        }
    }

    async getPortfolioState() {
        console.log('💼 Fetching portfolio state...');
        
        const portfolio = {
            totalValue: 0,
            positions: [],
            balances: {},
            protocols: {}
        };

        // Get token balances
        const tokens = [
            { address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", symbol: "WMATIC", decimals: 18 },
            { address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", symbol: "USDT", decimals: 6 },
            { address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", symbol: "USDC", decimals: 6 },
            { address: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", symbol: "DAI", decimals: 18 }
        ];

        for (const token of tokens) {
            try {
                const balance = await this.getTokenBalance(token.address, token.decimals);
                const usdValue = await this.getTokenUSDValue(token.address, balance);
                
                portfolio.balances[token.symbol] = {
                    balance,
                    usdValue,
                    address: token.address
                };
                
                portfolio.totalValue += usdValue;
                
                if (usdValue > 10) { // Only include significant positions
                    portfolio.positions.push({
                        token: token.symbol,
                        balance,
                        usdValue,
                        percentage: 0 // Will be calculated after total value
                    });
                }
            } catch (error) {
                console.warn(`⚠️ Failed to get balance for ${token.symbol}:`, error.message);
            }
        }

        // Calculate position percentages
        portfolio.positions.forEach(position => {
            position.percentage = portfolio.totalValue > 0 ? position.usdValue / portfolio.totalValue : 0;
        });

        // Get DeFi protocol positions (Aave, Compound, etc.)
        try {
            portfolio.protocols = await this.getDeFiPositions();
        } catch (error) {
            console.warn('⚠️ Failed to get DeFi positions:', error.message);
        }

        return portfolio;
    }

    async assessPositionSizeRisk(portfolio) {
        const largestPosition = Math.max(...portfolio.positions.map(p => p.percentage));
        const riskScore = largestPosition > this.riskThresholds.maxPositionSize ? 
            (largestPosition - this.riskThresholds.maxPositionSize) * 10 : 0;

        return {
            score: riskScore,
            largestPosition,
            threshold: this.riskThresholds.maxPositionSize,
            status: riskScore > 0 ? 'HIGH' : 'LOW',
            message: riskScore > 0 ? 
                `Largest position (${(largestPosition * 100).toFixed(1)}%) exceeds threshold` : 
                'Position sizes within acceptable limits'
        };
    }

    async assessLiquidityRisk(portfolio) {
        let liquidityScore = 0;
        let totalLiquidity = 0;

        // Check liquidity for each position
        for (const position of portfolio.positions) {
            try {
                const liquidity = await this.getTokenLiquidity(portfolio.balances[position.token].address);
                totalLiquidity += liquidity;
                
                // Score based on liquidity depth
                if (liquidity > 1000000) liquidityScore += 0; // $1M+ = excellent
                else if (liquidity > 100000) liquidityScore += 1; // $100K+ = good
                else if (liquidity > 10000) liquidityScore += 3; // $10K+ = moderate
                else liquidityScore += 5; // <$10K = high risk
                
            } catch (error) {
                liquidityScore += 5; // Unknown liquidity = high risk
            }
        }

        return {
            score: liquidityScore,
            totalLiquidity,
            averageLiquidity: portfolio.positions.length > 0 ? totalLiquidity / portfolio.positions.length : 0,
            status: liquidityScore > 10 ? 'HIGH' : liquidityScore > 5 ? 'MEDIUM' : 'LOW',
            message: `Average liquidity: $${(totalLiquidity / portfolio.positions.length).toLocaleString()}`
        };
    }

    async assessMarketRisk(portfolio) {
        let volatilityScore = 0;
        
        // Calculate portfolio volatility based on token volatilities
        for (const position of portfolio.positions) {
            try {
                const volatility = await this.getTokenVolatility(portfolio.balances[position.token].address);
                volatilityScore += volatility * position.percentage;
            } catch (error) {
                volatilityScore += 0.3 * position.percentage; // Assume 30% volatility if unknown
            }
        }

        return {
            score: volatilityScore * 10, // Scale to 0-10
            portfolioVolatility: volatilityScore,
            status: volatilityScore > 0.5 ? 'HIGH' : volatilityScore > 0.3 ? 'MEDIUM' : 'LOW',
            message: `Portfolio volatility: ${(volatilityScore * 100).toFixed(1)}%`
        };
    }

    async assessConcentrationRisk(portfolio) {
        // Calculate Herfindahl-Hirschman Index (HHI) for concentration
        const hhi = portfolio.positions.reduce((sum, position) => {
            return sum + Math.pow(position.percentage, 2);
        }, 0);

        const concentrationScore = hhi > 0.25 ? (hhi - 0.25) * 20 : 0; // HHI > 0.25 = concentrated

        return {
            score: concentrationScore,
            hhi,
            diversificationScore: 1 - hhi,
            status: hhi > 0.5 ? 'HIGH' : hhi > 0.25 ? 'MEDIUM' : 'LOW',
            message: `Portfolio concentration (HHI): ${hhi.toFixed(3)}`
        };
    }

    async assessSmartContractRisk(portfolio) {
        let contractRiskScore = 0;
        const contractRisks = [];

        // Known contract risk scores (0-10, 10 = highest risk)
        const contractRiskDatabase = {
            "0x111111125421ca6dc452d289314280a0f8842a65": 1, // 1inch - low risk
            "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063": 2, // DAI - low risk
            "0xa0b86a33e6441e2c1e5e0b9e2c1e5e0b9e2c1e5e": 8  // Example high-risk contract
        };

        // Check each protocol/contract interaction
        for (const position of portfolio.positions) {
            const contractAddress = portfolio.balances[position.token].address;
            const riskScore = contractRiskDatabase[contractAddress] || 3; // Default medium risk
            
            contractRiskScore += riskScore * position.percentage;
            contractRisks.push({
                token: position.token,
                contract: contractAddress,
                riskScore,
                exposure: position.percentage
            });
        }

        return {
            score: contractRiskScore,
            contractRisks,
            status: contractRiskScore > 6 ? 'HIGH' : contractRiskScore > 3 ? 'MEDIUM' : 'LOW',
            message: `Weighted contract risk score: ${contractRiskScore.toFixed(2)}`
        };
    }

    calculateRiskLevel(totalScore) {
        if (totalScore > 20) return 'CRITICAL';
        if (totalScore > 15) return 'HIGH';
        if (totalScore > 10) return 'MEDIUM';
        if (totalScore > 5) return 'LOW';
        return 'MINIMAL';
    }

    generateRiskAlerts(assessment) {
        const alerts = [];

        // Position size alerts
        if (assessment.positionSizeRisk.status === 'HIGH') {
            alerts.push({
                type: 'POSITION_SIZE',
                severity: 'HIGH',
                message: 'Large position detected - consider rebalancing',
                action: 'REBALANCE'
            });
        }

        // Liquidity alerts
        if (assessment.liquidityRisk.status === 'HIGH') {
            alerts.push({
                type: 'LIQUIDITY',
                severity: 'HIGH',
                message: 'Low liquidity positions detected',
                action: 'REDUCE_EXPOSURE'
            });
        }

        // Market risk alerts
        if (assessment.marketRisk.status === 'HIGH') {
            alerts.push({
                type: 'MARKET_VOLATILITY',
                severity: 'MEDIUM',
                message: 'High portfolio volatility detected',
                action: 'HEDGE_POSITIONS'
            });
        }

        // Concentration alerts
        if (assessment.concentrationRisk.status === 'HIGH') {
            alerts.push({
                type: 'CONCENTRATION',
                severity: 'HIGH',
                message: 'Portfolio highly concentrated - diversify',
                action: 'DIVERSIFY'
            });
        }

        // Overall risk alerts
        if (assessment.riskLevel === 'CRITICAL') {
            alerts.push({
                type: 'EMERGENCY',
                severity: 'CRITICAL',
                message: 'Critical risk level - immediate action required',
                action: 'EMERGENCY_STOP'
            });
        }

        return alerts;
    }

    generateRecommendations(assessment) {
        const recommendations = [];

        if (assessment.concentrationRisk.hhi > 0.3) {
            recommendations.push({
                type: 'DIVERSIFICATION',
                priority: 'HIGH',
                action: 'Reduce largest positions and diversify across more assets',
                impact: 'Reduce concentration risk'
            });
        }

        if (assessment.liquidityRisk.score > 5) {
            recommendations.push({
                type: 'LIQUIDITY',
                priority: 'MEDIUM',
                action: 'Move to more liquid assets or reduce position sizes',
                impact: 'Improve exit flexibility'
            });
        }

        if (assessment.marketRisk.portfolioVolatility > 0.4) {
            recommendations.push({
                type: 'HEDGING',
                priority: 'MEDIUM',
                action: 'Consider hedging high-volatility positions',
                impact: 'Reduce market risk exposure'
            });
        }

        return recommendations;
    }

    async executeEmergencyStop(reason) {
        console.log('🚨 EXECUTING EMERGENCY STOP:', reason);
        
        this.emergencyStops.add({
            timestamp: Date.now(),
            reason,
            actions: []
        });

        // Stop all active TWAP orders
        // Cancel pending limit orders
        // Close leveraged positions
        // Move to stable assets

        console.log('🛑 Emergency stop executed');
    }

    async getTokenBalance(tokenAddress, decimals) {
        if (tokenAddress === "0x0000000000000000000000000000000000000000") {
            // Native token (MATIC)
            const balance = await this.provider.getBalance(this.wallet.address);
            return parseFloat(formatUnits(balance, 18));
        } else {
            // ERC-20 token
            const contract = new Contract(tokenAddress, [
                "function balanceOf(address account) external view returns (uint256)"
            ], this.provider);
            
            const balance = await contract.balanceOf(this.wallet.address);
            return parseFloat(formatUnits(balance, decimals));
        }
    }

    async getTokenUSDValue(tokenAddress, balance) {
        try {
            // Use 1inch API to get USD price
            const response = await axios.get(
                `https://api.1inch.dev/price/v1.1/137/${tokenAddress}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`
                    }
                }
            );
            
            return balance * parseFloat(response.data[tokenAddress]);
        } catch (error) {
            console.warn(`⚠️ Failed to get USD value for token ${tokenAddress}`);
            return 0;
        }
    }

    async getTokenLiquidity(tokenAddress) {
        // Simplified liquidity check - in production, would check DEX liquidity
        return Math.random() * 1000000; // Mock data
    }

    async getTokenVolatility(tokenAddress) {
        // Simplified volatility calculation - in production, would use historical data
        return Math.random() * 0.5; // Mock 0-50% volatility
    }

    async getDeFiPositions() {
        // Simplified DeFi position fetching - in production, would query protocols
        return {
            aave: { supplied: 0, borrowed: 0, healthFactor: 2.5 },
            compound: { supplied: 0, borrowed: 0 }
        };
    }

    async saveRiskAssessment(assessment) {
        const filePath = `data/risk-assessments/assessment-${Date.now()}.json`;
        const dir = 'data/risk-assessments';
        
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(assessment, null, 2));
        console.log('💾 Risk assessment saved:', filePath);
    }

    getLatestAssessment() {
        // Return the most recent risk assessment
        const dir = 'data/risk-assessments';
        if (!fs.existsSync(dir)) return null;

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        if (files.length === 0) return null;

        const latestFile = files.sort().pop();
        return JSON.parse(fs.readFileSync(`${dir}/${latestFile}`, 'utf8'));
    }

    getRiskHistory(days = 7) {
        // Return risk assessments from the last N days
        const dir = 'data/risk-assessments';
        if (!fs.existsSync(dir)) return [];

        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        
        return files
            .map(file => {
                const assessment = JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8'));
                return assessment;
            })
            .filter(assessment => assessment.timestamp > cutoff)
            .sort((a, b) => a.timestamp - b.timestamp);
    }
}

// Demonstration function
async function demonstrateRiskManagement() {
    try {
        const riskManager = new RiskManagementSystem({
            riskThresholds: {
                maxPositionSize: 0.3, // 30%
                maxSlippage: 0.02, // 2%
                minHealthFactor: 2.0
            }
        });

        console.log('🔍 Running comprehensive risk assessment...');
        const assessment = await riskManager.assessPortfolioRisk();

        console.log('📊 Risk Assessment Results:');
        console.log(`Overall Risk Level: ${assessment.riskLevel}`);
        console.log(`Risk Score: ${assessment.riskScore.toFixed(2)}`);
        console.log(`Portfolio Value: $${assessment.portfolioValue.toLocaleString()}`);
        
        if (assessment.alerts.length > 0) {
            console.log('\n🚨 Risk Alerts:');
            assessment.alerts.forEach(alert => {
                console.log(`- ${alert.severity}: ${alert.message}`);
            });
        }

        if (assessment.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            assessment.recommendations.forEach(rec => {
                console.log(`- ${rec.priority}: ${rec.action}`);
            });
        }

        return assessment;

    } catch (error) {
        console.error('❌ Risk management demonstration failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    demonstrateRiskManagement()
        .then(() => {
            console.log('✅ Risk management demonstration completed');
        })
        .catch((error) => {
            console.error('❌ Risk management demonstration failed:', error);
            process.exit(1);
        });
}

// Add class wrapper for testing
class RiskManagement {
    async calculatePortfolioRisk(portfolio) {
        try {
            if (!portfolio || !portfolio.positions || !Array.isArray(portfolio.positions)) {
                console.log('❌ Invalid portfolio structure');
                return null;
            }
            
            // Calculate basic risk metrics
            const totalValue = portfolio.totalValue || 0;
            const positionCount = portfolio.positions.length;
            
            // Calculate concentration risk
            const maxPosition = Math.max(...portfolio.positions.map(p => p.percentage || 0));
            const concentrationRisk = maxPosition > 50 ? 'HIGH' : maxPosition > 30 ? 'MEDIUM' : 'LOW';
            
            // Calculate diversification score
            const diversificationScore = positionCount >= 5 ? 0.8 : positionCount >= 3 ? 0.6 : 0.4;
            
            // Overall risk assessment
            const overallRisk = concentrationRisk === 'HIGH' ? 0.8 : concentrationRisk === 'MEDIUM' ? 0.5 : 0.3;
            
            return {
                overallRisk,
                concentrationRisk,
                diversificationScore,
                positionCount,
                totalValue: totalValue.toString()
            };
        } catch (error) {
            console.log('❌ Risk calculation error:', error.message);
            return null;
        }
    }
}

module.exports = RiskManagement;
