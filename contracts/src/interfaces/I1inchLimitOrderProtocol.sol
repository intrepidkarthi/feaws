// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title I1inchLimitOrderProtocol
 * @dev Interface for 1inch Limit Order Protocol
 * @notice Based on 1inch Limit Order Protocol v4
 */
interface I1inchLimitOrderProtocol {
    
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

    /**
     * @dev Fills an order
     * @param order Order to fill
     * @param signature Signature of the order
     * @param interaction Interaction data
     * @param makingAmount Amount to make
     * @param takingAmount Amount to take
     * @param thresholdAmount Minimum amount to receive
     * @return actualMakingAmount Actual amount made
     * @return actualTakingAmount Actual amount taken
     * @return orderHash Hash of the order
     */
    function fillOrder(
        Order memory order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 thresholdAmount
    ) external payable returns (uint256 actualMakingAmount, uint256 actualTakingAmount, bytes32 orderHash);

    /**
     * @dev Cancels an order
     * @param makerTraits Maker traits
     * @param orderHash Hash of the order to cancel
     */
    function cancelOrder(uint256 makerTraits, bytes32 orderHash) external;

    /**
     * @dev Checks if an order is valid
     * @param order Order to check
     * @param signature Signature of the order
     * @param amount Amount to fill
     * @return isValid Whether the order is valid
     */
    function checkPredicate(Order memory order, bytes calldata signature, uint256 amount) external view returns (bool isValid);

    /**
     * @dev Gets the remaining amount of an order
     * @param orderHash Hash of the order
     * @return remaining Remaining amount
     */
    function remaining(bytes32 orderHash) external view returns (uint256 remaining);

    /**
     * @dev Hashes an order
     * @param order Order to hash
     * @return orderHash Hash of the order
     */
    function hashOrder(Order memory order) external view returns (bytes32 orderHash);

    // Events
    event OrderFilled(
        bytes32 indexed orderHash,
        uint256 remaining
    );

    event OrderCancelled(
        bytes32 indexed orderHash
    );
}
