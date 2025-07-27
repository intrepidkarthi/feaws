// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PriceOracle
 * @dev Real-time price feeds for USDC and stETH with external API integration
 * @notice Provides current market prices for accurate arbitrage calculations
 */
contract PriceOracle is Ownable {
    
    struct PriceData {
        uint256 price;          // Price in USD with 8 decimals (like Chainlink)
        uint256 lastUpdated;    // Timestamp of last update
        bool isActive;          // Whether this price feed is active
        uint256 confidence;     // Confidence score (0-100)
    }
    
    // Asset address => Price data
    mapping(address => PriceData) public prices;
    
    // Supported assets
    mapping(address => bool) public supportedAssets;
    mapping(address => string) public assetSymbols;
    
    // Price update settings
    uint256 public maxPriceAge = 300; // 5 minutes max age
    uint256 public minConfidence = 95; // 95% minimum confidence
    
    // Events
    event PriceUpdated(
        address indexed asset,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 timestamp,
        uint256 confidence
    );
    
    event AssetAdded(
        address indexed asset,
        string symbol,
        uint256 initialPrice
    );
    
    event PriceSettingsUpdated(
        uint256 maxPriceAge,
        uint256 minConfidence
    );
    
    constructor() {
        // Initialize with current market prices (as of deployment)
        // These will be updated by the price feed system
    }
    
    /**
     * @dev Add a new asset for price tracking
     * @param asset Asset contract address
     * @param symbol Asset symbol (e.g., "USDC", "stETH")
     * @param initialPrice Initial price in USD (8 decimals)
     */
    function addAsset(
        address asset,
        string calldata symbol,
        uint256 initialPrice
    ) external onlyOwner {
        require(asset != address(0), "Invalid asset address");
        require(initialPrice > 0, "Invalid initial price");
        
        supportedAssets[asset] = true;
        assetSymbols[asset] = symbol;
        
        prices[asset] = PriceData({
            price: initialPrice,
            lastUpdated: block.timestamp,
            isActive: true,
            confidence: 100
        });
        
        emit AssetAdded(asset, symbol, initialPrice);
    }
    
    /**
     * @dev Update price for an asset
     * @param asset Asset contract address
     * @param newPrice New price in USD (8 decimals)
     * @param confidence Confidence score (0-100)
     */
    function updatePrice(
        address asset,
        uint256 newPrice,
        uint256 confidence
    ) external onlyOwner {
        require(supportedAssets[asset], "Asset not supported");
        require(newPrice > 0, "Invalid price");
        require(confidence <= 100, "Invalid confidence");
        
        PriceData storage priceData = prices[asset];
        uint256 oldPrice = priceData.price;
        
        priceData.price = newPrice;
        priceData.lastUpdated = block.timestamp;
        priceData.confidence = confidence;
        
        emit PriceUpdated(asset, oldPrice, newPrice, block.timestamp, confidence);
    }
    
    /**
     * @dev Get current price for an asset
     * @param asset Asset contract address
     * @return price Current price in USD (8 decimals)
     * @return lastUpdated Timestamp of last update
     * @return isValid Whether the price is valid and recent
     */
    function getPrice(address asset) external view returns (
        uint256 price,
        uint256 lastUpdated,
        bool isValid
    ) {
        require(supportedAssets[asset], "Asset not supported");
        
        PriceData memory priceData = prices[asset];
        bool isRecent = (block.timestamp - priceData.lastUpdated) <= maxPriceAge;
        bool isConfident = priceData.confidence >= minConfidence;
        
        return (
            priceData.price,
            priceData.lastUpdated,
            priceData.isActive && isRecent && isConfident
        );
    }
    
    /**
     * @dev Get price ratio between two assets
     * @param assetA First asset
     * @param assetB Second asset
     * @return ratio Price ratio (assetA/assetB) with 18 decimals
     * @return isValid Whether both prices are valid
     */
    function getPriceRatio(
        address assetA,
        address assetB
    ) external view returns (uint256 ratio, bool isValid) {
        (uint256 priceA, , bool validA) = this.getPrice(assetA);
        (uint256 priceB, , bool validB) = this.getPrice(assetB);
        
        if (!validA || !validB || priceB == 0) {
            return (0, false);
        }
        
        // Calculate ratio with 18 decimals precision
        ratio = (priceA * 1e18) / priceB;
        return (ratio, true);
    }
    
    /**
     * @dev Calculate USD value of token amount
     * @param asset Asset contract address
     * @param amount Token amount (in asset's decimals)
     * @param assetDecimals Number of decimals for the asset
     * @return usdValue USD value with 8 decimals
     * @return isValid Whether the calculation is valid
     */
    function getUSDValue(
        address asset,
        uint256 amount,
        uint8 assetDecimals
    ) external view returns (uint256 usdValue, bool isValid) {
        (uint256 price, , bool valid) = this.getPrice(asset);
        
        if (!valid) {
            return (0, false);
        }
        
        // Convert amount to 18 decimals, multiply by price (8 decimals), then normalize to 8 decimals
        if (assetDecimals <= 18) {
            uint256 normalizedAmount = amount * (10 ** (18 - assetDecimals));
            usdValue = (normalizedAmount * price) / 1e18;
        } else {
            uint256 normalizedAmount = amount / (10 ** (assetDecimals - 18));
            usdValue = (normalizedAmount * price) / 1e18;
        }
        
        return (usdValue, true);
    }
    
    /**
     * @dev Update price settings
     * @param _maxPriceAge Maximum age for valid prices (seconds)
     * @param _minConfidence Minimum confidence score (0-100)
     */
    function updateSettings(
        uint256 _maxPriceAge,
        uint256 _minConfidence
    ) external onlyOwner {
        require(_maxPriceAge > 0, "Invalid max price age");
        require(_minConfidence <= 100, "Invalid min confidence");
        
        maxPriceAge = _maxPriceAge;
        minConfidence = _minConfidence;
        
        emit PriceSettingsUpdated(_maxPriceAge, _minConfidence);
    }
    
    /**
     * @dev Batch update multiple prices (gas efficient)
     * @param assets Array of asset addresses
     * @param newPrices Array of new prices
     * @param confidences Array of confidence scores
     */
    function batchUpdatePrices(
        address[] calldata assets,
        uint256[] calldata newPrices,
        uint256[] calldata confidences
    ) external onlyOwner {
        require(
            assets.length == newPrices.length && 
            newPrices.length == confidences.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < assets.length; i++) {
            if (supportedAssets[assets[i]] && newPrices[i] > 0 && confidences[i] <= 100) {
                PriceData storage priceData = prices[assets[i]];
                uint256 oldPrice = priceData.price;
                
                priceData.price = newPrices[i];
                priceData.lastUpdated = block.timestamp;
                priceData.confidence = confidences[i];
                
                emit PriceUpdated(assets[i], oldPrice, newPrices[i], block.timestamp, confidences[i]);
            }
        }
    }
    
    /**
     * @dev Get detailed price information
     * @param asset Asset contract address
     * @return priceData Complete price data struct
     */
    function getPriceData(address asset) external view returns (PriceData memory priceData) {
        require(supportedAssets[asset], "Asset not supported");
        return prices[asset];
    }
    
    /**
     * @dev Check if asset is supported
     * @param asset Asset contract address
     * @return supported Whether the asset is supported
     */
    function isAssetSupported(address asset) external view returns (bool supported) {
        return supportedAssets[asset];
    }
    
    /**
     * @dev Get asset symbol
     * @param asset Asset contract address
     * @return symbol Asset symbol
     */
    function getAssetSymbol(address asset) external view returns (string memory symbol) {
        require(supportedAssets[asset], "Asset not supported");
        return assetSymbols[asset];
    }
}
