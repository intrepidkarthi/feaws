const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

/**
 * TEST ENDPOINT COMBINATIONS
 * 
 * Testing different combinations of endpoints and auth methods
 * to find the working submission pattern
 */
class EndpointTester {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        // Captured real auth headers
        this.realAuthHeaders = {
            'accept': 'application/json, text/plain, */*',
            'authorization': 'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbiI6ImJjZjAyYTg0LTQwZTQtNDczOS04OTQwLWMzYjNiYjQ1YzRkMCIsImV4cCI6MTc1NDExMjk0MSwiZGV2aWNlIjoiYnJvd3NlciIsImlhdCI6MTc1NDEwOTM0MX0.SpmFemNXbI0CRVhfjcPUqZDVT57fWkGcazPagAWKRs5FdzhtZBQzLdzEzBZ5tReQ2Hcgjh4O1CEu2qp2jyWYmQ',
            'origin': 'https://app.1inch.io',
            'referer': 'https://app.1inch.io/',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-session-id': '5f7137d6-d217-46d6-8cc2-c823057b0b9d',
            'x-user-id': '4d244981-3a27-4a92-890c-594dceee7804'
        };

        // API key headers
        this.apiKeyHeaders = {
            'accept': 'application/json',
            'authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
            'origin': 'https://app.1inch.io',
            'referer': 'https://app.1inch.io/'
        };

        // Combined headers
        this.combinedHeaders = {
            ...this.realAuthHeaders,
            'x-api-key': process.env.ONEINCH_API_KEY
        };

