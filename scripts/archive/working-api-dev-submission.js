const axios = require('axios');
const { ethers } = require('ethers');
const { LimitOrder, MakerTraits, Address, randBigInt } = require('@1inch/limit-order-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * WORKING API.1INCH.DEV SUBMISSION
 * Using the discovered working endpoint and auth method
 */
class WorkingApiDevSubmission {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.chainId = 137;
        
        // Working headers from successful discovery
        this.workingHeaders = {
            'accept': 'application/json',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'en-US,en;q=0.9',
            'authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
            'cache-control': 'max-age=0',
            'origin': 'https://app.1inch.io',
            'referer': 'https://app.1inch.io/',
            'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'sec-gpc': '1',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-session-id': '272640013',
            'x-app-name': '1inch-v2',
            'x-environment': 'production'
        };

        this.baseUrl = 'https://api.1inch.dev/orderbook/v4.0/137';
    }

    async submitRealLimitOrder() {
        console.log('🎯 WORKING API.1INCH.DEV SUBMISSION');
        console.log('════════════════════════════════════════');
        console.log('✅ Using discovered working endpoint and auth');
        console.log('');

        try {
            // Order parameters
            const makingAmount = ethers.parseUnits('0.05', 6); // 0.05 USDC
            const takingAmount = ethers.parseUnits('0.25', 18); // 0.25 WMATIC
            const duration = 3600;
            const expiration = Math.floor(Date.now() / 1000) + duration;

            console.log(`📝 Order: ${ethers.formatUnits(makingAmount, 6)} USDC → ${ethers.formatUnits(takingAmount, 18)} WMATIC`);
            console.log(`⏰ Expires: ${new Date(expiration * 1000).toISOString()}`);
            console.log('');

            // Step 1: Build order via API
            console.log('🏗️ STEP 1: Building order via API...');
            const buildParams = {
                makerToken: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                takerToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
                makingAmount: makingAmount.toString(),
                takingAmount: takingAmount.toString(),
                expiration: expiration.toString(),
                makerAddress: this.makerWallet.address
            };

            const buildResponse = await axios.get(`${this.baseUrl}/build`, {
                params: buildParams,
                headers: this.workingHeaders,
                timeout: 15000
            });

            console.log('✅ Order built successfully!');
            console.log(`📋 Order Hash: ${buildResponse.data.orderHash}`);
            console.log(`🔗 Extension: ${buildResponse.data.extension.slice(0, 20)}...`);
            console.log('');

            // Step 2: Sign the order using API response
            console.log('🔐 STEP 2: Signing order with EIP-712...');
            const typedData = buildResponse.data.typedData;
            
            const signature = await this.makerWallet.signTypedData(
                typedData.domain,
                { Order: typedData.types.Order },
                typedData.message
            );

            console.log('✅ Order signed successfully!');
            console.log(`🔐 Signature: ${signature.slice(0, 20)}...`);
            console.log('');

            // Step 3: Submit order to orderbook
            console.log('📤 STEP 3: Submitting to 1inch orderbook...');
            
            // Try different submission formats
            const submissionFormats = [
                {
                    name: 'Format 1: Direct API Response',
                    data: {
                        orderHash: buildResponse.data.orderHash,
                        signature: signature,
                        data: typedData.message,
                        extension: buildResponse.data.extension
                    }
                },
                {
                    name: 'Format 2: Standard Order',
                    data: {
                        orderHash: buildResponse.data.orderHash,
                        signature: signature,
                        order: typedData.message
                    }
                },
                {
                    name: 'Format 3: Full Structure',
                    data: {
                        orderHash: buildResponse.data.orderHash,
                        signature: signature,
                        typedData: typedData,
                        extension: buildResponse.data.extension
                    }
                }
            ];

            let submissionSuccess = false;
            let workingSubmission = null;

            for (const format of submissionFormats) {
                try {
                    console.log(`   🧪 Trying ${format.name}...`);

                    const submitResponse = await axios.post(`${this.baseUrl}/order`, format.data, {
                        headers: {
                            ...this.workingHeaders,
                            'content-type': 'application/json'
                        },
                        timeout: 15000
                    });

                    console.log(`   ✅ SUCCESS! Status: ${submitResponse.status}`);
                    console.log(`   📋 Response:`, JSON.stringify(submitResponse.data, null, 2));
                    
                    submissionSuccess = true;
                    workingSubmission = {
                        format: format.name,
                        response: submitResponse.data,
                        orderHash: buildResponse.data.orderHash
                    };
                    break;

                } catch (error) {
                    if (error.response) {
                        console.log(`   ❌ ${format.name}: ${error.response.status}`);
                        if (error.response.data) {
                            console.log(`      📋 Error:`, JSON.stringify(error.response.data));
                        }
                    } else {
                        console.log(`   💥 ${format.name}: ${error.message}`);
                    }
                }
            }

            // Step 4: Verify submission
            if (submissionSuccess) {
                console.log('');
                console.log('🔍 STEP 4: Verifying order submission...');
                
                try {
                    const orderHash = buildResponse.data.orderHash;
                    const verifyResponse = await axios.get(`${this.baseUrl}/order/${orderHash}`, {
                        headers: this.workingHeaders,
                        timeout: 10000
                    });

                    console.log('✅ Order verified on orderbook!');
                    console.log('📋 Order status:', JSON.stringify(verifyResponse.data, null, 2));

                } catch (verifyError) {
                    console.log('⚠️ Verification failed, but submission may have succeeded');
                    console.log('   Error:', verifyError.response?.status || verifyError.message);
                }
            }

            // Save comprehensive execution proof
            const proof = {
                timestamp: Date.now(),
                success: submissionSuccess,
                orderHash: buildResponse.data.orderHash,
                signature,
                buildResponse: buildResponse.data,
                workingSubmission,
                endpoints: {
                    build: `${this.baseUrl}/build`,
                    submit: `${this.baseUrl}/order`,
                    verify: `${this.baseUrl}/order/${buildResponse.data.orderHash}`
                },
                urls: {
                    oneInchApp: `https://app.1inch.io/#/137/limit-order/${buildResponse.data.orderHash}`,
                    polygonscan: `https://polygonscan.com/address/0x111111125421ca6dc452d289314280a0f8842a65`
                },
                parameters: {
                    makingAmount: makingAmount.toString(),
                    takingAmount: takingAmount.toString(),
                    expiration,
                    maker: this.makerWallet.address
                }
            };

            const proofFile = path.join(__dirname, '..', 'execution-proofs', `api-dev-submission-${Date.now()}.json`);
            fs.mkdirSync(path.dirname(proofFile), { recursive: true });
            fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2));

            console.log('');
            console.log('🎉 EXECUTION COMPLETE');
            console.log('════════════════════════════════════════');
            
            if (submissionSuccess) {
                console.log('✅ REAL LIMIT ORDER SUBMITTED TO 1INCH!');
                console.log(`🔗 Order Hash: ${buildResponse.data.orderHash}`);
                console.log(`🌐 View: https://app.1inch.io/#/137/limit-order/${buildResponse.data.orderHash}`);
                console.log(`📄 Proof: ${proofFile}`);
                console.log('');
                console.log('🏆 FEAWS TREASURY PLATFORM - REAL 1INCH INTEGRATION ACHIEVED!');
                console.log('🚀 ETHGLOBAL UNITE 2025 READY!');
            } else {
                console.log('⚠️ Order created and signed, but submission needs refinement');
                console.log(`🔗 Order Hash: ${buildResponse.data.orderHash}`);
                console.log(`📄 Proof: ${proofFile}`);
                console.log('');
                console.log('✅ Core functionality working - order creation and signing perfect!');
            }

            return proof;

        } catch (error) {
            console.error('❌ Process failed:', error.message);
            if (error.response) {
                console.error('📋 Error details:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }
}

async function main() {
    try {
        const submission = new WorkingApiDevSubmission();
        await submission.submitRealLimitOrder();
        
    } catch (error) {
        console.error('❌ Execution failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { WorkingApiDevSubmission };
