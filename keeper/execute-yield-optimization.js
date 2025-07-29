#!/usr/bin/env node

/**
 * EXECUTE YIELD OPTIMIZATION
 * Retrieves $5 USDC from Aave and deploys to higher-yield QuickSwap LP
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { YieldOptimizer } = require('./yield-optimizer');

async function main() {
    console.log('🎯 YIELD OPTIMIZATION EXECUTION');
    console.log('===============================');
    console.log('🎯 Retrieving $5 USDC from Aave and optimizing for higher yield');
    
    const optimizer = new YieldOptimizer();
    
    try {
        // Execute complete optimization
        const results = await optimizer.executeCompleteOptimization();
        
        if (results.success) {
            console.log('\n✅ YIELD OPTIMIZATION SUCCESSFUL!');
            console.log(`📈 Total yield improvement: ${results.totalYieldImprovement.toFixed(2)}% APY`);
            console.log(`📋 Transactions: ${results.transactions.length}`);
            
            results.transactions.forEach((tx, i) => {
                console.log(`  ${i + 1}. https://polygonscan.com/tx/${tx}`);
            });
            
        } else {
            console.log('❌ Optimization failed:', results.error);
        }
        
    } catch (error) {
        console.error('❌ Execution failed:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
