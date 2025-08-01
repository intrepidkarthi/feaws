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

// 1inch LOP contract address on Polygon
const LOP_CONTRACT = '0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f';

// 1inch LOP ABI (minimal interface for fillOrder)
const LOP_ABI = [
    'function fillOrder((uint256,address,address,address,address,uint256,uint256,bytes,bytes,bytes) order, bytes signature, bytes interaction, uint256 makingAmount, uint256 takingAmount, uint256 skipPermitAndThresholdAmount) external payable returns (uint256, uint256, bytes32)',
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
            console.log(`⚡ Filling slice ${order.sliceIndex} (${order.makingAmount} USDC → ${order.takingAmount} WMATIC)`);

            try {
                // Build the order struct for 1inch LOP
                const lopOrder = [
                    order.order.salt,
                    order.order.maker,
                    order.order.receiver,
                    order.order.makerAsset,
                    order.order.takerAsset,
                    order.order.makingAmount,
                    order.order.takingAmount,
                    order.order.predicate,
                    order.order.permit,
                    order.order.interaction
                ];

                // Generate proper EIP-712 signature for the order
                const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
                
                // 1inch LOP domain
                const domain = {
                    name: 'Limit Order Protocol',
                    version: '4',
                    chainId: 137,
                    verifyingContract: '0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f'
                };
                
                // Order type for EIP-712
                const types = {
                    Order: [
                        { name: 'salt', type: 'uint256' },
                        { name: 'maker', type: 'address' },
                        { name: 'receiver', type: 'address' },
                        { name: 'makerAsset', type: 'address' },
                        { name: 'takerAsset', type: 'address' },
                        { name: 'makingAmount', type: 'uint256' },
                        { name: 'takingAmount', type: 'uint256' },
                        { name: 'predicate', type: 'bytes' },
                        { name: 'permit', type: 'bytes' },
                        { name: 'interaction', type: 'bytes' }
                    ]
                };
                
                // Sign the order
                const signature = await makerWallet.signTypedData(domain, types, {
                    salt: order.order.salt,
                    maker: order.order.maker,
                    receiver: order.order.receiver,
                    makerAsset: order.order.makerAsset,
                    takerAsset: order.order.takerAsset,
                    makingAmount: order.order.makingAmount,
                    takingAmount: order.order.takingAmount,
                    predicate: order.order.predicate,
                    permit: order.order.permit,
                    interaction: order.order.interaction
                });
                
                // Call fillOrder on 1inch LOP
                const tx = await lopContract.fillOrder(
                    lopOrder,
                    signature,
                    order.order.interaction,
                    order.order.makingAmount,
                    order.order.takingAmount,
                    0, // skipPermitAndThresholdAmount
                    {
                        gasLimit: 300000,
                        gasPrice: ethers.parseUnits('30', 'gwei')
                    }
                );

                console.log(`📤 Transaction sent: ${tx.hash}`);
                
                // Wait for confirmation
                const receipt = await tx.wait();
                
                if (receipt.status === 1) {
                    console.log(`✅ Slice ${order.sliceIndex} filled successfully!`);
                    console.log(`🔍 Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
                    
                    // Mark as filled
                    order.filled = true;
                    order.txHash = tx.hash;
                    order.gasUsed = receipt.gasUsed.toString();
                    fillCount++;

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
