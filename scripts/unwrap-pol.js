#!/usr/bin/env node

/**
 * Unwrap WPOL to native POL for gas
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log('🔄 Unwrapping WPOL to native POL for gas...');

    // WPOL contract (same address as WMATIC, now WPOL)
    const wpol = new ethers.Contract(
        '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        [
            'function withdraw(uint256) external',
            'function balanceOf(address) view returns (uint256)'
        ],
        makerWallet
    );

    const wpolBalance = await wpol.balanceOf(makerWallet.address);
    console.log(`Current WPOL balance: ${ethers.formatEther(wpolBalance)}`);

    // Unwrap 0.1 WPOL for gas
    const unwrapAmount = ethers.parseEther('0.1');
    
    if (wpolBalance < unwrapAmount) {
        throw new Error('Insufficient WPOL balance to unwrap');
    }

    console.log('Unwrapping 0.1 WPOL to native POL...');
    
    const tx = await wpol.withdraw(unwrapAmount, {
        gasLimit: 50000
    });

    console.log(`📤 Transaction sent: ${tx.hash}`);
    await tx.wait();
    
    const newNativeBalance = await provider.getBalance(makerWallet.address);
    console.log(`✅ Unwrap successful!`);
    console.log(`🔍 Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
    console.log(`💰 New native POL balance: ${ethers.formatEther(newNativeBalance)}`);
}

main().catch(console.error);
