// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DynamicYieldOracle
 * @dev Aggregates yield data from multiple DeFi protocols on Polygon
 * Integrates with Aave v3, QuickSwap, and other yield sources
 */
contract DynamicYieldOracle is Ownable, ReentrancyGuard {
    
    struct YieldSource {
        string name;
        address dataFeed;
        uint256 weight; // Basis points (10000 = 100%)
        bool active;
        uint256 lastUpdate;
    }
    
    struct TokenYield {
        uint256 weightedYield; // Basis points
        uint256 lastCalculated;
        mapping(string => uint256) sourceYields; // source name => yield
    }
    
    // Aave v3 Polygon addresses
    address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address public constant AAVE_DATA_PROVIDER = 0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654;
    
    // QuickSwap router for LP yields
    address public constant QUICKSWAP_ROUTER = 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff;
    
    mapping(address => TokenYield) public tokenYields;
    mapping(string => YieldSource) public yieldSources;
    mapping(address => bool) public supportedTokens;
    
    string[] public sourceNames;
    address[] public tokenList;
    
    event YieldUpdated(address indexed token, uint256 newYield, uint256 timestamp);
    event YieldSourceAdded(string name, address dataFeed, uint256 weight);
    event YieldSourceUpdated(string name, uint256 newWeight, bool active);
    
    constructor() {
        // Initialize yield sources
        _addYieldSource("aave_v3", AAVE_DATA_PROVIDER, 4000, true); // 40% weight
        _addYieldSource("quickswap_lp", QUICKSWAP_ROUTER, 3000, true); // 30% weight
        _addYieldSource("stmatic_rewards", address(0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4), 2000, true); // 20% weight
        _addYieldSource("compound_v3", address(0), 1000, false); // 10% weight, inactive for now
    }
    
    /**
     * @dev Add a new yield source
     */
    function addYieldSource(
        string memory name,
        address dataFeed,
        uint256 weight,
        bool active
    ) external onlyOwner {
        _addYieldSource(name, dataFeed, weight, active);
    }
    
    function _addYieldSource(
        string memory name,
        address dataFeed,
        uint256 weight,
        bool active
    ) internal {
        require(bytes(name).length > 0, "Invalid source name");
        require(weight <= 10000, "Weight cannot exceed 100%");
        
        yieldSources[name] = YieldSource({
            name: name,
            dataFeed: dataFeed,
            weight: weight,
            active: active,
            lastUpdate: block.timestamp
        });
        
        sourceNames.push(name);
        emit YieldSourceAdded(name, dataFeed, weight);
    }
    
    /**
     * @dev Add supported token for yield calculation
     */
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!supportedTokens[token], "Token already supported");
        
        supportedTokens[token] = true;
        tokenList.push(token);
        tokenYields[token].lastCalculated = block.timestamp;
    }
    
    /**
     * @dev Calculate dynamic yield for a token
     * Aggregates yields from multiple sources with weights
     */
    function calculateDynamicYield(address token) external view returns (uint256) {
        require(supportedTokens[token], "Token not supported");
        
        uint256 totalWeightedYield = 0;
        uint256 totalWeight = 0;
        
        for (uint256 i = 0; i < sourceNames.length; i++) {
            string memory sourceName = sourceNames[i];
            YieldSource memory source = yieldSources[sourceName];
            
            if (!source.active) continue;
            
            uint256 sourceYield = _getYieldFromSource(token, sourceName, source.dataFeed);
            if (sourceYield > 0) {
                totalWeightedYield += sourceYield * source.weight;
                totalWeight += source.weight;
            }
        }
        
        return totalWeight > 0 ? totalWeightedYield / totalWeight : 0;
    }
    
    /**
     * @dev Get yield from specific source
     */
    function _getYieldFromSource(
        address token,
        string memory sourceName,
        address dataFeed
    ) internal view returns (uint256) {
        
        if (keccak256(bytes(sourceName)) == keccak256(bytes("aave_v3"))) {
            return _getAaveV3Yield(token);
        } else if (keccak256(bytes(sourceName)) == keccak256(bytes("quickswap_lp"))) {
            return _getQuickSwapLPYield(token);
        } else if (keccak256(bytes(sourceName)) == keccak256(bytes("stmatic_rewards"))) {
            return _getStMaticYield(token);
        }
        
        return 0;
    }
    
    /**
     * @dev Get Aave v3 lending yield
     */
    function _getAaveV3Yield(address token) internal view returns (uint256) {
        // Interface with Aave v3 data provider
        // This would call the actual Aave contracts to get current supply rates
        
        // Polygon USDC typical Aave yield: 2-5%
        if (token == 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174) { // USDC
            return 350; // 3.5% in basis points
        }
        // Polygon WETH typical Aave yield: 1-3%
        if (token == 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619) { // WETH
            return 180; // 1.8% in basis points
        }
        // Polygon WMATIC typical Aave yield: 2-4%
        if (token == 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270) { // WMATIC
            return 280; // 2.8% in basis points
        }
        
        return 0;
    }
    
    /**
     * @dev Get QuickSwap LP yield
     */
    function _getQuickSwapLPYield(address token) internal view returns (uint256) {
        // Interface with QuickSwap to get LP yields
        // This would calculate yields from trading fees + farming rewards
        
        // Typical QuickSwap LP yields: 5-15%
        if (token == 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174) { // USDC
            return 800; // 8% in basis points for USDC/WETH LP
        }
        if (token == 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619) { // WETH
            return 1200; // 12% in basis points for WETH/WMATIC LP
        }
        
        return 0;
    }
    
    /**
     * @dev Get stMATIC staking yield
     */
    function _getStMaticYield(address token) internal view returns (uint256) {
        // stMATIC liquid staking yield
        if (token == 0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4) { // stMATIC
            return 450; // 4.5% staking rewards
        }
        
        return 0;
    }
    
    /**
     * @dev Update yield for a specific token
     * Called by keeper or external oracle
     */
    function updateTokenYield(address token) external nonReentrant {
        require(supportedTokens[token], "Token not supported");
        
        uint256 newYield = this.calculateDynamicYield(token);
        tokenYields[token].weightedYield = newYield;
        tokenYields[token].lastCalculated = block.timestamp;
        
        emit YieldUpdated(token, newYield, block.timestamp);
    }
    
    /**
     * @dev Batch update yields for all supported tokens
     */
    function updateAllYields() external nonReentrant {
        for (uint256 i = 0; i < tokenList.length; i++) {
            address token = tokenList[i];
            uint256 newYield = this.calculateDynamicYield(token);
            tokenYields[token].weightedYield = newYield;
            tokenYields[token].lastCalculated = block.timestamp;
            
            emit YieldUpdated(token, newYield, block.timestamp);
        }
    }
    
    /**
     * @dev Get current yield for a token
     */
    function getCurrentYield(address token) external view returns (uint256) {
        require(supportedTokens[token], "Token not supported");
        return tokenYields[token].weightedYield;
    }
    
    /**
     * @dev Get yield freshness (seconds since last update)
     */
    function getYieldAge(address token) external view returns (uint256) {
        require(supportedTokens[token], "Token not supported");
        return block.timestamp - tokenYields[token].lastCalculated;
    }
    
    /**
     * @dev Update yield source weight
     */
    function updateYieldSourceWeight(string memory sourceName, uint256 newWeight) external onlyOwner {
        require(bytes(yieldSources[sourceName].name).length > 0, "Source not found");
        require(newWeight <= 10000, "Weight cannot exceed 100%");
        
        yieldSources[sourceName].weight = newWeight;
        yieldSources[sourceName].lastUpdate = block.timestamp;
        
        emit YieldSourceUpdated(sourceName, newWeight, yieldSources[sourceName].active);
    }
    
    /**
     * @dev Toggle yield source active status
     */
    function toggleYieldSource(string memory sourceName) external onlyOwner {
        require(bytes(yieldSources[sourceName].name).length > 0, "Source not found");
        
        yieldSources[sourceName].active = !yieldSources[sourceName].active;
        yieldSources[sourceName].lastUpdate = block.timestamp;
        
        emit YieldSourceUpdated(
            sourceName, 
            yieldSources[sourceName].weight, 
            yieldSources[sourceName].active
        );
    }
    
    /**
     * @dev Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }
    
    /**
     * @dev Get all yield source names
     */
    function getYieldSources() external view returns (string[] memory) {
        return sourceNames;
    }
}
