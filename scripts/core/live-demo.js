#!/usr/bin/env node

/**
 * Live TWAP Demo - Complete end-to-end test
 * 
 * This script will:
 * 1. Check wallet balances
 * 2. Show contract deployment details
 * 3. Display generated orders
 * 4. Approve USDC if needed
 * 5. Start monitoring in background
 * 6. Execute live fills when ready
 * 
 * Usage: npm run live-demo
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Contract addresses
const TOKENS = {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
};
const LOP_CONTRACT = '0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f';
const TWAP_LOGGER = '0xA7909100B456a03703D16eD06F6B4F25D0a87971';

async function main() {
    console.log('🊀 FEAWS TWAP Engine - Live Platform\n');
    console.log('═'.repeat(60));
    console.log('🎯 Enterprise Treasury Management Platform');
    console.log('📋 Advanced TWAP Strategy using 1inch Limit Order Protocol');
    console.log('═'.repeat(60));

    // Setup provider and wallets
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);

    console.log('\n📍 WALLET ADDRESSES:');
    console.log(`   Maker:  ${makerWallet.address}`);
    console.log(`   Taker:  ${takerWallet.address}`);

    console.log('\n🏗️  DEPLOYED CONTRACTS:');
    console.log(`   TwapLogger:     ${TWAP_LOGGER}`);
    console.log(`   1inch LOP:      ${LOP_CONTRACT}`);
    console.log(`   USDC (Native):  ${TOKENS.USDC}`);
    console.log(`   WMATIC:         ${TOKENS.WMATIC}`);

    // Check balances
    console.log('\n💰 CURRENT BALANCES:');
    
    const usdcContract = new ethers.Contract(
        TOKENS.USDC,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function allowance(address,address) view returns (uint256)'],
        provider
    );
    
    const wmaticContract = new ethers.Contract(
        TOKENS.WMATIC,
        ['function balanceOf(address) view returns (uint256)'],
        provider
    );

    const makerUsdc = await usdcContract.balanceOf(makerWallet.address);
    const makerWmatic = await wmaticContract.balanceOf(makerWallet.address);
    const makerMatic = await provider.getBalance(makerWallet.address);
    
    const takerUsdc = await usdcContract.balanceOf(takerWallet.address);
    const takerWmatic = await wmaticContract.balanceOf(takerWallet.address);
    const takerMatic = await provider.getBalance(takerWallet.address);

    const usdcDecimals = await usdcContract.decimals();
    
    console.log(`   Maker:`);
    console.log(`     USDC:   ${ethers.formatUnits(makerUsdc, usdcDecimals)} USDC`);
    console.log(`     WMATIC: ${ethers.formatEther(makerWmatic)} WMATIC`);
    console.log(`     MATIC:  ${ethers.formatEther(makerMatic)} MATIC`);
    
    console.log(`   Taker:`);
    console.log(`     USDC:   ${ethers.formatUnits(takerUsdc, usdcDecimals)} USDC`);
    console.log(`     WMATIC: ${ethers.formatEther(takerWmatic)} WMATIC`);
    console.log(`     MATIC:  ${ethers.formatEther(takerMatic)} MATIC`);

    // Check USDC allowance
    const allowance = await usdcContract.allowance(makerWallet.address, LOP_CONTRACT);
    const allowanceFormatted = ethers.formatUnits(allowance, usdcDecimals);
    
    console.log(`\n🔐 USDC ALLOWANCE:`);
    console.log(`   Maker → 1inch LOP: ${allowanceFormatted} USDC`);
    
    if (parseFloat(allowanceFormatted) < 2) {
        console.log(`   ⚠️  Need to approve USDC first!`);
        console.log(`   Run: npm run approve-usdc`);
        return;
    } else {
        console.log(`   ✅ Sufficient allowance for demo`);
    }

    // Load and display orders
    const ordersFile = path.join(__dirname, '../data/orders.json');
    if (!fs.existsSync(ordersFile)) {
        console.log(`\n❌ Orders not found. Run: npm run build-orders`);
        return;
    }

    const ordersData = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    
    console.log('\n📋 TWAP STRATEGY DETAILS:');
    console.log(`   Total Amount:    ${ordersData.totalUSDC} USDC`);
    console.log(`   Slice Count:     ${ordersData.sliceCount}`);
    console.log(`   Amount per Slice: ${ordersData.usdcPerSlice} USDC`);
    console.log(`   Time Interval:   ${ordersData.sliceInterval} seconds`);
    console.log(`   Generated At:    ${new Date(ordersData.generatedAt).toLocaleString()}`);

    // Show order schedule
    console.log('\n⏰ ORDER SCHEDULE:');
    const currentTime = Math.floor(Date.now() / 1000);
    
    ordersData.orders.forEach((order, index) => {
        const timeUntil = order.availableAt - currentTime;
        const status = timeUntil <= 0 ? '🟢 READY' : `⏳ ${Math.max(0, timeUntil)}s`;
        const time = new Date(order.availableAt * 1000).toLocaleTimeString();
        console.log(`   Slice ${index}: ${status} at ${time} (${order.makingAmount} USDC → ${order.takingAmount} WMATIC)`);
    });

    // Contract verification links
    console.log('\n🔍 VERIFICATION LINKS:');
    console.log(`   TwapLogger Contract: https://polygonscan.com/address/${TWAP_LOGGER}`);
    console.log(`   Maker Wallet:        https://polygonscan.com/address/${makerWallet.address}`);
    console.log(`   Taker Wallet:        https://polygonscan.com/address/${takerWallet.address}`);

    // Start live execution
    console.log('\n🎬 STARTING LIVE EXECUTION...');
    console.log('═'.repeat(60));
    
    // Count ready orders
    const readyOrders = ordersData.orders.filter(order => order.availableAt <= currentTime);
    console.log(`\n⚡ ${readyOrders.length} orders ready to fill immediately`);
    console.log(`📊 ${ordersData.orders.length - readyOrders.length} orders waiting for time unlock`);

    if (readyOrders.length === 0) {
        const nextOrder = ordersData.orders.find(order => order.availableAt > currentTime);
        if (nextOrder) {
            const waitTime = nextOrder.availableAt - currentTime;
            console.log(`⏰ Next order available in ${waitTime} seconds at ${new Date(nextOrder.availableAt * 1000).toLocaleTimeString()}`);
        }
    }

    console.log('\n🔄 Starting monitor and taker bot...');
    console.log('   Monitor will show real-time events');
    console.log('   Taker bot will fill orders when ready');
    console.log('   All transactions will be shown with Polygonscan links');
    console.log('\n   Press Ctrl+C to stop\n');

    // Start monitor in background
    const monitor = spawn('npm', ['run', 'monitor'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: process.cwd()
    });

    monitor.stdout.on('data', (data) => {
        process.stdout.write(`[MONITOR] ${data}`);
    });

    monitor.stderr.on('data', (data) => {
        process.stderr.write(`[MONITOR ERROR] ${data}`);
    });

    // Wait a moment for monitor to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start taker bot
    const taker = spawn('npm', ['run', 'taker-bot'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: process.cwd()
    });

    taker.stdout.on('data', (data) => {
        process.stdout.write(`[TAKER] ${data}`);
    });

    taker.stderr.on('data', (data) => {
        process.stderr.write(`[TAKER ERROR] ${data}`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Stopping demo...');
        monitor.kill();
        taker.kill();
        process.exit(0);
    });

    // Keep the demo running
    await new Promise(() => {}); // Run indefinitely until Ctrl+C
}

main().catch((error) => {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
});
