const { Real1inchLimitOrders } = require('./real-1inch-limit-orders.js');
require('dotenv').config();

async function createFillableOrder() {
    console.log('🎯 Creating FILLABLE 1inch Limit Order');
    console.log('=====================================');
    console.log('Strategy: Create order 5% better than market rate for taker');
    console.log('This should be attractive for arbitrageurs to fill quickly\n');
    
    const orderSystem = new Real1inchLimitOrders();
    
    try {
        // Use a fixed attractive rate to avoid precision issues
        // Based on previous market data, 1 USDC ≈ 4.6 WMATIC
        // Let's offer 5.0 WMATIC for 1 USDC (≈ 8.7% above market)
        const marketRate = 4.6;
        const attractiveRate = 5.0;
        
        console.log(`📊 Estimated market rate: 1 USDC = ${marketRate} WMATIC`);
        console.log(`📈 Attractive rate: 1 USDC = ${attractiveRate} WMATIC`);
        console.log(`🎁 Arbitrage opportunity: ${((attractiveRate/marketRate - 1) * 100).toFixed(1)}% profit for taker`);
        
        const result = await orderSystem.createLimitOrder(
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
            1,          // Making 1 USDC
            attractiveRate, // Taking attractive amount of WMATIC
            7200        // 2 hour duration
        );
        
        if (result.success) {
            console.log('\n🎉 FILLABLE ORDER CREATED!');
            console.log(`📋 Order Hash: ${result.orderHash}`);
            console.log(`🔗 View: ${result.viewUrl}`);
            console.log(`💰 Rate: 1 USDC = ${attractiveRate} WMATIC`);
            console.log(`📈 Market Rate: 1 USDC = ${marketRate} WMATIC`);
            console.log(`🎁 Arbitrage Opportunity: ${((attractiveRate/marketRate - 1) * 100).toFixed(1)}% profit for taker`);
            
            // Monitor the order every 30 seconds
            console.log('\n⏰ Starting order monitoring...');
            console.log('Will check every 30 seconds for fills\n');
            
            let checkCount = 0;
            const maxChecks = 20; // Monitor for 10 minutes
            
            const monitorInterval = setInterval(async () => {
                checkCount++;
                console.log(`🔍 Check ${checkCount}/${maxChecks} - ${new Date().toLocaleTimeString()}`);
                
                try {
                    const status = await orderSystem.monitorOrder(result.orderHash);
                    
                    if (status) {
                        console.log(`Status: ${status.status}`);
                        console.log(`API Verified: ${status.apiVerified}`);
                        console.log(`Contract Verified: ${status.contractVerified}`);
                        
                        if (status.remaining !== undefined) {
                            const remainingAmount = parseFloat(status.remaining);
                            if (remainingAmount === 0) {
                                console.log('\n🎉 ORDER FILLED! 🎉');
                                console.log('✅ Limit order successfully executed!');
                                console.log(`🔗 View: ${status.viewUrl}`);
                                clearInterval(monitorInterval);
                                return;
                            } else {
                                console.log(`Remaining: ${remainingAmount}`);
                            }
                        }
                    }
                    
                    if (checkCount >= maxChecks) {
                        console.log('\n⏰ Monitoring period ended');
                        console.log('Order may still be active - check manually in 1inch app');
                        console.log(`🔗 ${result.viewUrl}`);
                        clearInterval(monitorInterval);
                    }
                    
                } catch (error) {
                    console.log(`❌ Monitor error: ${error.message}`);
                }
                
                console.log(''); // Empty line for readability
                
            }, 30000); // Check every 30 seconds
            
            return result;
            
        } else {
            throw new Error('Failed to create fillable order');
        }
        
    } catch (error) {
        console.error('❌ Failed to create fillable order:', error.message);
        throw error;
    }
}

if (require.main === module) {
    createFillableOrder().catch(console.error);
}

module.exports = { createFillableOrder };
