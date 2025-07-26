// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockStETH
 * @dev Mock Liquid Staked Ether token for ETHGlobal UNITE demo
 * @notice This is a test token with same decimals as real stETH (18)
 */
contract MockStETH is ERC20, Ownable {
    uint8 private constant DECIMALS = 18;
    uint256 private constant INITIAL_SUPPLY = 1000000; // 1M stETH

    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event YieldAccrued(uint256 totalSupply, uint256 yieldAmount);

    constructor() ERC20("Mock Liquid Staked Ether", "stETH") {
        _mint(msg.sender, INITIAL_SUPPLY * 10**DECIMALS);
        emit TokensMinted(msg.sender, INITIAL_SUPPLY * 10**DECIMALS);
    }

    /**
     * @dev Returns the number of decimals used to get its user representation
     * @return uint8 Number of decimals (18, same as real stETH)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Mint tokens to specified address (owner only)
     * @param to Address to mint tokens to
     * @param amount Amount to mint (in wei, considering 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @dev Burn tokens from specified address (owner only)
     * @param from Address to burn tokens from
     * @param amount Amount to burn (in wei, considering 18 decimals)
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    /**
     * @dev Simulate staking yield accrual (for demo purposes)
     * @param yieldBasisPoints Yield in basis points (e.g., 380 = 3.8%)
     */
    function accrueYield(uint256 yieldBasisPoints) external onlyOwner {
        uint256 currentSupply = totalSupply();
        uint256 yieldAmount = (currentSupply * yieldBasisPoints) / 10000;
        
        if (yieldAmount > 0) {
            _mint(owner(), yieldAmount);
            emit YieldAccrued(currentSupply, yieldAmount);
        }
    }

    /**
     * @dev Get balance in human readable format
     * @param account Address to check balance for
     * @return uint256 Balance in stETH (not wei)
     */
    function balanceInStETH(address account) external view returns (uint256) {
        return balanceOf(account) / 10**DECIMALS;
    }

    /**
     * @dev Convert stETH amount to wei (for internal calculations)
     * @param stethAmount Amount in stETH
     * @return uint256 Amount in wei
     */
    function toWei(uint256 stethAmount) external pure returns (uint256) {
        return stethAmount * 10**DECIMALS;
    }

    /**
     * @dev Simulate the rebasing mechanism of real stETH
     * @notice In real stETH, balances increase automatically. Here we simulate it.
     */
    function simulateRebase() external onlyOwner {
        // Simulate 0.1% daily yield (3.65% APY)
        accrueYield(10); // 0.1% = 10 basis points
    }
}
