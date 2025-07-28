const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function debug1inchResponse() {
    console.log('🔍 DEBUGGING 1INCH API RESPONSE FORMAT');
    console.log('======================================');
    
    const apiKey = process.env.ONEINCH_API_KEY;
    const url = 'https://api.1inch.dev/swap/v6.0/137/quote';
    
    const params = {
        fromTokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
        toTokenAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',   // WMATIC
        amount: '3000000' // 3 USDC (6 decimals)
    };
    
    try {
        console.log('📡 Making API call...');
        console.log('URL:', url);
        console.log('Params:', params);
        
        const response = await axios.get(url, {
            params: params,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 15000
        });
        
        console.log('\\n✅ SUCCESS!');
        console.log('Status:', response.status);
        console.log('\\n📊 FULL RESPONSE DATA:');
        console.log('======================');
        console.log(JSON.stringify(response.data, null, 2));
        
        console.log('\\n🔍 RESPONSE ANALYSIS:');
        console.log('=====================');
        console.log('Response type:', typeof response.data);
        console.log('Response keys:', Object.keys(response.data));
        
        // Check different possible field names
        const possibleFields = [
            'toTokenAmount', 'toAmount', 'dstAmount', 'returnAmount',
            'fromTokenAmount', 'fromAmount', 'srcAmount',
            'toToken', 'fromToken', 'protocols', 'estimatedGas'
        ];
        
        console.log('\\n🔎 FIELD ANALYSIS:');
        possibleFields.forEach(field => {
            if (response.data.hasOwnProperty(field)) {
                console.log(`✅ ${field}:`, response.data[field]);
            } else {
                console.log(`❌ ${field}: NOT FOUND`);
            }
        });
        
        // Try to calculate rate if we can find the amounts
        const data = response.data;
        if (data.toTokenAmount || data.toAmount) {
            const toAmount = data.toTokenAmount || data.toAmount;
            const fromAmount = data.fromTokenAmount || data.fromAmount || '3000000';
            
            console.log('\\n💱 RATE CALCULATION:');
            console.log('From Amount (raw):', fromAmount);
            console.log('To Amount (raw):', toAmount);
            
            if (toAmount && toAmount !== '0') {
                const { ethers } = require('ethers');
                const wmaticAmount = parseFloat(ethers.formatUnits(toAmount, 18));
                const usdcAmount = parseFloat(ethers.formatUnits(fromAmount, 6));
                const rate = wmaticAmount / usdcAmount;
                
                console.log('USDC Amount:', usdcAmount);
                console.log('WMATIC Amount:', wmaticAmount);
                console.log('Rate (WMATIC per USDC):', rate);
            }
        }
        
    } catch (error) {
        console.log('\\n❌ ERROR:');
        console.log('Message:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debug1inchResponse();
