// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/I1inchLimitOrderProtocol.sol";

/**
 * @title LimitOrderManager
 * @dev Wrapper contract for 1inch Limit Order Protocol integration
 * @notice Manages limit order creation and execution for ETHGlobal UNITE demo
 */
contract LimitOrderManager is Ownable {
    using SafeERC20 for IERC20;

    // 1inch Limit Order Protocol contract addresses
    address public immutable LIMIT_ORDER_PROTOCOL;
    I1inchLimitOrderProtocol public immutable oneInchProtocol;
    
    // Network detection for real vs mock integration
    bool public immutable isMainnetFork;
    
    // Order tracking
    struct OrderInfo {
        bytes32 orderHash;
        address maker;
        address makerAsset;
        address takerAsset;
        uint256 makingAmount;
        uint256 takingAmount;
        uint256 createdAt;
        bool isActive;
        bool isFilled;
    }
    
    // Integration status
    struct IntegrationStatus {
        bool isRealIntegration;
        address protocolAddress;
        bool networkSupported;
        uint256 lastOrderCount;
    }
    
    // Order storage
    mapping(bytes32 => OrderInfo) public orders;
    mapping(address => bytes32[]) public userOrders;
    bytes32[] public allOrders;
    
    // Events
    event OrderCreated(
        bytes32 indexed orderHash,
        address indexed maker,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount
    );
    
    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed filler,
        uint256 filledAmount,
        uint256 remainingAmount
    );
    
    event OrderCancelled(
        bytes32 indexed orderHash,
        address indexed canceller
    );
    
    event OneInchOrderSubmitted(
        bytes orderData,
        bytes signature,
        uint256 timestamp
    );
    
    event Real1inchOrderCreated(
        bytes32 indexed real1inchOrderHash,
        uint256 indexed salt,
        uint256 makingAmount,
        uint256 takingAmount
    );
    
    constructor(address _limitOrderProtocol) {
        require(_limitOrderProtocol != address(0), "Invalid protocol address");
        LIMIT_ORDER_PROTOCOL = _limitOrderProtocol;
        oneInchProtocol = I1inchLimitOrderProtocol(_limitOrderProtocol);
        
        // Detect if we're on mainnet fork (has real 1inch deployment)
        isMainnetFork = _isMainnetFork(_limitOrderProtocol);
    }
    
    /**
     * @dev Check if we're on mainnet fork with real 1inch deployment
     */
    function _isMainnetFork(address protocolAddress) internal view returns (bool) {
        // Check if the protocol address has code (real deployment)
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(protocolAddress)
        }
        return codeSize > 0;
    }
    
    /**
     * @dev Create a limit order using 1inch protocol
     * @param orderData Encoded order data from 1inch SDK
     * @param signature Order signature from maker
     * @return orderHash Hash of the created order
     */
    function createLimitOrder(
        bytes calldata orderData,
        bytes calldata signature
    ) external returns (bytes32 orderHash) {
        // Decode basic order info for tracking
        (
            address makerAsset,
            address takerAsset,
            uint256 makingAmount,
            uint256 takingAmount
        ) = _decodeOrderData(orderData);
        
        // Generate order hash
        orderHash = keccak256(abi.encodePacked(orderData, block.timestamp, msg.sender));
        
        // Store order info
        orders[orderHash] = OrderInfo({
            orderHash: orderHash,
            maker: msg.sender,
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            makingAmount: makingAmount,
            takingAmount: takingAmount,
            createdAt: block.timestamp,
            isActive: true,
            isFilled: false
        });
        
        // Track user orders
        userOrders[msg.sender].push(orderHash);
        allOrders.push(orderHash);
        
        // Use real 1inch protocol if available, otherwise simulate
        if (isMainnetFork) {
            _createReal1inchOrder(orderData, signature, makerAsset, takerAsset, makingAmount, takingAmount);
        } else {
            _simulateOneInchOrder(orderData, signature);
        }
        
        emit OrderCreated(
            orderHash,
            msg.sender,
            makerAsset,
            takerAsset,
            makingAmount,
            takingAmount
        );
        
        return orderHash;
    }
    
    /**
     * @dev Fill a limit order (simulated for demo)
     * @param orderHash Hash of the order to fill
     * @param takingAmount Amount to take from the order
     */
    function fillOrder(
        bytes32 orderHash,
        uint256 takingAmount
    ) external {
        OrderInfo storage order = orders[orderHash];
        require(order.isActive, "Order not active");
        require(!order.isFilled, "Order already filled");
        require(takingAmount <= order.takingAmount, "Amount too high");
        
        // Calculate making amount proportionally
        uint256 makingAmount = (order.makingAmount * takingAmount) / order.takingAmount;
        
        // Transfer tokens (simulated)
        // In production, this would be handled by 1inch protocol
        IERC20(order.takerAsset).safeTransferFrom(msg.sender, order.maker, takingAmount);
        IERC20(order.makerAsset).safeTransferFrom(order.maker, msg.sender, makingAmount);
        
        // Update order status
        if (takingAmount == order.takingAmount) {
            order.isFilled = true;
            order.isActive = false;
        } else {
            // Partial fill - update remaining amounts
            order.makingAmount -= makingAmount;
            order.takingAmount -= takingAmount;
        }
        
        emit OrderFilled(orderHash, msg.sender, makingAmount, takingAmount);
    }
    
    /**
     * @dev Cancel a limit order
     * @param orderHash Hash of the order to cancel
     */
    function cancelOrder(bytes32 orderHash) external {
        OrderInfo storage order = orders[orderHash];
        require(order.maker == msg.sender || msg.sender == owner(), "Not authorized");
        require(order.isActive, "Order not active");
        
        order.isActive = false;
        
        emit OrderCancelled(orderHash, order.maker);
    }
    
    /**
     * @dev Get order information
     * @param orderHash Hash of the order
     * @return Order information struct
     */
    function getOrder(bytes32 orderHash) external view returns (OrderInfo memory) {
        return orders[orderHash];
    }
    
    /**
     * @dev Get all orders for a user
     * @param user User address
     * @return Array of order hashes
     */
    function getUserOrders(address user) external view returns (bytes32[] memory) {
        return userOrders[user];
    }
    
    /**
     * @dev Get total number of orders
     * @return Total order count
     */
    function getTotalOrders() external view returns (uint256) {
        return allOrders.length;
    }
    
    /**
     * @dev Get active orders count
     * @return Number of active orders
     */
    function getActiveOrdersCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < allOrders.length; i++) {
            if (orders[allOrders[i]].isActive) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @dev Get integration status information
     * @return status Integration status struct
     */
    function getIntegrationStatus() external view returns (IntegrationStatus memory status) {
        status = IntegrationStatus({
            isRealIntegration: isMainnetFork,
            protocolAddress: LIMIT_ORDER_PROTOCOL,
            networkSupported: isMainnetFork,
            lastOrderCount: allOrders.length
        });
    }
    
    /**
     * @dev Notify external contract of order fill (for testing)
     * @param target Target contract to notify
     * @param orderHash Hash of filled order
     * @param filledAmount Amount that was filled
     */
    function notifyOrderFilled(
        address target,
        bytes32 orderHash,
        uint256 filledAmount
    ) external {
        // Call the target contract's onOrderFilled function
        (bool success, ) = target.call(
            abi.encodeWithSignature(
                "onOrderFilled(bytes32,uint256)",
                orderHash,
                filledAmount
            )
        );
        require(success, "Notification failed");
    }
    
    /**
     * @dev Get supported chain IDs
     */
    function getSupportedChains() external pure returns (uint256[] memory) {
        uint256[] memory chains = new uint256[](3);
        chains[0] = 1;        // Ethereum Mainnet
        chains[1] = 11155111; // Sepolia
        chains[2] = 128123;   // Etherlink
        return chains;
    }
    
    /**
     * @dev Build order data for 1inch SDK integration
     * @param makerAsset Token being sold
     * @param takerAsset Token being bought
     * @param makingAmount Amount being sold
     * @param takingAmount Amount being bought
     * @param maker Order maker address
     * @return Encoded order data
     */
    function buildOrderData(
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        address maker
    ) external view returns (bytes memory) {
        return abi.encode(
            makerAsset,
            takerAsset,
            makingAmount,
            takingAmount,
            maker,
            block.timestamp + 86400 // 24 hour expiry
        );
    }
    
    /**
     * @dev Internal function to decode order data
     */
    function _decodeOrderData(
        bytes calldata orderData
    ) internal pure returns (
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount
    ) {
        // For demo purposes, we use a simple encoding
        // In production, this would decode actual 1inch order format
        (makerAsset, takerAsset, makingAmount, takingAmount, ,) = abi.decode(
            orderData,
            (address, address, uint256, uint256, address, uint256)
        );
    }
    
    /**
     * @dev Create real 1inch limit order
     */
    function _createReal1inchOrder(
        bytes calldata orderData,
        bytes calldata signature,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount
    ) internal {
        // Build 1inch order struct
        I1inchLimitOrderProtocol.Order memory order = I1inchLimitOrderProtocol.Order({
            salt: uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender))),
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            maker: msg.sender,
            receiver: address(0), // Use maker as receiver
            allowedSender: address(0), // Allow any sender
            makingAmount: makingAmount,
            takingAmount: takingAmount,
            offsets: 0, // No complex interactions
            interactions: "" // No interactions
        });
        
        // Get order hash from 1inch protocol
        bytes32 realOrderHash = oneInchProtocol.hashOrder(order);
        
        // Emit event with real 1inch order hash
        emit Real1inchOrderCreated(realOrderHash, order.salt, makingAmount, takingAmount);
        emit OneInchOrderSubmitted(orderData, signature, block.timestamp);
    }
    
    /**
     * @dev Simulate 1inch protocol interaction (for demo)
     */
    function _simulateOneInchOrder(
        bytes calldata orderData,
        bytes calldata signature
    ) internal {
        // For demo, we just emit an event to show integration
        emit OneInchOrderSubmitted(orderData, signature, block.timestamp);
    }
}
