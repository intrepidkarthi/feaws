#!/usr/bin/env node

/**
 * EXECUTE REAL YIELD STRATEGIES
 * No simulations - actual smart contract interactions
 */

require('dotenv').config({ path: '../.env' });
const { RealYieldManager } = require('./real-yield-manager');

async function main() {
    console.log('🎯 REAL YIELD STRATEGY EXECUTION');
    console.log('================================');
    
    const yieldManager = new RealYieldManager();
    console.log(`📍 Wallet: ${yieldManager.wallet.address}`);
    
    try {
        // Check current yield positions first
        console.log('\n📊 Checking current REAL yield positions...');
        const currentPositions = await yieldManager.getRealYieldPositions();
        console.log(`💰 Current positions: ${currentPositions.totalPositions}`);
        
        if (currentPositions.positions.length > 0) {
            currentPositions.positions.forEach(pos => {
                console.log(`  ${pos.protocol}: ${pos.amount} ${pos.token} (${pos.estimatedAPY})`);
            });
        }
        
        // Execute Aave lending with 5 USDC instead (stMATIC was shut down)
        console.log('\n🏦 Executing REAL Aave lending...');
        const lendingResult = await yieldManager.lendToAave('USDC', 5.0);
        
        console.log('\n✅ REAL LENDING COMPLETED!');
        console.log(`📋 Transaction Hash: ${lendingResult.transactionHash}`);
        console.log(`🔗 Polygonscan: https://polygonscan.com/tx/${lendingResult.transactionHash}`);
        console.log(`💰 USDC Lent: ${lendingResult.amount}`);
        console.log(`🏦 Protocol: Aave v3`);
        console.log(`⛽ Gas Used: ${lendingResult.gasUsed}`);
        
        // Save real transaction data
        const fs = require('fs');
        const path = require('path');
        
        const realYieldData = {
            execution: {
                timestamp: new Date().toISOString(),
                strategy: 'aave_lending',
                status: 'SUCCESS',
                transactionHash: lendingResult.transactionHash,
                blockNumber: lendingResult.blockNumber,
                gasUsed: lendingResult.gasUsed,
                token: lendingResult.token,
                amount: lendingResult.amount
            },
            positions: currentPositions
        };
        
        fs.writeFileSync(
            path.join(__dirname, '../frontend/real-yield-data.json'),
            JSON.stringify(realYieldData, null, 2)
        );
        
        console.log('\n💾 Real yield data saved to frontend/real-yield-data.json');
        console.log('\n🎉 REAL YIELD STRATEGY EXECUTED SUCCESSFULLY!');
        console.log('This is NOT a simulation - check Polygonscan for proof!');
        
    } catch (error) {
        console.error('\n❌ REAL yield execution failed:', error.message);
        
        // Save error data
        const fs = require('fs');
        const path = require('path');
        
        const errorData = {
            execution: {
                timestamp: new Date().toISOString(),
                strategy: 'aave_lending',
                status: 'ERROR',
                error: error.message
            }
        };
        
        fs.writeFileSync(
            path.join(__dirname, '../frontend/real-yield-data.json'),
            JSON.stringify(errorData, null, 2)
        );
        
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
