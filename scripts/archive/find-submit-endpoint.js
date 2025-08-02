const axios = require('axios');
require('dotenv').config();

/**
 * FIND CORRECT SUBMISSION ENDPOINT
 * Test various possible submission endpoints
 */
async function findSubmitEndpoint() {
    console.log('🔍 FINDING CORRECT SUBMISSION ENDPOINT');
    console.log('════════════════════════════════════════');
    
    const workingHeaders = {
        'accept': 'application/json',
        'authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
        'origin': 'https://app.1inch.io',
        'referer': 'https://app.1inch.io/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'x-session-id': '272640013',
        'x-app-name': '1inch-v2',
        'x-environment': 'production',
        'content-type': 'application/json'
    };

    // Test different possible submission endpoints
    const possibleEndpoints = [
        // Direct paths
        'https://api.1inch.dev/orderbook/v4.0/137/orders',
        'https://api.1inch.dev/orderbook/v4.0/137/submit',
        'https://api.1inch.dev/orderbook/v4.0/137/create',
        'https://api.1inch.dev/orderbook/v4.0/137/limit-order',
        'https://api.1inch.dev/orderbook/v4.0/137/limit-orders',
        
        // Alternative structures
        'https://api.1inch.dev/v4.0/137/orderbook/order',
        'https://api.1inch.dev/v4.0/137/orderbook/orders',
        'https://api.1inch.dev/v4.0/137/orderbook/submit',
        'https://api.1inch.dev/v4.0/137/limit-order/order',
        'https://api.1inch.dev/v4.0/137/limit-order/submit',
        
        // Root level
        'https://api.1inch.dev/orderbook/137/order',
        'https://api.1inch.dev/orderbook/137/orders',
        'https://api.1inch.dev/orderbook/137/submit',
        
        // Proxy alternatives
        'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/orders',
        'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/submit',
        'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/create'
    ];

    const testPayload = {
        orderHash: '0x126ba080ad046d7f2f8fd6a5c78796330509a2014de0872423897b206696e548',
        signature: '0xbd6693d880b23aeea6b4c8c5c7e8f9e0f1f2f3f4f5f6f7f8f9f0f1f2f3f4f5f6f7f8f9f0f1f2f3f4f5f6f7f8f9f0f1f2f3f4f5f6f7f8f9f0f1f2f3f4f5f6f7',
        data: {
            maker: '0x5756CB1C9223E109FCd0D0f0b48923b1D8B4C654',
            makerAsset: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            takerAsset: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            makingAmount: '50000',
            takingAmount: '250000000000000000'
        }
    };

    console.log('🧪 Testing POST endpoints...');
    console.log('');

    for (const endpoint of possibleEndpoints) {
        try {
            console.log(`📤 Testing: ${endpoint}`);
            
            const response = await axios.post(endpoint, testPayload, {
                headers: workingHeaders,
                timeout: 8000
            });
            
            console.log(`✅ SUCCESS! ${endpoint}`);
            console.log(`📊 Status: ${response.status}`);
            console.log('📋 Response:', JSON.stringify(response.data, null, 2));
            console.log('');
            console.log('🎉 FOUND WORKING SUBMISSION ENDPOINT!');
            return endpoint;
            
        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const errorMsg = error.response.data;
                
                if (status === 404) {
                    console.log(`❌ ${endpoint} - 404 Not Found`);
                } else if (status === 400) {
                    console.log(`⚠️ ${endpoint} - 400 Bad Request (endpoint exists!)`);
                    console.log(`   📋 Error:`, JSON.stringify(errorMsg));
                    console.log('   🎯 This endpoint exists but needs correct payload format');
                } else if (status === 401) {
                    console.log(`🔐 ${endpoint} - 401 Unauthorized (endpoint exists!)`);
                    console.log('   🎯 This endpoint exists but needs correct auth');
                } else {
                    console.log(`🔍 ${endpoint} - ${status}`);
                    console.log(`   📋 Response:`, JSON.stringify(errorMsg));
                }
            } else {
                console.log(`💥 ${endpoint} - ${error.message}`);
            }
        }
    }

    console.log('');
    console.log('🔍 TESTING GET ENDPOINTS FOR DISCOVERY...');
    console.log('');

    // Test GET endpoints to discover API structure
    const getEndpoints = [
        'https://api.1inch.dev/orderbook/v4.0/137',
        'https://api.1inch.dev/orderbook/v4.0/137/orders',
        'https://api.1inch.dev/orderbook/v4.0/137/active-orders',
        'https://api.1inch.dev/v4.0/137/orderbook',
        'https://api.1inch.dev/v4.0/137/limit-order'
    ];

    for (const endpoint of getEndpoints) {
        try {
            console.log(`🔍 GET: ${endpoint}`);
            
            const response = await axios.get(endpoint, {
                headers: workingHeaders,
                timeout: 8000
            });
            
            console.log(`✅ SUCCESS! ${endpoint}`);
            console.log(`📊 Status: ${response.status}`);
            console.log('📋 Response:', JSON.stringify(response.data, null, 2));
            console.log('');
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ ${endpoint} - ${error.response.status}`);
            } else {
                console.log(`💥 ${endpoint} - ${error.message}`);
            }
        }
    }

    console.log('');
    console.log('🎯 ANALYSIS COMPLETE');
    console.log('Look for endpoints that returned 400 (Bad Request) - these exist but need correct format');
    console.log('Look for endpoints that returned 401 (Unauthorized) - these exist but need correct auth');
}

findSubmitEndpoint().catch(console.error);
