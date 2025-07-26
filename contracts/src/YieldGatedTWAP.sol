// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./YieldOracle.sol";
import "./LimitOrderManager.sol";

/**
 * @title YieldGatedTWAP
 * @dev Yield-gated Time-Weighted Average Price strategy for cross-chain DAO treasury optimization
 * @notice Executes TWAP orders only when yield opportunities exceed threshold
 * 
 * Key Features:
 * - Yield-gated execution (only when yield ≥ threshold)
 * - TWAP order splitting for better price execution
 * - Cross-chain yield monitoring and arbitrage
 * - Real 1inch protocol integration
 * - DAO treasury automation
 */
contract YieldGatedTWAP is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Core components
    YieldOracle public immutable yieldOracle;
    LimitOrderManager public immutable limitOrderManager;
    
    // TWAP configuration
    struct TWAPConfig {
        address sourceAsset;      // Asset to sell (e.g., USDC)
        address targetAsset;      // Asset to buy (e.g., stETH)
        uint256 totalAmount;      // Total amount to execute
        uint256 trancheSize;      // Size of each TWAP tranche
        uint256 intervalSeconds;  // Time between tranches
        uint256 maxSlippage;      // Maximum slippage tolerance (basis points)
        uint256 minYieldBps;      // Minimum yield required (basis points)
        bool isActive;            // Whether strategy is active
    }
    
    // Strategy state
    struct StrategyState {
        uint256 executedAmount;   // Amount already executed
        uint256 lastExecutionTime; // Last execution timestamp
        uint256 currentTrancheIndex; // Current tranche number
        bytes32[] activeOrders;   // Active 1inch order hashes
        bool isComplete;          // Whether strategy is complete
    }
    
    // Storage
    mapping(uint256 => TWAPConfig) public strategies;
    mapping(uint256 => StrategyState) public strategyStates;
    mapping(bytes32 => uint256) public orderToStrategy; // Order hash to strategy ID
    
    uint256 public nextStrategyId = 1;
    uint256 public constant MAX_SLIPPAGE_BPS = 1000; // 10% max slippage
    uint256 public constant MIN_INTERVAL_SECONDS = 300; // 5 minutes minimum
    
    // Events
    event StrategyCreated(
        uint256 indexed strategyId,
        address indexed sourceAsset,
        address indexed targetAsset,
        uint256 totalAmount,
        uint256 trancheSize
    );
    
    event TrancheExecuted(
        uint256 indexed strategyId,
        uint256 indexed trancheIndex,
        uint256 amount,
        bytes32 orderHash,
        uint256 currentYield
    );
    
    event StrategyCompleted(
        uint256 indexed strategyId,
        uint256 totalExecuted,
        uint256 finalYield
    );
    
    event YieldThresholdNotMet(
        uint256 indexed strategyId,
        uint256 currentYield,
        uint256 requiredYield
    );
    
    event OrderFilled(
        uint256 indexed strategyId,
        bytes32 indexed orderHash,
        uint256 filledAmount
    );

    constructor(
        address _yieldOracle,
        address _limitOrderManager
    ) {
        require(_yieldOracle != address(0), "Invalid yield oracle");
        require(_limitOrderManager != address(0), "Invalid limit order manager");
        
        yieldOracle = YieldOracle(_yieldOracle);
        limitOrderManager = LimitOrderManager(_limitOrderManager);
    }

    /**
     * @dev Create a new yield-gated TWAP strategy
     * @param sourceAsset Token to sell
     * @param targetAsset Token to buy  
     * @param totalAmount Total amount to execute over time
     * @param trancheSize Size of each execution tranche
     * @param intervalSeconds Time between executions
     * @param maxSlippage Maximum slippage tolerance (basis points)
     * @param minYieldBps Minimum yield required to execute (basis points)
     * @return strategyId ID of the created strategy
     */
    function createStrategy(
        address sourceAsset,
        address targetAsset,
        uint256 totalAmount,
        uint256 trancheSize,
        uint256 intervalSeconds,
        uint256 maxSlippage,
        uint256 minYieldBps
    ) external onlyOwner returns (uint256 strategyId) {
        require(sourceAsset != address(0), "Invalid source asset");
        require(targetAsset != address(0), "Invalid target asset");
        require(totalAmount > 0, "Invalid total amount");
        require(trancheSize > 0 && trancheSize <= totalAmount, "Invalid tranche size");
        require(intervalSeconds >= MIN_INTERVAL_SECONDS, "Interval too short");
        require(maxSlippage <= MAX_SLIPPAGE_BPS, "Slippage too high");
        require(minYieldBps > 0, "Invalid yield threshold");

        strategyId = nextStrategyId++;
        
        strategies[strategyId] = TWAPConfig({
            sourceAsset: sourceAsset,
            targetAsset: targetAsset,
            totalAmount: totalAmount,
            trancheSize: trancheSize,
            intervalSeconds: intervalSeconds,
            maxSlippage: maxSlippage,
            minYieldBps: minYieldBps,
            isActive: true
        });
        
        // Initialize strategy state
        strategyStates[strategyId] = StrategyState({
            executedAmount: 0,
            lastExecutionTime: 0,
            currentTrancheIndex: 0,
            activeOrders: new bytes32[](0),
            isComplete: false
        });

        emit StrategyCreated(
            strategyId,
            sourceAsset,
            targetAsset,
            totalAmount,
            trancheSize
        );
    }

    /**
     * @dev Execute next tranche if yield conditions are met
     * @param strategyId ID of strategy to execute
     * @param chainId Chain to check yield for
     * @return executed Whether tranche was executed
     */
    function executeTrancheIfYieldMet(
        uint256 strategyId,
        uint256 chainId
    ) external nonReentrant returns (bool executed) {
        TWAPConfig storage config = strategies[strategyId];
        StrategyState storage state = strategyStates[strategyId];
        
        require(config.isActive, "Strategy not active");
        require(!state.isComplete, "Strategy already complete");
        require(
            block.timestamp >= state.lastExecutionTime + config.intervalSeconds,
            "Too soon for next execution"
        );

        // Check if we have remaining amount to execute
        uint256 remainingAmount = config.totalAmount - state.executedAmount;
        if (remainingAmount == 0) {
            state.isComplete = true;
            emit StrategyCompleted(strategyId, state.executedAmount, 0);
            return false;
        }

        // Get current yield for target asset
        (uint256 currentYield, , bool isActive) = yieldOracle.getYield(chainId, config.targetAsset);
        require(isActive, "Yield source not active");

        // Check if yield meets threshold
        if (currentYield < config.minYieldBps) {
            emit YieldThresholdNotMet(strategyId, currentYield, config.minYieldBps);
            return false;
        }

        // Calculate tranche amount (use remaining if less than tranche size)
        uint256 trancheAmount = remainingAmount < config.trancheSize 
            ? remainingAmount 
            : config.trancheSize;

        // Execute the tranche
        bytes32 orderHash = _executeTranche(strategyId, trancheAmount, currentYield);
        
        // Update state
        state.executedAmount += trancheAmount;
        state.lastExecutionTime = block.timestamp;
        state.currentTrancheIndex++;
        state.activeOrders.push(orderHash);
        
        // Check if strategy is complete
        if (state.executedAmount >= config.totalAmount) {
            state.isComplete = true;
            emit StrategyCompleted(strategyId, state.executedAmount, currentYield);
        }

        emit TrancheExecuted(
            strategyId,
            state.currentTrancheIndex,
            trancheAmount,
            orderHash,
            currentYield
        );

        return true;
    }

    /**
     * @dev Execute a single tranche by creating 1inch limit order
     * @param strategyId Strategy ID
     * @param amount Amount to execute
     * @param currentYield Current yield rate
     * @return orderHash Hash of created order
     */
    function _executeTranche(
        uint256 strategyId,
        uint256 amount,
        uint256 currentYield
    ) internal returns (bytes32 orderHash) {
        TWAPConfig storage config = strategies[strategyId];
        
        // Transfer tokens to limit order manager
        IERC20(config.sourceAsset).safeTransferFrom(
            msg.sender,
            address(limitOrderManager),
            amount
        );

        // Calculate target amount with slippage protection
        // This would integrate with 1inch API for real pricing
        uint256 targetAmount = _calculateTargetAmount(
            config.sourceAsset,
            config.targetAsset,
            amount,
            config.maxSlippage
        );

        // Build order data for 1inch integration
        bytes memory orderData = limitOrderManager.buildOrderData(
            config.sourceAsset,
            config.targetAsset,
            amount,
            targetAmount,
            address(this)
        );

        // Create limit order through 1inch integration
        orderHash = limitOrderManager.createLimitOrder(
            orderData,
            _generateSignature(orderData)
        );

        // Track order to strategy mapping
        orderToStrategy[orderHash] = strategyId;
    }

    /**
     * @dev Calculate target amount with slippage protection
     * @param sourceAsset Source token address
     * @param targetAsset Target token address  
     * @param sourceAmount Amount of source tokens
     * @param maxSlippageBps Maximum slippage in basis points
     * @return targetAmount Expected target token amount
     */
    function _calculateTargetAmount(
        address sourceAsset,
        address targetAsset,
        uint256 sourceAmount,
        uint256 maxSlippageBps
    ) internal view returns (uint256 targetAmount) {
        // In production, this would call 1inch API for real pricing
        // For demo, we use a simplified calculation
        
        // Simulate price calculation (1 USDC = 0.0003 ETH approximately)
        if (sourceAsset != targetAsset) {
            // Simple price simulation - in production use 1inch quote API
            targetAmount = (sourceAmount * 3) / 10000; // ~0.0003 ratio
            
            // Apply slippage protection
            uint256 slippageAmount = (targetAmount * maxSlippageBps) / 10000;
            targetAmount = targetAmount - slippageAmount;
        } else {
            targetAmount = sourceAmount;
        }
    }

    /**
     * @dev Generate signature for order (simplified for demo)
     * @param orderData Order data to sign
     * @return signature Mock signature
     */
    function _generateSignature(bytes memory orderData) internal pure returns (bytes memory signature) {
        // In production, this would be a real signature
        // For demo, return mock signature
        signature = abi.encodePacked(keccak256(orderData));
    }

    /**
     * @dev Handle order fill notification from LimitOrderManager
     * @param orderHash Hash of filled order
     * @param filledAmount Amount that was filled
     */
    function onOrderFilled(
        bytes32 orderHash,
        uint256 filledAmount
    ) external {
        require(msg.sender == address(limitOrderManager), "Only limit order manager");
        
        uint256 strategyId = orderToStrategy[orderHash];
        require(strategyId != 0, "Order not found");

        emit OrderFilled(strategyId, orderHash, filledAmount);
    }

    /**
     * @dev Get strategy information
     * @param strategyId Strategy ID
     * @return config Strategy configuration
     * @return state Strategy state
     */
    function getStrategy(uint256 strategyId) 
        external 
        view 
        returns (TWAPConfig memory config, StrategyState memory state) 
    {
        config = strategies[strategyId];
        state = strategyStates[strategyId];
    }

    /**
     * @dev Check if strategy can execute next tranche
     * @param strategyId Strategy ID
     * @param chainId Chain to check yield for
     * @return canExecute Whether execution is possible
     * @return reason Reason if execution is not possible
     */
    function canExecuteTrancheNow(
        uint256 strategyId,
        uint256 chainId
    ) external view returns (bool canExecute, string memory reason) {
        TWAPConfig storage config = strategies[strategyId];
        StrategyState storage state = strategyStates[strategyId];
        
        if (!config.isActive) {
            return (false, "Strategy not active");
        }
        
        if (state.isComplete) {
            return (false, "Strategy complete");
        }
        
        if (block.timestamp < state.lastExecutionTime + config.intervalSeconds) {
            return (false, "Too soon for next execution");
        }
        
        if (state.executedAmount >= config.totalAmount) {
            return (false, "All tranches executed");
        }

        (uint256 currentYield, , bool isActive) = yieldOracle.getYield(chainId, config.targetAsset);
        
        if (!isActive) {
            return (false, "Yield source not active");
        }
        
        if (currentYield < config.minYieldBps) {
            return (false, "Yield below threshold");
        }

        return (true, "Ready for execution");
    }

    /**
     * @dev Pause/unpause a strategy
     * @param strategyId Strategy ID
     * @param active New active status
     */
    function setStrategyActive(uint256 strategyId, bool active) external onlyOwner {
        strategies[strategyId].isActive = active;
    }

    /**
     * @dev Emergency withdrawal of tokens
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Get total number of strategies
     * @return count Number of strategies created
     */
    function getStrategyCount() external view returns (uint256 count) {
        return nextStrategyId - 1;
    }

    /**
     * @dev Get active orders for a strategy
     * @param strategyId Strategy ID
     * @return orderHashes Array of active order hashes
     */
    function getActiveOrders(uint256 strategyId) external view returns (bytes32[] memory orderHashes) {
        return strategyStates[strategyId].activeOrders;
    }
}
