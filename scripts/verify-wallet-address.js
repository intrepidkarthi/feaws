#!/usr/bin/env node

/**
 * Verify the actual wallet address from private key
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    console.log('🔍 WALLET ADDRESS VERIFICATION\n');
    
    // Create wallets from private keys
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY);
    
    console.log('📋 ADDRESSES FROM PRIVATE KEYS:');
    console.log(`Maker:  ${makerWallet.address}`);
    console.log(`Taker:  ${takerWallet.address}`);
    
    console.log('\n🔗 POLYGONSCAN LINKS:');
    console.log(`Maker:  https://polygonscan.com/address/${makerWallet.address}`);
    console.log(`Taker:  https://polygonscan.com/address/${takerWallet.address}`);
    
    // Show first few chars of private keys for verification (safely)
    console.log('\n🔐 PRIVATE KEY VERIFICATION (first 10 chars):');
    console.log(`Maker PK:  ${process.env.PRIVATE_KEY.substring(0, 10)}...`);
    console.log(`Taker PK:  ${process.env.TAKER_PRIVATE_KEY.substring(0, 10)}...`);
}

main().catch(console.error);
