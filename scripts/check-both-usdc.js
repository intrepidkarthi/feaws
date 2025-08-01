#!/usr/bin/env node

/**
 * Check balances for BOTH USDC contracts
 */

require('dotenv').config();
const { ethers } = require('ethers');

// Both USDC contracts on Polygon
const USDC_CONTRACTS = {
    'Native USDC': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    'PoS USDC': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'
};

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);

    console.log('💰 USDC Balance Check:\n');
    console.log(`Maker: ${makerWallet.address}`);
    console.log(`Taker: ${takerWallet.address}\n`);

    for (const [name, address] of Object.entries(USDC_CONTRACTS)) {
        console.log(`${name} (${address}):`);
        
        const contract = new ethers.Contract(
            address,
            ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'],
            provider
        );

        try {
            const decimals = await contract.decimals();
            const symbol = await contract.symbol();
            const makerBalance = await contract.balanceOf(makerWallet.address);
            const takerBalance = await contract.balanceOf(takerWallet.address);

            console.log(`  Symbol: ${symbol}`);
            console.log(`  Decimals: ${decimals}`);
            console.log(`  Maker: ${ethers.formatUnits(makerBalance, decimals)}`);
            console.log(`  Taker: ${ethers.formatUnits(takerBalance, decimals)}`);
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
        console.log('');
    }
}

main().catch(console.error);
