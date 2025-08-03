#!/usr/bin/env node

/**
 * Autonomous taker bot for TWAP limit orders
 * 
 * Monitors generated orders and fills them when time predicates are satisfied
 * Calls 1inch LOP fillOrder() directly on Polygon mainnet
 * 
 * Usage: npm run taker-bot
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Track processed orders to prevent duplicate fills
const PROCESSED_ORDERS_FILE = path.join(__dirname, '../data/processed-orders.json');
let processedOrders = new Set();

// Load processed orders from file
function loadProcessedOrders() {
    try {
        if (fs.existsSync(PROCESSED_ORDERS_FILE)) {
            const data = fs.readFileSync(PROCESSED_ORDERS_FILE, 'utf8');
            const orders = JSON.parse(data);
            processedOrders = new Set(orders);
        }
    } catch (error) {
        console.warn('Warning: Could not load processed orders:', error.message);
    }
}

// Save processed orders to file
function saveProcessedOrders() {
    try {
        fs.writeFileSync(PROCESSED_ORDERS_FILE, JSON.stringify([...processedOrders], null, 2));
    } catch (error) {
        console.warn('Warning: Could not save processed orders:', error.message);
    }
}

// Mark an order as processed
function markOrderAsProcessed(order) {
    const orderId = `${order.sliceIndex}-${order.availableAt}`;
    processedOrders.add(orderId);
    saveProcessedOrders();
}

// Check if an order has been processed
function isOrderProcessed(order) {
    const orderId = `${order.sliceIndex}-${order.availableAt}`;
    return processedOrders.has(orderId);
}

// Initialize processed orders
loadProcessedOrders();

// 1inch LOP contract address on Polygon
const LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';

// 1inch LOP ABI (minimal interface for fillOrder)
const LOP_ABI = [
    'function fillOrder((uint256,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes,bytes) order, bytes signature, uint256 makingAmount, uint256 takingAmount, uint256 flags) external payable returns (uint256, uint256, bytes32)',
    'event OrderFilled(address indexed maker, bytes32 orderHash, uint256 remaining)'
];

async function main() {
    console.log('🤖 Starting TWAP Taker Bot...\n');

    // Validate environment
    if (!process.env.TAKER_PRIVATE_KEY) {
        throw new Error('TAKER_PRIVATE_KEY not found in .env');
    }

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    const lopContract = new ethers.Contract(LOP_CONTRACT, LOP_ABI, takerWallet);

    console.log(`🤖 Taker Bot: ${takerWallet.address}`);
    
    // Check taker balance
    const balance = await provider.getBalance(takerWallet.address);
    console.log(`💰 MATIC Balance: ${ethers.formatEther(balance)} MATIC`);
    
    if (balance < ethers.parseEther('0.01')) {
        throw new Error('Insufficient MATIC for gas (need at least 0.01 MATIC)');
    }

    // Load orders
    const ordersFile = path.join(__dirname, '../data/orders.json');
    if (!fs.existsSync(ordersFile)) {
        throw new Error('Orders file not found. Run: npm run build-orders');
    }

    const ordersData = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    console.log(`📋 Loaded ${ordersData.orders.length} TWAP orders`);
    console.log(`💱 Strategy: ${ordersData.totalUSDC} USDC → WMATIC in ${ordersData.sliceCount} slices\n`);

    // Track filled orders
    const fillsFile = path.join(__dirname, '../data/fills.csv');
    if (!fs.existsSync(fillsFile)) {
        fs.writeFileSync(fillsFile, 'sliceIndex,timestamp,txHash,gasUsed,status\n');
    }

    // Main bot loop
    console.log('🔄 Monitoring orders... (Ctrl+C to stop)\n');
    
    let fillCount = 0;
    const startTime = Date.now();

    while (fillCount < ordersData.orders.length) {
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Find next available order
        const availableOrders = ordersData.orders.filter(order => 
            order.availableAt <= currentTime && !order.filled
        );

        if (availableOrders.length > 0) {
            const order = availableOrders[0];
            
            // Check if order has already been processed
            if (isOrderProcessed(order)) {
                console.log(`⏭️  Skipping already processed slice ${order.sliceIndex}`);
                continue;
            }
            
            console.log(`⚡ Filling slice ${order.sliceIndex} (${ethers.formatUnits(order.order.makingAmount, 6)} USDC → ${ethers.formatEther(order.order.takingAmount)} WMATIC)`);

            try {
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
                
                // Call fillOrder on 1inch LOP
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

                console.log(`📤 Transaction sent: ${tx.hash}`);
                
                // Wait for confirmation
                const receipt = await tx.wait();
                
                if (receipt.status === 1) {
                    console.log(`✅ Slice ${order.sliceIndex} filled successfully!`);
                    console.log(`🔍 Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
                    
                    // Mark order as processed
                    markOrderAsProcessed(order);
                    
                    // Log to CSV
                    const csvLine = `${order.sliceIndex},${new Date().toISOString()},${tx.hash},${receipt.gasUsed},success\n`;
                    fs.appendFileSync(fillsFile, csvLine);

                    console.log(`📊 Progress: ${fillCount}/${ordersData.orders.length} slices filled\n`);
                } else {
                    console.log(`❌ Transaction failed for slice ${order.sliceIndex}`);
                }

            } catch (error) {
                console.error(`❌ Error filling slice ${order.sliceIndex}:`, error.message);
                
                // Log error to CSV
                const csvLine = `${order.sliceIndex},${new Date().toISOString()},,0,error: ${error.message}\n`;
                fs.appendFileSync(fillsFile, csvLine);
            }
        }

        // Wait 10 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Show periodic status
        if (Math.floor(Date.now() / 1000) % 60 === 0) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            console.log(`⏰ Status: ${fillCount}/${ordersData.orders.length} filled, ${elapsed}s elapsed`);
        }
    }

    console.log('\n🎉 All TWAP slices completed!');
    console.log(`📊 Final stats: ${fillCount} orders filled`);
    console.log(`📄 Fill log: ${fillsFile}`);
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Bot stopped by user');
    process.exit(0);
});

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Taker bot failed:', error.message);
        process.exit(1);
    });
