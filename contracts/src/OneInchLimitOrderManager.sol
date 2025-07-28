// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// 1inch Limit Order Protocol interface (simplified)
interface ILimitOrderProtocol {
    struct Order {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        address maker;
        address receiver;
        address allowedSender;
        uint256 makingAmount;
        uint256 takingAmount;
        uint256 offsets;
        bytes interactions;
    }
    
    function fillOrder(
        Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) external payable returns (uint256 actualMakingAmount, uint256 actualTakingAmount);
    
    function cancelOrder(Order calldata order) external;
    
    function remaining(bytes32 orderHash) external view returns (uint256);
    
    function remainingRaw(bytes32 orderHash) external view returns (uint256);
}

/**
 * @title OneInchLimitOrderManager
 * @dev Manages 1inch Limit Order Protocol v4 integration for treasury management
 * 
 * This contract interfaces with 1inch Limit Order Protocol to:
 * - Create limit orders with yield-based conditions
 * - Execute orders when conditions are met
 * - Monitor order status and manage order lifecycle
 */
contract OneInchLimitOrderManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // 1inch Limit Order Protocol v4 on Polygon
    address public constant ONEINCH_LIMIT_ORDER_PROTOCOL = 0x111111125421cA6dc452d289314280a0f8842A65;
    
    struct LimitOrder {
        uint256 orderId;
        address makerToken;
        address takerToken;
        uint256 makingAmount;
        uint256 takingAmount;
        uint256 minYieldBps;
        uint256 deadline;
        bytes32 orderHash;
        bool active;
        uint256 filled;
        address creator;
    }
    
    struct YieldCondition {
        uint256 minYieldBps;
        uint256 currentYield;
        uint256 lastUpdate;
        bool conditionMet;
    }
    
    ILimitOrderProtocol public limitOrderProtocol;
    
    mapping(uint256 => LimitOrder) public limitOrders;
    mapping(bytes32 => uint256) public orderHashToId;
    mapping(address => YieldCondition) public yieldConditions;
    
    uint256 public nextOrderId = 1;
    address public treasuryManager;
    address public yieldOracle;
    
    event LimitOrderCreated(
        uint256 indexed orderId,
        address indexed makerToken,
        address indexed takerToken,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 minYieldBps,
        bytes32 orderHash
    );
    
    event LimitOrderFilled(
        uint256 indexed orderId,
        uint256 filledAmount,
        uint256 receivedAmount,
        bytes32 orderHash
    );
    
    event LimitOrderCancelled(uint256 indexed orderId, bytes32 orderHash);
    
    event YieldConditionUpdated(
        address indexed token,
        uint256 currentYield,
        bool conditionMet
    );
    
    constructor(address _treasuryManager, address _yieldOracle) {
        limitOrderProtocol = ILimitOrderProtocol(ONEINCH_LIMIT_ORDER_PROTOCOL);
        treasuryManager = _treasuryManager;
        yieldOracle = _yieldOracle;
    }
    
    modifier onlyTreasuryManager() {
        require(msg.sender == treasuryManager, "Only treasury manager");
        _;
    }
    
    modifier onlyYieldOracle() {
        require(msg.sender == yieldOracle, "Only yield oracle");
        _;
    }
    
    /**
     * @dev Create a yield-conditional limit order
     * @param makerToken Token to sell (e.g., USDC)
     * @param takerToken Token to buy (e.g., WETH)
     * @param makingAmount Amount of maker token to sell
     * @param takingAmount Minimum amount of taker token to receive
     * @param minYieldBps Minimum yield advantage required (basis points)
     * @param deadline Order expiration timestamp
     */
    function createYieldConditionalOrder(
        address makerToken,
        address takerToken,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 minYieldBps,
        uint256 deadline
    ) external onlyTreasuryManager returns (uint256 orderId) {
        require(makingAmount > 0, "Invalid making amount");
        require(takingAmount > 0, "Invalid taking amount");
        require(deadline > block.timestamp, "Invalid deadline");
        require(minYieldBps > 0, "Invalid yield threshold");
        
        // Transfer tokens to this contract for order creation
        IERC20(makerToken).safeTransferFrom(msg.sender, address(this), makingAmount);
        
        // Approve 1inch protocol to spend tokens
        IERC20(makerToken).safeApprove(ONEINCH_LIMIT_ORDER_PROTOCOL, makingAmount);
        
        orderId = nextOrderId++;
        
        // Create 1inch limit order structure
        ILimitOrderProtocol.Order memory order = ILimitOrderProtocol.Order({
            salt: _generateSalt(orderId),
            makerAsset: makerToken,
            takerAsset: takerToken,
            maker: address(this),
            receiver: address(this),
            allowedSender: address(0), // Anyone can fill
            makingAmount: makingAmount,
            takingAmount: takingAmount,
            offsets: _encodeOffsets(),
            interactions: _encodeYieldCondition(takerToken, minYieldBps)
        });
        
        // Calculate order hash
        bytes32 orderHash = _calculateOrderHash(order);
        
        // Store order details
        limitOrders[orderId] = LimitOrder({
            orderId: orderId,
            makerToken: makerToken,
            takerToken: takerToken,
            makingAmount: makingAmount,
            takingAmount: takingAmount,
            minYieldBps: minYieldBps,
            deadline: deadline,
            orderHash: orderHash,
            active: true,
            filled: 0,
            creator: msg.sender
        });
        
        orderHashToId[orderHash] = orderId;
        
        emit LimitOrderCreated(
            orderId,
            makerToken,
            takerToken,
            makingAmount,
            takingAmount,
            minYieldBps,
            orderHash
        );
        
        return orderId;
    }
    
    /**
     * @dev Update yield condition for a token
     * Called by yield oracle when yield data changes
     */
    function updateYieldCondition(
        address token,
        uint256 currentYield
    ) external onlyYieldOracle {
        YieldCondition storage condition = yieldConditions[token];
        condition.currentYield = currentYield;
        condition.lastUpdate = block.timestamp;
        
        // Check if any orders can now be executed
        _checkAndUpdateCondition(token, currentYield);
        
        emit YieldConditionUpdated(token, currentYield, condition.conditionMet);
    }
    
    /**
     * @dev Check if yield condition is met for token
     */
    function _checkAndUpdateCondition(address token, uint256 currentYield) internal {
        YieldCondition storage condition = yieldConditions[token];
        
        // Find orders for this token and check if conditions are met
        for (uint256 i = 1; i < nextOrderId; i++) {
            LimitOrder storage order = limitOrders[i];
            if (order.active && order.takerToken == token) {
                bool conditionMet = currentYield >= order.minYieldBps;
                if (conditionMet != condition.conditionMet) {
                    condition.conditionMet = conditionMet;
                    
                    // If condition is now met, the order can be filled by anyone
                    // The 1inch protocol will handle the actual execution
                }
            }
        }
    }
    
    /**
     * @dev Cancel a limit order
     */
    function cancelLimitOrder(uint256 orderId) external {
        LimitOrder storage order = limitOrders[orderId];
        require(order.active, "Order not active");
        require(
            msg.sender == order.creator || msg.sender == owner(),
            "Not authorized"
        );
        
        // Create order structure for cancellation
        ILimitOrderProtocol.Order memory orderStruct = _reconstructOrder(order);
        
        // Cancel on 1inch protocol
        limitOrderProtocol.cancelOrder(orderStruct);
        
        // Update local state
        order.active = false;
        
        // Return unused tokens to creator
        uint256 unfilledAmount = order.makingAmount - order.filled;
        if (unfilledAmount > 0) {
            IERC20(order.makerToken).safeTransfer(order.creator, unfilledAmount);
        }
        
        emit LimitOrderCancelled(orderId, order.orderHash);
    }
    
    /**
     * @dev Get remaining amount for an order
     */
    function getRemainingAmount(uint256 orderId) external view returns (uint256) {
        LimitOrder memory order = limitOrders[orderId];
        if (!order.active) return 0;
        
        uint256 remaining = limitOrderProtocol.remaining(order.orderHash);
        return remaining;
    }
    
    /**
     * @dev Check if order can be executed based on yield conditions
     */
    function canExecuteOrder(uint256 orderId) external view returns (bool) {
        LimitOrder memory order = limitOrders[orderId];
        if (!order.active || block.timestamp > order.deadline) {
            return false;
        }
        
        YieldCondition memory condition = yieldConditions[order.takerToken];
        return condition.conditionMet && condition.currentYield >= order.minYieldBps;
    }
    
    /**
     * @dev Get order details
     */
    function getOrder(uint256 orderId) external view returns (LimitOrder memory) {
        return limitOrders[orderId];
    }
    
    /**
     * @dev Get yield condition for token
     */
    function getYieldCondition(address token) external view returns (YieldCondition memory) {
        return yieldConditions[token];
    }
    
    /**
     * @dev Generate unique salt for order
     */
    function _generateSalt(uint256 orderId) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(
            address(this),
            orderId,
            block.timestamp,
            block.prevrandao
        )));
    }
    
    /**
     * @dev Encode offsets for 1inch order
     */
    function _encodeOffsets() internal pure returns (uint256) {
        // Simplified offset encoding
        // In real implementation, this would encode the positions of dynamic data
        return 0;
    }
    
    /**
     * @dev Encode yield condition as interaction
     */
    function _encodeYieldCondition(
        address token,
        uint256 minYieldBps
    ) internal pure returns (bytes memory) {
        // Encode the yield condition check as interaction bytes
        // This would be called before order execution to verify yield conditions
        return abi.encodeWithSignature(
            "checkYieldCondition(address,uint256)",
            token,
            minYieldBps
        );
    }
    
    /**
     * @dev Calculate order hash (simplified)
     */
    function _calculateOrderHash(
        ILimitOrderProtocol.Order memory order
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(order));
    }
    
    /**
     * @dev Reconstruct order structure from stored data
     */
    function _reconstructOrder(
        LimitOrder memory order
    ) internal pure returns (ILimitOrderProtocol.Order memory) {
        return ILimitOrderProtocol.Order({
            salt: uint256(order.orderHash), // Simplified
            makerAsset: order.makerToken,
            takerAsset: order.takerToken,
            maker: address(0), // Will be set properly in real implementation
            receiver: address(0),
            allowedSender: address(0),
            makingAmount: order.makingAmount,
            takingAmount: order.takingAmount,
            offsets: 0,
            interactions: ""
        });
    }
    
    /**
     * @dev Yield condition check function (called by 1inch before execution)
     */
    function checkYieldCondition(
        address token,
        uint256 minYieldBps
    ) external view returns (bool) {
        YieldCondition memory condition = yieldConditions[token];
        return condition.conditionMet && condition.currentYield >= minYieldBps;
    }
    
    /**
     * @dev Update treasury manager address
     */
    function updateTreasuryManager(address newManager) external onlyOwner {
        require(newManager != address(0), "Invalid address");
        treasuryManager = newManager;
    }
    
    /**
     * @dev Update yield oracle address
     */
    function updateYieldOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid address");
        yieldOracle = newOracle;
    }
    
    /**
     * @dev Emergency function to recover tokens
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
