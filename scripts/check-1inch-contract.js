const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    
    console.log('🔍 CHECKING 1INCH LOP CONTRACT');
    console.log('');
    
    const LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
    
    // Check if contract exists
    const code = await provider.getCode(LOP_CONTRACT);
    console.log('📋 Contract exists:', code !== '0x' ? '✅ YES' : '❌ NO');
    console.log('📋 Code length:', code.length);
    console.log('');
    
    if (code === '0x') {
        console.log('❌ Contract not found at this address!');
        console.log('💡 Let me check the correct 1inch LOP address for Polygon...');
        
        // Try the alternative addresses
        const alternatives = [
            '0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f', // v3
            '0x119c71D3BbAC22029622cbaEc24854d3D32D2828', // Alternative
            '0x1111111254eeb25477b68fb85ed929f73a960582'  // v2
        ];
        
        for (const addr of alternatives) {
            const altCode = await provider.getCode(addr);
            console.log(`📋 ${addr}:`, altCode !== '0x' ? '✅ EXISTS' : '❌ NO');
        }
        return;
    }
    
    // Try to call a simple view function to test the contract
    try {
        const contract = new ethers.Contract(
            LOP_CONTRACT,
            [
                'function DOMAIN_SEPARATOR() external view returns (bytes32)',
                'function name() external view returns (string)',
                'function version() external view returns (string)'
            ],
            provider
        );
        
        console.log('🔍 Testing contract calls...');
        
        try {
            const domainSeparator = await contract.DOMAIN_SEPARATOR();
            console.log('✅ DOMAIN_SEPARATOR:', domainSeparator);
        } catch (e) {
            console.log('❌ DOMAIN_SEPARATOR failed:', e.message);
        }
        
        try {
            const name = await contract.name();
            console.log('✅ Name:', name);
        } catch (e) {
            console.log('❌ Name failed:', e.message);
        }
        
        try {
            const version = await contract.version();
            console.log('✅ Version:', version);
        } catch (e) {
            console.log('❌ Version failed:', e.message);
        }
        
    } catch (error) {
        console.log('❌ Contract interface error:', error.message);
    }
    
    console.log('');
    console.log('💡 Alternative approach: Use 1inch API for limit orders');
    console.log('🔗 https://docs.1inch.io/docs/limit-order-protocol/introduction');
}

main().catch(console.error);
