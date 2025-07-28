const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testWorking1inchAPI() {
    console.log('🔍 TESTING REAL 1INCH API WITH CORRECT ENDPOINTS');
    console.log('=================================================');
    
    const apiKey = process.env.ONEINCH_API_KEY;
    console.log(`API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING'}`);
    
    if (!apiKey) {
        console.log('❌ No 1inch API key found in .env file');
        return;
    }
    
    // CORRECT 1inch API endpoint based on documentation
    const baseUrl = 'https://api.1inch.dev/swap/v6.0/137/quote';
    
    const params = {
        fromTokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
        toTokenAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',   // WMATIC
        amount: '1000000' // 1 USDC (6 decimals)
    };
    
    console.log(`🌐 URL: ${baseUrl}`);
    console.log(`📊 Params:`, params);
    
    try {
        console.log('\\n📡 Making REAL API call to 1inch...');
        
        const response = await axios.get(baseUrl, {
            params: params,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 15000
        });
        
        console.log('\\n✅ SUCCESS! REAL 1inch API response:');
        console.log('Status:', response.status);
        console.log('Headers:', Object.keys(response.headers));
        
        const data = response.data;
        console.log('\\n📊 Quote Data:');
        console.log('From Token:', data.fromToken?.symbol || 'Unknown');
        console.log('To Token:', data.toToken?.symbol || 'Unknown');
        console.log('From Amount:', data.fromTokenAmount);
        console.log('To Amount:', data.toTokenAmount);
        
        if (data.fromTokenAmount && data.toTokenAmount) {
            const rate = parseFloat(data.toTokenAmount) / parseFloat(data.fromTokenAmount);
            console.log(`💱 Exchange Rate: 1 ${data.fromToken?.symbol || 'USDC'} = ${rate.toFixed(6)} ${data.toToken?.symbol || 'WMATIC'}`);
        }
        
        console.log('\\n🎉 1INCH API IS WORKING!');
        console.log('We can now build REAL limit orders with this data');
        
        return data;
        
    } catch (error) {
        console.log('\\n❌ API CALL FAILED:');
        console.log('Error:', error.message);
        
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Status Text:', error.response.statusText);
            console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 401) {
                console.log('\\n🔑 AUTHENTICATION ERROR:');
                console.log('- Check if API key is valid');
                console.log('- Register at https://portal.1inch.dev/');
                console.log('- Make sure API key has proper permissions');
            }
            
            if (error.response.status === 429) {
                console.log('\\n⏰ RATE LIMIT ERROR:');
                console.log('- 1inch has 1 request per second limit');
                console.log('- Wait before making next request');
                console.log('- Consider upgrading to enterprise plan');
            }
        }
        
        return null;
    }
}

async function testLimitOrderAPI() {
    console.log('\\n🔍 TESTING 1INCH LIMIT ORDER API');
    console.log('==================================');
    
    const apiKey = process.env.ONEINCH_API_KEY;
    
    // Try to get limit order protocol info
    const limitOrderUrl = 'https://api.1inch.dev/orderbook/v4.0/137/events';
    
    try {
        console.log('📡 Testing limit order endpoint...');
        
        const response = await axios.get(limitOrderUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('✅ Limit Order API accessible!');
        console.log('Status:', response.status);
        console.log('Data keys:', Object.keys(response.data));
        
        return true;
        
    } catch (error) {
        console.log('❌ Limit Order API failed:');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data || error.message);
        
        return false;
    }
}

async function main() {
    const quoteResult = await testWorking1inchAPI();
    
    if (quoteResult) {
        console.log('\\n🚀 READY TO BUILD REAL TWAP STRATEGY!');
        console.log('✅ 1inch Quote API working');
        
        // Test limit order API
        const limitOrderResult = await testLimitOrderAPI();
        
        if (limitOrderResult) {
            console.log('✅ 1inch Limit Order API working');
            console.log('\\n🎯 We can now build REAL limit order TWAP strategy!');
        } else {
            console.log('⚠️  Limit Order API needs investigation');
            console.log('💡 We can still build quote-based strategy');
        }
        
    } else {
        console.log('\\n❌ Cannot proceed without working 1inch API');
        console.log('🔧 Fix API authentication first');
    }
}

main();
