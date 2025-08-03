const { fetchTokenBalances, tokens } = require('./balance-fetcher');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

class RiskManagementSystem {
  constructor() {
    this.apiKey = process.env.ONEINCH_API_KEY;
    this.rpcUrl = process.env.POLYGON_RPC_URL;
    this.walletAddress = null;
    this.portfolio = [];
    this.riskThresholds = {
      maxPortfolioVolatility: 0.15, // 15% max volatility
      maxSingleAssetExposure: 0.50,  // 50% max in single asset
      minDiversification: 3,         // Minimum 3 different assets
      maxDrawdown: 0.20             // 20% max drawdown
    };
  }

  async initialize() {
    console.log('🛡️  INITIALIZING RISK MANAGEMENT SYSTEM');
    console.log('═════════════════════════════════════════');
    
    // Fetch current balances
    const balances = await fetchTokenBalances();
    this.walletAddress = process.env.MAKER_PRIVATE_KEY ? 
      new (require('ethers').Wallet)(process.env.MAKER_PRIVATE_KEY).address : 
      'Unknown';
    
    console.log(`👤 Wallet: ${this.walletAddress}`);
    console.log('');
    
    return balances;
  }

  async getPortfolioState() {
    console.log('📊 ANALYZING PORTFOLIO STATE');
    console.log('══════════════════════════════');
    
    const balances = await this.initialize();
    
    // Filter out zero balances
    const nonZeroBalances = balances.filter(token => token.balance > 0);
    
    if (nonZeroBalances.length === 0) {
      console.log('⚠️  No assets in portfolio');
      return {
        totalValue: 0,
        assets: [],
        riskMetrics: this.calculateRiskMetrics([])
      };
    }
    
    // Get USD values for all assets
    const assetsWithValues = [];
    let totalValue = 0;
    
    for (const asset of nonZeroBalances) {
      try {
        const usdValue = await this.getTokenUSDValue(asset.address, asset.balance);
        const assetWithValues = {
          ...asset,
          usdValue: usdValue,
          percentageOfPortfolio: 0  // Will be calculated after total
        };
        
        assetsWithValues.push(assetWithValues);
        totalValue += usdValue;
        
        console.log(`${asset.symbol}: ${asset.balance.toFixed(6)} ($${usdValue.toFixed(2)})`);
      } catch (error) {
        console.warn(`⚠️  Could not get USD value for ${asset.symbol}: ${error.message}`);
        
        // Add with zero value if we can't get price
        assetsWithValues.push({
          ...asset,
          usdValue: 0,
          percentageOfPortfolio: 0
        });
      }
    }
    
    // Calculate portfolio percentages
    assetsWithValues.forEach(asset => {
      asset.percentageOfPortfolio = totalValue > 0 ? (asset.usdValue / totalValue) * 100 : 0;
    });
    
    console.log('');
    console.log(`💰 TOTAL PORTFOLIO VALUE: $${totalValue.toFixed(2)}`);
    console.log('');
    
    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(assetsWithValues);
    
    const portfolioState = {
      totalValue: totalValue,
      assets: assetsWithValues,
      riskMetrics: riskMetrics,
      timestamp: new Date().toISOString()
    };
    
    // Save portfolio state
    this.savePortfolioState(portfolioState);
    
    return portfolioState;
  }

