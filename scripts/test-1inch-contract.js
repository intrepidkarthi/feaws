#!/usr/bin/env node

/**
 * Test basic 1inch LOP contract interaction
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    
    // 1inch LOP contract
    const LOP_ADDRESS = '0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f';
    
    console.log('🔍 Testing 1inch LOP contract interaction...\n');
    console.log(`Contract: ${LOP_ADDRESS}`);
    
    // Test basic contract calls
    try {
        // Check if contract exists
        const code = await provider.getCode(LOP_ADDRESS);
        console.log(`✅ Contract exists (code length: ${code.length})`);
        
        // Try to call a simple view function
        const contract = new ethers.Contract(
            LOP_ADDRESS,
            [
                'function DOMAIN_SEPARATOR() view returns (bytes32)',
                'function name() view returns (string)',
                'function version() view returns (string)'
            ],
            provider
        );
        
        try {
            const domainSeparator = await contract.DOMAIN_SEPARATOR();
            console.log(`✅ DOMAIN_SEPARATOR: ${domainSeparator}`);
        } catch (error) {
            console.log(`❌ DOMAIN_SEPARATOR failed: ${error.message}`);
        }
        
        try {
            const name = await contract.name();
            console.log(`✅ Contract name: ${name}`);
        } catch (error) {
            console.log(`❌ Name failed: ${error.message}`);
        }
        
        try {
            const version = await contract.version();
            console.log(`✅ Contract version: ${version}`);
        } catch (error) {
            console.log(`❌ Version failed: ${error.message}`);
        }
        
    } catch (error) {
        console.log(`❌ Contract test failed: ${error.message}`);
    }
    
    console.log('\n🔗 Polygonscan: https://polygonscan.com/address/' + LOP_ADDRESS);
}

main().catch(console.error);
