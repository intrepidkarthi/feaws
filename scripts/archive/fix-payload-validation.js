const { ethers } = require('ethers');
const { LimitOrder, MakerTraits, Address, randBigInt } = require('@1inch/limit-order-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * FIX PAYLOAD VALIDATION
 * 
 * Debug and fix every single payload parameter to ensure
 * proper formatting for the official 1inch API
 */
class FixPayloadValidation {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.chainId = 137; // Polygon
        
        // Token addresses
        this.WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        this.USDT_ADDRESS = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
        
        // Official API endpoint
        this.OFFICIAL_ENDPOINT = 'https://api.1inch.dev/orderbook/v4.0/137';
        
        // API configuration
        this.apiConfig = {
            headers: {
                Authorization: `Bearer ${process.env.ONEINCH_API_KEY}`,
                'Content-Type': 'application/json'
            },
            params: {},
            paramsSerializer: {
                indexes: null,
            },
        };
    }

    validateAndFixPayload(orderHash, signature, order) {
        console.log('🔍 VALIDATING AND FIXING PAYLOAD PARAMETERS');
        console.log('═══════════════════════════════════════════');
        
        // Helper function to ensure string format
        const ensureString = (value, name) => {
            if (typeof value === 'object' && value !== null) {
                if (value.toString && typeof value.toString === 'function') {
                    const stringValue = value.toString();
                    console.log(`🔧 Fixed ${name}: object -> "${stringValue}"`);
                    return stringValue;
                } else if (value.value !== undefined) {
                    const stringValue = value.value.toString();
                    console.log(`🔧 Fixed ${name}: object.value -> "${stringValue}"`);
                    return stringValue;
                } else {
                    console.log(`❌ ${name}: Cannot convert object to string`, value);
                    return "0";
                }
            } else if (typeof value === 'bigint') {
                const stringValue = value.toString();
                console.log(`🔧 Fixed ${name}: bigint -> "${stringValue}"`);
                return stringValue;
            } else if (typeof value === 'number') {
                const stringValue = value.toString();
                console.log(`🔧 Fixed ${name}: number -> "${stringValue}"`);
                return stringValue;
            } else if (typeof value === 'string') {
                console.log(`✅ ${name}: already string -> "${value}"`);
                return value;
            } else {
                console.log(`❌ ${name}: unknown type ${typeof value}`, value);
                return "0";
            }
        };

        // Helper function to ensure address format
        const ensureAddress = (value, name) => {
            let address;
            if (typeof value === 'object' && value !== null) {
                if (value.val) {
                    address = value.val;
                } else if (value.toString && typeof value.toString === 'function') {
                    address = value.toString();
                } else {
                    console.log(`❌ ${name}: Cannot extract address from object`, value);
                    return "0x0000000000000000000000000000000000000000";
                }
            } else {
                address = value;
            }

            // Validate address format
            if (typeof address === 'string' && address.match(/^0x[a-fA-F0-9]{40}$/)) {
                console.log(`✅ ${name}: valid address -> "${address}"`);
                return address.toLowerCase();
            } else {
                console.log(`❌ ${name}: invalid address format "${address}"`);
                return "0x0000000000000000000000000000000000000000";
            }
        };

        console.log('');
        console.log('📋 RAW ORDER DATA:');
        console.log('makerAsset:', typeof order.makerAsset, order.makerAsset);
        console.log('takerAsset:', typeof order.takerAsset, order.takerAsset);
        console.log('maker:', typeof order.maker, order.maker);
        console.log('receiver:', typeof order.receiver, order.receiver);
        console.log('makingAmount:', typeof order.makingAmount, order.makingAmount);
        console.log('takingAmount:', typeof order.takingAmount, order.takingAmount);
        console.log('salt:', typeof order.salt, order.salt);
        console.log('makerTraits:', typeof order.makerTraits, order.makerTraits);
        console.log('');

        // Fix each parameter
        const fixedPayload = {
            orderHash: ensureString(orderHash, 'orderHash'),
            signature: ensureString(signature, 'signature'),
            data: {
                makerAsset: ensureAddress(order.makerAsset, 'makerAsset'),
                takerAsset: ensureAddress(order.takerAsset, 'takerAsset'),
                maker: ensureAddress(order.maker, 'maker'),
                receiver: ensureAddress(order.receiver, 'receiver'),
                makingAmount: ensureString(order.makingAmount, 'makingAmount'),
                takingAmount: ensureString(order.takingAmount, 'takingAmount'),
                salt: ensureString(order.salt, 'salt'),
                extension: "0x", // Always string
                makerTraits: ensureString(order.makerTraits, 'makerTraits')
            }
        };

        console.log('');
        console.log('✅ FIXED PAYLOAD:');
        console.log(JSON.stringify(fixedPayload, null, 2));
        console.log('');

        // Final validation
        console.log('🔍 FINAL VALIDATION:');
        console.log('═══════════════════');
        
        const validations = [
            { name: 'orderHash', value: fixedPayload.orderHash, check: v => typeof v === 'string' && v.length > 0 },
            { name: 'signature', value: fixedPayload.signature, check: v => typeof v === 'string' && v.startsWith('0x') },
            { name: 'makerAsset', value: fixedPayload.data.makerAsset, check: v => v.match(/^0x[a-fA-F0-9]{40}$/) },
            { name: 'takerAsset', value: fixedPayload.data.takerAsset, check: v => v.match(/^0x[a-fA-F0-9]{40}$/) },
            { name: 'maker', value: fixedPayload.data.maker, check: v => v.match(/^0x[a-fA-F0-9]{40}$/) },
            { name: 'receiver', value: fixedPayload.data.receiver, check: v => v.match(/^0x[a-fA-F0-9]{40}$/) },
            { name: 'makingAmount', value: fixedPayload.data.makingAmount, check: v => typeof v === 'string' && !isNaN(v) && v !== '0' },
            { name: 'takingAmount', value: fixedPayload.data.takingAmount, check: v => typeof v === 'string' && !isNaN(v) && v !== '0' },
            { name: 'salt', value: fixedPayload.data.salt, check: v => typeof v === 'string' && !isNaN(v) },
            { name: 'extension', value: fixedPayload.data.extension, check: v => typeof v === 'string' },
            { name: 'makerTraits', value: fixedPayload.data.makerTraits, check: v => typeof v === 'string' && !isNaN(v) }
        ];

        let allValid = true;
        validations.forEach(({ name, value, check }) => {
            const isValid = check(value);
            console.log(`${isValid ? '✅' : '❌'} ${name}: ${value} (${typeof value})`);
            if (!isValid) allValid = false;
        });

        console.log('');
        console.log(`🎯 Payload validation: ${allValid ? '✅ PASSED' : '❌ FAILED'}`);

        return { fixedPayload, allValid };
    }

    async createAndSubmitFixedOrder() {
        console.log('🚀 CREATING ORDER WITH FIXED PAYLOAD VALIDATION');
        console.log('═══════════════════════════════════════════════');
        console.log('🔧 Ensuring all parameters are properly formatted');
        console.log('');

        try {
            // Step 1: Create order using official SDK
            console.log('🏗️ CREATING ORDER WITH OFFICIAL SDK...');
            
            const makingAmount = ethers.parseUnits('0.005', 18); // 0.005 WMATIC
            const takingAmount = ethers.parseUnits('0.01', 6);   // 0.01 USDT
            const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour

            const UINT_40_MAX = (1n << 40n) - 1n;
            const makerTraits = MakerTraits.default()
                .withExpiration(BigInt(expiration))
                .withNonce(randBigInt(UINT_40_MAX));

            const order = new LimitOrder({
                makerAsset: new Address(this.WMATIC_ADDRESS),
                takerAsset: new Address(this.USDT_ADDRESS),
                makingAmount: makingAmount.toString(),
                takingAmount: takingAmount.toString(),
                maker: new Address(this.makerWallet.address),
                receiver: new Address('0x0000000000000000000000000000000000000000'),
                salt: randBigInt(UINT_40_MAX)
            }, makerTraits);

            console.log('📋 ORDER CREATED:');
            console.log(`   Making: ${ethers.formatUnits(makingAmount, 18)} WMATIC`);
            console.log(`   Taking: ${ethers.formatUnits(takingAmount, 6)} USDT`);
            console.log(`   Expires: ${new Date(expiration * 1000).toISOString()}`);
            console.log('');

            // Step 2: Sign the order
            console.log('🔐 SIGNING ORDER...');
            const typedData = order.getTypedData(this.chainId);
            const signature = await this.makerWallet.signTypedData(
                typedData.domain,
                { Order: typedData.types.Order },
                typedData.message
            );

            const orderHash = order.getOrderHash(this.chainId);
            console.log(`✅ Order Hash: ${orderHash}`);
            console.log(`✅ Signature: ${signature.slice(0, 20)}...`);
            console.log('');

            // Step 3: Validate and fix payload
            const { fixedPayload, allValid } = this.validateAndFixPayload(orderHash, signature, order);

            if (!allValid) {
                throw new Error('Payload validation failed');
            }

            // Step 4: Submit to official API
            console.log('🚀 SUBMITTING FIXED PAYLOAD TO OFFICIAL API...');
            console.log(`📡 POST ${this.OFFICIAL_ENDPOINT}`);

            try {
                const response = await axios.post(this.OFFICIAL_ENDPOINT, fixedPayload, this.apiConfig);
                
                console.log('🎉 SUBMISSION SUCCESS!');
                console.log('═══════════════════════');
                console.log(`✅ Status: ${response.status}`);
                console.log(`📋 Response:`, response.data);
                console.log('');
                console.log(`🔗 View order: https://app.1inch.io/#/137/limit-order/${orderHash}`);

                const successResult = {
                    success: true,
                    orderHash: orderHash,
                    signature: signature,
                    fixedPayload: fixedPayload,
                    submissionResponse: response.data,
                    viewUrl: `https://app.1inch.io/#/137/limit-order/${orderHash}`
                };

                this.saveResults(successResult, 'fixed-success');
                return successResult;

            } catch (apiError) {
                console.log('❌ API SUBMISSION FAILED:');
                console.log(`Status: ${apiError.response?.status || 'No response'}`);
                console.log(`Error: ${JSON.stringify(apiError.response?.data || apiError.message, null, 2)}`);
                
                if (apiError.response?.data) {
                    console.log('');
                    console.log('🔍 DETAILED ERROR ANALYSIS:');
                    const errorData = apiError.response.data;
                    if (errorData.message) {
                        console.log(`Message: ${errorData.message}`);
                    }
                    if (errorData.errors) {
                        console.log('Validation errors:', errorData.errors);
                    }
                    if (errorData.details) {
                        console.log('Details:', errorData.details);
                    }
                }

                const failureResult = {
                    success: false,
                    orderHash: orderHash,
                    signature: signature,
                    fixedPayload: fixedPayload,
                    submissionError: apiError.response?.data || apiError.message,
                    note: 'Payload properly formatted but API submission failed'
                };

                this.saveResults(failureResult, 'fixed-failure');
                return failureResult;
            }

        } catch (error) {
            console.error('❌ Process failed:', error.message);
            throw error;
        }
    }

    saveResults(results, type) {
        const timestamp = Date.now();
        const filename = `payload-fix-${type}-${timestamp}.json`;
        const filepath = path.join(__dirname, '..', 'execution-proofs', filename);
        
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
        fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

        console.log(`📄 Results saved: ${filepath}`);
    }
}

async function main() {
    try {
        const fixer = new FixPayloadValidation();
        const result = await fixer.createAndSubmitFixedOrder();
        
        console.log('');
        console.log('🎯 PAYLOAD VALIDATION COMPLETE!');
        if (result.success) {
            console.log('🎉 Order submitted successfully with fixed payload!');
        } else {
            console.log('⚠️ Payload fixed but submission needs further debugging');
        }
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { FixPayloadValidation };