  async getTokenUSDValue(tokenAddress, balance) {
    try {
      // Map native tokens to their contract addresses for pricing
      if (tokenAddress === "0x0000000000000000000000000000000000000000") {
        // Map MATIC to WMATIC for pricing
        tokenAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";
      }
      
      // Try to get price from 1inch API
      let priceNum = null;
      
      try {
        const response = await axios.get(
          `https://api.1inch.dev/price/v1.1/137/${tokenAddress}?currency=USD`,
          { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
        );
        
        const price = response.data[tokenAddress];
        if (price !== undefined) {
          priceNum = parseFloat(price);
        }
      } catch (error) {
        // If USD currency fails, try without it
        try {
          const response = await axios.get(
            `https://api.1inch.dev/price/v1.1/137/${tokenAddress}`,
            { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
          );
          
          const price = response.data[tokenAddress];
          if (price !== undefined) {
            priceNum = parseFloat(price);
            
            // Convert from wei if necessary
            if (priceNum > 1000000) {
              priceNum = priceNum / 1e18;
            }
          }
        } catch (innerError) {
          // Ignore inner error
        }
      }
      
      if (priceNum === null || isNaN(priceNum) || priceNum <= 0) {
        // Fallback prices for common tokens
        const fallbackPrices = {
          "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": 0.70,  // WMATIC
          "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359": 1.00,  // USDC
          "0x2791bca1f2de4661ed88a30c99a7a9449aa84174": 1.00,  // USDC.e
          "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": 1.00,  // USDT
          "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063": 1.00,  // DAI
          "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": 2500.00 // WETH (approx)
        };
        
        priceNum = fallbackPrices[tokenAddress] || 0;
      }
      
      return balance * priceNum;
    } catch (error) {
      console.warn(`⚠️  Price fetch error for ${tokenAddress}: ${error.message}`);
      return 0;
    }
  }

  calculateRiskMetrics(assets) {
    console.log('⚠️  CALCULATING RISK METRICS');
    console.log('════════════════════════════');
    
    if (assets.length === 0) {
      return {
        volatility: 0,
        concentrationRisk: 0,
        diversification: 0,
        totalExposure: 0,
        riskScore: 0
      };
    }
    
    const totalValue = assets.reduce((sum, asset) => sum + asset.usdValue, 0);
    
    // Calculate concentration risk (max asset % of portfolio)
    const maxAssetPercentage = Math.max(...assets.map(asset => asset.percentageOfPortfolio));
    
    // Calculate diversification score
    const diversification = assets.length;
    
    // Calculate volatility approximation (simplified)
    // In a real system, this would use historical price data
    let volatility = 0;
    assets.forEach(asset => {
      // Approximate volatility based on asset type
      const assetVolatilities = {
        'MATIC': 0.8,
        'WMATIC': 0.8,
        'USDC': 0.05,
        'USDC.e': 0.05,
        'USDT': 0.05,
        'DAI': 0.05,
        'WETH': 0.6,
        'WBTC': 0.4,
        'stMATIC': 0.7
      };
      
      const assetVol = assetVolatilities[asset.symbol] || 0.5;
      const weight = asset.usdValue / totalValue;
      volatility += weight * assetVol;
    });
    
    // Calculate risk score (0-100)
    const concentrationScore = Math.max(0, 100 - (maxAssetPercentage / this.riskThresholds.maxSingleAssetExposure) * 100);
    const diversificationScore = Math.min(100, (diversification / this.riskThresholds.minDiversification) * 100);
    const volatilityScore = Math.max(0, 100 - (volatility / this.riskThresholds.maxPortfolioVolatility) * 100);
    
    const riskScore = (concentrationScore + diversificationScore + volatilityScore) / 3;
    
    const metrics = {
      volatility: volatility,
      concentrationRisk: maxAssetPercentage,
      diversification: diversification,
      totalExposure: totalValue,
      riskScore: riskScore
    };
    
    console.log(`Volatility: ${(volatility * 100).toFixed(2)}%`);
    console.log(`Concentration Risk: ${maxAssetPercentage.toFixed(2)}%`);
    console.log(`Diversification: ${diversification} assets`);
    console.log(`Risk Score: ${riskScore.toFixed(2)}/100`);
    console.log('');
    
    return metrics;
  }

  assessPortfolioRisk(portfolioState) {
    console.log('📋 PORTFOLIO RISK ASSESSMENT');
    console.log('═════════════════════════════');
    
    const { riskMetrics } = portfolioState;
    const issues = [];
    
    // Check volatility
    if (riskMetrics.volatility > this.riskThresholds.maxPortfolioVolatility) {
      issues.push(`High portfolio volatility: ${(riskMetrics.volatility * 100).toFixed(2)}% (max ${this.riskThresholds.maxPortfolioVolatility * 100}%)`);
    }
    
    // Check concentration
    if (riskMetrics.concentrationRisk > this.riskThresholds.maxSingleAssetExposure * 100) {
      issues.push(`High concentration risk: ${riskMetrics.concentrationRisk.toFixed(2)}% in single asset (max ${this.riskThresholds.maxSingleAssetExposure * 100}%)`);
    }
    
    // Check diversification
    if (riskMetrics.diversification < this.riskThresholds.minDiversification) {
      issues.push(`Low diversification: ${riskMetrics.diversification} assets (min ${this.riskThresholds.minDiversification})`);
    }
    
    // Overall risk rating
    let riskRating = 'LOW';
    if (riskMetrics.riskScore < 30) riskRating = 'HIGH';
    else if (riskMetrics.riskScore < 70) riskRating = 'MEDIUM';
    
    console.log(`📊 OVERALL RISK RATING: ${riskRating} (${riskMetrics.riskScore.toFixed(2)}/100)`);
    
    if (issues.length > 0) {
      console.log('\n⚠️  RISK ISSUES IDENTIFIED:');
      issues.forEach(issue => console.log(`  • ${issue}`));
    } else {
      console.log('\n✅ PORTFOLIO RISK PROFILE IS HEALTHY');
    }
    
    console.log('');
    
    return {
      riskRating,
      riskScore: riskMetrics.riskScore,
      issues,
      recommendations: this.generateRecommendations(portfolioState, issues)
    };
  }

  generateRecommendations(portfolioState, issues) {
    const recommendations = [];
    
    // If no issues, provide general advice
    if (issues.length === 0) {
      recommendations.push('Maintain current portfolio allocation');
      recommendations.push('Continue monitoring market conditions');
      return recommendations;
    }
    
    // Specific recommendations based on issues
    if (issues.some(issue => issue.includes('volatility'))) {
      recommendations.push('Consider adding more stable assets (USDC, USDT, DAI)');
      recommendations.push('Reduce exposure to high-volatility assets (MATIC, ETH, BTC)');
    }
    
    if (issues.some(issue => issue.includes('concentration'))) {
      recommendations.push('Diversify portfolio by adding new asset classes');
      recommendations.push('Reduce position size in largest holding');
    }
    
    if (issues.some(issue => issue.includes('diversification'))) {
      recommendations.push('Add exposure to different asset classes');
      recommendations.push('Consider stablecoins, liquid staking tokens, or other DeFi assets');
    }
    
    return recommendations;
  }

  savePortfolioState(portfolioState) {
    const dir = 'data/risk-assessments';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filename = `assessment-${Date.now()}.json`;
    const filepath = `${dir}/${filename}`;
    
    fs.writeFileSync(filepath, JSON.stringify(portfolioState, null, 2));
    console.log(`💾 Risk assessment saved: ${filename}`);
    console.log('');
  }

  async runFullRiskAssessment() {
    try {
      console.log('🛡️  FEWS RISK MANAGEMENT SYSTEM');
      console.log('════════════════════════════════');
      
      // Get portfolio state
      const portfolioState = await this.getPortfolioState();
      
      // Assess risk
      const riskAssessment = this.assessPortfolioRisk(portfolioState);
      
      // Combine results
      const fullAssessment = {
        ...portfolioState,
        riskAssessment,
        generatedAt: new Date().toISOString()
      };
      
      console.log('📈 RISK ASSESSMENT COMPLETE');
      console.log('═════════════════════════════');
      console.log(`Portfolio Value: $${portfolioState.totalValue.toFixed(2)}`);
      console.log(`Risk Rating: ${riskAssessment.riskRating}`);
      console.log(`Risk Score: ${riskAssessment.riskScore.toFixed(2)}/100`);
      
      if (riskAssessment.recommendations.length > 0) {
        console.log('\n💡 RECOMMENDATIONS:');
        riskAssessment.recommendations.forEach(rec => console.log(`  • ${rec}`));
      }
      
      console.log('\n✅ RISK ASSESSMENT COMPLETED SUCCESSFULLY');
      
      return fullAssessment;
    } catch (error) {
      console.error('❌ Risk assessment failed:', error);
      throw error;
    }
  }
}

async function main() {
  try {
    const riskManager = new RiskManagementSystem();
    await riskManager.runFullRiskAssessment();
  } catch (error) {
    console.error('💥 FATAL ERROR:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = RiskManagementSystem;
