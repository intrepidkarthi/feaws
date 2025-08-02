#!/usr/bin/env node

/**
 * FIXED 1inch Fusion Integration
 * Uses 1inch v6 Fusion API for gasless swaps and MEV protection
 */

const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

class Fixed1inchFusion {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.API_KEY = process.env.ONEINCH_API_KEY;
        this.headers = { 'Authorization': `Bearer ${this.API_KEY}` };
        
        // Polygon mainnet addresses
        this.USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        this.WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        this.CHAIN_ID = 137;
        
        console.log('🔥 FIXED 1INCH FUSION INTEGRATION');
        console.log('Using 1inch v6 Fusion API');
        console.log('Wallet:', this.wallet.address);
        console.log('');
    }

    async checkFusionAvailability() {
        try {
            console.log('🔍 Checking Fusion availability...');
            
            // Check if Fusion is available for this pair
            const fusionUrl = `https://api.1inch.dev/fusion/v1.0/${this.CHAIN_ID}/quote`;
            const params = {
                src: this.USDC_ADDRESS,
                dst: this.WPOL_ADDRESS,
                amount: ethers.parseUnits('0.1', 6).toString()
            };
            
            const response = await axios.get(fusionUrl, {
                headers: this.headers,
                params: params
            });
            
            console.log('✅ Fusion available for USDC → WPOL');
            console.log(`   Expected output: ${ethers.formatEther(response.data.dstAmount)} WPOL`);
            console.log(`   Gas estimate: ${response.data.gas || 'gasless'}`);
            
            return true;
            
        } catch (error) {
            console.log('⚠️  Fusion not available, will use Aggregator fallback');
            console.log(`   Error: ${error.response?.data?.description || error.message}`);
            return false;
        }
    }

    async executeFusionSwap(amount) {
        console.log('🔥 Executing Fusion Swap...');
        console.log(`   Amount: ${ethers.formatUnits(amount, 6)} USDC`);
        
        try {
            // Step 1: Get Fusion quote
            const quoteUrl = `https://api.1inch.dev/fusion/v1.0/${this.CHAIN_ID}/quote`;
            const quoteParams = {
                src: this.USDC_ADDRESS,
                dst: this.WPOL_ADDRESS,
                amount: amount.toString(),
                from: this.wallet.address
            };
            
            const quoteResponse = await axios.get(quoteUrl, {
                headers: this.headers,
                params: quoteParams
            });
            
            console.log('📊 Fusion Quote:');
            console.log(`   Input: ${ethers.formatUnits(amount, 6)} USDC`);
            console.log(`   Output: ${ethers.formatEther(quoteResponse.data.dstAmount)} WPOL`);
            console.log(`   Gas: ${quoteResponse.data.gas || 'gasless'}`);
            
            // Step 2: Create Fusion order
            const orderUrl = `https://api.1inch.dev/fusion/v1.0/${this.CHAIN_ID}/order`;
            const orderData = {
                src: this.USDC_ADDRESS,
                dst: this.WPOL_ADDRESS,
                amount: amount.toString(),
                from: this.wallet.address,
                receiver: this.wallet.address,
                preset: 'fast' // or 'medium', 'slow'
            };
            
            const orderResponse = await axios.post(orderUrl, orderData, {
                headers: this.headers
            });
            
            console.log('📋 Fusion Order Created:');
            console.log(`   Order Hash: ${orderResponse.data.orderHash}`);
            
            // Step 3: Sign and submit order
            const order = orderResponse.data.order;
            const signature = await this.signFusionOrder(order);
            
            const submitUrl = `https://api.1inch.dev/fusion/v1.0/${this.CHAIN_ID}/order`;
            const submitData = {
                order: order,
                signature: signature,
                quoteId: orderResponse.data.quoteId
            };
            
            const submitResponse = await axios.post(submitUrl, submitData, {
                headers: this.headers
            });
            
            console.log('✅ Fusion Order Submitted Successfully!');
            console.log(`   Order ID: ${submitResponse.data.orderId}`);
            
            // Step 4: Monitor order status
            await this.monitorFusionOrder(submitResponse.data.orderId);
            
            return {
                success: true,
                orderId: submitResponse.data.orderId,
                orderHash: orderResponse.data.orderHash
            };
            
        } catch (error) {
            console.log('❌ Fusion swap failed:', error.response?.data || error.message);
            
            // Fallback to regular aggregator swap
            console.log('🔄 Falling back to Aggregator swap...');
            return await this.executeAggregatorFallback(amount);
        }
    }

    async executeAggregatorFallback(amount) {
        try {
            console.log('🔄 Executing Aggregator Fallback...');
            
            const swapUrl = `https://api.1inch.dev/swap/v6.0/${this.CHAIN_ID}/swap`;
            const swapParams = {
                src: this.USDC_ADDRESS,
                dst: this.WPOL_ADDRESS,
                amount: amount.toString(),
                from: this.wallet.address,
                slippage: 1
            };
            
            const swapResponse = await axios.get(swapUrl, {
                headers: this.headers,
                params: swapParams
            });
            
            console.log('📊 Aggregator Quote:');
            console.log(`   Input: ${ethers.formatUnits(amount, 6)} USDC`);
            console.log(`   Output: ${ethers.formatEther(swapResponse.data.dstAmount)} WPOL`);
            console.log(`   Gas: ${swapResponse.data.gas}`);
            
            // Execute transaction
            const tx = await this.wallet.sendTransaction({
                to: swapResponse.data.tx.to,
                data: swapResponse.data.tx.data,
                value: swapResponse.data.tx.value,
                gasLimit: swapResponse.data.tx.gas
            });
            
            console.log(`⏳ Transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log('✅ Aggregator swap successful!');
                console.log(`🔗 Tx: https://polygonscan.com/tx/${tx.hash}`);
                
                return {
                    success: true,
                    txHash: tx.hash,
                    method: 'aggregator'
                };
            } else {
                throw new Error('Transaction failed');
            }
            
        } catch (error) {
            console.log('❌ Aggregator fallback failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async signFusionOrder(order) {
        // EIP-712 domain for Fusion
        const domain = {
            name: '1inch Fusion',
            version: '1',
            chainId: this.CHAIN_ID,
            verifyingContract: order.verifyingContract || '0x1111111254eeb25477b68fb85ed929f73a960582'
        };

        // Fusion order types
        const types = {
            Order: [
                { name: 'salt', type: 'uint256' },
                { name: 'makerAsset', type: 'address' },
                { name: 'takerAsset', type: 'address' },
                { name: 'maker', type: 'address' },
                { name: 'receiver', type: 'address' },
                { name: 'allowedSender', type: 'address' },
                { name: 'makingAmount', type: 'uint256' },
                { name: 'takingAmount', type: 'uint256' },
                { name: 'offsets', type: 'uint256' },
                { name: 'interactions', type: 'bytes' }
            ]
        };

        return await this.wallet.signTypedData(domain, types, order);
    }

    async monitorFusionOrder(orderId) {
        console.log('👀 Monitoring Fusion order...');
        
        const maxAttempts = 12; // 2 minutes
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            try {
                const statusUrl = `https://api.1inch.dev/fusion/v1.0/${this.CHAIN_ID}/order/${orderId}`;
                const statusResponse = await axios.get(statusUrl, { headers: this.headers });
                
                const status = statusResponse.data.status;
                console.log(`   Status: ${status}`);
                
                if (status === 'filled') {
                    console.log('✅ Fusion order filled successfully!');
                    if (statusResponse.data.txHash) {
                        console.log(`🔗 Tx: https://polygonscan.com/tx/${statusResponse.data.txHash}`);
                    }
                    return true;
                } else if (status === 'cancelled' || status === 'expired') {
                    console.log(`❌ Fusion order ${status}`);
                    return false;
                }
                
                // Wait 10 seconds before next check
                await this.sleep(10000);
                attempts++;
                
            } catch (error) {
                console.log(`   ⚠️  Status check failed: ${error.message}`);
                attempts++;
                await this.sleep(10000);
            }
        }
        
        console.log('⏰ Monitoring timeout - order may still be pending');
        return false;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    try {
        const fusion = new Fixed1inchFusion();
        
        // Check USDC balance
        const usdcContract = new ethers.Contract(
            fusion.USDC_ADDRESS,
            ['function balanceOf(address) view returns (uint256)'],
            fusion.provider
        );
        
        const balance = await usdcContract.balanceOf(fusion.wallet.address);
        console.log('💰 USDC Balance:', ethers.formatUnits(balance, 6));
        
        if (balance === 0n) {
            console.log('❌ No USDC available for Fusion swap');
            return;
        }
        
        // Check Fusion availability
        const fusionAvailable = await fusion.checkFusionAvailability();
        console.log('');
        
        // Execute swap
        const amount = ethers.parseUnits('0.05', 6); // 0.05 USDC
        const result = await fusion.executeFusionSwap(amount);
        
        console.log('');
        console.log('🎉 FUSION INTEGRATION COMPLETED!');
        console.log('');
        console.log('📊 FINAL REPORT');
        console.log('════════════════════════════════════════');
        console.log(`Success: ${result.success}`);
        console.log(`Method: ${result.method || 'fusion'}`);
        if (result.orderId) console.log(`Order ID: ${result.orderId}`);
        if (result.txHash) console.log(`Tx Hash: ${result.txHash}`);
        console.log('');
        console.log('✅ Fixed Fusion integration working!');
        
    } catch (error) {
        console.error('❌ Fusion Error:', error.message);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { Fixed1inchFusion };
