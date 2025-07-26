// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AdvancedArbitrageCalculator
 * @dev Sophisticated arbitrage calculations considering real-world factors
 * @notice Calculates net profit after gas, bridge fees, slippage, and market impact
 */
contract AdvancedArbitrageCalculator is Ownable {
    
    // Chain configuration for gas and bridge costs
    struct ChainConfig {
        uint256 avgGasPrice;        // Average gas price in gwei
        uint256 bridgeFeeRate;      // Bridge fee rate in basis points
        uint256 bridgeFixedFee;     // Fixed bridge fee in wei
        uint256 executionGas;       // Gas required for execution
        uint256 blockTime;          // Average block time in seconds
        bool isActive;              // Whether chain is active
    }
    
    // Market impact parameters
    struct MarketImpact {
        uint256 liquidityDepth;     // Available liquidity in USD
        uint256 impactThreshold;    // Threshold for market impact (USD)
        uint256 maxImpactRate;      // Maximum impact rate in basis points
        uint256 priceDecayRate;     // Price recovery rate per block
    }
    
    // Arbitrage opportunity data
    struct ArbitrageOpportunity {
        uint256 fromChain;
        uint256 toChain;
        address asset;
        uint256 grossYieldDiff;     // Gross yield difference (basis points)
        uint256 amount;             // Trade amount in USD
        uint256 netProfit;          // Net profit after all costs
        uint256 profitMargin;       // Profit margin percentage
        bool isProfitable;          // Whether trade is profitable
        uint256 executionTime;      // Estimated execution time
        uint256 riskScore;          // Risk assessment (0-100)
    }
    
    // Storage
    mapping(uint256 => ChainConfig) public chainConfigs;
    mapping(address => MarketImpact) public marketImpacts;
    
    // Constants
    uint256 public constant MIN_PROFIT_THRESHOLD = 50; // 0.5% minimum profit
    uint256 public constant MAX_SLIPPAGE = 300; // 3% max slippage
    uint256 public constant RISK_FREE_RATE = 200; // 2% risk-free rate
    uint256 public constant BASIS_POINTS = 10000;
    
    // Events
    event ArbitrageCalculated(
        uint256 indexed fromChain,
        uint256 indexed toChain,
        address indexed asset,
        uint256 amount,
        uint256 netProfit,
        bool isProfitable
    );
    
    event ChainConfigUpdated(
        uint256 indexed chainId,
        uint256 gasPrice,
        uint256 bridgeFeeRate
    );
    
    event MarketImpactUpdated(
        address indexed asset,
        uint256 liquidityDepth,
        uint256 impactThreshold
    );

    constructor() {
        _initializeChainConfigs();
        _initializeMarketImpacts();
    }

    /**
     * @dev Initialize default chain configurations
     */
    function _initializeChainConfigs() internal {
        // Ethereum Mainnet
        chainConfigs[1] = ChainConfig({
            avgGasPrice: 20 gwei,
            bridgeFeeRate: 30, // 0.3%
            bridgeFixedFee: 0.01 ether,
            executionGas: 200000,
            blockTime: 12,
            isActive: true
        });
        
        // Sepolia Testnet
        chainConfigs[11155111] = ChainConfig({
            avgGasPrice: 2 gwei,
            bridgeFeeRate: 25, // 0.25%
            bridgeFixedFee: 0.001 ether,
            executionGas: 180000,
            blockTime: 12,
            isActive: true
        });
        
        // Etherlink
        chainConfigs[42793] = ChainConfig({
            avgGasPrice: 1 gwei,
            bridgeFeeRate: 20, // 0.2%
            bridgeFixedFee: 0.0005 ether,
            executionGas: 150000,
            blockTime: 6,
            isActive: true
        });
    }

    /**
     * @dev Initialize default market impact parameters
     */
    function _initializeMarketImpacts() internal {
        // Default market impact for demonstration
        // In production, this would be updated from real market data
    }

    /**
     * @dev Calculate comprehensive arbitrage analysis
     * @param fromChain Source chain ID
     * @param toChain Destination chain ID
     * @param asset Asset address
     * @param grossYieldDiff Gross yield difference in basis points
     * @param amount Trade amount in USD (scaled by 1e18)
     * @return opportunity Complete arbitrage opportunity analysis
     */
    function calculateArbitrageOpportunity(
        uint256 fromChain,
        uint256 toChain,
        address asset,
        uint256 grossYieldDiff,
        uint256 amount
    ) external returns (ArbitrageOpportunity memory opportunity) {
        require(chainConfigs[fromChain].isActive, "Source chain not active");
        require(chainConfigs[toChain].isActive, "Destination chain not active");
        require(amount > 0, "Amount must be positive");
        
        // Calculate gross profit
        uint256 grossProfit = (amount * grossYieldDiff) / BASIS_POINTS;
        
        // Calculate total costs
        uint256 totalCosts = _calculateGasCosts(fromChain, toChain, amount) +
                           _calculateBridgeFees(fromChain, toChain, amount) +
                           _calculateSlippage(asset, amount) +
                           _calculateMarketImpact(asset, amount);
        
        // Calculate net profit and margin
        uint256 netProfit = grossProfit > totalCosts ? grossProfit - totalCosts : 0;
        uint256 profitMargin = amount > 0 ? (netProfit * BASIS_POINTS) / amount : 0;
        
        // Determine profitability and calculate metrics
        bool isProfitable = profitMargin >= MIN_PROFIT_THRESHOLD && netProfit > 0;
        uint256 executionTime = _calculateExecutionTime(fromChain, toChain);
        uint256 riskScore = _calculateRiskScore(fromChain, toChain, amount, profitMargin);
        
        opportunity = ArbitrageOpportunity({
            fromChain: fromChain,
            toChain: toChain,
            asset: asset,
            grossYieldDiff: grossYieldDiff,
            amount: amount,
            netProfit: netProfit,
            profitMargin: profitMargin,
            isProfitable: isProfitable,
            executionTime: executionTime,
            riskScore: riskScore
        });
        
        emit ArbitrageCalculated(
            fromChain,
            toChain,
            asset,
            amount,
            netProfit,
            isProfitable
        );
    }

    /**
     * @dev Calculate gas costs for cross-chain execution
     * @param fromChain Source chain ID
     * @param toChain Destination chain ID
     * @param amount Trade amount
     * @return totalGasCost Total gas cost in USD (scaled by 1e18)
     */
    function _calculateGasCosts(
        uint256 fromChain,
        uint256 toChain,
        uint256 amount
    ) internal view returns (uint256 totalGasCost) {
        ChainConfig memory fromConfig = chainConfigs[fromChain];
        ChainConfig memory toConfig = chainConfigs[toChain];
        
        // Calculate gas cost on source chain
        uint256 fromChainGasCost = fromConfig.avgGasPrice * fromConfig.executionGas;
        
        // Calculate gas cost on destination chain
        uint256 toChainGasCost = toConfig.avgGasPrice * toConfig.executionGas;
        
        // Convert to USD (simplified - in production use price oracles)
        // Assuming 1 ETH = $2000 for demonstration
        uint256 ethPriceUSD = 2000 * 1e18;
        
        totalGasCost = ((fromChainGasCost + toChainGasCost) * ethPriceUSD) / 1e18;
        
        // Add complexity factor for larger amounts
        if (amount > 100000 * 1e18) { // > $100k
            totalGasCost = (totalGasCost * 120) / 100; // 20% increase
        }
    }

    /**
     * @dev Calculate bridge fees
     * @param fromChain Source chain ID
     * @param amount Trade amount
     * @return bridgeFee Total bridge fee in USD
     */
    function _calculateBridgeFees(
        uint256 fromChain,
        uint256 /* toChain */,
        uint256 amount
    ) internal view returns (uint256 bridgeFee) {
        ChainConfig memory fromConfig = chainConfigs[fromChain];
        
        // Variable fee based on amount
        uint256 variableFee = (amount * fromConfig.bridgeFeeRate) / BASIS_POINTS;
        
        // Fixed fee (convert from wei to USD)
        uint256 ethPriceUSD = 2000 * 1e18;
        uint256 fixedFee = (fromConfig.bridgeFixedFee * ethPriceUSD) / 1e18;
        
        bridgeFee = variableFee + fixedFee;
    }

    /**
     * @dev Calculate slippage cost
     * @param amount Trade amount
     * @return slippageCost Estimated slippage cost
     */
    function _calculateSlippage(
        address /* asset */,
        uint256 amount
    ) internal pure returns (uint256 slippageCost) {
        // Simplified slippage model
        // In production, this would use real DEX liquidity data
        
        uint256 baseSlippage = 10; // 0.1% base slippage
        
        // Increase slippage for larger amounts
        if (amount > 50000 * 1e18) { // > $50k
            baseSlippage = 25; // 0.25%
        }
        if (amount > 100000 * 1e18) { // > $100k
            baseSlippage = 50; // 0.5%
        }
        if (amount > 500000 * 1e18) { // > $500k
            baseSlippage = 100; // 1%
        }
        
        // Cap at maximum slippage
        if (baseSlippage > MAX_SLIPPAGE) {
            baseSlippage = MAX_SLIPPAGE;
        }
        
        slippageCost = (amount * baseSlippage) / BASIS_POINTS;
    }

    /**
     * @dev Calculate market impact cost
     * @param asset Asset address
     * @param amount Trade amount
     * @return impactCost Market impact cost
     */
    function _calculateMarketImpact(
        address asset,
        uint256 amount
    ) internal view returns (uint256 impactCost) {
        MarketImpact memory impact = marketImpacts[asset];
        
        // If no specific config, use default
        if (impact.liquidityDepth == 0) {
            impact.liquidityDepth = 1000000 * 1e18; // $1M default
            impact.impactThreshold = 10000 * 1e18; // $10k threshold
            impact.maxImpactRate = 200; // 2% max impact
        }
        
        // Calculate impact based on amount vs liquidity
        if (amount <= impact.impactThreshold) {
            impactCost = 0; // No impact for small trades
        } else {
            uint256 excessAmount = amount - impact.impactThreshold;
            uint256 impactRatio = (excessAmount * BASIS_POINTS) / impact.liquidityDepth;
            
            // Cap impact ratio
            if (impactRatio > impact.maxImpactRate) {
                impactRatio = impact.maxImpactRate;
            }
            
            impactCost = (amount * impactRatio) / BASIS_POINTS;
        }
    }

    /**
     * @dev Calculate estimated execution time
     * @param fromChain Source chain ID
     * @param toChain Destination chain ID
     * @return executionTime Estimated time in seconds
     */
    function _calculateExecutionTime(
        uint256 fromChain,
        uint256 toChain
    ) internal view returns (uint256 executionTime) {
        ChainConfig memory fromConfig = chainConfigs[fromChain];
        ChainConfig memory toConfig = chainConfigs[toChain];
        
        // Base execution time: 2 blocks on each chain + bridge time
        uint256 baseTime = (fromConfig.blockTime * 2) + (toConfig.blockTime * 2);
        
        // Add bridge confirmation time (varies by bridge)
        uint256 bridgeTime = 300; // 5 minutes average
        
        executionTime = baseTime + bridgeTime;
    }

    /**
     * @dev Calculate risk score (0-100, higher = riskier)
     * @param fromChain Source chain ID
     * @param toChain Destination chain ID
     * @param amount Trade amount
     * @param profitMargin Profit margin in basis points
     * @return riskScore Risk score from 0-100
     */
    function _calculateRiskScore(
        uint256 fromChain,
        uint256 toChain,
        uint256 amount,
        uint256 profitMargin
    ) internal view returns (uint256 riskScore) {
        uint256 risk = 0;
        
        // Amount risk (larger amounts = higher risk)
        if (amount > 100000 * 1e18) risk += 20; // $100k+
        if (amount > 500000 * 1e18) risk += 20; // $500k+
        if (amount > 1000000 * 1e18) risk += 20; // $1M+
        
        // Profit margin risk (lower margins = higher risk)
        if (profitMargin < 100) risk += 30; // < 1%
        else if (profitMargin < 200) risk += 20; // < 2%
        else if (profitMargin < 500) risk += 10; // < 5%
        
        // Chain risk (testnet vs mainnet)
        if (fromChain != 1 && toChain != 1) risk += 15; // Both testnets
        
        // Execution time risk
        uint256 execTime = _calculateExecutionTime(fromChain, toChain);
        if (execTime > 600) risk += 10; // > 10 minutes
        
        riskScore = risk > 100 ? 100 : risk;
    }

    /**
     * @dev Update chain configuration
     * @param chainId Chain ID to update
     * @param gasPrice New gas price
     * @param bridgeFeeRate New bridge fee rate
     * @param bridgeFixedFee New bridge fixed fee
     * @param executionGas New execution gas
     */
    function updateChainConfig(
        uint256 chainId,
        uint256 gasPrice,
        uint256 bridgeFeeRate,
        uint256 bridgeFixedFee,
        uint256 executionGas
    ) external onlyOwner {
        ChainConfig storage config = chainConfigs[chainId];
        config.avgGasPrice = gasPrice;
        config.bridgeFeeRate = bridgeFeeRate;
        config.bridgeFixedFee = bridgeFixedFee;
        config.executionGas = executionGas;
        
        emit ChainConfigUpdated(chainId, gasPrice, bridgeFeeRate);
    }

    /**
     * @dev Update market impact parameters
     * @param asset Asset address
     * @param liquidityDepth Available liquidity
     * @param impactThreshold Impact threshold
     * @param maxImpactRate Maximum impact rate
     */
    function updateMarketImpact(
        address asset,
        uint256 liquidityDepth,
        uint256 impactThreshold,
        uint256 maxImpactRate
    ) external onlyOwner {
        marketImpacts[asset] = MarketImpact({
            liquidityDepth: liquidityDepth,
            impactThreshold: impactThreshold,
            maxImpactRate: maxImpactRate,
            priceDecayRate: 100 // 1% per block default
        });
        
        emit MarketImpactUpdated(asset, liquidityDepth, impactThreshold);
    }

    /**
     * @dev Get detailed cost breakdown
     * @param fromChain Source chain ID
     * @param toChain Destination chain ID
     * @param asset Asset address
     * @param amount Trade amount
     * @return gasCosts Gas costs in USD
     * @return bridgeFees Bridge fees in USD
     * @return slippageCost Slippage cost in USD
     * @return marketImpactCost Market impact cost in USD
     */
    function getCostBreakdown(
        uint256 fromChain,
        uint256 toChain,
        address asset,
        uint256 amount
    ) external view returns (
        uint256 gasCosts,
        uint256 bridgeFees,
        uint256 slippageCost,
        uint256 marketImpactCost
    ) {
        gasCosts = _calculateGasCosts(fromChain, toChain, amount);
        bridgeFees = _calculateBridgeFees(fromChain, toChain, amount);
        slippageCost = _calculateSlippage(asset, amount);
        marketImpactCost = _calculateMarketImpact(asset, amount);
    }

    /**
     * @dev Batch calculate multiple arbitrage opportunities
     * @param opportunities Array of basic opportunity data
     * @return results Array of detailed arbitrage analyses
     */
    function batchCalculateArbitrage(
        ArbitrageOpportunity[] calldata opportunities
    ) external returns (ArbitrageOpportunity[] memory results) {
        results = new ArbitrageOpportunity[](opportunities.length);
        
        for (uint i = 0; i < opportunities.length; i++) {
            results[i] = this.calculateArbitrageOpportunity(
                opportunities[i].fromChain,
                opportunities[i].toChain,
                opportunities[i].asset,
                opportunities[i].grossYieldDiff,
                opportunities[i].amount
            );
        }
    }
}
