const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

/**
 * DEBUG ORDER STRUCTURE
 * 
 * Let's examine the exact structure returned by the build endpoint
 * to understand how to format it for the official API
 */
class DebugOrderStructure {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        // Working build endpoint
        this.BUILD_ENDPOINT = 'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/build';
        
        // Working headers
        this.buildHeaders = {
            'accept': 'application/json, text/plain, */*',
            'authorization': 'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbiI6ImJjZjAyYTg0LTQwZTQtNDczOS04OTQwLWMzYjNiYjQ1YzRkMCIsImV4cCI6MTc1NDExMjk0MSwiZGV2aWNlIjoiYnJvd3NlciIsImlhdCI6MTc1NDEwOTM0MX0.SpmFemNXbI0CRVhfjcPUqZDVT57fWkGcazPagAWKRs5FdzhtZBQzLdzEzBZ5tReQ2Hcgjh4O1CEu2qp2jyWYmQ',
            'referer': 'https://app.1inch.io/',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-session-id': '5f7137d6-d217-46d6-8cc2-c823057b0b9d',
            'x-user-id': '4d244981-3a27-4a92-890c-594dceee7804'
        };
    }

    async debugBuildResponse() {
        console.log('🔍 DEBUGGING BUILD RESPONSE STRUCTURE');
        console.log('═══════════════════════════════════════');
        console.log('🎯 Examining exact response from build endpoint');
        console.log('');

        try {
            const buildParams = {
                makerToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
                takerToken: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',   // USDT
                makingAmount: ethers.parseUnits('0.01', 18).toString(),
                takingAmount: ethers.parseUnits('0.02', 6).toString(),
                expiration: Math.floor(Date.now() / 1000) + 3600,
                makerAddress: this.makerWallet.address,
                series: '0',
                source: '0xe26b9977'
            };

            console.log('📋 Build parameters:');
            console.log(JSON.stringify(buildParams, null, 2));
            console.log('');

            const buildResponse = await axios.get(this.BUILD_ENDPOINT, {
                params: buildParams,
                headers: this.buildHeaders,
                timeout: 15000
            });

            console.log('✅ Build response received!');
            console.log('📊 Full response structure:');
            console.log(JSON.stringify(buildResponse.data, null, 2));
            console.log('');

            // Analyze the structure
            console.log('🔍 STRUCTURE ANALYSIS:');
            console.log('═══════════════════════');
            
            const data = buildResponse.data;
            
            console.log(`📋 Order Hash: ${data.orderHash || 'NOT FOUND'}`);
            console.log(`📋 Has order property: ${!!data.order}`);
            console.log(`📋 Has typedData property: ${!!data.typedData}`);
            console.log('');

            if (data.order) {
                console.log('📦 Order object structure:');
                console.log(JSON.stringify(data.order, null, 2));
                console.log('');
            }

            if (data.typedData) {
                console.log('📝 TypedData structure:');
                console.log('Domain:', JSON.stringify(data.typedData.domain, null, 2));
                console.log('Types:', JSON.stringify(data.typedData.types, null, 2));
                console.log('Message:', JSON.stringify(data.typedData.message, null, 2));
                console.log('');
            }

            // Try to extract order data from typedData.message if order property doesn't exist
            let orderData = data.order;
            if (!orderData && data.typedData && data.typedData.message) {
                console.log('🔄 Order data not in .order, checking .typedData.message...');
                orderData = data.typedData.message;
                console.log('📦 Order data from typedData.message:');
                console.log(JSON.stringify(orderData, null, 2));
                console.log('');
            }

            // Create the official API payload structure
            if (orderData) {
                console.log('🏗️ CREATING OFFICIAL API PAYLOAD:');
                console.log('═══════════════════════════════════');

                const officialPayload = {
                    orderHash: data.orderHash,
                    signature: "0x_PLACEHOLDER_SIGNATURE_",
                    data: {
                        makerAsset: orderData.makerAsset || orderData.makerToken,
                        takerAsset: orderData.takerAsset || orderData.takerToken,
                        maker: orderData.maker,
                        receiver: orderData.receiver || "0x0000000000000000000000000000000000000000",
                        makingAmount: orderData.makingAmount,
                        takingAmount: orderData.takingAmount,
                        salt: orderData.salt,
                        extension: orderData.extension || "0x",
                        makerTraits: orderData.makerTraits || "0"
                    }
                };

                console.log('📋 Official payload structure:');
                console.log(JSON.stringify(officialPayload, null, 2));
                console.log('');

                // Validate all required fields
                console.log('✅ VALIDATION CHECK:');
                console.log('═══════════════════');
                
                const required = ['makerAsset', 'takerAsset', 'maker', 'makingAmount', 'takingAmount', 'salt'];
                let allValid = true;
                
                for (const field of required) {
                    const value = officialPayload.data[field];
                    const isValid = value && value !== 'undefined';
                    console.log(`${isValid ? '✅' : '❌'} ${field}: ${value || 'MISSING'}`);
                    if (!isValid) allValid = false;
                }

                console.log('');
                console.log(`🎯 Payload ready for submission: ${allValid ? '✅ YES' : '❌ NO'}`);

                if (allValid) {
                    console.log('');
                    console.log('🚀 READY FOR REAL SUBMISSION!');
                    console.log('═══════════════════════════════');
                    console.log('✅ Order structure understood');
                    console.log('✅ Official API payload created');
                    console.log('✅ All required fields present');
                    console.log('');
                    console.log('💡 Next step: Sign and submit this payload to official API');
                }

                return {
                    success: true,
                    buildResponse: data,
                    orderData: orderData,
                    officialPayload: officialPayload,
                    valid: allValid
                };
            } else {
                console.log('❌ Could not find order data in response');
                return { success: false, buildResponse: data };
            }

        } catch (error) {
            console.error('❌ Debug failed:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            throw error;
        }
    }
}

async function main() {
    try {
        const debugger = new DebugOrderStructure();
        const result = await debugger.debugBuildResponse();
        
        if (result.success && result.valid) {
            console.log('🎉 STRUCTURE ANALYSIS COMPLETE!');
            console.log('Ready to implement real submission with correct structure.');
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { DebugOrderStructure };
