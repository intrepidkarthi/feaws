#!/usr/bin/env node

/**
 * Simplified TWAP Demo - Shows order generation and time-based execution
 * without complex 1inch LOP integration for demonstration purposes
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);

    console.log('🚀 FEAWS TWAP Engine - Simplified Demo\n');
    console.log('════════════════════════════════════════════════════════════');
    console.log('🎯 ETHGlobal UNITE 2025 - 1inch Prize Track');
    console.log('📋 Advanced TWAP Strategy Demonstration');
    console.log('════════════════════════════════════════════════════════════\n');

    console.log('📍 WALLET ADDRESSES:');
    console.log(`   Maker:  ${makerWallet.address}`);
    console.log(`   Taker:  ${takerWallet.address}\n`);

    // Check balances
    const usdcContract = new ethers.Contract(
        '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        provider
    );

    const makerUSDC = await usdcContract.balanceOf(makerWallet.address);
    const usdcDecimals = await usdcContract.decimals();
    const makerPOL = await provider.getBalance(makerWallet.address);
    const takerPOL = await provider.getBalance(takerWallet.address);

    console.log('💰 CURRENT BALANCES:');
    console.log(`   Maker USDC: ${ethers.formatUnits(makerUSDC, usdcDecimals)} USDC`);
    console.log(`   Maker POL:  ${ethers.formatEther(makerPOL)} POL`);
    console.log(`   Taker POL:  ${ethers.formatEther(takerPOL)} POL\n`);

    // Load orders
    const ordersFile = path.join(__dirname, '../data/orders.json');
    if (!fs.existsSync(ordersFile)) {
        console.log('❌ No orders found. Run: npm run build-orders');
        return;
    }

    const ordersData = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    console.log('📋 TWAP STRATEGY:');
    console.log(`   Total USDC: ${ordersData.totalUSDC} USDC`);
    console.log(`   Slices: ${ordersData.sliceCount}`);
    console.log(`   Per slice: ${ordersData.usdcPerSlice} USDC`);
    console.log(`   Interval: ${ordersData.sliceInterval} seconds\n`);

    console.log('⏰ EXECUTION TIMELINE:');
    const currentTime = Math.floor(Date.now() / 1000);
    
    ordersData.orders.forEach((order, i) => {
        const timeUntil = order.availableAt - currentTime;
        const status = timeUntil <= 0 ? '✅ READY' : `⏳ ${timeUntil}s`;
        console.log(`   Slice ${i}: ${status} - ${order.makingAmount} USDC → ${order.takingAmount} WMATIC`);
    });

    console.log('\n🎬 STARTING DEMO EXECUTION...');
    console.log('════════════════════════════════════════════════════════════\n');

    // Simulate TWAP execution
    let completedSlices = 0;
    const startTime = Date.now();

    for (let i = 0; i < ordersData.orders.length; i++) {
        const order = ordersData.orders[i];
        const timeUntil = order.availableAt - Math.floor(Date.now() / 1000);

        if (timeUntil > 0) {
            console.log(`⏳ Waiting ${timeUntil}s for slice ${i}...`);
            
            // Wait for the time or max 10 seconds for demo
            const waitTime = Math.min(timeUntil * 1000, 10000);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        console.log(`⚡ Executing slice ${i}: ${order.makingAmount} USDC → ${order.takingAmount} WMATIC`);
        
        // Simulate transaction
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        completedSlices++;
        const progress = (completedSlices / ordersData.orders.length * 100).toFixed(1);
        
        console.log(`✅ Slice ${i} completed! Progress: ${progress}%`);
        
        // Emit to TwapLogger (simulated)
        console.log(`📡 TwapLogger event: SliceFilled(${i}, ${makerWallet.address}, ${order.order.makingAmount}, ${order.order.takingAmount})`);
        console.log(`🔍 Simulated tx: https://polygonscan.com/tx/0x${'0'.repeat(60)}${i.toString().padStart(4, '0')}\n`);
        
        // Break after 3 slices for demo
        if (i >= 2) {
            console.log('📋 Demo completed 3 slices. Full execution would continue...\n');
            break;
        }
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log('🎉 TWAP DEMO COMPLETED!');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`📊 Executed: ${Math.min(completedSlices, 3)} slices`);
    console.log(`⏰ Time elapsed: ${elapsed} seconds`);
    console.log(`💰 USDC processed: ${Math.min(completedSlices, 3) * parseFloat(ordersData.usdcPerSlice)} USDC`);
    console.log('\n✨ This demonstrates the TWAP time-based execution logic.');
    console.log('🔗 In production, each slice would be a real 1inch limit order fill.');
    console.log('📡 Events would be emitted to TwapLogger contract on-chain.');
    console.log('🎯 Perfect for ETHGlobal UNITE 2025 - 1inch Prize Track!\n');
}

main().catch(console.error);
