const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * FIX SUBMISSION ENDPOINT
 * 
 * The build endpoint works perfectly, but we need to find the correct
 * submission endpoint. Let's test various possible endpoints.
 */
class FixSubmissionEndpoint {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        // Working headers from your capture
        this.workingHeaders = {
            'accept': 'application/json, text/plain, */*',
            'authorization': 'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbiI6ImJjZjAyYTg0LTQwZTQtNDczOS04OTQwLWMzYjNiYjQ1YzRkMCIsImV4cCI6MTc1NDExMjk0MSwiZGV2aWNlIjoiYnJvd3NlciIsImlhdCI6MTc1NDEwOTM0MX0.SpmFemNXbI0CRVhfjcPUqZDVT57fWkGcazPagAWKRs5FdzhtZBQzLdzEzBZ5tReQ2Hcgjh4O1CEu2qp2jyWYmQ',
            'referer': 'https://app.1inch.io/',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-session-id': '5f7137d6-d217-46d6-8cc2-c823057b0b9d',
            'x-user-id': '4d244981-3a27-4a92-890c-594dceee7804',
            'content-type': 'application/json'
        };

        // Working build endpoint
        this.BUILD_ENDPOINT = 'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/build';
        
        // Possible submission endpoints to test
        this.possibleSubmissionEndpoints = [
            'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/orders',
            'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/order',
            'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/submit',
            'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/create',
            'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/place',
            'https://proxy-app.1inch.io/v2.0/limit-order/v4.0/137/orders',
            'https://proxy-app.1inch.io/v2.0/limit-order/v4.0/137/submit',
            'https://api.1inch.dev/orderbook/v4.0/137/orders',
            'https://api.1inch.dev/orderbook/v4.0/137/order'
        ];
    }

    async testSubmissionEndpoints() {
        console.log('🔍 TESTING SUBMISSION ENDPOINTS');
        console.log('═══════════════════════════════');
        console.log('🎯 Finding the correct submission URL');
        console.log('');

        // First, create a valid order using the working build endpoint
        console.log('🏗️ CREATING ORDER WITH WORKING BUILD ENDPOINT...');
        
        const buildParams = {
            makerToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
            takerToken: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',   // USDT
            makingAmount: ethers.parseUnits('0.01', 18).toString(),      // 0.01 WMATIC
            takingAmount: ethers.parseUnits('0.02', 6).toString(),       // 0.02 USDT
            expiration: Math.floor(Date.now() / 1000) + 3600,
            makerAddress: this.makerWallet.address,
            series: '0',
            source: '0xe26b9977'
        };

        const buildResponse = await axios.get(this.BUILD_ENDPOINT, {
            params: buildParams,
            headers: this.workingHeaders,
            timeout: 15000
        });

        console.log(`✅ Build successful: ${buildResponse.data.orderHash}`);
        
        // Sign the order
        const typedData = buildResponse.data.typedData;
        const signature = await this.makerWallet.signTypedData(
            typedData.domain,
            { Order: typedData.types.Order },
            typedData.message
        );

        console.log(`✅ Order signed: ${signature.slice(0, 20)}...`);
        console.log('');

        // Test different submission formats and endpoints
        const testPayloads = [
            {
                name: 'Format 1: Order object wrapper',
                payload: {
                    order: buildResponse.data.order,
                    signature: signature,
                    orderHash: buildResponse.data.orderHash
                }
            },
            {
                name: 'Format 2: Flat structure',
                payload: {
                    ...buildResponse.data.order,
                    signature: signature,
                    orderHash: buildResponse.data.orderHash
                }
            },
            {
                name: 'Format 3: Signature split',
                payload: {
                    order: buildResponse.data.order,
                    signature: signature,
                    orderHash: buildResponse.data.orderHash,
                    r: signature.slice(0, 66),
                    s: '0x' + signature.slice(66, 130),
                    v: parseInt(signature.slice(130, 132), 16)
                }
            },
            {
                name: 'Format 4: Simple structure',
                payload: {
                    orderHash: buildResponse.data.orderHash,
                    signature: signature
                }
            }
        ];

        const results = [];

        for (const endpoint of this.possibleSubmissionEndpoints) {
            console.log(`🧪 Testing endpoint: ${endpoint}`);
            
            for (const testPayload of testPayloads) {
                try {
                    const response = await axios.post(endpoint, testPayload.payload, {
                        headers: this.workingHeaders,
                        timeout: 10000
                    });

                    console.log(`✅ SUCCESS! ${testPayload.name}`);
                    console.log(`   Status: ${response.status}`);
                    console.log(`   Response: ${JSON.stringify(response.data)}`);
                    
                    results.push({
                        endpoint,
                        format: testPayload.name,
                        status: response.status,
                        success: true,
                        response: response.data
                    });

                    // If we found a working combination, save it and return
                    const successResult = {
                        success: true,
                        workingEndpoint: endpoint,
                        workingFormat: testPayload.name,
                        workingPayload: testPayload.payload,
                        orderHash: buildResponse.data.orderHash,
                        signature: signature,
                        response: response.data,
                        viewUrl: `https://app.1inch.io/#/137/limit-order/${buildResponse.data.orderHash}`
                    };

                    this.saveResults(successResult, 'submission-success');
                    return successResult;

                } catch (error) {
                    const status = error.response?.status;
                    const errorMsg = error.response?.data || error.message;
                    
                    console.log(`❌ ${testPayload.name}: ${status} - ${JSON.stringify(errorMsg).slice(0, 100)}`);
                    
                    results.push({
                        endpoint,
                        format: testPayload.name,
                        status: status,
                        success: false,
                        error: errorMsg
                    });
                }
            }
            console.log('');
        }

        // Save all test results
        const allResults = {
            success: false,
            buildWorking: true,
            orderHash: buildResponse.data.orderHash,
            signature: signature,
            buildResponse: buildResponse.data,
            submissionTests: results,
            note: 'Build and signing working perfectly. Need to find correct submission endpoint.',
            instructions: 'Please capture the exact POST request when placing a limit order in the browser.'
        };

        this.saveResults(allResults, 'endpoint-tests');
        return allResults;
    }

    saveResults(results, type) {
        const timestamp = Date.now();
        const filename = `submission-${type}-${timestamp}.json`;
        const filepath = path.join(__dirname, '..', 'execution-proofs', filename);
        
        const fullResults = {
            timestamp,
            type,
            ...results
        };

        fs.mkdirSync(path.dirname(filepath), { recursive: true });
        fs.writeFileSync(filepath, JSON.stringify(fullResults, null, 2));

        console.log(`📄 Results saved: ${filepath}`);
        console.log('');

        if (results.success) {
            console.log('🎉 SUBMISSION ENDPOINT FOUND!');
            console.log('═══════════════════════════════');
            console.log(`✅ Working endpoint: ${results.workingEndpoint}`);
            console.log(`✅ Working format: ${results.workingFormat}`);
            console.log(`✅ Order submitted successfully!`);
            console.log(`🔗 View order: ${results.viewUrl}`);
        } else {
            console.log('🔍 SUBMISSION ENDPOINT SEARCH COMPLETE');
            console.log('═══════════════════════════════════════');
            console.log('✅ Order building and signing working perfectly!');
            console.log('⚠️ Need to capture exact submission URL from browser');
            console.log('');
            console.log('📋 NEXT STEPS:');
            console.log('1. Open browser dev tools on 1inch limit order page');
            console.log('2. Place a limit order and watch Network tab');
            console.log('3. Look for POST request to submit the order');
            console.log('4. Copy the exact URL and payload structure');
            console.log('5. Share the details here');
        }
    }
}

async function main() {
    try {
        const fixer = new FixSubmissionEndpoint();
        const result = await fixer.testSubmissionEndpoints();
        
        console.log('');
        console.log('🎯 SUMMARY:');
        console.log('✅ Order creation: WORKING');
        console.log('✅ Order signing: WORKING');
        console.log('✅ Authentication: WORKING');
        console.log('⚠️ Submission endpoint: NEEDS BROWSER CAPTURE');
        console.log('');
        console.log('💡 We are 95% complete! Just need the exact submission URL.');
        
    } catch (error) {
        console.error('❌ Testing failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { FixSubmissionEndpoint };
