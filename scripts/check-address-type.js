#!/usr/bin/env node

/**
 * Check if addresses are EOA (externally owned accounts) or contracts
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerAddress = new ethers.Wallet(process.env.PRIVATE_KEY).address;
    const takerAddress = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY).address;

    console.log('🔍 ADDRESS TYPE VERIFICATION\n');

    async function checkAddress(address, name) {
        console.log(`📋 ${name}: ${address}`);
        
        try {
            // Check if it's a contract (has code)
            const code = await provider.getCode(address);
            const isContract = code !== '0x';
            
            // Get nonce (transaction count)
            const nonce = await provider.getTransactionCount(address);
            
            // Get balance
            const balance = await provider.getBalance(address);
            
            console.log(`   Type: ${isContract ? 'Contract' : 'EOA (Externally Owned Account)'}`);
            console.log(`   Code: ${code.length > 2 ? 'Has code' : 'No code'} (${code.substring(0, 10)}...)`);
            console.log(`   Nonce: ${nonce}`);
            console.log(`   Balance: ${ethers.formatEther(balance)} POL`);
            
            if (isContract) {
                console.log(`   ⚠️  This is a smart contract, not a regular wallet!`);
            } else {
                console.log(`   ✅ This is a regular wallet (EOA)`);
            }
            
        } catch (error) {
            console.log(`   ❌ Error checking address: ${error.message}`);
        }
        
        console.log('');
    }

    await checkAddress(makerAddress, 'Maker');
    await checkAddress(takerAddress, 'Taker');
    
    // Also check a known EOA for comparison
    console.log('📋 Reference - Known EOA: 0x0000000000000000000000000000000000000001');
    try {
        const code = await provider.getCode('0x0000000000000000000000000000000000000001');
        console.log(`   Code: ${code}`);
        console.log(`   Type: ${code !== '0x' ? 'Contract' : 'EOA'}`);
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }
}

main().catch(console.error);
