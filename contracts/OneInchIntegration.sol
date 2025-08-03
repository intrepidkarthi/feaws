// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OneInchIntegration
 * @dev Advanced 1inch protocol integration for FEAWS treasury management
 * @notice Handles aggregator swaps, limit orders, and fusion protocol interactions
 */
contract OneInchIntegration is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // 1inch Protocol Addresses on Polygon
    address public constant ONEINCH_AGGREGATOR = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address public constant ONEINCH_LIMIT_ORDER = 0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f;
    address public constant ONEINCH_FUSION = 0x00000000009726632680FB29d3F7A9734E3010E2;
    
    // Treasury configuration
    address public treasuryWallet;
    uint256 public maxSlippage = 300; // 3% in basis points
    uint256 public minOrderSize = 1e6; // Minimum 1 USDC equivalent
    
    // Supported tokens
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public tokenDecimals;
    
    // Order tracking
    struct LimitOrder {
        address maker;
        address makerAsset;
        address takerAsset;
        uint256 makerAmount;
        uint256 takerAmount;
        uint256 expiration;
        bytes32 orderHash;
        bool executed;
    }
    
    mapping(bytes32 => LimitOrder) public limitOrders;
    bytes32[] public orderHashes;
    
    // Events
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );
    
    event LimitOrderCreated(
        bytes32 indexed orderHash,
        address indexed maker,
        address makerAsset,
        address takerAsset,
        uint256 makerAmount,
        uint256 takerAmount
    );
    
    event FusionOrderSubmitted(
        bytes32 indexed orderHash,
        address indexed maker,
        uint256 amount,
        address tokenIn,
        address tokenOut
    );

    constructor(address _treasuryWallet) {
        treasuryWallet = _treasuryWallet;
        
        // Initialize supported tokens on Polygon
        _addSupportedToken(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174, 6); // USDC
        _addSupportedToken(0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270, 18); // WMATIC
        _addSupportedToken(0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619, 18); // WETH
        _addSupportedToken(0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063, 18); // DAI
    }

    /**
     * @dev Execute swap through 1inch aggregator
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output amount (slippage protection)
     * @param swapData Encoded swap data from 1inch API
     */
    function executeAggregatorSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata swapData
    ) external onlyOwner nonReentrant {
        require(supportedTokens[tokenIn] && supportedTokens[tokenOut], "Unsupported token");
        require(amountIn >= minOrderSize, "Order too small");
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(ONEINCH_AGGREGATOR, amountIn);
        
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        
        (bool success, ) = ONEINCH_AGGREGATOR.call(swapData);
        require(success, "Swap failed");
        
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        uint256 amountOut = balanceAfter - balanceBefore;
        
        require(amountOut >= minAmountOut, "Insufficient output amount");
        
        IERC20(tokenOut).safeTransfer(treasuryWallet, amountOut);
        
        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, treasuryWallet);
    }

    /**
     * @dev Create limit order through 1inch Limit Order Protocol
     * @param makerAsset Token to sell
     * @param takerAsset Token to buy
     * @param makerAmount Amount to sell
     * @param takerAmount Amount to receive
     * @param expiration Order expiration timestamp
     * @param orderData Encoded order data
     */
    function createLimitOrder(
        address makerAsset,
        address takerAsset,
        uint256 makerAmount,
        uint256 takerAmount,
        uint256 expiration,
        bytes calldata orderData
    ) external onlyOwner returns (bytes32 orderHash) {
        require(supportedTokens[makerAsset] && supportedTokens[takerAsset], "Unsupported token");
        require(expiration > block.timestamp, "Invalid expiration");
        
        orderHash = keccak256(abi.encodePacked(
            makerAsset,
            takerAsset,
            makerAmount,
            takerAmount,
            expiration,
            block.timestamp
        ));
        
        limitOrders[orderHash] = LimitOrder({
            maker: msg.sender,
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            makerAmount: makerAmount,
            takerAmount: takerAmount,
            expiration: expiration,
            orderHash: orderHash,
            executed: false
        });
        
        orderHashes.push(orderHash);
        
        IERC20(makerAsset).safeTransferFrom(msg.sender, address(this), makerAmount);
        IERC20(makerAsset).safeApprove(ONEINCH_LIMIT_ORDER, makerAmount);
        
        (bool success, ) = ONEINCH_LIMIT_ORDER.call(orderData);
        require(success, "Limit order creation failed");
        
        emit LimitOrderCreated(orderHash, msg.sender, makerAsset, takerAsset, makerAmount, takerAmount);
    }

    /**
     * @dev Submit order to 1inch Fusion protocol
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amount Amount to swap
     * @param fusionData Encoded fusion order data
     */
    function submitFusionOrder(
        address tokenIn,
        address tokenOut,
        uint256 amount,
        bytes calldata fusionData
    ) external onlyOwner nonReentrant returns (bytes32 orderHash) {
        require(supportedTokens[tokenIn] && supportedTokens[tokenOut], "Unsupported token");
        
        orderHash = keccak256(abi.encodePacked(
            tokenIn,
            tokenOut,
            amount,
            block.timestamp
        ));
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(tokenIn).safeApprove(ONEINCH_FUSION, amount);
        
        (bool success, ) = ONEINCH_FUSION.call(fusionData);
        require(success, "Fusion order submission failed");
        
        emit FusionOrderSubmitted(orderHash, msg.sender, amount, tokenIn, tokenOut);
    }

    /**
     * @dev Add supported token
     */
    function _addSupportedToken(address token, uint256 decimals) internal {
        supportedTokens[token] = true;
        tokenDecimals[token] = decimals;
    }

    /**
     * @dev Get active limit orders count
     */
    function getActiveOrdersCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < orderHashes.length; i++) {
            if (!limitOrders[orderHashes[i]].executed && 
                limitOrders[orderHashes[i]].expiration > block.timestamp) {
                count++;
            }
        }
        return count;
    }

    /**
     * @dev Emergency withdrawal function
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(treasuryWallet, amount);
    }

    /**
     * @dev Update treasury wallet
     */
    function updateTreasuryWallet(address newTreasury) external onlyOwner {
        treasuryWallet = newTreasury;
    }

    /**
     * @dev Update max slippage
     */
    function updateMaxSlippage(uint256 newSlippage) external onlyOwner {
        require(newSlippage <= 1000, "Slippage too high"); // Max 10%
        maxSlippage = newSlippage;
    }
}
