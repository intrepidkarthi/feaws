#!/usr/bin/env node

/**
 * Real-time event monitor for TWAP execution
 * 
 * Listens to:
 * - 1inch LOP OrderFilled events
 * - TwapLogger SliceFilled events
 * - Provides real-time progress updates
 * 
 * Usage: npm run monitor
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract addresses
const LOP_CONTRACT = '0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f';
const TWAP_LOGGER = '0xA7909100B456a03703D16eD06F6B4F25D0a87971';

// Contract ABIs
const LOP_ABI = [
    'event OrderFilled(address indexed maker, bytes32 orderHash, uint256 remaining)'
];

const LOGGER_ABI = [
    'event SliceFilled(uint256 indexed sliceIndex, address indexed maker, address indexed taker, uint256 makingAmount, uint256 takingAmount)'
];

async function main() {
    console.log('📡 Starting TWAP Monitor...\n');

    // Setup provider
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    
    // Create contract instances
    const lopContract = new ethers.Contract(LOP_CONTRACT, LOP_ABI, provider);
    const loggerContract = new ethers.Contract(TWAP_LOGGER, LOGGER_ABI, provider);

    // Load orders metadata
    const ordersFile = path.join(__dirname, '../data/orders.json');
    if (!fs.existsSync(ordersFile)) {
        throw new Error('Orders file not found. Run: npm run build-orders');
    }

    const ordersData = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    const makerAddress = ordersData.maker;
    
    console.log(`👁️  Monitoring TWAP execution for maker: ${makerAddress}`);
    console.log(`📊 Total slices: ${ordersData.sliceCount}`);
    console.log(`💰 Total amount: ${ordersData.totalUSDC} USDC\n`);

    // Track progress
    let filledSlices = 0;
    const sliceStatus = new Array(ordersData.sliceCount).fill(false);

    // Get current block for event polling
    let lastCheckedBlock = await provider.getBlockNumber();
    
    // Polling function to check for events
    async function checkForEvents() {
        try {
            const currentBlock = await provider.getBlockNumber();
            
            if (currentBlock > lastCheckedBlock) {
                // Check for SliceFilled events
                const sliceFilter = loggerContract.filters.SliceFilled(null, makerAddress);
                const sliceEvents = await loggerContract.queryFilter(sliceFilter, lastCheckedBlock + 1, currentBlock);
                
                for (const event of sliceEvents) {
                    const sliceIdx = Number(event.args.sliceIndex);
                    
                    if (!sliceStatus[sliceIdx]) {
                        sliceStatus[sliceIdx] = true;
                        filledSlices++;
                        
                        const usdcAmount = ethers.formatUnits(event.args.makingAmount, 6);
                        const wmaticAmount = ethers.formatEther(event.args.takingAmount);
                        
                        console.log(`🎯 Slice ${sliceIdx} filled!`);
                        console.log(`   📤 Sent: ${usdcAmount} USDC`);
                        console.log(`   📥 Received: ${wmaticAmount} WMATIC`);
                        console.log(`   👤 Taker: ${event.args.taker}`);
                        console.log(`   🔗 Tx: https://polygonscan.com/tx/${event.transactionHash}`);
                        
                        // Progress bar
                        const progress = Math.floor((filledSlices / ordersData.sliceCount) * 20);
                        const progressBar = '█'.repeat(progress) + '░'.repeat(20 - progress);
                        console.log(`   📊 Progress: [${progressBar}] ${filledSlices}/${ordersData.sliceCount} (${Math.floor(filledSlices/ordersData.sliceCount*100)}%)\n`);
                        
                        if (filledSlices === ordersData.sliceCount) {
                            console.log('🎉 TWAP execution complete! All slices filled.');
                        }
                    }
                }
                
                // Check for 1inch LOP OrderFilled events
                const lopFilter = lopContract.filters.OrderFilled(makerAddress);
                const lopEvents = await lopContract.queryFilter(lopFilter, lastCheckedBlock + 1, currentBlock);
                
                for (const event of lopEvents) {
                    console.log(`📋 1inch LOP OrderFilled detected:`);
                    console.log(`   🏷️  Order Hash: ${event.args.orderHash}`);
                    console.log(`   💰 Remaining: ${event.args.remaining}`);
                    console.log(`   🔗 Tx: https://polygonscan.com/tx/${event.transactionHash}\n`);
                }
                
                lastCheckedBlock = currentBlock;
            }
        } catch (error) {
            console.error('Error checking events:', error.message);
        }
    }

    // Show upcoming slices
    console.log('⏰ Upcoming slices:');
    const currentTime = Math.floor(Date.now() / 1000);
    
    ordersData.orders.forEach((order, index) => {
        const timeUntil = order.availableAt - currentTime;
        const status = timeUntil <= 0 ? '🟢 READY' : `⏳ ${Math.max(0, timeUntil)}s`;
        console.log(`   Slice ${index}: ${status} (${order.makingAmount} USDC → ${order.takingAmount} WMATIC)`);
    });

    console.log('\n🔄 Listening for events... (Ctrl+C to stop)\n');

    // Start event polling
    setInterval(checkForEvents, 10000); // Check every 10 seconds
    
    // Periodic status updates
    setInterval(() => {
        const currentTime = Math.floor(Date.now() / 1000);
        const readySlices = ordersData.orders.filter(order => 
            order.availableAt <= currentTime && !sliceStatus[order.sliceIndex]
        ).length;
        
        if (readySlices > 0 && filledSlices < ordersData.sliceCount) {
            console.log(`⚡ ${readySlices} slice(s) ready to fill, ${filledSlices}/${ordersData.sliceCount} completed`);
        }
    }, 30000); // Every 30 seconds

    // Keep the process running
    process.on('SIGINT', () => {
        console.log('\n📡 Monitor stopped');
        process.exit(0);
    });
}

main().catch((error) => {
    console.error('❌ Monitor failed:', error.message);
    process.exit(1);
});
