const axios = require('axios');
require('dotenv').config();

/**
 * Debug 1inch API endpoints to find the correct submission format
 */
class Debug1inchAPI {
    constructor() {
        this.chainId = 137; // Polygon
        this.apiKey = process.env.ONEINCH_API_KEY;
        this.baseUrls = [
            'https://api.1inch.dev',
            'https://api.1inch.io',
            'https://limit-orders.1inch.io'
        ];
    }

    async testEndpoints() {
        console.log('🔍 DEBUGGING 1INCH API ENDPOINTS');
        console.log('════════════════════════════════════════');
        console.log(`🔑 API Key: ${this.apiKey ? 'Present' : 'Missing'}`);
        console.log(`🔗 Chain ID: ${this.chainId}`);
        console.log('');

        const endpointsToTest = [
            // v4.0 endpoints
            '/orderbook/v4.0/137',
            '/orderbook/v4.0/137/order',
            '/orderbook/v4.0/137/orders',
            
            // v3.0 endpoints
            '/orderbook/v3.0/137',
            '/orderbook/v3.0/137/order',
            
            // v2.0 endpoints  
            '/orderbook/v2.0/137',
            '/orderbook/v2.0/137/order',
            
            // Generic endpoints
            '/orderbook/137',
            '/orderbook/137/order',
            '/limit-order/137',
            '/limit-order/137/order'
        ];

        for (const baseUrl of this.baseUrls) {
            console.log(`🌐 Testing base URL: ${baseUrl}`);
            
            for (const endpoint of endpointsToTest) {
                const fullUrl = `${baseUrl}${endpoint}`;
                
                try {
                    // Test GET request first
                    const response = await axios.get(fullUrl, {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 5000
                    });
                    
                    console.log(`✅ GET ${fullUrl} - Status: ${response.status}`);
                    if (response.data) {
                        console.log(`   📋 Response:`, JSON.stringify(response.data).slice(0, 200));
                    }
                    
                } catch (error) {
                    if (error.response) {
                        console.log(`❌ GET ${fullUrl} - Status: ${error.response.status} - ${error.response.statusText}`);
                        if (error.response.status === 405) {
                            console.log(`   ℹ️  Method not allowed - endpoint exists but needs POST`);
                        }
                    } else if (error.code === 'ECONNABORTED') {
                        console.log(`⏰ GET ${fullUrl} - Timeout`);
                    } else {
                        console.log(`💥 GET ${fullUrl} - ${error.message}`);
                    }
                }
            }
            console.log('');
        }
    }

    async testOrderSubmission() {
        console.log('🧪 TESTING ORDER SUBMISSION FORMATS');
        console.log('════════════════════════════════════════');

        // Mock order data for testing
        const mockOrderData = {
            orderHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            signature: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
            data: {
                salt: '12345678901234567890',
                maker: '0x5756CB1C9223E109FCd0D0f0b48923b1D8B4C654',
                receiver: '0x0000000000000000000000000000000000000000',
                makerAsset: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                takerAsset: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
                makingAmount: '50000',
                takingAmount: '250000000000000000',
                makerTraits: '1234567890123456789012345678901234567890'
            }
        };

        const submissionFormats = [
            // Format 1: Full order data
            mockOrderData,
            
            // Format 2: Simplified
            {
                orderHash: mockOrderData.orderHash,
                signature: mockOrderData.signature,
                ...mockOrderData.data
            },
            
            // Format 3: Just hash and signature
            {
                orderHash: mockOrderData.orderHash,
                signature: mockOrderData.signature
            },
            
            // Format 4: Order object format
            {
                order: mockOrderData.data,
                signature: mockOrderData.signature
            }
        ];

        const testUrls = [
            'https://api.1inch.dev/orderbook/v4.0/137/order',
            'https://api.1inch.io/orderbook/v4.0/137/order',
            'https://limit-orders.1inch.io/v4.0/137/order'
        ];

        for (const url of testUrls) {
            console.log(`🎯 Testing submission to: ${url}`);
            
            for (let i = 0; i < submissionFormats.length; i++) {
                const format = submissionFormats[i];
                console.log(`   📦 Format ${i + 1}:`, JSON.stringify(format).slice(0, 100) + '...');
                
                try {
                    const response = await axios.post(url, format, {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    });
                    
                    console.log(`   ✅ Success! Status: ${response.status}`);
                    console.log(`   📋 Response:`, JSON.stringify(response.data).slice(0, 200));
                    
                } catch (error) {
                    if (error.response) {
                        console.log(`   ❌ Status: ${error.response.status} - ${error.response.statusText}`);
                        if (error.response.data) {
                            console.log(`   📋 Error:`, JSON.stringify(error.response.data).slice(0, 200));
                        }
                    } else {
                        console.log(`   💥 Error: ${error.message}`);
                    }
                }
            }
            console.log('');
        }
    }

    async checkAPIKey() {
        console.log('🔑 TESTING API KEY AUTHENTICATION');
        console.log('════════════════════════════════════════');
        
        const testUrls = [
            'https://api.1inch.dev/swap/v5.0/137/tokens',
            'https://api.1inch.io/v5.0/137/tokens'
        ];

        for (const url of testUrls) {
            try {
                const response = await axios.get(url, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    timeout: 5000
                });
                
                console.log(`✅ ${url} - Status: ${response.status}`);
                console.log(`   📋 API Key working, got ${Object.keys(response.data.tokens || {}).length} tokens`);
                
            } catch (error) {
                if (error.response) {
                    console.log(`❌ ${url} - Status: ${error.response.status}`);
                    if (error.response.status === 401) {
                        console.log(`   🔐 API Key authentication failed`);
                    }
                } else {
                    console.log(`💥 ${url} - ${error.message}`);
                }
            }
        }
        console.log('');
    }

    async runFullDiagnostic() {
        try {
            await this.checkAPIKey();
            await this.testEndpoints();
            await this.testOrderSubmission();
            
            console.log('🎯 DIAGNOSTIC COMPLETE');
            console.log('Check the results above to identify the correct endpoint and format.');
            
        } catch (error) {
            console.error('❌ Diagnostic failed:', error.message);
        }
    }
}

async function main() {
    const apiDebugger = new Debug1inchAPI();
    await apiDebugger.runFullDiagnostic();
}

if (require.main === module) {
    main();
}

module.exports = { Debug1inchAPI };
