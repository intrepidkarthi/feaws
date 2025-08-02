const axios = require('axios');
require('dotenv').config();

/**
 * Test the discovered unleash-edge authentication format
 */
async function testUnleashAuth() {
    console.log('🔍 TESTING UNLEASH-EDGE AUTH FORMAT');
    console.log('════════════════════════════════════════');
    
    // The discovered auth format from browser
    const unleashAuth = '1inch-v2:production.a9fa089671657f45d864d999f16c11f1d4723aa7f9930379d81591d0';
    
    // Test the unleash endpoint first
    try {
        console.log('🧪 Testing unleash-edge endpoint...');
        const response = await axios.get('https://unleash-edge.1inch.io/api/frontend', {
            params: {
                sessionId: Math.floor(Math.random() * 1000000000),
                appName: '1inch-v2',
                environment: 'production',
                userId: '4d244981-3a27-4a92-890c-594dceee7804'
            },
            headers: {
                'authorization': unleashAuth,
                'accept': 'application/json',
                'origin': 'https://app.1inch.io',
                'referer': 'https://app.1inch.io/',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        console.log('✅ Unleash endpoint works!');
        console.log('📋 Response:', JSON.stringify(response.data, null, 2));
        
        // Check if response contains API configuration
        if (response.data && response.data.toggles) {
            console.log('🎯 Found feature toggles - checking for API endpoints...');
            response.data.toggles.forEach(toggle => {
                if (toggle.name.includes('api') || toggle.name.includes('orderbook') || toggle.name.includes('limit')) {
                    console.log(`   🔧 ${toggle.name}: ${toggle.enabled}`);
                }
            });
        }
        
    } catch (error) {
        console.log('❌ Unleash test failed:', error.response?.status || error.message);
    }
    
    console.log('');
    console.log('🔍 TESTING ORDERBOOK WITH UNLEASH AUTH');
    console.log('════════════════════════════════════════');
    
    // Now test orderbook endpoints with this auth format
    const orderbookEndpoints = [
        'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/build',
        'https://api.1inch.dev/orderbook/v4.0/137',
        'https://api.1inch.io/orderbook/v4.0/137'
    ];
    
    const testParams = {
        makerToken: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        takerToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        makingAmount: '50000',
        takingAmount: '250000000000000000',
        expiration: Math.floor(Date.now() / 1000) + 3600,
        makerAddress: '0x5756CB1C9223E109FCd0D0f0b48923b1D8B4C654',
        series: '0',
        source: '0xe26b9977'
    };
    
    for (const endpoint of orderbookEndpoints) {
        try {
            console.log(`🧪 Testing ${endpoint}...`);
            
            const response = await axios.get(endpoint, {
                params: testParams,
                headers: {
                    'authorization': unleashAuth,
                    'accept': 'application/json',
                    'origin': 'https://app.1inch.io',
                    'referer': 'https://app.1inch.io/',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                },
                timeout: 10000
            });
            
            console.log(`✅ SUCCESS! ${endpoint}`);
            console.log(`📊 Status: ${response.status}`);
            console.log('📋 Response:', JSON.stringify(response.data, null, 2));
            
            // If we get a successful response, this is our working endpoint!
            return { endpoint, response: response.data };
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ ${endpoint} - Status: ${error.response.status}`);
                if (error.response.data) {
                    console.log(`   📋 Error:`, JSON.stringify(error.response.data));
                }
            } else {
                console.log(`💥 ${endpoint} - ${error.message}`);
            }
        }
    }
    
    console.log('');
    console.log('🔍 TESTING WITH BEARER TOKEN + UNLEASH HEADERS');
    console.log('════════════════════════════════════════');
    
    // Try combining our API key with unleash-style headers
    for (const endpoint of orderbookEndpoints) {
        try {
            console.log(`🧪 Testing ${endpoint} with Bearer + Unleash headers...`);
            
            const response = await axios.get(endpoint, {
                params: testParams,
                headers: {
                    'authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                    'x-1inch-auth': unleashAuth,
                    'accept': 'application/json',
                    'origin': 'https://app.1inch.io',
                    'referer': 'https://app.1inch.io/',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                },
                timeout: 10000
            });
            
            console.log(`✅ SUCCESS! ${endpoint} with combined auth`);
            console.log(`📊 Status: ${response.status}`);
            console.log('📋 Response:', JSON.stringify(response.data, null, 2));
            
            return { endpoint, response: response.data, authMethod: 'combined' };
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ ${endpoint} - Status: ${error.response.status}`);
            } else {
                console.log(`💥 ${endpoint} - ${error.message}`);
            }
        }
    }
    
    console.log('');
    console.log('🎯 ANALYSIS COMPLETE');
    console.log('Check results above for working authentication method');
}

testUnleashAuth().catch(console.error);
