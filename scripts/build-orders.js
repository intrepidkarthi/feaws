#!/usr/bin/env node

/**
 * Build TWAP Orders for 1inch Limit Order Protocol
 * 
 * This script creates TWAP orders and saves them to data/orders.json
 * for use with the taker-bot and monitor scripts.
 * 
 * Usage: npm run build-orders
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract addresses
const TOKENS = {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
};
const LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
const TWAP_LOGGER = '0xA7909100B456a03703D16eD06F6B4F25D0a87971';

class TWAPBuilder {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        // EIP-712 Domain for 1inch LOP
        this.domain = {
            name: '1inch Limit Order Protocol',
            version: '4',
            chainId: 137,
            verifyingContract: LOP_CONTRACT
        };
        
        // EIP-712 Types for Order
        this.types = {
            Order: [
                { name: 'salt', type: 'uint256' },
                { name: 'makerAsset', type: 'address' },
                { name: 'takerAsset', type: 'address' },
                { name: 'maker', type: 'address' },
                { name: 'receiver', type: 'address' },
                { name: 'allowedSender', type: 'address' },
                { name: 'makingAmount', type: 'uint256' },
                { name: 'takingAmount', type: 'uint256' },
                { name: 'makerAssetData', type: 'bytes' },
                { name: 'takerAssetData', type: 'bytes' },
                { name: 'getMakerAmount', type: 'bytes' },
                { name: 'getTakerAmount', type: 'bytes' },
                { name: 'predicate', type: 'bytes' },
                { name: 'permit', type: 'bytes' },
                { name: 'interaction', type: 'bytes' }
            ]
        };
        
        console.log('🚀 TWAP Order Builder Initialized');
        console.log(` Maker Wallet: ${this.wallet.address}`);
        console.log(` Network: Polygon Mainnet (137)`);
        console.log('');
    }
    
    async buildOrders(totalAmount, slices, intervalSeconds) {
        console.log('📋 BUILDING TWAP ORDERS');
        console.log(` Total Amount: ${ethers.formatUnits(totalAmount, 6)} USDC`);
        console.log(` Slices: ${slices}`);
        console.log(` Interval: ${intervalSeconds} seconds`);
        console.log('');
        
        const sliceAmount = totalAmount / BigInt(slices);
        const decimals = 6; // USDC decimals
        
        // Create individual orders with time-based scheduling
        const orders = [];
        const baseTime = Math.floor(Date.now() / 1000) + 120; // Start 2 minutes from now
        
        for (let i = 0; i < slices; i++) {
            const executeTime = baseTime + (i * intervalSeconds);
            
            // Create order with proper structure
            const order = {
                salt: ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32))).toString(),
                makerAsset: TOKENS.USDC,
                takerAsset: TOKENS.WMATIC,
                maker: this.wallet.address,
                receiver: this.wallet.address,
                allowedSender: ethers.ZeroAddress,
                makingAmount: sliceAmount.toString(),
                takingAmount: this.calculateTakingAmount(sliceAmount).toString(),
                makerAssetData: '0x',
                takerAssetData: '0x',
                getMakerAmount: '0x',
                getTakerAmount: '0x',
                predicate: this.buildTimePredicate(executeTime),
                permit: '0x',
                interaction: this.buildInteractionData(i, sliceAmount)
            };
            
            // Sign the order
            const signature = await this.signOrder(order);
            
            orders.push({
                sliceIndex: i,
                availableAt: executeTime,
                availableAtISO: new Date(executeTime * 1000).toISOString(),
                order: order,
                signature: signature,
                makingAmount: ethers.formatUnits(sliceAmount, 6),
                takingAmount: ethers.formatUnits(this.calculateTakingAmount(sliceAmount), 18)
            });
            
            console.log(`📝 Order ${i + 1}/${slices} created:`);
            console.log(`   Available at: ${new Date(executeTime * 1000).toISOString()}`);
            console.log('');
        }
        
        // Save orders to data/orders.json
        const ordersData = {
            totalUSDC: ethers.formatUnits(totalAmount, decimals),
            sliceCount: slices,
            usdcPerSlice: ethers.formatUnits(sliceAmount, decimals),
            sliceInterval: intervalSeconds,
            startTime: baseTime,
            makerAddress: this.wallet.address,
            takerAddress: process.env.TAKER_WALLET_ADDRESS || "0xD9E3dDdBaB1C375DF0D669737d70F8292802AB65",
            twapLoggerAddress: TWAP_LOGGER,
            generatedAt: Date.now(),
            orders: orders
        };
        
        const ordersFile = path.join(__dirname, '../data/orders.json');
        fs.mkdirSync(path.dirname(ordersFile), { recursive: true });
        fs.writeFileSync(ordersFile, JSON.stringify(ordersData, null, 2));
        
        console.log(`✅ ${slices} TWAP orders saved to: ${ordersFile}`);
        console.log('');
        
        return ordersData;
    }
    
    calculateTakingAmount(makingAmount) {
        // Convert USDC to WMATIC
        // Using a rate of 0.5 WMATIC per USDC
        // makingAmount is in USDC with 6 decimals (1000000 for 1 USDC)
        // takingAmount should be in WMATIC with 18 decimals
        const rate = ethers.parseEther('0.5'); // 0.5 WMATIC per USDC
        return (makingAmount * rate) / ethers.parseUnits('1', 6);
    }
    
    buildTimePredicate(executeTime) {
        // Build a time-based predicate using timestamp
        // This creates a predicate that allows execution only after the specified timestamp
        // Format: 0x000000000000000000000000000000000000000000000000[8-byte timestamp in hex]
        const timestampHex = executeTime.toString(16).padStart(8, '0');
        const predicate = '0x' + '0'.repeat(56) + timestampHex;
        return predicate;
    }
    
    buildInteractionData(sliceIndex, sliceAmount) {
        // Build simple interaction data
        return '0x';
    }
    
    async signOrder(order) {
        // Sign the order using EIP-712
        const signature = await this.wallet.signTypedData(this.domain, this.types, order);
        return signature;
    }
}

async function main() {
    const builder = new TWAPBuilder();
    
    // Build TWAP orders: 1 USDC, 5 slices, 60 second intervals
    const ordersData = await builder.buildOrders(
        ethers.parseUnits('1', 6), // 1 USDC total
        5,                        // 5 slices
        60                       // 60 second intervals
    );
    
    console.log('🎉 TWAP Orders Generated Successfully!');
    console.log('');
    console.log('📋 Order Summary:');
    console.log(`   Total Amount: ${ordersData.totalUSDC} USDC`);
    console.log(`   Slice Count: ${ordersData.sliceCount}`);
    console.log(`   Amount per Slice: ${ordersData.usdcPerSlice} USDC`);
    console.log(`   Time Interval: ${ordersData.sliceInterval} seconds`);
    console.log(`   Generated At: ${new Date(ordersData.generatedAt).toLocaleString()}`);
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('   1. Run: npm run approve-usdc');
    console.log('   2. Run: npm run live-demo');
}

main().catch(console.error);
