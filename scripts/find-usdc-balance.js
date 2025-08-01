#!/usr/bin/env node

/**
 * Find USDC balance across all variants
 */

require('dotenv').config();
const { ethers } = require('ethers');

// All USDC variants on Polygon
const USDC_VARIANTS = {
    'Native USDC': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    'PoS USDC (old)': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    'USDC.e (Ethereum)': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // Same as PoS
    'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
};

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log('🔍 Searching for stablecoin balances...\n');
    console.log(`Wallet: ${makerWallet.address}\n`);

    let totalFound = 0;

    for (const [name, address] of Object.entries(USDC_VARIANTS)) {
        const contract = new ethers.Contract(
            address,
            ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'],
            provider
        );

        try {
            const decimals = await contract.decimals();
            const symbol = await contract.symbol();
            const balance = await contract.balanceOf(makerWallet.address);
            const formatted = ethers.formatUnits(balance, decimals);

            if (parseFloat(formatted) > 0) {
                console.log(`✅ ${name}:`);
                console.log(`   Address: ${address}`);
                console.log(`   Symbol: ${symbol}`);
                console.log(`   Balance: ${formatted}`);
                console.log('');
                totalFound++;
            }
        } catch (error) {
            // Skip invalid contracts
        }
    }

    if (totalFound === 0) {
        console.log('❌ No stablecoin balances found');
        console.log('\nChecking native MATIC...');
        
        const maticBalance = await provider.getBalance(makerWallet.address);
        console.log(`MATIC: ${ethers.formatEther(maticBalance)}`);
        
        console.log('\nChecking WMATIC...');
        const wmaticContract = new ethers.Contract(
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            ['function balanceOf(address) view returns (uint256)'],
            provider
        );
        const wmaticBalance = await wmaticContract.balanceOf(makerWallet.address);
        console.log(`WMATIC: ${ethers.formatEther(wmaticBalance)}`);
    }
}

main().catch(console.error);
