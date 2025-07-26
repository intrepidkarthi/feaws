// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title YieldOracle
 * @dev Cross-chain yield monitoring system for ETHGlobal UNITE demo
 * @notice Provides configurable yield rates for different chains and assets
 */
contract YieldOracle is Ownable {
    
    // Yield rates stored in basis points (1% = 100 basis points)
    struct YieldData {
        uint256 yieldRate;      // Current yield rate in basis points
        uint256 lastUpdated;    // Timestamp of last update
        bool isActive;          // Whether this yield source is active
    }
    
    // Chain ID => Asset Address => Yield Data
    mapping(uint256 => mapping(address => YieldData)) public yields;
    
    // Supported chains and assets
    mapping(uint256 => bool) public supportedChains;
    mapping(address => bool) public supportedAssets;
    
    // Global yield threshold for strategy execution (basis points)
    uint256 public globalYieldThreshold = 380; // 3.8%
    
    // Events
    event YieldUpdated(
        uint256 indexed chainId,
        address indexed asset,
        uint256 oldYield,
        uint256 newYield,
        uint256 timestamp
    );
    
    event ChainAdded(uint256 indexed chainId, string chainName);
    event AssetAdded(address indexed asset, string assetSymbol);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event YieldSourceActivated(uint256 indexed chainId, address indexed asset);
    event YieldSourceDeactivated(uint256 indexed chainId, address indexed asset);
    
    constructor() {
        // Initialize with common test networks
        _addChain(1, "Ethereum Mainnet");
        _addChain(11155111, "Sepolia");
        _addChain(128123, "Etherlink Ghostnet");
        
        // Set initial demo yields
        _setInitialYields();
    }
    
    /**
     * @dev Set yield rate for a specific chain and asset
     * @param chainId Chain identifier
     * @param asset Asset contract address
     * @param yieldRate Yield rate in basis points (e.g., 380 = 3.8%)
     */
    function setYield(
        uint256 chainId,
        address asset,
        uint256 yieldRate
    ) external onlyOwner {
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
     * @param chainId Chain identifier
     * @param asset Asset contract address
     * @return yieldRate Current yield rate in basis points
     * @return lastUpdated Timestamp of last update
     * @return isActive Whether the yield source is active
     */
    function getYield(
        uint256 chainId,
        address asset
    ) external view returns (uint256 yieldRate, uint256 lastUpdated, bool isActive) {
        YieldData memory data = yields[chainId][asset];
        return (data.yieldRate, data.lastUpdated, data.isActive);
    }
    
    /**
     * @dev Check if yield meets the global threshold
     * @param chainId Chain identifier
     * @param asset Asset contract address
     * @return bool True if yield >= threshold
     */
    function isYieldAboveThreshold(
        uint256 chainId,
        address asset
    ) external view returns (bool) {
        return yields[chainId][asset].yieldRate >= globalYieldThreshold &&
               yields[chainId][asset].isActive;
    }
    
    /**
     * @dev Get the best yield across all supported chains for an asset
     * @param asset Asset contract address
     * @return bestChainId Chain with highest yield
     * @return bestYield Highest yield rate found
     */
    function getBestYield(
        address asset
    ) external view returns (uint256 bestChainId, uint256 bestYield) {
        uint256[] memory chainIds = getSupportedChainIds();
        
        for (uint256 i = 0; i < chainIds.length; i++) {
            uint256 chainId = chainIds[i];
            YieldData memory data = yields[chainId][asset];
            
            if (data.isActive && data.yieldRate > bestYield) {
                bestYield = data.yieldRate;
                bestChainId = chainId;
            }
        }
    }
    
    /**
     * @dev Set global yield threshold
     * @param newThreshold New threshold in basis points
     */
    function setGlobalThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold <= 1000, "Threshold too high (max 10%)");
        
        uint256 oldThreshold = globalYieldThreshold;
        globalYieldThreshold = newThreshold;
        
        emit ThresholdUpdated(oldThreshold, newThreshold);
    }
    
    /**
     * @dev Add support for a new chain
     * @param chainId Chain identifier
     * @param chainName Human readable chain name
     */
    function addChain(uint256 chainId, string calldata chainName) external onlyOwner {
        _addChain(chainId, chainName);
    }
    
    /**
     * @dev Add support for a new asset
     * @param asset Asset contract address
     * @param assetSymbol Asset symbol (e.g., "USDC", "stETH")
     */
    function addAsset(address asset, string calldata assetSymbol) external onlyOwner {
        require(asset != address(0), "Invalid asset address");
        
        supportedAssets[asset] = true;
        emit AssetAdded(asset, assetSymbol);
    }
    
    /**
     * @dev Activate/deactivate a yield source
     * @param chainId Chain identifier
     * @param asset Asset contract address
     * @param active Whether to activate or deactivate
     */
    function setYieldSourceActive(
        uint256 chainId,
        address asset,
        bool active
    ) external onlyOwner {
        require(supportedChains[chainId], "Chain not supported");
        require(supportedAssets[asset], "Asset not supported");
        
        yields[chainId][asset].isActive = active;
        
        if (active) {
            emit YieldSourceActivated(chainId, asset);
        } else {
            emit YieldSourceDeactivated(chainId, asset);
        }
    }
    
    /**
     * @dev Get all supported chain IDs
     * @return Array of supported chain IDs
     */
    function getSupportedChainIds() public pure returns (uint256[] memory) {
        uint256[] memory chainIds = new uint256[](3);
        chainIds[0] = 1;        // Ethereum Mainnet
        chainIds[1] = 11155111; // Sepolia
        chainIds[2] = 128123;   // Etherlink Ghostnet
        return chainIds;
    }
    
    /**
     * @dev Internal function to add chain support
     */
    function _addChain(uint256 chainId, string memory chainName) internal {
        supportedChains[chainId] = true;
        emit ChainAdded(chainId, chainName);
    }
    
    /**
     * @dev Set initial demo yields for testing
     */
    function _setInitialYields() internal {
        // Add mock asset addresses (will be replaced with real deployed addresses)
        address mockUSDC = address(0x1); // Placeholder
        address mockStETH = address(0x2); // Placeholder
        
        supportedAssets[mockUSDC] = true;
        supportedAssets[mockStETH] = true;
        
        // Set demo yields
        // Sepolia: Below threshold (3.2%)
        yields[11155111][mockStETH] = YieldData({
            yieldRate: 320, // 3.2%
            lastUpdated: block.timestamp,
            isActive: true
        });
        
        // Etherlink: Above threshold (4.1%)
        yields[128123][mockStETH] = YieldData({
            yieldRate: 410, // 4.1%
            lastUpdated: block.timestamp,
            isActive: true
        });
        
        emit AssetAdded(mockUSDC, "USDC");
        emit AssetAdded(mockStETH, "stETH");
    }
}
