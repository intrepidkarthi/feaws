#!/usr/bin/env node

/**
 * Send MATIC for gas from taker to maker
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    const makerAddress = new ethers.Wallet(process.env.PRIVATE_KEY).address;

    console.log('⛽ Sending POL for gas from taker to maker...');
    console.log(`From: ${takerWallet.address}`);
    console.log(`To: ${makerAddress}`);

    const gasAmount = ethers.parseEther('0.1'); // 0.1 POL for gas
    
    const tx = await takerWallet.sendTransaction({
        to: makerAddress,
        value: gasAmount,
        gasLimit: 21000
    });

    console.log(`📤 Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Sent 0.1 POL for gas`);
    console.log(`🔍 Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
}

main().catch(console.error);
