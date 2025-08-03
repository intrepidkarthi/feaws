require('dotenv').config();
const { ethers } = require('ethers');

async function testRPC(url, name) {
    console.log(`Testing ${name}...`);
    
    try {
        const provider = new ethers.JsonRpcProvider(url);
        
        // Test basic connectivity
        const blockNumber = await provider.getBlockNumber();
        console.log(`✅ ${name} connected. Current block: ${blockNumber}`);
        
        // Test contract interaction
        const contract = new ethers.Contract(
            '0x111111125421cA6dc452d289314280a0f8842A65',
            ['function version() view returns (string)'],
            provider
        );
        
        try {
            const version = await contract.version();
            console.log(`✅ ${name} contract version: ${version}`);
        } catch (error) {
            console.log(`⚠️ ${name} contract call failed: ${error.message}`);
        }
        
        return true;
    } catch (error) {
        console.log(`❌ ${name} failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('Testing different RPC endpoints...');
    
    const rpcs = [
        { url: process.env.POLYGON_RPC_URL, name: 'Default' },
        { url: 'https://polygon-rpc.com', name: 'Polygon RPC' },
        { url: 'https://rpc-mainnet.maticvigil.com', name: 'Matic Vigil' },
        { url: 'https://rpc-mainnet.matic.quiknode.pro', name: 'QuickNode' }
    ];
    
    for (const rpc of rpcs) {
        await testRPC(rpc.url, rpc.name);
        console.log('---');
    }
}

main().catch(console.error);
