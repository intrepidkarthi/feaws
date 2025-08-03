#!/usr/bin/env node

/**
 * FEAWS 1inch TWAP Limit Order Protocol Demo
 * This script demonstrates a working limit order fill on Polygon mainnet
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

// Contract addresses
const LIMIT_ORDER_PROTOCOL = '0x111111125421cA6dc452d289314280a0f8842A65';
const USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const WMATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

async function main() {
    console.log('🚀 FEAWS 1inch TWAP Limit Order Protocol Demo');
    console.log('===============================================');
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    console.log(`💼 Taker Wallet: ${wallet.address}`);
    
    // Check taker's WMATIC balance
    const wmaticContract = new ethers.Contract(
        WMATIC,
        ['function balanceOf(address) view returns (uint256)'],
        provider
    );
    
    try {
        const balance = await wmaticContract.balanceOf(wallet.address);
        console.log(`💰 Taker WMATIC Balance: ${ethers.formatEther(balance)} WMATIC`);
    } catch (error) {
        console.error('❌ Error checking WMATIC balance:', error.message);
    }
    
    // Load orders
    console.log('\n📋 Loading TWAP Orders...');
    const ordersData = JSON.parse(fs.readFileSync('./data/orders.json', 'utf8'));
    const orderData = ordersData.orders[0]; // First order
    
    console.log(`📝 Order Details:`);
    console.log(`   Slice: ${orderData.sliceIndex + 1}/${ordersData.sliceCount}`);
    console.log(`   Available at: ${orderData.availableAtISO}`);
    console.log(`   Making Amount: ${orderData.makingAmount} USDC`);
    console.log(`   Taking Amount: ${orderData.takingAmount} WMATIC`);
    
    // Create contract instance
    const abi = [
        'function fillOrder(tuple(uint256,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes,bytes), bytes, bytes) public payable returns(uint256, uint256)'
    ];
    const contract = new ethers.Contract(LIMIT_ORDER_PROTOCOL, abi, wallet);
    
    // Prepare order struct
    const order = [
        orderData.order.salt,
        orderData.order.makerAsset,
        orderData.order.takerAsset,
        orderData.order.maker,
        orderData.order.receiver,
        orderData.order.allowedSender,
        orderData.order.makingAmount,
        orderData.order.takingAmount,
        orderData.order.makerAssetData,
        orderData.order.takerAssetData,
        orderData.order.getMakerAmount,
        orderData.order.getTakerAmount,
        orderData.order.predicate,
        orderData.order.permit,
        orderData.order.interaction
    ];
    
    console.log('\n⚡ Attempting to Fill Order...');
    
    try {
        // Estimate gas with a reasonable default if estimation fails
        let gasLimit;
        try {
            console.log('   Estimating gas...');
            const gasEstimate = await contract.fillOrder.estimateGas(order, orderData.signature, '0x');
            gasLimit = gasEstimate * 150n / 100n; // Add 50% buffer
            console.log(`   Gas estimate: ${gasEstimate.toString()}`);
        } catch (error) {
            console.log('   Gas estimation failed, using default gas limit');
            gasLimit = 500000n;
        }
        
        // Fill order with fixed gas limit
        console.log('   Sending transaction...');
        const tx = await contract.fillOrder(order, orderData.signature, '0x', {
            gasLimit: gasLimit
        });
        
        console.log(`\n✅ Transaction Sent!`);
        console.log(`   Hash: ${tx.hash}`);
        console.log(`   🔍 Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
        
        console.log('\n⏳ Waiting for confirmation...');
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log('\n🎉 ORDER SUCCESSFULLY FILLED!');
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
            console.log(`   🔍 Polygonscan: https://polygonscan.com/tx/${receipt.hash}`);
        } else {
            console.log('\n❌ TRANSACTION FAILED');
        }
        
    } catch (error) {
        console.log('\n❌ Error filling order:');
        console.log(`   Message: ${error.message}`);
        
        // Try to provide more specific error information
        if (error.reason) {
            console.log(`   Reason: ${error.reason}`);
        }
        
        if (error.code) {
            console.log(`   Code: ${error.code}`);
        }
        
        console.log('\n📋 DEBUG INFO:');
        console.log(`   Order Hash: ${ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(uint256,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes,bytes)'],
            [order]
        ))}`);
        console.log(`   Current Time: ${new Date().toISOString()}`);
        console.log(`   Order Available At: ${orderData.availableAtISO}`);
    }
}

main().catch(console.error);
