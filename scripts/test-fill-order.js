#!/usr/bin/env node

/**
 * Test filling a single order
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// 1inch LOP contract address on Polygon
const LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';

// 1inch LOP ABI (minimal interface for fillOrder)
const LOP_ABI = [
    'function fillOrder(tuple(uint256,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes,bytes), bytes, uint256, uint256, uint256) returns (uint256, uint256)',
];

async function main() {
    console.log('Testing order fill...');
    
    // Validate environment
    if (!process.env.TAKER_PRIVATE_KEY) {
        throw new Error('TAKER_PRIVATE_KEY not found in .env');
    }
    
    if (!process.env.POLYGON_RPC_URL) {
        throw new Error('POLYGON_RPC_URL not found in .env');
    }
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    // Create contract instance
    const lopContract = new ethers.Contract(LOP_CONTRACT, LOP_ABI, wallet);
    
    // Load orders
    const ordersPath = path.join(__dirname, '../data/orders.json');
    const ordersData = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    
    if (ordersData.orders.length === 0) {
        throw new Error('No orders found');
    }
    
    const order = ordersData.orders[0];
    console.log(`Testing order ${order.sliceIndex}`);
    console.log(`Making amount: ${order.order.makingAmount}`);
    console.log(`Taking amount: ${order.order.takingAmount}`);
    
    // Build the order struct for 1inch LOP
    const lopOrder = [
        order.order.salt,
        order.order.makerAsset,
        order.order.takerAsset,
        order.order.maker,
        order.order.receiver,
        order.order.allowedSender,
        order.order.makingAmount,
        order.order.takingAmount,
        order.order.makerAssetData,
        order.order.takerAssetData,
        order.order.getMakerAmount,
        order.order.getTakerAmount,
        order.order.predicate,
        order.order.permit,
        order.order.interaction
    ];
    
    // Use the existing signature from the order file
    const signature = order.signature;
    
    console.log('Order struct:');
    console.log(JSON.stringify(lopOrder, null, 2));
    console.log('Signature:');
    console.log(signature);
    
    try {
        // Estimate gas
        console.log('Estimating gas...');
        const gasEstimate = await lopContract.fillOrder.estimateGas(
            lopOrder,
            signature,
            order.order.makingAmount,
            order.order.takingAmount,
            0, // flags
            {
                gasLimit: 500000,
                gasPrice: ethers.parseUnits('35', 'gwei')
            }
        );
        
        console.log(`Gas estimate: ${gasEstimate.toString()}`);
        
        // Call fillOrder on 1inch LOP
        console.log('Sending transaction...');
        const tx = await lopContract.fillOrder(
            lopOrder,
            signature,
            order.order.makingAmount,
            order.order.takingAmount,
            0, // flags
            {
                gasLimit: 500000,
                gasPrice: ethers.parseUnits('35', 'gwei')
            }
        );
        
        console.log(`Transaction sent: ${tx.hash}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log('✅ Order filled successfully!');
            console.log(`🔍 Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
        } else {
            console.log('❌ Order fill failed');
        }
    } catch (error) {
        console.error('❌ Error filling order:', error.message);
        console.error('Error data:', error.data);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
