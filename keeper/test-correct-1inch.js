const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testCorrect1inchAPI() {
    console.log('🔍 TESTING CORRECT 1INCH API ENDPOINTS');
    console.log('======================================');
    
    const apiKey = process.env.ONEINCH_API_KEY;
    console.log(`API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING'}`);
    
    if (!apiKey) {
        console.log('❌ No 1inch API key found in .env file');
        return;
    }
    
    // Test different possible endpoints
    const endpoints = [
        'https://api.1inch.dev/v6.0/137/quote',
        'https://api.1inch.io/v6.0/137/quote',
        'https://api.1inch.dev/v5.0/137/quote',
        'https://api.1inch.io/v5.0/137/quote'
    ];
    
    const params = {
        src: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
        dst: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC (more liquid)
        amount: '1000000' // 1 USDC (6 decimals)
    };
    
    for (const endpoint of endpoints) {
        console.log(`\\n🌐 Testing: ${endpoint}`);
        
        try {
            const response = await axios.get(endpoint, {
                params: params,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            
            console.log('✅ SUCCESS!');
            console.log('Status:', response.status);
            console.log('Response keys:', Object.keys(response.data));
            
            if (response.data.toAmount) {
                const rate = parseFloat(response.data.toAmount) / parseFloat(response.data.fromAmount || params.amount);
                console.log(`💱 Rate: 1 USDC = ${rate.toFixed(6)} WMATIC`);
            }
            
            return { endpoint, data: response.data };
            
        } catch (error) {
            console.log('❌ FAILED');
            console.log('Status:', error.response?.status || 'No response');
            console.log('Error:', error.response?.data || error.message);
        }
    }
    
    console.log('\\n❌ All endpoints failed. Possible issues:');
    console.log('1. Invalid API key - register at https://portal.1inch.dev/');
    console.log('2. API endpoints changed');
    console.log('3. Rate limiting (1 req/sec limit)');
    console.log('4. Token addresses not supported');
    
    return null;
}

// Also test without API key to see if we get different errors
async function testWithoutAPIKey() {
    console.log('\\n🔍 TESTING WITHOUT API KEY (to compare errors)');
    console.log('================================================');
    
    try {
        const response = await axios.get('https://api.1inch.dev/v6.0/137/quote', {
            params: {
                src: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                dst: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
                amount: '1000000'
            },
            timeout: 10000
        });
        
        console.log('✅ Worked without API key!');
        console.log(response.data);
        
    } catch (error) {
        console.log('❌ Failed without API key:');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data || error.message);
    }
}

async function main() {
    const result = await testCorrect1inchAPI();
    await testWithoutAPIKey();
    
    if (result) {
        console.log('\\n🎉 WORKING ENDPOINT FOUND!');
        console.log('Endpoint:', result.endpoint);
        console.log('Sample response:', JSON.stringify(result.data, null, 2));
    }
}

main();
