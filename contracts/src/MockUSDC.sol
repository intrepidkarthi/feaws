// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for ETHGlobal UNITE demo
 * @notice This is a test token with same decimals as real USDC (6)
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;
    uint256 private constant INITIAL_SUPPLY = 1000000; // 1M USDC

    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);

    constructor() ERC20("Mock USD Coin", "USDC") {
        _mint(msg.sender, INITIAL_SUPPLY * 10**DECIMALS);
        emit TokensMinted(msg.sender, INITIAL_SUPPLY * 10**DECIMALS);
    }

    /**
     * @dev Returns the number of decimals used to get its user representation
     * @return uint8 Number of decimals (6, same as real USDC)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Mint tokens to specified address (owner only)
     * @param to Address to mint tokens to
     * @param amount Amount to mint (in wei, considering 6 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @dev Burn tokens from specified address (owner only)
     * @param from Address to burn tokens from
     * @param amount Amount to burn (in wei, considering 6 decimals)
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    /**
     * @dev Get balance in human readable format
     * @param account Address to check balance for
     * @return uint256 Balance in USDC (not wei)
     */
    function balanceInUSDC(address account) external view returns (uint256) {
        return balanceOf(account) / 10**DECIMALS;
    }

    /**
     * @dev Convert USDC amount to wei (for internal calculations)
     * @param usdcAmount Amount in USDC
     * @return uint256 Amount in wei
     */
    function toWei(uint256 usdcAmount) external pure returns (uint256) {
        return usdcAmount * 10**DECIMALS;
    }
}
