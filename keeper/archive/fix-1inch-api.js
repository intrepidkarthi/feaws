const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function find1inchLimitOrderAPI() {
    console.log('🔍 FINDING CORRECT 1INCH LIMIT ORDER API ENDPOINT');
    console.log('=================================================');
    
    const apiKey = process.env.ONEINCH_API_KEY;
    
    // Test different API endpoints
    const endpoints = [
        'https://api.1inch.dev/orderbook/v4.0/137',
        'https://api.1inch.dev/orderbook/v3.0/137', 
        'https://api.1inch.dev/orderbook/v2.0/137',
        'https://api.1inch.dev/orderbook/v1.0/137',
        'https://api.1inch.dev/limit-order/v4.0/137',
        'https://api.1inch.dev/limit-order/v3.0/137',
        'https://api.1inch.dev/limit-order/v2.0/137',
        'https://api.1inch.dev/limit-order/v1.0/137',
        'https://api.1inch.io/v5.0/137/limit-order',
        'https://api.1inch.io/v4.0/137/limit-order',
        'https://limit-orders.1inch.io/v3.0/137',
        'https://limit-orders.1inch.io/v2.0/137',
        'https://limit-orders.1inch.io/v1.0/137'
    ];
    
    const testPaths = [
        '',
        '/orders',
        '/order',
        '/events',
        '/all',
        '/active',
        '/status'
    ];
    
    for (const baseUrl of endpoints) {
        console.log(`\\n🧪 Testing base: ${baseUrl}`);
        
        for (const path of testPaths) {
            const fullUrl = baseUrl + path;
            
            try {
                console.log(`  📡 GET ${fullUrl}`);
                
                const response = await axios.get(fullUrl, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                });
                
                console.log(`  ✅ SUCCESS: ${response.status}`);
                console.log(`  📊 Response:`, JSON.stringify(response.data, null, 2).substring(0, 200));
                
                // If we get here, this endpoint works
                console.log(`\\n🎉 WORKING ENDPOINT FOUND: ${fullUrl}`);
                return { url: fullUrl, method: 'GET', status: response.status, data: response.data };
                
            } catch (error) {
                if (error.response) {
                    console.log(`  ❌ ${error.response.status}: ${error.response.statusText}`);
                    
                    // 405 Method Not Allowed means endpoint exists but wrong method
                    if (error.response.status === 405) {
                        console.log(`  💡 Endpoint exists but GET not allowed, trying POST...`);
                        
                        try {
                            const postResponse = await axios.post(fullUrl, {}, {
                                headers: {
                                    'Authorization': `Bearer ${apiKey}`,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 10000
                            });
                            
                            console.log(`  ✅ POST SUCCESS: ${postResponse.status}`);
                            console.log(`\\n🎉 WORKING POST ENDPOINT: ${fullUrl}`);
                            return { url: fullUrl, method: 'POST', status: postResponse.status, data: postResponse.data };
                            
                        } catch (postError) {
                            console.log(`  ❌ POST also failed: ${postError.response?.status || postError.message}`);
                        }
                    }
                } else {
                    console.log(`  ❌ Network error: ${error.message}`);
                }
            }
        }
    }
    
    console.log('\\n❌ NO WORKING LIMIT ORDER API ENDPOINT FOUND');
    
    // Try to find any 1inch API documentation
    console.log('\\n🔍 Checking 1inch API documentation...');
    
    try {
        const docResponse = await axios.get('https://api.1inch.dev/swagger', {
            timeout: 10000
        });
        
        console.log('✅ Found API docs at: https://api.1inch.dev/swagger');
        
    } catch (error) {
        console.log('❌ No API docs found at standard location');
    }
    
    // Try the main 1inch API to see what's available
    try {
        const mainResponse = await axios.get('https://api.1inch.dev', {
            timeout: 10000
        });
        
        console.log('✅ Main API response:', JSON.stringify(mainResponse.data, null, 2));
        
    } catch (error) {
        console.log('❌ Main API not accessible');
    }
    
    return null;
}

async function testDirectContractInteraction() {
    console.log('\\n🔧 TESTING DIRECT CONTRACT INTERACTION');
    console.log('======================================');
    
    const { ethers } = require('ethers');
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // 1inch Limit Order Protocol v4 on Polygon
    const limitOrderProtocol = '0x111111125421cA6dc452d289314280a0f8842A65';
    
    console.log(`📍 Contract: ${limitOrderProtocol}`);
    console.log(`📍 Wallet: ${wallet.address}`);
    
    try {
        // Check if contract exists
        const code = await provider.getCode(limitOrderProtocol);
        
        if (code === '0x') {
            console.log('❌ Contract does not exist at this address');
            return false;
        }
        
        console.log('✅ Contract exists');
        console.log(`📊 Contract code length: ${code.length} bytes`);
        
        // Try to interact with contract directly
        const limitOrderABI = [
            'function DOMAIN_SEPARATOR() view returns (bytes32)',
            'function cancelOrder((uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order) external returns (uint256, uint256)',
            'function checkPredicate((uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order) external view returns (bool)',
            'function hashOrder((uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order) external view returns (bytes32)'
        ];
        
        const contract = new ethers.Contract(limitOrderProtocol, limitOrderABI, provider);
        
        // Test read-only function
        const domainSeparator = await contract.DOMAIN_SEPARATOR();
        console.log(`✅ Domain Separator: ${domainSeparator}`);
        
        console.log('✅ Contract is accessible and functional');
        
        return true;
        
    } catch (error) {
        console.error(`❌ Contract interaction failed: ${error.message}`);
        return false;
    }
}

async function main() {
    // First try to find working API
    const workingAPI = await find1inchLimitOrderAPI();
    
    if (workingAPI) {
        console.log(`\\n🎉 SOLUTION: Use ${workingAPI.url} with ${workingAPI.method} method`);
    } else {
        console.log('\\n⚠️  No working API found, checking direct contract interaction...');
        
        const contractWorks = await testDirectContractInteraction();
        
        if (contractWorks) {
            console.log('\\n💡 SOLUTION: Submit orders directly to contract instead of API');
            console.log('Contract Address: 0x111111125421cA6dc452d289314280a0f8842A65');
        } else {
            console.log('\\n❌ Neither API nor contract interaction works');
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { find1inchLimitOrderAPI, testDirectContractInteraction };