        // Test endpoints
        this.endpoints = {
            proxyOrders: 'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/orders',
            proxyAddress: 'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/address',
            apiBuild: 'https://api.1inch.dev/orderbook/v4.0/137/build',
            apiOrders: 'https://api.1inch.dev/orderbook/v4.0/137/orders',
            apiAddress: 'https://api.1inch.dev/orderbook/v4.0/137/address'
        };
    }

    async testAllEndpoints() {
        console.log('🧪 TESTING ALL ENDPOINT COMBINATIONS');
        console.log('═══════════════════════════════════════');
        console.log('');

        const results = {};

        // Test parameters
        const testParams = {
            makerToken: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC
            takerToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
            makingAmount: ethers.parseUnits('0.01', 6).toString(),
            takingAmount: ethers.parseUnits('0.05', 18).toString(),
            expiration: Math.floor(Date.now() / 1000) + 3600,
            makerAddress: this.makerWallet.address
        };

        // Test 1: Proxy endpoints with real auth
        console.log('🔍 TEST 1: Proxy endpoints with real JWT auth');
        console.log('─────────────────────────────────────────────');
        
        // Test address endpoint (we know this works)
        try {
            const addressUrl = `${this.endpoints.proxyAddress}/${this.makerWallet.address}?page=1&limit=10`;
            const addressResponse = await axios.get(addressUrl, {
                headers: this.realAuthHeaders,
                timeout: 10000
            });
            
            console.log(`✅ Proxy address: ${addressResponse.status}`);
            results.proxyAddress = { status: addressResponse.status, working: true };
        } catch (error) {
            console.log(`❌ Proxy address: ${error.response?.status || error.message}`);
            results.proxyAddress = { status: error.response?.status, working: false };
        }

        // Test orders endpoint
        try {
            const ordersResponse = await axios.get(this.endpoints.proxyOrders, {
                headers: this.realAuthHeaders,
                timeout: 10000
            });
            
            console.log(`✅ Proxy orders: ${ordersResponse.status}`);
            results.proxyOrders = { status: ordersResponse.status, working: true };
        } catch (error) {
            console.log(`❌ Proxy orders: ${error.response?.status || error.message}`);
            results.proxyOrders = { status: error.response?.status, working: false };
        }

        console.log('');

        // Test 2: API endpoints with API key
        console.log('🔍 TEST 2: API endpoints with API key');
        console.log('─────────────────────────────────────');

        try {
            const buildResponse = await axios.get(this.endpoints.apiBuild, {
                params: testParams,
                headers: this.apiKeyHeaders,
                timeout: 10000
            });
            
            console.log(`✅ API build: ${buildResponse.status}`);
            console.log(`📋 Order hash: ${buildResponse.data.orderHash}`);
            results.apiBuild = { status: buildResponse.status, working: true, data: buildResponse.data };
        } catch (error) {
            console.log(`❌ API build: ${error.response?.status || error.message}`);
            results.apiBuild = { status: error.response?.status, working: false };
        }

        console.log('');

        // Test 3: Combined headers approach
        console.log('🔍 TEST 3: Combined headers (JWT + API key)');
        console.log('───────────────────────────────────────────');

        try {
            const combinedBuildResponse = await axios.get(this.endpoints.apiBuild, {
                params: testParams,
                headers: this.combinedHeaders,
                timeout: 10000
            });
            
            console.log(`✅ Combined build: ${combinedBuildResponse.status}`);
            results.combinedBuild = { status: combinedBuildResponse.status, working: true };
        } catch (error) {
            console.log(`❌ Combined build: ${error.response?.status || error.message}`);
            results.combinedBuild = { status: error.response?.status, working: false };
        }

        console.log('');

        // Test 4: Direct order submission formats
        console.log('🔍 TEST 4: Order submission format testing');
        console.log('─────────────────────────────────────────');

        // Create a test order payload
        const testOrderPayload = {
            salt: "12345",
            maker: this.makerWallet.address,
            receiver: "0x0000000000000000000000000000000000000000",
            makerAsset: testParams.makerToken,
            takerAsset: testParams.takerToken,
            makingAmount: testParams.makingAmount,
            takingAmount: testParams.takingAmount,
            makerTraits: "0"
        };

        const testSignature = "0x1234567890abcdef"; // Dummy signature for format testing

        // Format 1: Direct order object
        try {
            const format1Response = await axios.post(this.endpoints.proxyOrders, {
                order: testOrderPayload,
                signature: testSignature
            }, {
                headers: { ...this.realAuthHeaders, 'content-type': 'application/json' },
                timeout: 10000
            });
            
            console.log(`✅ Format 1 (order object): ${format1Response.status}`);
            results.format1 = { status: format1Response.status, working: true };
        } catch (error) {
            console.log(`❌ Format 1: ${error.response?.status || error.message}`);
            if (error.response?.data) {
                console.log(`   Details: ${JSON.stringify(error.response.data).substring(0, 100)}...`);
            }
            results.format1 = { status: error.response?.status, working: false };
        }

        // Format 2: Flat structure
        try {
            const format2Response = await axios.post(this.endpoints.proxyOrders, {
                ...testOrderPayload,
                signature: testSignature
            }, {
                headers: { ...this.realAuthHeaders, 'content-type': 'application/json' },
                timeout: 10000
            });
            
            console.log(`✅ Format 2 (flat): ${format2Response.status}`);
            results.format2 = { status: format2Response.status, working: true };
        } catch (error) {
            console.log(`❌ Format 2: ${error.response?.status || error.message}`);
            results.format2 = { status: error.response?.status, working: false };
        }

        console.log('');
        console.log('📊 SUMMARY OF FINDINGS');
        console.log('═════════════════════');

        Object.entries(results).forEach(([test, result]) => {
            const status = result.working ? '✅' : '❌';
            console.log(`${status} ${test}: ${result.status || 'Error'}`);
        });

        console.log('');
        console.log('💡 RECOMMENDATIONS:');
        
        if (results.apiBuild && results.apiBuild.working) {
            console.log('✅ Use API build endpoint with API key for order creation');
        }
        
        if (results.proxyAddress && results.proxyAddress.working) {
            console.log('✅ Use proxy endpoints with JWT token for order queries');
        }

        if (results.format1 && results.format1.status !== 401) {
            console.log('✅ Format 1 (order object) seems to be accepted format');
        }

        console.log('');
        console.log('🎯 NEXT STEP: Create hybrid approach using working endpoints');

        return results;
    }
}

async function main() {
    try {
        const tester = new EndpointTester();
        const results = await tester.testAllEndpoints();
        
        console.log('');
        console.log('🏆 ENDPOINT TESTING COMPLETE!');
        console.log('Use the working combinations to implement real order submission.');
        
    } catch (error) {
        console.error('❌ Testing failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { EndpointTester };
