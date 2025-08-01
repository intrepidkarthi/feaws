#!/usr/bin/env node

/**
 * Transfer 1 POL from taker to maker for gas
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    const makerAddress = new ethers.Wallet(process.env.PRIVATE_KEY).address;

    console.log('⛽ Transferring 1 POL from taker to maker...\n');
    console.log(`From (Taker): ${takerWallet.address}`);
    console.log(`To (Maker):   ${makerAddress}`);

    // Check taker balance first
    const takerBalance = await provider.getBalance(takerWallet.address);
    console.log(`\nTaker current balance: ${ethers.formatEther(takerBalance)} POL`);

    const transferAmount = ethers.parseEther('1.0'); // 1 POL
    
    if (takerBalance < transferAmount) {
        throw new Error('Insufficient POL balance in taker wallet');
    }

    console.log(`\n📤 Sending 1.0 POL...`);
    
    const tx = await takerWallet.sendTransaction({
        to: makerAddress,
        value: transferAmount,
        gasLimit: 21000
    });

    console.log(`Transaction hash: ${tx.hash}`);
    console.log(`🔍 Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
    
    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
        console.log('✅ Transfer successful!');
        
        // Check new balances
        const newTakerBalance = await provider.getBalance(takerWallet.address);
        const newMakerBalance = await provider.getBalance(makerAddress);
        
        console.log('\n💰 Updated balances:');
        console.log(`Taker: ${ethers.formatEther(newTakerBalance)} POL`);
        console.log(`Maker: ${ethers.formatEther(newMakerBalance)} POL`);
        
    } else {
        console.log('❌ Transfer failed!');
    }
}

main().catch(console.error);
