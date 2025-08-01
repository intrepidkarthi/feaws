#!/usr/bin/env node

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const balance = await provider.getBalance(makerWallet.address);
    console.log(`Maker MATIC balance: ${ethers.formatEther(balance)} MATIC`);
}

main().catch(console.error);
