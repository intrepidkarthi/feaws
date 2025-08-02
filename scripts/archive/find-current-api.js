const axios = require('axios');
require('dotenv').config();

/**
 * Find the current 1inch API version and structure
 */
async function findCurrentAPI() {
    console.log('🔍 FINDING CURRENT 1INCH API VERSION');
    console.log('════════════════════════════════════════');

    const apiKey = process.env.ONEINCH_API_KEY;
    
    // Test known working endpoints to understand structure
    const workingEndpoints = [
        'https://api.1inch.dev/swap/v5.0/137/tokens',
        'https://api.1inch.io/v5.0/137/tokens'
    ];

    for (const endpoint of workingEndpoints) {
        try {
            const response = await axios.get(endpoint, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            
            console.log(`✅ ${endpoint} - Working (Status: ${response.status})`);
            
            // Check if there are any headers that indicate API structure
            if (response.headers) {
                console.log(`   📋 Headers:`, Object.keys(response.headers).filter(h => h.includes('api') || h.includes('version')));
            }
            
        } catch (error) {
            console.log(`❌ ${endpoint} - ${error.response?.status || error.message}`);
        }
    }

    console.log('');
    console.log('🔍 TESTING POTENTIAL ORDERBOOK ENDPOINTS');
    console.log('════════════════════════════════════════');

    // Test various potential endpoints based on the working structure
    const potentialEndpoints = [
        // v5.0 format (like swap API)
        'https://api.1inch.dev/orderbook/v5.0/137',
        'https://api.1inch.io/orderbook/v5.0/137',
        
        // v6.0 format
        'https://api.1inch.dev/orderbook/v6.0/137',
        'https://api.1inch.io/orderbook/v6.0/137',
        
        // limit-order instead of orderbook
        'https://api.1inch.dev/limit-order/v5.0/137',
        'https://api.1inch.io/limit-order/v5.0/137',
        
        // fusion format (new 1inch protocol)
        'https://api.1inch.dev/fusion/v1.0/137',
        'https://api.1inch.io/fusion/v1.0/137',
        
        // Try without version
        'https://api.1inch.dev/orderbook/137',
        'https://api.1inch.io/orderbook/137'
    ];

    for (const endpoint of potentialEndpoints) {
        try {
            const response = await axios.get(endpoint, {
                headers: { 
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            
            console.log(`✅ ${endpoint} - Status: ${response.status}`);
            if (response.data) {
                console.log(`   📋 Response:`, JSON.stringify(response.data).slice(0, 150) + '...');
            }
            
        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const message = error.response.statusText;
                
                if (status === 405) {
                    console.log(`🔄 ${endpoint} - Method not allowed (endpoint exists, needs POST)`);
                } else if (status === 400) {
                    console.log(`⚠️  ${endpoint} - Bad request (${error.response.data?.message || message})`);
                } else if (status === 404) {
                    console.log(`❌ ${endpoint} - Not found`);
                } else {
                    console.log(`❓ ${endpoint} - Status: ${status} (${message})`);
                }
            } else {
                console.log(`💥 ${endpoint} - ${error.message}`);
            }
        }
    }

    console.log('');
    console.log('🔍 CHECKING 1INCH FUSION (NEW PROTOCOL)');
    console.log('════════════════════════════════════════');
    
    // Fusion is 1inch's newer limit order system
    const fusionEndpoints = [
        'https://fusion.1inch.io/swap/v1.0/137',
        'https://api.1inch.dev/fusion/orders/v1.0/137',
        'https://fusion-api.1inch.io/orders/v1.0/137'
    ];

    for (const endpoint of fusionEndpoints) {
        try {
            const response = await axios.get(endpoint, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                timeout: 5000
            });
            
            console.log(`✅ ${endpoint} - Status: ${response.status}`);
            console.log(`   📋 Fusion endpoint found!`);
            
        } catch (error) {
            if (error.response?.status === 405) {
                console.log(`🔄 ${endpoint} - Method not allowed (Fusion endpoint exists!)`);
            } else {
                console.log(`❌ ${endpoint} - ${error.response?.status || error.message}`);
            }
        }
    }

    console.log('');
    console.log('🎯 ANALYSIS COMPLETE');
    console.log('Look for endpoints that return 405 (Method Not Allowed) - those exist but need POST requests');
}

findCurrentAPI().catch(console.error);
