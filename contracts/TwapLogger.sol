// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TwapLogger
 * @notice Minimal, stateless contract that logs TWAP slice fills via 1inch LOP interaction callbacks
 * @dev This contract receives callbacks when limit orders are filled and emits events for tracking.
 *      It holds no state and has no custody of funds - purely for event logging.
 */
contract TwapLogger {
    /// @notice Emitted when a TWAP slice is filled
    /// @param sliceIndex Zero-based index of the slice that was filled
    /// @param maker Address of the original order maker (treasury wallet)
    /// @param taker Address that filled the order
    /// @param makingAmount Amount of maker token that was spent
    /// @param takingAmount Amount of taker token that was received
    event SliceFilled(
        uint256 indexed sliceIndex,
        address indexed maker,
        address indexed taker,
        uint256 makingAmount,
        uint256 takingAmount
    );

    /// @notice Called by 1inch LOP when an order with this interaction is filled
    /// @param sliceIndex Index of the TWAP slice (encoded in interaction data)
    /// @param maker Original order maker address
    /// @param makingAmount Amount of maker token spent in this fill
    /// @param takingAmount Amount of taker token received in this fill
    /// @dev The taker address is derived from tx.origin since LOP doesn't pass it directly
    function onSliceFilled(
        uint256 sliceIndex,
        address maker,
        uint256 makingAmount,
        uint256 takingAmount
    ) external {
        emit SliceFilled(sliceIndex, maker, tx.origin, makingAmount, takingAmount);
    }
}
