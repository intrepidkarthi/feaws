#!/usr/bin/env node

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    const balance = await provider.getBalance(takerWallet.address);
    console.log(`Taker native POL balance: ${ethers.formatEther(balance)} POL`);
    
    if (balance > ethers.parseEther('0.1')) {
        console.log('✅ Taker has enough POL to send gas to maker');
    } else {
        console.log('❌ Taker needs more POL for gas transfer');
    }
}

main().catch(console.error);
