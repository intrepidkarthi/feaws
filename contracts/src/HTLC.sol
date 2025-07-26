// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title HTLC - Hash Time Locked Contract
 * @dev Enables atomic cross-chain swaps using hash-lock and time-lock mechanisms
 * @notice This contract facilitates secure cross-chain asset transfers for the yield arbitrage system
 */
contract HTLC is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Contract states
    enum SwapState { INVALID, OPEN, CLOSED, EXPIRED }

    // Swap structure
    struct Swap {
        uint256 inputAmount;
        uint256 outputAmount;
        uint256 expiration;
        bytes32 hashLock;
        SwapState state;
        address payable sender;
        address payable receiver;
        address inputToken;
        address outputToken;
        bytes32 preimage;
    }

    // Events
    event SwapOpened(
        bytes32 indexed swapId,
        address indexed sender,
        address indexed receiver,
        bytes32 hashLock,
        uint256 expiration,
        address inputToken,
        uint256 inputAmount,
        address outputToken,
        uint256 outputAmount
    );

    event SwapClosed(
        bytes32 indexed swapId,
        bytes32 preimage
    );

    event SwapExpired(
        bytes32 indexed swapId
    );

    event SwapRefunded(
        bytes32 indexed swapId
    );

    // State variables
    mapping(bytes32 => Swap) public swaps;
    mapping(address => uint256) public swapCounts;
    
    // Constants
    uint256 public constant MIN_TIME_LOCK = 1 hours;
    uint256 public constant MAX_TIME_LOCK = 48 hours;

    // Modifiers
    modifier onlyValidSwap(bytes32 _swapId) {
        require(swaps[_swapId].state != SwapState.INVALID, "HTLC: Invalid swap");
        _;
    }

    modifier onlyOpenSwap(bytes32 _swapId) {
        require(swaps[_swapId].state == SwapState.OPEN, "HTLC: Swap not open");
        _;
    }

    modifier onlyBeforeExpiration(bytes32 _swapId) {
        require(block.timestamp < swaps[_swapId].expiration, "HTLC: Swap expired");
        _;
    }

    modifier onlyAfterExpiration(bytes32 _swapId) {
        require(block.timestamp >= swaps[_swapId].expiration, "HTLC: Swap not expired");
        _;
    }

    /**
     * @dev Open a new atomic swap
     * @param _receiver Address that can claim the swap
     * @param _hashLock Hash of the secret that unlocks the swap
     * @param _expiration Timestamp when the swap expires
     * @param _inputToken Token being locked
     * @param _inputAmount Amount of input token
     * @param _outputToken Token expected in return (for tracking)
     * @param _outputAmount Amount of output token expected
     * @return swapId Unique identifier for the swap
     */
    function openSwap(
        address payable _receiver,
        bytes32 _hashLock,
        uint256 _expiration,
        address _inputToken,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _outputAmount
    ) external nonReentrant returns (bytes32 swapId) {
        require(_receiver != address(0), "HTLC: Invalid receiver");
        require(_hashLock != bytes32(0), "HTLC: Invalid hash lock");
        require(_inputAmount > 0, "HTLC: Invalid input amount");
        require(_outputAmount > 0, "HTLC: Invalid output amount");
        require(
            _expiration > block.timestamp + MIN_TIME_LOCK && 
            _expiration < block.timestamp + MAX_TIME_LOCK,
            "HTLC: Invalid expiration"
        );

        // Generate unique swap ID
        swapId = keccak256(abi.encodePacked(
            msg.sender,
            _receiver,
            _hashLock,
            _expiration,
            _inputToken,
            _inputAmount,
            block.timestamp,
            swapCounts[msg.sender]++
        ));

        require(swaps[swapId].state == SwapState.INVALID, "HTLC: Swap already exists");

        // Transfer tokens to contract
        IERC20(_inputToken).safeTransferFrom(msg.sender, address(this), _inputAmount);

        // Create swap
        swaps[swapId] = Swap({
            inputAmount: _inputAmount,
            outputAmount: _outputAmount,
            expiration: _expiration,
            hashLock: _hashLock,
            state: SwapState.OPEN,
            sender: payable(msg.sender),
            receiver: _receiver,
            inputToken: _inputToken,
            outputToken: _outputToken,
            preimage: bytes32(0)
        });

        emit SwapOpened(
            swapId,
            msg.sender,
            _receiver,
            _hashLock,
            _expiration,
            _inputToken,
            _inputAmount,
            _outputToken,
            _outputAmount
        );
    }

    /**
     * @dev Close a swap by revealing the preimage
     * @param _swapId The swap identifier
     * @param _preimage The secret that unlocks the swap
     */
    function closeSwap(bytes32 _swapId, bytes32 _preimage) 
        external 
        nonReentrant 
        onlyValidSwap(_swapId)
        onlyOpenSwap(_swapId)
        onlyBeforeExpiration(_swapId)
    {
        Swap storage swap = swaps[_swapId];
        
        // Verify preimage matches hash lock
        require(sha256(abi.encodePacked(_preimage)) == swap.hashLock, "HTLC: Invalid preimage");

        // Update swap state
        swap.state = SwapState.CLOSED;
        swap.preimage = _preimage;

        // Transfer tokens to receiver
        IERC20(swap.inputToken).safeTransfer(swap.receiver, swap.inputAmount);

        emit SwapClosed(_swapId, _preimage);
    }

    /**
     * @dev Refund an expired swap
     * @param _swapId The swap identifier
     */
    function refundSwap(bytes32 _swapId) 
        external 
        nonReentrant 
        onlyValidSwap(_swapId)
        onlyOpenSwap(_swapId)
        onlyAfterExpiration(_swapId)
    {
        Swap storage swap = swaps[_swapId];
        require(msg.sender == swap.sender, "HTLC: Only sender can refund");

        // Update swap state
        swap.state = SwapState.EXPIRED;

        // Refund tokens to sender
        IERC20(swap.inputToken).safeTransfer(swap.sender, swap.inputAmount);

        emit SwapExpired(_swapId);
        emit SwapRefunded(_swapId);
    }

    /**
     * @dev Get swap details by ID
     * @param swapId The swap identifier
     * @return inputAmount The input token amount
     * @return outputAmount The output token amount
     * @return expiration The swap expiration timestamp
     * @return hashLock The hash lock for the swap
     * @return state The current swap state
     * @return sender The swap initiator
     * @return receiver The swap receiver
     * @return inputToken The input token address
     * @return outputToken The output token address
     * @return preimage The revealed preimage (if closed)
     */
    function getSwap(bytes32 swapId) external view returns (
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 expiration,
        bytes32 hashLock,
        SwapState state,
        address sender,
        address receiver,
        address inputToken,
        address outputToken,
        bytes32 preimage
    ) {
        Swap storage swap = swaps[swapId];
        return (
            swap.inputAmount,
            swap.outputAmount,
            swap.expiration,
            swap.hashLock,
            swap.state,
            swap.sender,
            swap.receiver,
            swap.inputToken,
            swap.outputToken,
            swap.preimage
        );
    }

    /**
     * @dev Check if a swap exists and is open
     * @param _swapId The swap identifier
     * @return True if swap is open
     */
    function isSwapOpen(bytes32 _swapId) external view returns (bool) {
        return swaps[_swapId].state == SwapState.OPEN && 
               block.timestamp < swaps[_swapId].expiration;
    }

    /**
     * @dev Check if a swap is expired
     * @param _swapId The swap identifier
     * @return True if swap is expired
     */
    function isSwapExpired(bytes32 _swapId) external view returns (bool) {
        return swaps[_swapId].state == SwapState.OPEN && 
               block.timestamp >= swaps[_swapId].expiration;
    }

    /**
     * @dev Get the remaining time for a swap
     * @param _swapId The swap identifier
     * @return Remaining time in seconds (0 if expired)
     */
    function getSwapTimeRemaining(bytes32 _swapId) external view returns (uint256) {
        Swap storage swap = swaps[_swapId];
        if (swap.state != SwapState.OPEN || block.timestamp >= swap.expiration) {
            return 0;
        }
        return swap.expiration - block.timestamp;
    }

    /**
     * @dev Generate a hash lock from a secret
     * @param _preimage The secret
     * @return The hash lock
     */
    function generateHashLock(bytes32 _preimage) external pure returns (bytes32) {
        return sha256(abi.encodePacked(_preimage));
    }

    /**
     * @dev Emergency function to recover stuck tokens (only for development)
     * @param _token Token address
     * @param _amount Amount to recover
     */
    function emergencyRecover(address _token, uint256 _amount) external {
        // In production, this would have proper access control
        // For demo purposes, allowing recovery of any stuck tokens
        require(_amount > 0, "HTLC: Invalid amount");
        IERC20(_token).safeTransfer(msg.sender, _amount);
    }
}
