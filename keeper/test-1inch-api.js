const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function test1inchAPI() {
    console.log('🔍 TESTING REAL 1INCH API');
    console.log('=========================');
    
    const apiKey = process.env.ONEINCH_API_KEY;
    console.log(`API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING'}`);
    
    if (!apiKey) {
        console.log('❌ No 1inch API key found in .env file');
        return;
    }
    
    try {
        const url = 'https://api.1inch.dev/v6.0/137/quote';
        const params = {
            src: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
            dst: '0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4', // stMATIC
            amount: '1000000' // 1 USDC (6 decimals)
        };
        
        console.log(`🌐 URL: ${url}`);
        console.log(`📊 Params:`, params);
        console.log(`🔑 Headers: Authorization: Bearer ${apiKey.substring(0, 8)}...`);
        
        console.log('\\n📡 Making API call...');
        
        const response = await axios.get(url, {
            params: params,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            timeout: 15000
        });
        
        console.log('\\n✅ SUCCESS! Real 1inch API response:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        
        // Parse the response
        const toAmount = response.data.toAmount;
        const fromAmount = response.data.fromAmount;
        
        if (toAmount && fromAmount) {
            const rate = parseFloat(toAmount) / parseFloat(fromAmount);
            console.log(`\\n💱 Exchange Rate: 1 USDC = ${rate.toFixed(6)} stMATIC`);
        }
        
        return true;
        
    } catch (error) {
        console.log('\\n❌ API CALL FAILED:');
        console.log('Error:', error.message);
        
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Status Text:', error.response.statusText);
            console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        
        return false;
    }
}

test1inchAPI();
