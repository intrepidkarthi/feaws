// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimpleRealTimeYieldOracle
 * @dev Simplified real-time yield oracle with dynamic fluctuations
 * @notice Demonstrates realistic market conditions with live yield updates
 */
contract SimpleRealTimeYieldOracle is Ownable {
    
    // Yield data structure
    struct YieldData {
        uint256 yieldRate;      // Yield rate in basis points
        uint256 lastUpdated;    // Last update timestamp
        bool isActive;          // Whether the yield source is active
    }
    
    // Real-time configuration
    struct YieldConfig {
        uint256 baseYield;        // Base yield rate (basis points)
        uint256 volatility;       // Volatility factor (basis points)
        uint256 lastUpdate;       // Last update timestamp
        uint256 trendDirection;   // 0=down, 1=stable, 2=up
        bool isActive;            // Whether real-time updates are active
    }
    
    // Storage mappings
    mapping(uint256 => mapping(address => YieldData)) public yields;
    mapping(uint256 => mapping(address => YieldConfig)) public yieldConfigs;
    mapping(uint256 => mapping(address => uint256[])) public yieldHistory;
    mapping(uint256 => bool) public supportedChains;
    mapping(address => bool) public supportedAssets;
    
    // Constants
    uint256 public constant UPDATE_INTERVAL = 60; // 1 minute
    uint256 public constant MAX_VOLATILITY = 200; // 2% max volatility
    uint256 public constant HISTORY_LENGTH = 100; // Keep 100 data points
    
    // Events
    event YieldUpdated(
        uint256 indexed chainId,
        address indexed asset,
        uint256 oldYield,
        uint256 newYield,
        uint256 timestamp
    );
    
    event RealTimeYieldUpdate(
        uint256 indexed chainId,
        address indexed asset,
        uint256 oldYield,
        uint256 newYield,
        uint256 timestamp
    );
    
    event ArbitrageOpportunityDetected(
        uint256 fromChain,
        uint256 toChain,
        address asset,
        uint256 yieldDifference,
        uint256 potentialProfit
    );
    
    event ChainAdded(uint256 indexed chainId, string chainName);
    event AssetAdded(address indexed asset, string assetSymbol);

    constructor() {
        // Initialize with test chains
        supportedChains[1] = true; // Ethereum
        supportedChains[11155111] = true; // Sepolia
        supportedChains[42793] = true; // Etherlink
    }

    /**
     * @dev Add support for a new chain
     */
    function addChain(uint256 chainId, string calldata chainName) external onlyOwner {
        supportedChains[chainId] = true;
        emit ChainAdded(chainId, chainName);
    }

    /**
     * @dev Add support for a new asset
     */
    function addAsset(address asset, string calldata assetSymbol) external onlyOwner {
        require(asset != address(0), "Invalid asset address");
        supportedAssets[asset] = true;
        emit AssetAdded(asset, assetSymbol);
    }

    /**
     * @dev Set yield rate for a specific chain and asset
     */
    function setYield(
        uint256 chainId,
        address asset,
        uint256 yieldRate
    ) public onlyOwner {
        require(supportedChains[chainId], "Chain not supported");
        require(supportedAssets[asset], "Asset not supported");
        require(yieldRate <= 2000, "Yield rate too high (max 20%)");
        
        uint256 oldYield = yields[chainId][asset].yieldRate;
        
        yields[chainId][asset] = YieldData({
            yieldRate: yieldRate,
            lastUpdated: block.timestamp,
            isActive: true
        });
        
        emit YieldUpdated(chainId, asset, oldYield, yieldRate, block.timestamp);
    }

    /**
     * @dev Get current yield rate for a chain and asset
     */
    function getYield(
        uint256 chainId,
        address asset
    ) external view returns (uint256 yieldRate, uint256 lastUpdated, bool isActive) {
        YieldData memory data = yields[chainId][asset];
        return (data.yieldRate, data.lastUpdated, data.isActive);
    }

    /**
     * @dev Initialize real-time yield configuration
     */
    function initializeRealTimeYield(
        uint256 chainId,
        address asset,
        uint256 baseYield,
        uint256 volatility
    ) external onlyOwner {
        require(supportedChains[chainId], "Chain not supported");
        require(supportedAssets[asset], "Asset not supported");
        require(volatility <= MAX_VOLATILITY, "Volatility too high");
        
        yieldConfigs[chainId][asset] = YieldConfig({
            baseYield: baseYield,
            volatility: volatility,
            lastUpdate: block.timestamp,
            trendDirection: 1, // Start stable
            isActive: true
        });
        
        // Initialize with base yield
        setYield(chainId, asset, baseYield);
        
        // Initialize history
        yieldHistory[chainId][asset].push(baseYield);
    }

    /**
     * @dev Update yields with realistic market fluctuations
     */
    function updateRealTimeYield(uint256 chainId, address asset) external {
        YieldConfig storage config = yieldConfigs[chainId][asset];
        require(config.isActive, "Real-time updates not active");
        require(
            block.timestamp >= config.lastUpdate + UPDATE_INTERVAL,
            "Update too frequent"
        );
        
        uint256 currentYield = yields[chainId][asset].yieldRate;
        uint256 newYield = _calculateNewYield(chainId, asset, currentYield);
        
        // Update yield
        setYield(chainId, asset, newYield);
        
        // Update configuration
        config.lastUpdate = block.timestamp;
        
        // Update history
        _updateYieldHistory(chainId, asset, newYield);
        
        // Check for trend changes
        _updateTrend(chainId, asset);
        
        emit RealTimeYieldUpdate(
            chainId,
            asset,
            currentYield,
            newYield,
            block.timestamp
        );
        
        // Check for arbitrage opportunities
        _checkArbitrageOpportunities(asset);
    }

    /**
     * @dev Calculate new yield based on volatility and trends
     */
    function _calculateNewYield(
        uint256 chainId,
        address asset,
        uint256 currentYield
    ) internal view returns (uint256 newYield) {
        YieldConfig storage config = yieldConfigs[chainId][asset];
        
        // Generate pseudo-random fluctuation
        uint256 randomSeed = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    chainId,
                    asset
                )
            )
        );
        
        // Calculate fluctuation (-volatility to +volatility)
        int256 fluctuation = int256(randomSeed % (config.volatility * 2)) - int256(config.volatility);
        
        // Apply trend bias
        if (config.trendDirection == 0) {
            // Downward trend
            fluctuation = fluctuation > int256(config.volatility / 2) ? 
                fluctuation - int256(config.volatility / 2) : fluctuation;
        } else if (config.trendDirection == 2) {
            // Upward trend
            fluctuation = fluctuation < int256(config.volatility / 2) ? 
                fluctuation + int256(config.volatility / 2) : fluctuation;
        }
        
        // Apply fluctuation with bounds checking
        if (fluctuation < 0 && uint256(-fluctuation) > currentYield) {
            newYield = 10; // Floor at 0.1%
        } else if (fluctuation < 0) {
            newYield = currentYield - uint256(-fluctuation);
        } else {
            newYield = currentYield + uint256(fluctuation);
        }
        
        // Cap at reasonable maximum (20%)
        if (newYield > 2000) {
            newYield = 2000;
        }
        
        // Floor at minimum (0.1%)
        if (newYield < 10) {
            newYield = 10;
        }
    }

    /**
     * @dev Update yield history
     */
    function _updateYieldHistory(
        uint256 chainId,
        address asset,
        uint256 newYield
    ) internal {
        uint256[] storage history = yieldHistory[chainId][asset];
        
        history.push(newYield);
        
        // Maintain fixed history length
        if (history.length > HISTORY_LENGTH) {
            // Remove oldest entry
            for (uint i = 0; i < history.length - 1; i++) {
                history[i] = history[i + 1];
            }
            history.pop();
        }
    }

    /**
     * @dev Update trend direction based on recent history
     */
    function _updateTrend(uint256 chainId, address asset) internal {
        uint256[] storage history = yieldHistory[chainId][asset];
        if (history.length < 5) return;
        
        YieldConfig storage config = yieldConfigs[chainId][asset];
        
        // Calculate trend from last 5 data points
        uint256 recent = 0;
        uint256 older = 0;
        
        for (uint i = history.length - 3; i < history.length; i++) {
            recent += history[i];
        }
        
        for (uint i = history.length - 6; i < history.length - 3; i++) {
            older += history[i];
        }
        
        recent = recent / 3;
        older = older / 3;
        
        // Update trend
        if (recent > older + 10) { // 0.1% threshold
            config.trendDirection = 2; // Upward
        } else if (recent < older - 10) {
            config.trendDirection = 0; // Downward
        } else {
            config.trendDirection = 1; // Stable
        }
    }

    /**
     * @dev Check for arbitrage opportunities
     */
    function _checkArbitrageOpportunities(address asset) internal {
        uint256[] memory chainIds = getSupportedChainIds();
        
        for (uint i = 0; i < chainIds.length; i++) {
            for (uint j = i + 1; j < chainIds.length; j++) {
                uint256 chain1 = chainIds[i];
                uint256 chain2 = chainIds[j];
                
                (uint256 yield1, , bool active1) = this.getYield(chain1, asset);
                (uint256 yield2, , bool active2) = this.getYield(chain2, asset);
                
                if (active1 && active2) {
                    uint256 yieldDiff = yield1 > yield2 ? yield1 - yield2 : yield2 - yield1;
                    
                    if (yieldDiff >= 50) { // 0.5% threshold
                        uint256 fromChain = yield1 > yield2 ? chain2 : chain1;
                        uint256 toChain = yield1 > yield2 ? chain1 : chain2;
                        
                        emit ArbitrageOpportunityDetected(
                            fromChain,
                            toChain,
                            asset,
                            yieldDiff,
                            yieldDiff * 1000
                        );
                    }
                }
            }
        }
    }

    /**
     * @dev Get supported chain IDs
     */
    function getSupportedChainIds() public pure returns (uint256[] memory) {
        uint256[] memory chainIds = new uint256[](3);
        chainIds[0] = 1; // Ethereum
        chainIds[1] = 11155111; // Sepolia
        chainIds[2] = 42793; // Etherlink
        return chainIds;
    }

    /**
     * @dev Batch update all real-time yields for a specific asset
     */
    function updateAllRealTimeYieldsForAsset(address asset) external {
        uint256[] memory chainIds = getSupportedChainIds();
        
        for (uint i = 0; i < chainIds.length; i++) {
            YieldConfig storage config = yieldConfigs[chainIds[i]][asset];
            
            if (config.isActive && 
                block.timestamp >= config.lastUpdate + UPDATE_INTERVAL) {
                
                this.updateRealTimeYield(chainIds[i], asset);
            }
        }
    }

    /**
     * @dev Get yield history for a specific asset and chain
     */
    function getYieldHistory(
        uint256 chainId,
        address asset
    ) external view returns (uint256[] memory) {
        return yieldHistory[chainId][asset];
    }

    /**
     * @dev Get real-time configuration for an asset
     */
    function getRealTimeConfig(
        uint256 chainId,
        address asset
    ) external view returns (YieldConfig memory) {
        return yieldConfigs[chainId][asset];
    }

    /**
     * @dev Get current arbitrage opportunities
     */
    function getCurrentArbitrageOpportunities(
        address asset
    ) external view returns (
        uint256[] memory fromChains,
        uint256[] memory toChains,
        uint256[] memory yieldDifferences
    ) {
        uint256[] memory chainIds = getSupportedChainIds();
        uint256 opportunityCount = 0;
        
        // First pass: count opportunities
        for (uint i = 0; i < chainIds.length; i++) {
            for (uint j = i + 1; j < chainIds.length; j++) {
                (uint256 yield1, , bool active1) = this.getYield(chainIds[i], asset);
                (uint256 yield2, , bool active2) = this.getYield(chainIds[j], asset);
                
                if (active1 && active2) {
                    uint256 yieldDiff = yield1 > yield2 ? yield1 - yield2 : yield2 - yield1;
                    if (yieldDiff >= 50) {
                        opportunityCount++;
                    }
                }
            }
        }
        
        // Second pass: populate arrays
        fromChains = new uint256[](opportunityCount);
        toChains = new uint256[](opportunityCount);
        yieldDifferences = new uint256[](opportunityCount);
        
        uint256 index = 0;
        for (uint i = 0; i < chainIds.length && index < opportunityCount; i++) {
            for (uint j = i + 1; j < chainIds.length && index < opportunityCount; j++) {
                (uint256 yield1, , bool active1) = this.getYield(chainIds[i], asset);
                (uint256 yield2, , bool active2) = this.getYield(chainIds[j], asset);
                
                if (active1 && active2) {
                    uint256 yieldDiff = yield1 > yield2 ? yield1 - yield2 : yield2 - yield1;
                    if (yieldDiff >= 50) {
                        fromChains[index] = yield1 > yield2 ? chainIds[j] : chainIds[i];
                        toChains[index] = yield1 > yield2 ? chainIds[i] : chainIds[j];
                        yieldDifferences[index] = yieldDiff;
                        index++;
                    }
                }
            }
        }
    }
}
