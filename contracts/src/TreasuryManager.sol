// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TreasuryManager
 * @dev Manages USDC treasury with yield-gaining TWAP orders through 1inch Limit Orders
 * 
 * Core functionality:
 * - Hold USDC treasury balance
 * - Create TWAP orders that execute when yield opportunities arise
 * - Integrate with 1inch Limit Order Protocol v4 for optimal execution
 * - Monitor yield differentials and execute profitable swaps
 */
contract TreasuryManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // 1inch Limit Order Protocol v4 on Polygon
    address public constant ONEINCH_LIMIT_ORDER_PROTOCOL = 0x111111125421cA6dc452d289314280a0f8842A65;
    
    // Polygon token addresses
    address public constant USDC = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;
    address public constant WETH = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619;
    address public constant WMATIC = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
    address public constant DAI = 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063;
    address public constant stMATIC = 0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4;
    
    struct TWAPOrder {
        uint256 orderId;
        address sourceToken;      // USDC
        address targetToken;      // WETH, WMATIC, DAI, stMATIC
        uint256 totalAmount;      // Total USDC to swap
        uint256 trancheSize;      // Amount per execution
        uint256 executedAmount;   // Amount already executed
        uint256 minYieldBps;      // Minimum yield in basis points to execute
        uint256 intervalSeconds;  // Time between executions
        uint256 lastExecution;    // Timestamp of last execution
        uint256 maxSlippageBps;   // Maximum slippage tolerance
        bool active;              // Order status
        bytes32 limitOrderHash;   // 1inch limit order hash
    }
    
    struct YieldOpportunity {
        address token;
        uint256 currentYield;     // Current yield in basis points
        uint256 projectedYield;   // Projected yield after swap
        uint256 yieldDifferential; // Difference in basis points
        uint256 timestamp;
    }
    
    // State variables
    mapping(uint256 => TWAPOrder) public twapOrders;
    mapping(address => uint256) public treasuryBalances;
    mapping(address => YieldOpportunity) public yieldOpportunities;
    
    uint256 public nextOrderId = 1;
    uint256 public totalUSDCManaged;
    uint256 public minExecutionAmount = 100 * 1e6; // 100 USDC minimum
    uint256 public defaultYieldThreshold = 50; // 0.5% minimum yield advantage
    
    address public yieldOracle;
    
    // Events
    event TWAPOrderCreated(
        uint256 indexed orderId,
        address indexed sourceToken,
        address indexed targetToken,
        uint256 totalAmount,
        uint256 trancheSize,
        uint256 minYieldBps
    );
    
    event TWAPOrderExecuted(
        uint256 indexed orderId,
        uint256 executedAmount,
        uint256 receivedAmount,
        uint256 currentYield
    );
    
    event YieldOpportunityDetected(
        address indexed token,
        uint256 yieldDifferential,
        uint256 timestamp
    );
    
    event TreasuryDeposit(address indexed token, uint256 amount);
    event TreasuryWithdraw(address indexed token, uint256 amount);
    
    constructor(address _yieldOracle) {
        yieldOracle = _yieldOracle;
        
        // Initialize treasury balances tracking
        treasuryBalances[USDC] = 0;
        treasuryBalances[WETH] = 0;
        treasuryBalances[WMATIC] = 0;
        treasuryBalances[DAI] = 0;
        treasuryBalances[stMATIC] = 0;
    }
    
    /**
     * @dev Deposit USDC into treasury
     */
    function depositUSDC(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), amount);
        treasuryBalances[USDC] += amount;
        totalUSDCManaged += amount;
        
        emit TreasuryDeposit(USDC, amount);
    }
    
    /**
     * @dev Withdraw USDC from treasury (owner only)
     */
    function withdrawUSDC(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= treasuryBalances[USDC], "Insufficient balance");
        
        treasuryBalances[USDC] -= amount;
        totalUSDCManaged -= amount;
        IERC20(USDC).safeTransfer(msg.sender, amount);
        
        emit TreasuryWithdraw(USDC, amount);
    }
    
    /**
     * @dev Create a TWAP order for yield-gaining swaps
     * @param targetToken Token to swap USDC into (WETH, WMATIC, DAI, stMATIC)
     * @param totalAmount Total USDC amount to swap over time
     * @param trancheSize Amount of USDC per execution
     * @param minYieldBps Minimum yield advantage required to execute (basis points)
     * @param intervalSeconds Time interval between executions
     * @param maxSlippageBps Maximum slippage tolerance
     */
    function createTWAPOrder(
        address targetToken,
        uint256 totalAmount,
        uint256 trancheSize,
        uint256 minYieldBps,
        uint256 intervalSeconds,
        uint256 maxSlippageBps
    ) external onlyOwner returns (uint256 orderId) {
        require(_isValidTargetToken(targetToken), "Invalid target token");
        require(totalAmount >= minExecutionAmount, "Amount below minimum");
        require(trancheSize <= totalAmount, "Tranche size too large");
        require(trancheSize >= minExecutionAmount, "Tranche size too small");
        require(totalAmount <= treasuryBalances[USDC], "Insufficient USDC balance");
        require(minYieldBps >= 10, "Minimum yield too low"); // At least 0.1%
        require(intervalSeconds >= 300, "Interval too short"); // At least 5 minutes
        require(maxSlippageBps <= 1000, "Slippage too high"); // Max 10%
        
        orderId = nextOrderId++;
        
        twapOrders[orderId] = TWAPOrder({
            orderId: orderId,
            sourceToken: USDC,
            targetToken: targetToken,
            totalAmount: totalAmount,
            trancheSize: trancheSize,
            executedAmount: 0,
            minYieldBps: minYieldBps,
            intervalSeconds: intervalSeconds,
            lastExecution: 0,
            maxSlippageBps: maxSlippageBps,
            active: true,
            limitOrderHash: bytes32(0)
        });
        
        // Reserve USDC for this order
        treasuryBalances[USDC] -= totalAmount;
        
        emit TWAPOrderCreated(
            orderId,
            USDC,
            targetToken,
            totalAmount,
            trancheSize,
            minYieldBps
        );
        
        return orderId;
    }
    
    /**
     * @dev Execute TWAP order tranche if yield conditions are met
     * @param orderId The TWAP order to execute
     */
    function executeTWAPOrder(uint256 orderId) external nonReentrant {
        TWAPOrder storage order = twapOrders[orderId];
        require(order.active, "Order not active");
        require(order.executedAmount < order.totalAmount, "Order fully executed");
        require(
            block.timestamp >= order.lastExecution + order.intervalSeconds,
            "Too early to execute"
        );
        
        // Check yield opportunity
        YieldOpportunity memory opportunity = yieldOpportunities[order.targetToken];
        require(
            opportunity.yieldDifferential >= order.minYieldBps,
            "Yield threshold not met"
        );
        
        // Calculate execution amount
        uint256 remainingAmount = order.totalAmount - order.executedAmount;
        uint256 executionAmount = remainingAmount < order.trancheSize 
            ? remainingAmount 
            : order.trancheSize;
        
        // Execute swap through 1inch Limit Order
        uint256 receivedAmount = _executeSwapVia1inch(
            order.sourceToken,
            order.targetToken,
            executionAmount,
            order.maxSlippageBps
        );
        
        // Update order state
        order.executedAmount += executionAmount;
        order.lastExecution = block.timestamp;
        
        // Update treasury balances
        treasuryBalances[order.targetToken] += receivedAmount;
        
        // Mark order as complete if fully executed
        if (order.executedAmount >= order.totalAmount) {
            order.active = false;
        }
        
        emit TWAPOrderExecuted(
            orderId,
            executionAmount,
            receivedAmount,
            opportunity.currentYield
        );
    }
    
    /**
     * @dev Update yield opportunity for a token (called by oracle or keeper)
     */
    function updateYieldOpportunity(
        address token,
        uint256 currentYield,
        uint256 projectedYield
    ) external {
        require(msg.sender == yieldOracle || msg.sender == owner(), "Unauthorized");
        require(_isValidTargetToken(token), "Invalid token");
        
        uint256 yieldDifferential = projectedYield > currentYield 
            ? projectedYield - currentYield 
            : 0;
        
        yieldOpportunities[token] = YieldOpportunity({
            token: token,
            currentYield: currentYield,
            projectedYield: projectedYield,
            yieldDifferential: yieldDifferential,
            timestamp: block.timestamp
        });
        
        if (yieldDifferential >= defaultYieldThreshold) {
            emit YieldOpportunityDetected(token, yieldDifferential, block.timestamp);
        }
    }
    
    /**
     * @dev Execute swap through 1inch Limit Order Protocol
     */
    function _executeSwapVia1inch(
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint256 maxSlippageBps
    ) internal returns (uint256 receivedAmount) {
        // This would integrate with 1inch Limit Order Protocol
        // For now, we'll simulate the swap logic
        
        // Approve 1inch protocol to spend tokens
        IERC20(sourceToken).safeApprove(ONEINCH_LIMIT_ORDER_PROTOCOL, amount);
        
        // Calculate minimum received amount based on slippage
        uint256 minReceived = _calculateMinReceived(
            sourceToken,
            targetToken,
            amount,
            maxSlippageBps
        );
        
        // In a real implementation, this would:
        // 1. Create a limit order with 1inch Protocol
        // 2. Set appropriate price and conditions
        // 3. Wait for order execution or execute immediately if conditions are met
        
        // For simulation, we'll calculate a realistic received amount
        receivedAmount = _simulateSwapOutput(sourceToken, targetToken, amount);
        require(receivedAmount >= minReceived, "Slippage too high");
        
        return receivedAmount;
    }
    
    /**
     * @dev Calculate minimum received amount based on slippage tolerance
     */
    function _calculateMinReceived(
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint256 maxSlippageBps
    ) internal pure returns (uint256) {
        // Simplified price calculation - in reality would use 1inch quote API
        uint256 baseRate = _getSimulatedRate(sourceToken, targetToken);
        uint256 expectedOutput = (amount * baseRate) / 1e18;
        uint256 slippageAmount = (expectedOutput * maxSlippageBps) / 10000;
        
        return expectedOutput - slippageAmount;
    }
    
    /**
     * @dev Simulate swap output for testing
     */
    function _simulateSwapOutput(
        address sourceToken,
        address targetToken,
        uint256 amount
    ) internal pure returns (uint256) {
        uint256 rate = _getSimulatedRate(sourceToken, targetToken);
        return (amount * rate) / 1e18;
    }
    
    /**
     * @dev Get simulated exchange rate
     */
    function _getSimulatedRate(
        address sourceToken,
        address targetToken
    ) internal pure returns (uint256) {
        // Simplified rates for simulation
        if (sourceToken == USDC && targetToken == WETH) {
            return 400000000000000; // ~0.0004 WETH per USDC
        } else if (sourceToken == USDC && targetToken == WMATIC) {
            return 1200000000000000000; // ~1.2 WMATIC per USDC
        } else if (sourceToken == USDC && targetToken == DAI) {
            return 1000000000000000000; // ~1 DAI per USDC
        } else if (sourceToken == USDC && targetToken == stMATIC) {
            return 1100000000000000000; // ~1.1 stMATIC per USDC
        }
        
        return 1e18; // 1:1 fallback
    }
    
    /**
     * @dev Check if token is valid for swapping
     */
    function _isValidTargetToken(address token) internal pure returns (bool) {
        return token == WETH || token == WMATIC || token == DAI || token == stMATIC;
    }
    
    /**
     * @dev Cancel TWAP order
     */
    function cancelTWAPOrder(uint256 orderId) external onlyOwner {
        TWAPOrder storage order = twapOrders[orderId];
        require(order.active, "Order not active");
        
        // Return unused USDC to treasury
        uint256 unusedAmount = order.totalAmount - order.executedAmount;
        treasuryBalances[USDC] += unusedAmount;
        
        order.active = false;
    }
    
    /**
     * @dev Get treasury balance for a token
     */
    function getTreasuryBalance(address token) external view returns (uint256) {
        return treasuryBalances[token];
    }
    
    /**
     * @dev Get TWAP order details
     */
    function getTWAPOrder(uint256 orderId) external view returns (TWAPOrder memory) {
        return twapOrders[orderId];
    }
    
    /**
     * @dev Get yield opportunity for a token
     */
    function getYieldOpportunity(address token) external view returns (YieldOpportunity memory) {
        return yieldOpportunities[token];
    }
    
    /**
     * @dev Check if TWAP order can be executed
     */
    function canExecuteTWAPOrder(uint256 orderId) external view returns (bool) {
        TWAPOrder memory order = twapOrders[orderId];
        
        if (!order.active || order.executedAmount >= order.totalAmount) {
            return false;
        }
        
        if (block.timestamp < order.lastExecution + order.intervalSeconds) {
            return false;
        }
        
        YieldOpportunity memory opportunity = yieldOpportunities[order.targetToken];
        return opportunity.yieldDifferential >= order.minYieldBps;
    }
    
    /**
     * @dev Update yield oracle address
     */
    function updateYieldOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        yieldOracle = newOracle;
    }
    
    /**
     * @dev Update minimum execution amount
     */
    function updateMinExecutionAmount(uint256 newAmount) external onlyOwner {
        require(newAmount > 0, "Amount must be greater than 0");
        minExecutionAmount = newAmount;
    }
    
    /**
     * @dev Emergency withdraw function
     */
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(owner(), balance);
        }
    }
}
