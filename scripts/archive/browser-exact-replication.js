const axios = require('axios');
const { ethers } = require('ethers');
const { LimitOrder, MakerTraits, Address, randBigInt } = require('@1inch/limit-order-sdk');
require('dotenv').config();

/**
 * EXACT BROWSER REPLICATION
 * Using the exact headers and patterns from your browser discovery
 */
class BrowserExactReplication {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.chainId = 137;
        
        // Exact browser headers from your discovery
        this.browserHeaders = {
            'accept': 'application/json',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'en-US,en;q=0.9',
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
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
        };
        
        // Try different auth combinations
        this.authMethods = [
            // Method 1: Unleash auth format
            {
                name: 'Unleash Auth',
                headers: {
                    'authorization': '1inch-v2:production.a9fa089671657f45d864d999f16c11f1d4723aa7f9930379d81591d0'
                }
            },
            // Method 2: Bearer token with unleash session
            {
                name: 'Bearer + Session',
                headers: {
                    'authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                    'x-session-id': '272640013',
                    'x-app-name': '1inch-v2',
                    'x-environment': 'production'
                }
            },
            // Method 3: Combined auth
            {
                name: 'Combined Auth',
                headers: {
                    'authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                    'x-1inch-auth': '1inch-v2:production.a9fa089671657f45d864d999f16c11f1d4723aa7f9930379d81591d0'
                }
            },
            // Method 4: JWT-style (since proxy-jwt-validation is enabled)
            {
                name: 'JWT Style',
                headers: {
                    'authorization': 'Bearer 1inch-v2:production.a9fa089671657f45d864d999f16c11f1d4723aa7f9930379d81591d0'
                }
            }
        ];
    }

    async createOrderAndSubmit() {
        console.log('🎯 BROWSER EXACT REPLICATION');
        console.log('════════════════════════════════════════');
        console.log('🔍 Using exact browser headers and auth patterns');
        console.log('');

        try {
            // Create order first
            console.log('🏗️ Creating limit order...');
            
            const makingAmount = ethers.parseUnits('0.05', 6); // 0.05 USDC
            const takingAmount = ethers.parseUnits('0.25', 18); // 0.25 WMATIC
            const duration = 3600;
            const expiration = BigInt(Math.floor(Date.now() / 1000)) + BigInt(duration);
            const UINT_40_MAX = (1n << 40n) - 1n;
            
            const makerTraits = MakerTraits.default()
                .withExpiration(expiration)
                .withNonce(randBigInt(UINT_40_MAX));

            const order = new LimitOrder({
                makerAsset: new Address('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'),
                takerAsset: new Address('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'),
                makingAmount: makingAmount.toString(),
                takingAmount: takingAmount.toString(),
                maker: new Address(this.makerWallet.address),
                receiver: new Address('0x0000000000000000000000000000000000000000'),
                salt: randBigInt(UINT_40_MAX)
            }, makerTraits);

            // Sign the order
            const typedData = order.getTypedData(this.chainId);
            const signature = await this.makerWallet.signTypedData(
                typedData.domain,
                { Order: typedData.types.Order },
                typedData.message
            );

            const orderHash = order.getOrderHash(this.chainId);
            console.log(`✅ Order created: ${orderHash}`);
            console.log('');

            // Test different API endpoints with browser-exact patterns
            const endpoints = [
                {
                    name: 'Proxy Build',
                    url: 'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/build',
                    method: 'GET',
                    params: {
                        makerToken: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                        takerToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
                        makingAmount: makingAmount.toString(),
                        takingAmount: takingAmount.toString(),
                        expiration: expiration.toString(),
                        makerAddress: this.makerWallet.address,
                        series: '0',
                        source: '0xe26b9977'
                    }
                },
                {
                    name: 'Proxy Submit',
                    url: 'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/order',
                    method: 'POST',
                    data: {
                        orderHash,
                        signature,
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
                    }
                },
                {
                    name: 'API Dev Build',
                    url: 'https://api.1inch.dev/orderbook/v4.0/137/build',
                    method: 'GET',
                    params: {
                        makerToken: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                        takerToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
                        makingAmount: makingAmount.toString(),
                        takingAmount: takingAmount.toString(),
                        expiration: expiration.toString(),
                        makerAddress: this.makerWallet.address
                    }
                }
            ];

            // Test each endpoint with each auth method
            for (const endpoint of endpoints) {
                console.log(`🧪 TESTING ${endpoint.name}`);
                console.log(`🔗 ${endpoint.url}`);
                console.log('────────────────────────────────────────');

                for (const authMethod of this.authMethods) {
                    try {
                        console.log(`   🔐 Trying ${authMethod.name}...`);

                        const headers = {
                            ...this.browserHeaders,
                            ...authMethod.headers
                        };

                        let response;
                        if (endpoint.method === 'GET') {
                            response = await axios.get(endpoint.url, {
                                params: endpoint.params,
                                headers,
                                timeout: 10000
                            });
                        } else {
                            response = await axios.post(endpoint.url, endpoint.data, {
                                headers,
                                timeout: 10000
                            });
                        }

                        console.log(`   ✅ SUCCESS! Status: ${response.status}`);
                        console.log(`   📋 Response:`, JSON.stringify(response.data, null, 2));
                        console.log('');

                        // If successful, save the working method
                        const workingMethod = {
                            endpoint: endpoint.name,
                            url: endpoint.url,
                            method: endpoint.method,
                            authMethod: authMethod.name,
                            headers: authMethod.headers,
                            response: response.data,
                            timestamp: Date.now()
                        };

                        const fs = require('fs');
                        const path = require('path');
                        const proofFile = path.join(__dirname, '..', 'execution-proofs', `working-browser-method-${Date.now()}.json`);
                        fs.mkdirSync(path.dirname(proofFile), { recursive: true });
                        fs.writeFileSync(proofFile, JSON.stringify(workingMethod, null, 2));

                        console.log('🎉 FOUND WORKING METHOD!');
                        console.log(`📄 Saved to: ${proofFile}`);
                        return workingMethod;

                    } catch (error) {
                        if (error.response) {
                            console.log(`   ❌ ${authMethod.name}: ${error.response.status}`);
                            if (error.response.data) {
                                console.log(`      📋 Error:`, JSON.stringify(error.response.data));
                            }
                        } else {
                            console.log(`   💥 ${authMethod.name}: ${error.message}`);
                        }
                    }
                }
                console.log('');
            }

            console.log('❌ No working method found with current approaches');
            console.log('');
            console.log('🔍 ADDITIONAL INSIGHTS:');
            console.log('• proxy-jwt-validation is enabled in feature flags');
            console.log('• limit-orders-with-fees is enabled');
            console.log('• May need to capture actual JWT token from browser session');
            console.log('• Consider using browser automation to capture working auth');

        } catch (error) {
            console.error('❌ Process failed:', error.message);
        }
    }
}

async function main() {
    const replication = new BrowserExactReplication();
    await replication.createOrderAndSubmit();
}

if (require.main === module) {
    main();
}

module.exports = { BrowserExactReplication };
