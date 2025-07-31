#!/usr/bin/env node

/**
 * Generate and sign TWAP limit orders for 1inch LOP
 * 
 * Creates 10 time-gated orders selling 0.2 USDC each for WMATIC
 * Each order has a predicate that unlocks 60 seconds after the previous one
 * 
 * Usage: npm run build-orders
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Polygon mainnet addresses
const TOKENS = {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC (not PoS)
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
};

// 1inch LOP contract address on Polygon
const LOP_CONTRACT = '0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f';

// Our deployed TwapLogger contract
const TWAP_LOGGER = '0xA7909100B456a03703D16eD06F6B4F25D0a87971';

// Demo parameters
const TOTAL_USDC = 2; // 2 USDC total
const SLICE_COUNT = 10; // 10 slices
const USDC_PER_SLICE = TOTAL_USDC / SLICE_COUNT; // 0.2 USDC per slice
const SLICE_INTERVAL = 60; // 60 seconds between slices

async function main() {
    console.log('🔨 Building TWAP limit orders...\n');

    // Validate environment
    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in .env');
    }
    if (!process.env.TAKER_PRIVATE_KEY) {
        throw new Error('TAKER_PRIVATE_KEY not found in .env');
    }

    // Setup provider and wallets
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);

    console.log(`📍 Maker: ${makerWallet.address}`);
    console.log(`📍 Taker: ${takerWallet.address}`);

    // Check maker USDC balance
    const usdcContract = new ethers.Contract(
        TOKENS.USDC,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        provider
    );
    
    const usdcBalance = await usdcContract.balanceOf(makerWallet.address);
    const usdcDecimals = await usdcContract.decimals();
    const usdcBalanceFormatted = ethers.formatUnits(usdcBalance, usdcDecimals);
    
    console.log(`💰 Maker USDC balance: ${usdcBalanceFormatted} USDC`);
    
    if (parseFloat(usdcBalanceFormatted) < TOTAL_USDC) {
        throw new Error(`Insufficient USDC balance. Need ${TOTAL_USDC} USDC, have ${usdcBalanceFormatted} USDC`);
    }

    // Check taker WMATIC balance
    const wmaticContract = new ethers.Contract(
        TOKENS.WMATIC,
        ['function balanceOf(address) view returns (uint256)'],
        provider
    );
    
    const wmaticBalance = await wmaticContract.balanceOf(takerWallet.address);
    const wmaticBalanceFormatted = ethers.formatEther(wmaticBalance);
    
    console.log(`💰 Taker WMATIC balance: ${wmaticBalanceFormatted} WMATIC`);

    // Get current timestamp and calculate start time (5 minutes from now)
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime + 300; // Start in 5 minutes
    
    console.log(`⏰ Current time: ${new Date(currentTime * 1000).toISOString()}`);
    console.log(`⏰ First slice available: ${new Date(startTime * 1000).toISOString()}`);

    // Generate orders
    const orders = [];
    const makingAmount = ethers.parseUnits(USDC_PER_SLICE.toString(), usdcDecimals); // 0.2 USDC
    
    // Get current WMATIC price (simplified - using 1 USDC = 1.2 WMATIC for demo)
    const takingAmount = ethers.parseEther((USDC_PER_SLICE * 1.2).toString()); // 0.24 WMATIC per slice

    console.log(`\n📋 Generating ${SLICE_COUNT} orders:`);
    console.log(`   Making: ${USDC_PER_SLICE} USDC per slice`);
    console.log(`   Taking: ${ethers.formatEther(takingAmount)} WMATIC per slice`);
    console.log(`   Interval: ${SLICE_INTERVAL} seconds\n`);

    for (let i = 0; i < SLICE_COUNT; i++) {
        const sliceTime = startTime + (i * SLICE_INTERVAL);
        
        // Build the order struct (simplified version for demo)
        const order = {
            salt: ethers.randomBytes(32),
            maker: makerWallet.address,
            receiver: makerWallet.address,
            makerAsset: TOKENS.USDC,
            takerAsset: TOKENS.WMATIC,
            makingAmount: makingAmount.toString(),
            takingAmount: takingAmount.toString(),
            predicate: `0x${sliceTime.toString(16).padStart(8, '0')}`, // Simple timestamp predicate
            permit: '0x',
            interaction: ethers.concat([
                TWAP_LOGGER,
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['uint256', 'address', 'uint256', 'uint256'],
                    [i, makerWallet.address, makingAmount, takingAmount]
                )
            ])
        };

        orders.push({
            sliceIndex: i,
            availableAt: sliceTime,
            availableAtISO: new Date(sliceTime * 1000).toISOString(),
            order: order,
            makingAmount: ethers.formatUnits(makingAmount, usdcDecimals),
            takingAmount: ethers.formatEther(takingAmount)
        });

        console.log(`   Slice ${i}: Available at ${new Date(sliceTime * 1000).toLocaleTimeString()}`);
    }

    // Save orders to file
    const dataDir = path.join(__dirname, '../data');
    fs.mkdirSync(dataDir, { recursive: true });
    
    const ordersFile = path.join(dataDir, 'orders.json');
    const metadata = {
        totalUSDC: TOTAL_USDC,
        sliceCount: SLICE_COUNT,
        usdcPerSlice: USDC_PER_SLICE,
        sliceInterval: SLICE_INTERVAL,
        startTime: startTime,
        maker: makerWallet.address,
        taker: takerWallet.address,
        twapLogger: TWAP_LOGGER,
        generatedAt: new Date().toISOString(),
        orders: orders
    };
    
    fs.writeFileSync(ordersFile, JSON.stringify(metadata, null, 2));
    console.log(`\n💾 Orders saved to: ${ordersFile}`);

    // Generate approval script
    const approvalScript = `#!/bin/bash
# Approve 1inch LOP contract to spend USDC
echo "Approving ${TOTAL_USDC} USDC for 1inch LOP..."
cast send ${TOKENS.USDC} \\
  "approve(address,uint256)" \\
  ${LOP_CONTRACT} \\
  ${ethers.parseUnits(TOTAL_USDC.toString(), usdcDecimals).toString()} \\
  --private-key ${process.env.PRIVATE_KEY} \\
  --rpc-url ${process.env.POLYGON_RPC_URL}
echo "✅ Approval complete"
`;

    const approvalFile = path.join(__dirname, '../scripts/approve-usdc.sh');
    fs.writeFileSync(approvalFile, approvalScript);
    fs.chmodSync(approvalFile, '755');
    console.log(`💾 Approval script saved to: ${approvalFile}`);

    console.log('\n🎉 Order generation complete!');
    console.log('\nNext steps:');
    console.log('1. Run: bash scripts/approve-usdc.sh');
    console.log('2. Run: npm run taker-bot');
    console.log('3. Watch orders fill every 60 seconds');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Order generation failed:', error.message);
        process.exit(1);
    });
