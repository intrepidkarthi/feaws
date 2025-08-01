#!/usr/bin/env node

/**
 * Check actual transaction status to see what happened
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    
    const txHashes = [
        '0xb4643a00a7f709cf5b6fc05d650903b1067d15c71e2c51f8ad2cfa8bf21060ec',
        '0xa165e5e286836250d215b52664ecc0cf89d117602d22131d81b316716ad87acd',
        '0x99e81e54869e634dcf0d5796dea3e98050d8192bf6d4eb669e581c68b385bc70'
    ];
    
    console.log('🔍 CHECKING ACTUAL TRANSACTION STATUS\n');
    
    for (let i = 0; i < txHashes.length; i++) {
        const hash = txHashes[i];
        console.log(`📋 Transaction ${i}: ${hash}`);
        
        try {
            const receipt = await provider.getTransactionReceipt(hash);
            
            if (receipt) {
                console.log(`   Status: ${receipt.status === 1 ? '✅ SUCCESS' : '❌ FAILED'}`);
                console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
                console.log(`   Block: ${receipt.blockNumber}`);
                
                if (receipt.status === 0) {
                    console.log('   ⚠️  Transaction REVERTED - no state changes occurred');
                }
            } else {
                console.log('   ❌ Transaction not found or pending');
            }
            
        } catch (error) {
            console.log(`   ❌ Error checking transaction: ${error.message}`);
        }
        
        console.log('');
    }
    
    console.log('🎯 HONEST ASSESSMENT:');
    console.log('   - Transactions were sent to the network');
    console.log('   - But they likely failed/reverted');
    console.log('   - No actual USDC was transferred');
    console.log('   - Balance remained unchanged');
    console.log('   - This is NOT proof of successful TWAP execution');
}

main().catch(console.error);
