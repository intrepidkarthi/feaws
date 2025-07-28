const axios = require('axios');

async function testV5API() {
    console.log('🔍 TESTING 1INCH V5 API (Legacy)');
    console.log('=================================');
    
    // Try the old v5 API which might still work
    const url = 'https://api.1inch.io/v5.0/137/quote';
    const params = {
        fromTokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
        toTokenAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
        amount: '1000000' // 1 USDC
    };
    
    console.log(`🌐 URL: ${url}`);
    console.log(`📊 Params:`, params);
    
    try {
        const response = await axios.get(url, {
            params: params,
            timeout: 15000
        });
        
        console.log('\\n✅ V5 API SUCCESS!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        return true;
        
    } catch (error) {
        console.log('\\n❌ V5 API FAILED:');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data || error.message);
        
        return false;
    }
}

async function testSimpleQuote() {
    console.log('\\n🔍 TESTING SIMPLE QUOTE');
    console.log('========================');
    
    // Try different token pairs that are definitely liquid
    const tests = [
        {
            name: 'USDC → WMATIC',
            from: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            to: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            amount: '1000000'
        },
        {
            name: 'USDC → WETH',
            from: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            to: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
            amount: '1000000'
        }
    ];
    
    for (const test of tests) {
        console.log(`\\n🧪 Testing: ${test.name}`);
        
        try {
            const response = await axios.get('https://api.1inch.io/v5.0/137/quote', {
                params: {
                    fromTokenAddress: test.from,
                    toTokenAddress: test.to,
                    amount: test.amount
                },
                timeout: 10000
            });
            
            console.log('✅ SUCCESS!');
            console.log('To Amount:', response.data.toTokenAmount);
            console.log('Estimated Gas:', response.data.estimatedGas);
            
            return { test, response: response.data };
            
        } catch (error) {
            console.log('❌ FAILED');
            console.log('Error:', error.response?.data || error.message);
        }
    }
    
    return null;
}

async function main() {
    const v5Result = await testV5API();
    
    if (!v5Result) {
        const simpleResult = await testSimpleQuote();
        
        if (simpleResult) {
            console.log('\\n🎉 FOUND WORKING ENDPOINT!');
            console.log('Use v5.0 API with these parameters');
        } else {
            console.log('\\n❌ ALL TESTS FAILED');
            console.log('Possible issues:');
            console.log('1. 1inch API is down');
            console.log('2. Rate limiting');
            console.log('3. Network connectivity');
            console.log('4. API endpoints changed');
        }
    }
}

main();
