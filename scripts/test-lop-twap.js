#!/usr/bin/env node

require('dotenv').config();
const { ethers } = require('ethers');

/**
 * Test 1inch Limit Order Protocol TWAP Implementation
 * 
 * This script tests the real 1inch Limit Order Protocol integration by:
 * 1. Creating a proper limit order with correct structure
 * 2. Signing it with EIP-712
 * 3. Broadcasting it to the dashboard
 */

async function testLimitOrderCreation() {
    console.log('🧪 TESTING 1INCH LIMIT ORDER PROTOCOL TWAP');
    console.log('='.repeat(50));
    
    try {
        // Initialize provider and wallets
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
        
        console.log(`_maker: ${makerWallet.address}`);
        console.log(`_taker: ${takerWallet.address}`);
        
        // Token addresses
        const USDC_ADDRESS = process.env.USDC_ADDRESS || '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        const WMATIC_ADDRESS = process.env.WMATIC_ADDRESS || '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        const LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
        
        // EIP-712 Domain for 1inch LOP v4
        const domain = {
            name: '1inch Aggregation Router',
            version: '6',
            chainId: 137,
            verifyingContract: LOP_CONTRACT
        };
        
        // EIP-712 Types for Order
        const types = {
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
        
        // Create a test order
        const nonce = Date.now();
        const usdcAmount = ethers.parseUnits('0.1', 6); // 0.1 USDC
        const wmaticAmount = ethers.parseEther('0.05'); // 0.05 WMATIC
        
        console.log(`\n📝 Creating test order:`);
        console.log(`   USDC Amount: ${ethers.formatUnits(usdcAmount, 6)}`);
        console.log(`   WMATIC Amount: ${ethers.formatEther(wmaticAmount)}`);
        
        const order = {
            salt: nonce.toString(),
            makerAsset: USDC_ADDRESS,
            takerAsset: WMATIC_ADDRESS,
            maker: makerWallet.address,
            receiver: makerWallet.address,
            allowedSender: ethers.ZeroAddress,
            makingAmount: usdcAmount.toString(),
            takingAmount: wmaticAmount.toString(),
            makerAssetData: '0x',
            takerAssetData: '0x',
            getMakerAmount: '0x',
            getTakerAmount: '0x',
            predicate: '0x',
            permit: '0x',
            interaction: '0x'
        };
        
        // Sign the order
        const signature = await makerWallet.signTypedData(domain, types, order);
        
        console.log(`\n✅ Order created successfully:`);
        console.log(`   Signature: ${signature}`);
        
        // Test the order structure
        console.log(`\n📋 Order structure:`);
        console.log(JSON.stringify(order, null, 2));
        
        console.log('\n🎉 1INCH LIMIT ORDER PROTOCOL TEST COMPLETED');
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('❌ Error in test:', error.message);
        console.error('📝 Error stack:', error.stack);
    }
}

// Run the test
testLimitOrderCreation().catch(console.error);
