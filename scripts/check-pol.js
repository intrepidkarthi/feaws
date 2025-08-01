#!/usr/bin/env node

/**
 * Check POL token balance (Polygon's new token)
 */

require('dotenv').config();
const { ethers } = require('ethers');

// POL token address on Polygon
const POL_TOKEN = '0x455e53908c6d1c5a7b3e5c6c4f1b3f4e2c8b5c6d'; // This might be the POL address

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log('🔍 Checking POL and native token balances...\n');
    console.log(`Wallet: ${makerWallet.address}\n`);

    // Check native balance (should be POL now)
    const nativeBalance = await provider.getBalance(makerWallet.address);
    console.log(`Native Balance: ${ethers.formatEther(nativeBalance)} (should be POL)`);

    // Check if there's a POL ERC20 token
    const possiblePOLAddresses = [
        '0x455e53908c6d1c5a7b3e5c6c4f1b3f4e2c8b5c6d', // Hypothetical POL
        '0x0000000000000000000000000000000000001010', // Native token proxy
        '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'  // WMATIC (might be WPOL now)
    ];

    for (const address of possiblePOLAddresses) {
        try {
            const contract = new ethers.Contract(
                address,
                ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)', 'function name() view returns (string)'],
                provider
            );

            const balance = await contract.balanceOf(makerWallet.address);
            const symbol = await contract.symbol();
            const name = await contract.name();
            
            if (balance > 0) {
                console.log(`✅ ${name} (${symbol}):`);
                console.log(`   Address: ${address}`);
                console.log(`   Balance: ${ethers.formatEther(balance)}`);
            }
        } catch (error) {
            // Skip invalid contracts
        }
    }

    // Check WMATIC specifically
    try {
        const wmaticContract = new ethers.Contract(
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'],
            provider
        );
        
        const wmaticBalance = await wmaticContract.balanceOf(makerWallet.address);
        const symbol = await wmaticContract.symbol();
        
        console.log(`\n${symbol} Balance: ${ethers.formatEther(wmaticBalance)}`);
    } catch (error) {
        console.log('Error checking WMATIC:', error.message);
    }
}

main().catch(console.error);
