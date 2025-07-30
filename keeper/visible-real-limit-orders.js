const { Real1inchLimitOrders } = require('./real-1inch-limit-orders');
const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * CREATE VISIBLE REAL LIMIT ORDERS
 * 
 * Creates limit orders with attractive rates that are visible in 1inch UI
 * These orders are designed to be filled quickly for demonstration purposes
 */

async function createVisibleRealLimitOrder() {
    console.log('🎯 Creating Visible Real Limit Order');
    console.log('====================================');
    
    const orderSystem = new Real1inchLimitOrders();
    
    try {
        // Create an order with an attractive rate to ensure visibility
        // 1 USDC for 5 WMATIC (very attractive rate)
        console.log('Creating limit order with attractive rate...');
        
        const result = await orderSystem.createLimitOrder(
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
            1,      // 1 USDC
            5.0,    // 5.0 WMATIC (attractive rate)
            7200    // 2 hours
        );
        
        if (result.success) {
            console.log('\n✅ Limit Order Created Successfully!');
            console.log(`📋 Order Hash: ${result.orderHash}`);
            console.log(`🔗 Method: ${result.method}`);
            console.log(`🔗 View: https://app.1inch.io/#/137/limit-order/${result.orderHash}`);
            
            // Start monitoring the order
            console.log('\n🔍 Monitoring order status...');
            await monitorOrder(orderSystem, result.orderHash);
        } else {
            console.log('\n❌ Limit Order Creation Failed');
            console.log(`Error: ${result.error}`);
            if (result.txHash) {
                console.log(`Transaction: https://polygonscan.com/tx/${result.txHash}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error creating limit order:', error.message);
        process.exit(1);
    }
}

/**
 * Monitor order status
 */
async function monitorOrder(orderSystem, orderHash) {
    console.log(`\n📊 Monitoring order: ${orderHash}`);
    
    // Check status 5 times with 30 second intervals
    for (let i = 0; i < 5; i++) {
        try {
            const status = await orderSystem.getOrderStatus(orderHash);
            console.log(`\n📋 Order Status Check ${i + 1}/5:`);
            console.log(`   Remaining: ${status.remaining} (${status.filledPercentage}% filled)`);
            console.log(`   Status: ${status.status}`);
            
            if (status.filledPercentage > 0) {
                console.log('🎉 Order has been partially or fully filled!');
                break;
            }
            
            if (i < 4) { // Don't wait after the last check
                console.log('⏳ Waiting 30 seconds for next check...');
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
            
        } catch (error) {
            console.error(`❌ Error checking order status:`, error.message);
        }
    }
    
    console.log('\n🏁 Monitoring complete');
}

/**
 * Create multiple visible orders for demonstration
 */
async function createMultipleVisibleOrders() {
    console.log('🎯 Creating Multiple Visible Limit Orders');
    console.log('=========================================');
    
    const orderSystem = new Real1inchLimitOrders();
    
    // Create 3 orders with different attractive rates
    const orders = [
        { fromAmount: 1, toAmount: 5.0, duration: 3600 },   // 1 USDC → 5 WMATIC
        { fromAmount: 2, toAmount: 9.5, duration: 3600 },   // 2 USDC → 9.5 WMATIC
        { fromAmount: 5, toAmount: 22.0, duration: 7200 }   // 5 USDC → 22 WMATIC
    ];
    
    const results = [];
    
    for (let i = 0; i < orders.length; i++) {
        console.log(`\n📝 Creating order ${i + 1}/${orders.length}...`);
        
        try {
            const result = await orderSystem.createLimitOrder(
                '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC
                '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
                orders[i].fromAmount,
                orders[i].toAmount,
                orders[i].duration
            );
            
            results.push({
                index: i + 1,
                success: result.success,
                orderHash: result.orderHash,
                viewUrl: result.viewUrl,
                error: result.error
            });
            
            if (result.success) {
                console.log(`✅ Order ${i + 1} created successfully`);
                console.log(`   Hash: ${result.orderHash}`);
                console.log(`   View: ${result.viewUrl}`);
            } else {
                console.log(`❌ Order ${i + 1} failed: ${result.error}`);
            }
            
        } catch (error) {
            console.error(`❌ Error creating order ${i + 1}:`, error.message);
            results.push({
                index: i + 1,
                success: false,
                error: error.message
            });
        }
        
        // Small delay between orders
        if (i < orders.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('============');
    
    const successful = results.filter(r => r.success).length;
    console.log(`Successful: ${successful}/${orders.length}`);
    
    for (const result of results) {
        if (result.success) {
            console.log(`✅ Order ${result.index}: ${result.orderHash.substring(0, 10)}...`);
        } else {
            console.log(`❌ Order ${result.index}: Failed`);
        }
    }
}

module.exports = { createVisibleRealLimitOrder, createMultipleVisibleOrders };
