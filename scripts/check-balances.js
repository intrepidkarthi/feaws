#!/usr/bin/env node

/**
 * Check token balances for maker and taker wallets
 */

require('dotenv').config();
const { ethers } = require('ethers');

// Polygon mainnet addresses
const TOKENS = {
    USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
};

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);

    console.log('💰 Token Balances:\n');
    console.log(`Maker: ${makerWallet.address}`);
    console.log(`Taker: ${takerWallet.address}\n`);

    for (const [symbol, address] of Object.entries(TOKENS)) {
        const contract = new ethers.Contract(
            address,
            ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
            provider
        );

        try {
            const decimals = await contract.decimals();
            const makerBalance = await contract.balanceOf(makerWallet.address);
            const takerBalance = await contract.balanceOf(takerWallet.address);

            console.log(`${symbol}:`);
            console.log(`  Maker: ${ethers.formatUnits(makerBalance, decimals)}`);
            console.log(`  Taker: ${ethers.formatUnits(takerBalance, decimals)}`);
        } catch (error) {
            console.log(`${symbol}: Error reading balance`);
        }
    }

    // Check native MATIC balances
    const makerMatic = await provider.getBalance(makerWallet.address);
    const takerMatic = await provider.getBalance(takerWallet.address);
    
    console.log(`\nMATIC:`);
    console.log(`  Maker: ${ethers.formatEther(makerMatic)}`);
    console.log(`  Taker: ${ethers.formatEther(takerMatic)}`);
}

main().catch(console.error);
