#!/usr/bin/env node

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // WMATIC contract - this WILL work
    const wmatic = new ethers.Contract(
        '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        ['function deposit() payable', 'function balanceOf(address) view returns (uint256)'],
        wallet
    );

    const before = await wmatic.balanceOf(wallet.address);
    console.log(`Before: ${ethers.formatEther(before)} WMATIC`);

    // Actually wrap 0.01 MATIC to WMATIC
    const tx = await wmatic.deposit({ value: ethers.parseEther('0.01') });
    await tx.wait();

    const after = await wmatic.balanceOf(wallet.address);
    console.log(`After: ${ethers.formatEther(after)} WMATIC`);
    console.log(`Gained: ${ethers.formatEther(after - before)} WMATIC`);
    console.log(`TX: https://polygonscan.com/tx/${tx.hash}`);
}

main().catch(console.error);
