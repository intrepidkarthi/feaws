#!/usr/bin/env node

/**
 * Analyze the maker contract to understand what it is
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerAddress = new ethers.Wallet(process.env.PRIVATE_KEY).address;

    console.log('🔍 ANALYZING MAKER CONTRACT\n');
    console.log(`Contract Address: ${makerAddress}`);
    console.log(`🔗 Polygonscan: https://polygonscan.com/address/${makerAddress}\n`);

    // Get contract code
    const code = await provider.getCode(makerAddress);
    console.log(`Contract Code Length: ${code.length} characters`);
    console.log(`Code Preview: ${code.substring(0, 100)}...\n`);

    // Try to call common contract functions
    const commonSelectors = [
        { name: 'name()', selector: '0x06fdde03' },
        { name: 'symbol()', selector: '0x95d89b41' },
        { name: 'owner()', selector: '0x8da5cb5b' },
        { name: 'implementation()', selector: '0x5c60da1b' },
        { name: 'version()', selector: '0x54fd4d50' }
    ];

    console.log('🔍 Testing common contract functions:');
    
    for (const func of commonSelectors) {
        try {
            const result = await provider.call({
                to: makerAddress,
                data: func.selector
            });
            
            if (result !== '0x') {
                console.log(`✅ ${func.name}: ${result}`);
                
                // Try to decode as string for name/symbol
                if (func.name.includes('name') || func.name.includes('symbol')) {
                    try {
                        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['string'], result);
                        console.log(`   Decoded: "${decoded[0]}"`);
                    } catch (e) {
                        // Not a string
                    }
                }
            }
        } catch (error) {
            // Function doesn't exist or failed
        }
    }

    // Check recent transactions to understand usage
    console.log('\n📊 Recent Activity:');
    try {
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 1000); // Last ~1000 blocks
        
        const filter = {
            address: makerAddress,
            fromBlock: fromBlock,
            toBlock: 'latest'
        };
        
        const logs = await provider.getLogs(filter);
        console.log(`Found ${logs.length} events in last 1000 blocks`);
        
        if (logs.length > 0) {
            console.log('Recent events:');
            logs.slice(-3).forEach((log, i) => {
                console.log(`  ${i + 1}. Block ${log.blockNumber}, Topic: ${log.topics[0]?.substring(0, 10)}...`);
            });
        }
    } catch (error) {
        console.log('Could not fetch recent activity');
    }

    console.log('\n💡 RECOMMENDATION:');
    console.log('This appears to be a smart contract wallet or proxy.');
    console.log('For TWAP demo, consider using a regular EOA wallet instead.');
}

main().catch(console.error);
