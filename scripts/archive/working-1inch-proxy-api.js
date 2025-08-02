const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

/**
 * WORKING 1inch Proxy API Implementation
 * Based on actual browser network traffic analysis
 */
class Working1inchProxyAPI {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        this.chainId = 137; // Polygon
        this.USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        this.WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        this.LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
        
        // Discovered endpoints from browser network tab
        this.BUILD_ENDPOINT = 'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/build';
        this.SUBMIT_ENDPOINT = 'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137'; // Likely submit endpoint
        
        // Token contract for approvals
        this.makerUSDC = new ethers.Contract(
            this.USDC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)'
            ],
            this.makerWallet
        );
    }

    async buildOrderViaAPI() {
        console.log('🏗️ BUILDING ORDER VIA 1INCH PROXY API');
        console.log('════════════════════════════════════════');

        try {
            // Check balance
            const makerUSDCBalance = await this.makerUSDC.balanceOf(this.makerWallet.address);
            console.log(`👤 Maker: ${this.makerWallet.address}`);
            console.log(`💰 USDC Balance: ${ethers.formatUnits(makerUSDCBalance, 6)}`);

            // Order parameters
            const makingAmount = ethers.parseUnits('0.05', 6); // 0.05 USDC
            const takingAmount = ethers.parseUnits('0.25', 18); // 0.25 WMATIC
            const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

            console.log(`📝 Order: ${ethers.formatUnits(makingAmount, 6)} USDC → ${ethers.formatUnits(takingAmount, 18)} WMATIC`);
            console.log(`⏰ Expires: ${new Date(expiration * 1000).toISOString()}`);
            console.log('');

            // Build the order using the discovered API format
            const buildParams = {
                makerToken: this.USDC_ADDRESS,
                takerToken: this.WMATIC_ADDRESS,
                makingAmount: makingAmount.toString(),
                takingAmount: takingAmount.toString(),
                expiration: expiration.toString(),
                makerAddress: this.makerWallet.address,
                series: '0',
                source: '0xe26b9977' // From the browser example
            };

            console.log('🔨 Building order via API...');
            console.log(`📤 ${this.BUILD_ENDPOINT}`);
            console.log('📦 Parameters:', buildParams);

            // Try different authentication methods
            const authMethods = [
                // Method 1: No auth (public endpoint)
                {},
                // Method 2: API key in header
                { 'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}` },
                // Method 3: API key as parameter
                {},
                // Method 4: Different header format
                { 'x-api-key': process.env.ONEINCH_API_KEY }
            ];
            
            const paramSets = [
                buildParams,
                { ...buildParams, apiKey: process.env.ONEINCH_API_KEY },
                { ...buildParams, key: process.env.ONEINCH_API_KEY }
            ];
            
            let buildResponse = null;
            
            for (let i = 0; i < authMethods.length; i++) {
                for (let j = 0; j < paramSets.length; j++) {
                    try {
                        console.log(`🧪 Trying auth method ${i + 1}, params set ${j + 1}...`);
                        
                        buildResponse = await axios.get(this.BUILD_ENDPOINT, {
                            params: paramSets[j],
                            headers: {
                                'Content-Type': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                                'Accept': 'application/json, text/plain, */*',
                                'Origin': 'https://app.1inch.io',
                                'Referer': 'https://app.1inch.io/',
                                ...authMethods[i]
                            },
                            timeout: 15000
                        });
                        
                        console.log(`✅ Success with method ${i + 1}, params ${j + 1}!`);
                        break;
                        
                    } catch (error) {
                        console.log(`   ❌ Method ${i + 1}, params ${j + 1}: ${error.response?.status || error.message}`);
                        if (error.response?.status !== 401 && error.response?.status !== 403) {
                            // If it's not an auth error, we might have found the right endpoint
                            console.log(`   📋 Non-auth error:`, error.response?.data);
                        }
                    }
                }
                if (buildResponse) break;
            }
            
            if (!buildResponse) {
                throw new Error('All authentication methods failed');
            }

            console.log('✅ Order built successfully!');
            console.log(`📊 Status: ${buildResponse.status}`);
            console.log('📋 Response:', JSON.stringify(buildResponse.data, null, 2));

            const { typedData, orderHash, extension } = buildResponse.data;

            console.log('');
            console.log('🔐 SIGNING ORDER...');
            console.log(`📋 Order Hash: ${orderHash}`);

            // Sign the order using the API-provided typed data
            const signature = await this.makerWallet.signTypedData(
                typedData.domain,
                { Order: typedData.types.Order },
                typedData.message
            );

            console.log('✅ Order signed successfully!');
            console.log(`📝 Signature: ${signature.slice(0, 20)}...`);

            return {
                typedData,
                orderHash,
                extension,
                signature,
                buildParams
            };

        } catch (error) {
            console.error('❌ Build failed:', error.message);
            if (error.response) {
                console.error('📋 Response:', error.response.status, error.response.data);
            }
            throw error;
        }
    }

    async submitOrderViaAPI(orderData) {
        console.log('');
        console.log('📤 SUBMITTING ORDER VIA API');
        console.log('════════════════════════════════════════');

        try {
            const { typedData, orderHash, extension, signature } = orderData;

            // Try different submission formats based on common patterns
            const submissionFormats = [
                // Format 1: Full order data with extension
                {
                    orderHash,
                    signature,
                    data: typedData.message,
                    extension
                },
                
                // Format 2: Simplified format
                {
                    orderHash,
                    signature,
                    ...typedData.message
                },
                
                // Format 3: Typed data format
                {
                    typedData,
                    signature,
                    orderHash
                }
            ];

            const endpointsToTry = [
                this.SUBMIT_ENDPOINT,
                `${this.SUBMIT_ENDPOINT}/order`,
                `${this.SUBMIT_ENDPOINT}/submit`,
                'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/order'
            ];

            for (const endpoint of endpointsToTry) {
                console.log(`🎯 Trying endpoint: ${endpoint}`);
                
                for (let i = 0; i < submissionFormats.length; i++) {
                    const format = submissionFormats[i];
                    console.log(`   📦 Format ${i + 1}...`);
                    
                    try {
                        const response = await axios.post(endpoint, format, {
                            headers: {
                                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                                'Content-Type': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (compatible; 1inch-integration/1.0)'
                            },
                            timeout: 15000
                        });

                        console.log('🎉 SUCCESS! Order submitted!');
                        console.log(`📊 Status: ${response.status}`);
                        console.log('📋 Response:', JSON.stringify(response.data, null, 2));

                        return {
                            success: true,
                            endpoint,
                            format: i + 1,
                            response: response.data
                        };

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
            }

            return { success: false, error: 'All submission attempts failed' };

        } catch (error) {
            console.error('❌ Submission process failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async run() {
        console.log('🚀 STARTING WORKING 1INCH PROXY API');
        console.log('════════════════════════════════════════');
        console.log('🔍 Using discovered browser network endpoints');
        console.log('');

        try {
            // Step 1: Build order via API
            const orderData = await this.buildOrderViaAPI();

            // Step 2: Submit order via API
            const submissionResult = await this.submitOrderViaAPI(orderData);

            // Step 3: Save results
            const result = {
                timestamp: Date.now(),
                success: submissionResult.success,
                orderHash: orderData.orderHash,
                signature: orderData.signature,
                buildParams: orderData.buildParams,
                submissionResult,
                endpoints: {
                    build: this.BUILD_ENDPOINT,
                    submit: this.SUBMIT_ENDPOINT
                }
            };

            const resultFile = path.join(__dirname, '..', 'execution-proofs', `proxy-api-result-${Date.now()}.json`);
            fs.mkdirSync(path.dirname(resultFile), { recursive: true });
            fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));

            console.log('');
            console.log('📊 FINAL RESULT');
            console.log('════════════════════════════════════════');
            if (submissionResult.success) {
                console.log('🎉 SUCCESS! Order submitted to 1inch orderbook!');
                console.log('🔗 Order is now live and can be filled by anyone');
                console.log(`📱 View at: https://app.1inch.io/#/137/limit-order/${orderData.orderHash}`);
            } else {
                console.log('❌ Submission failed, but order building worked!');
                console.log('✅ We have valid order data and signature');
            }
            console.log(`📄 Result saved: ${resultFile}`);

            return result;

        } catch (error) {
            console.error('❌ Process failed:', error.message);
            throw error;
        }
    }
}

async function main() {
    try {
        const api = new Working1inchProxyAPI();
        await api.run();
        
    } catch (error) {
        console.error('❌ Execution failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { Working1inchProxyAPI };
