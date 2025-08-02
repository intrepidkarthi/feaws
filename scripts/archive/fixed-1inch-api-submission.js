const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Import the official 1inch SDK
const { LimitOrder, MakerTraits, Address, randBigInt } = require('@1inch/limit-order-sdk');

require('dotenv').config();

/**
 * FIXED 1inch API Submission
 * Using the correct v3.0 endpoint and format from Reddit example
 */
class Fixed1inchAPISubmission {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        this.chainId = 137; // Polygon
        this.USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        this.WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        this.LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
        
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

    async testCorrectEndpoints() {
        console.log('🔧 TESTING CORRECT API ENDPOINTS');
        console.log('════════════════════════════════════════');
        
        const endpointsToTest = [
            'https://api.1inch.dev/orderbook/v3.0/137',
            'https://api.1inch.io/orderbook/v3.0/137'
        ];

        for (const endpoint of endpointsToTest) {
            try {
                console.log(`🧪 Testing GET ${endpoint}`);
                const response = await axios.get(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                });
                
                console.log(`✅ Success! Status: ${response.status}`);
                if (response.data) {
                    console.log(`📋 Response:`, JSON.stringify(response.data).slice(0, 200));
                }
                
            } catch (error) {
                if (error.response) {
                    console.log(`❌ Status: ${error.response.status} - ${error.response.statusText}`);
                    if (error.response.status === 405) {
                        console.log(`✅ Method not allowed - endpoint exists but needs POST!`);
                    }
                } else {
                    console.log(`💥 Error: ${error.message}`);
                }
            }
        }
        console.log('');
    }

    async createAndSubmitOrder() {
        console.log('🎯 CREATING AND SUBMITTING REAL ORDER');
        console.log('════════════════════════════════════════');

        try {
            // Check balance and approval
            const makerUSDCBalance = await this.makerUSDC.balanceOf(this.makerWallet.address);
            const allowance = await this.makerUSDC.allowance(this.makerWallet.address, this.LOP_CONTRACT);
            
            console.log(`👤 Maker: ${this.makerWallet.address}`);
            console.log(`💰 USDC Balance: ${ethers.formatUnits(makerUSDCBalance, 6)}`);
            console.log(`🔐 Allowance: ${ethers.formatUnits(allowance, 6)}`);
            console.log('');

            // Create order parameters
            const makingAmount = ethers.parseUnits('0.05', 6); // 0.05 USDC
            const takingAmount = ethers.parseUnits('0.25', 18); // 0.25 WMATIC
            const duration = 3600; // 1 hour

            console.log(`📝 Creating order: ${ethers.formatUnits(makingAmount, 6)} USDC → ${ethers.formatUnits(takingAmount, 18)} WMATIC`);

            // Calculate expiration
            const expiresIn = BigInt(duration);
            const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn;
            
            // Create maker traits
            const UINT_40_MAX = (1n << 40n) - 1n;
            const makerTraits = MakerTraits.default()
                .withExpiration(expiration)
                .withNonce(randBigInt(UINT_40_MAX));

            // Create the order
            const order = new LimitOrder({
                makerAsset: new Address(this.USDC_ADDRESS),
                takerAsset: new Address(this.WMATIC_ADDRESS),
                makingAmount: makingAmount.toString(),
                takingAmount: takingAmount.toString(),
                maker: new Address(this.makerWallet.address),
                receiver: new Address('0x0000000000000000000000000000000000000000'),
                salt: randBigInt(UINT_40_MAX)
            }, makerTraits);

            console.log('✅ Order created');

            // Sign the order
            console.log('🔐 Signing order...');
            const typedData = order.getTypedData(this.chainId);
            const signature = await this.makerWallet.signTypedData(
                typedData.domain,
                { Order: typedData.types.Order },
                typedData.message
            );

            console.log('✅ Order signed');

            // Get order hash
            const orderHash = order.getOrderHash(this.chainId);
            console.log(`📋 Order Hash: ${orderHash}`);
            console.log('');

            // Prepare submission data in correct format (from Reddit example)
            const submissionData = {
                orderHash: orderHash,
                signature: signature,
                data: {
                    salt: order.salt.toString(),
                    maker: order.maker.val,
                    receiver: order.receiver.val,
                    makerAsset: order.makerAsset.val,
                    takerAsset: order.takerAsset.val,
                    makingAmount: order.makingAmount.toString(),
                    takingAmount: order.takingAmount.toString(),
                    makerTraits: order.makerTraits.value.toString()
                }
            };

            console.log('📦 Submission data prepared');
            console.log('🚀 Submitting to 1inch API...');

            // Try both v3.0 endpoints
            const endpoints = [
                'https://api.1inch.dev/orderbook/v3.0/137',
                'https://api.1inch.io/orderbook/v3.0/137'
            ];

            let submissionSuccess = false;
            let successResponse = null;

            for (const endpoint of endpoints) {
                try {
                    console.log(`📤 Trying ${endpoint}...`);
                    
                    const response = await axios.post(endpoint, submissionData, {
                        headers: {
                            'accept': 'application/json, text/plain, */*',
                            'content-type': 'application/json',
                            'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`
                        },
                        timeout: 15000
                    });

                    console.log(`🎉 SUCCESS! Order submitted to ${endpoint}`);
                    console.log(`📊 Status: ${response.status}`);
                    console.log(`📋 Response:`, JSON.stringify(response.data, null, 2));

                    submissionSuccess = true;
                    successResponse = response.data;
                    break;

                } catch (error) {
                    console.log(`❌ Failed ${endpoint}:`);
                    if (error.response) {
                        console.log(`   Status: ${error.response.status} - ${error.response.statusText}`);
                        console.log(`   Error:`, JSON.stringify(error.response.data, null, 2));
                    } else {
                        console.log(`   Error: ${error.message}`);
                    }
                }
            }

            // Save results
            const result = {
                timestamp: Date.now(),
                orderHash,
                signature,
                submissionData,
                success: submissionSuccess,
                response: successResponse,
                endpoints: endpoints,
                order: {
                    maker: order.maker.val,
                    makerAsset: order.makerAsset.val,
                    takerAsset: order.takerAsset.val,
                    makingAmount: order.makingAmount.toString(),
                    takingAmount: order.takingAmount.toString(),
                    expiration: expiration.toString(),
                    expirationDate: new Date(Number(expiration) * 1000).toISOString()
                }
            };

            const resultFile = path.join(__dirname, '..', 'execution-proofs', `fixed-api-submission-${Date.now()}.json`);
            fs.mkdirSync(path.dirname(resultFile), { recursive: true });
            fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));

            console.log('');
            console.log('📊 SUBMISSION RESULT:');
            console.log('════════════════════════════════════════');
            if (submissionSuccess) {
                console.log('🎉 SUCCESS! Order submitted to 1inch orderbook!');
                console.log('🔗 Order is now live and can be filled by anyone');
                console.log(`📱 View at: https://app.1inch.io/#/137/limit-order/${orderHash}`);
            } else {
                console.log('❌ Submission failed on all endpoints');
                console.log('✅ But order creation and signing worked perfectly!');
            }
            console.log(`📄 Result saved: ${resultFile}`);

            return result;

        } catch (error) {
            console.error('❌ Process failed:', error.message);
            throw error;
        }
    }

    async run() {
        try {
            await this.testCorrectEndpoints();
            const result = await this.createAndSubmitOrder();
            
            console.log('');
            console.log('🏁 PROCESS COMPLETE!');
            return result;
            
        } catch (error) {
            console.error('❌ Run failed:', error.message);
            throw error;
        }
    }
}

async function main() {
    try {
        const fixer = new Fixed1inchAPISubmission();
        await fixer.run();
        
    } catch (error) {
        console.error('❌ Execution failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { Fixed1inchAPISubmission };
