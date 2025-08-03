/**
 * @fileoverview Advanced 1inch Fusion Protocol Manager
 * @description Handles gasless swaps and advanced order management through Fusion
 * @author FEAWS Development Team
 */

const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class OneInchFusionManager {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.fusionApiUrl = 'https://api.1inch.dev/fusion';
        this.apiKey = process.env.ONEINCH_API_KEY;
        
        // Fusion contract addresses
        this.fusionContract = '0x00000000009726632680FB29d3F7A9734E3010E2';
        this.settlementContract = '0x00000000009726632680FB29d3F7A9734E3010E2';
        
        // Token addresses on Polygon
        this.tokens = {
            USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
        };
        
        this.activeOrders = new Map();
        this.executionHistory = [];
    }

    /**
     * Create a Fusion order for gasless swapping
     * @param {string} fromToken - Source token address
     * @param {string} toToken - Destination token address
     * @param {string} amount - Amount to swap (in wei)
     * @param {Object} options - Additional options
     */
    async createFusionOrder(fromToken, toToken, amount, options = {}) {
        try {
            console.log('🔄 Creating Fusion order...');
            console.log(`From: ${fromToken} | To: ${toToken} | Amount: ${amount}`);

            // Get quote from Fusion API
            const quoteParams = {
                src: fromToken,
                dst: toToken,
                amount: amount,
                from: this.wallet.address,
                slippage: options.slippage || 1,
                disableEstimate: false,
                allowPartialFill: options.allowPartialFill || false
            };

            const quoteResponse = await this.makeApiCall('/quote', quoteParams);
            
            if (!quoteResponse.success) {
                throw new Error(`Quote failed: ${quoteResponse.error}`);
            }

            const quote = quoteResponse.data;
            console.log(`💰 Expected output: ${ethers.formatUnits(quote.dstAmount, 18)}`);

            // Create the order
            const orderData = {
                src: fromToken,
                dst: toToken,
                amount: amount,
                from: this.wallet.address,
                receiver: options.receiver || this.wallet.address,
                preset: options.preset || 'fast',
                fee: options.fee || '0',
                nonce: Date.now(),
                permit: options.permit || '0x'
            };

            // Sign the order
            const signature = await this.signFusionOrder(orderData);
            orderData.signature = signature;

            // Submit to Fusion network
            const submitResponse = await this.makeApiCall('/order', orderData, 'POST');
            
            if (!submitResponse.success) {
                throw new Error(`Order submission failed: ${submitResponse.error}`);
            }

            const orderHash = submitResponse.data.orderHash;
            
            // Store order details
            this.activeOrders.set(orderHash, {
                ...orderData,
                orderHash,
                status: 'pending',
                createdAt: new Date().toISOString(),
                expectedOutput: quote.dstAmount
            });

            // Save execution proof
            await this.saveExecutionProof('fusion-order-created', {
                orderHash,
                fromToken,
                toToken,
                amount,
                expectedOutput: quote.dstAmount,
                timestamp: new Date().toISOString()
            });

            console.log(`✅ Fusion order created: ${orderHash}`);
            return { orderHash, expectedOutput: quote.dstAmount };

        } catch (error) {
            console.error('❌ Fusion order creation failed:', error.message);
            throw error;
        }
    }

    /**
     * Monitor active Fusion orders
     */
    async monitorOrders() {
        console.log('👀 Monitoring active Fusion orders...');
        
        for (const [orderHash, order] of this.activeOrders.entries()) {
            try {
                const status = await this.getOrderStatus(orderHash);
                
                if (status.status !== order.status) {
                    console.log(`📊 Order ${orderHash.substring(0, 10)}... status: ${status.status}`);
                    
                    order.status = status.status;
                    order.lastUpdated = new Date().toISOString();
                    
                    if (status.status === 'filled') {
                        await this.handleOrderFilled(orderHash, status);
                    } else if (status.status === 'cancelled' || status.status === 'expired') {
                        await this.handleOrderCancelled(orderHash, status);
                    }
                }
            } catch (error) {
                console.error(`❌ Error monitoring order ${orderHash}:`, error.message);
            }
        }
    }

    /**
     * Handle filled order
     */
    async handleOrderFilled(orderHash, status) {
        const order = this.activeOrders.get(orderHash);
        
        console.log(`🎉 Order filled: ${orderHash}`);
        console.log(`💰 Received: ${ethers.formatUnits(status.actualOutput, 18)}`);
        
        // Record execution
        this.executionHistory.push({
            orderHash,
            type: 'fusion_fill',
            timestamp: new Date().toISOString(),
            fromToken: order.src,
            toToken: order.dst,
            amountIn: order.amount,
            amountOut: status.actualOutput,
            txHash: status.txHash
        });

        // Save proof
        await this.saveExecutionProof('fusion-order-filled', {
            orderHash,
            txHash: status.txHash,
            amountOut: status.actualOutput,
            timestamp: new Date().toISOString()
        });

        // Remove from active orders
        this.activeOrders.delete(orderHash);
    }

    /**
     * Handle cancelled/expired order
     */
    async handleOrderCancelled(orderHash, status) {
        console.log(`❌ Order ${status.status}: ${orderHash}`);
        
        await this.saveExecutionProof('fusion-order-cancelled', {
            orderHash,
            reason: status.status,
            timestamp: new Date().toISOString()
        });

        this.activeOrders.delete(orderHash);
    }

    /**
     * Get order status from Fusion API
     */
    async getOrderStatus(orderHash) {
        try {
            const response = await this.makeApiCall(`/order/${orderHash}`);
            return response.data;
        } catch (error) {
            console.error(`Error getting order status: ${error.message}`);
            return { status: 'unknown' };
        }
    }

    /**
     * Sign Fusion order
     */
    async signFusionOrder(orderData) {
        const domain = {
            name: '1inch Fusion',
            version: '1',
            chainId: 137,
            verifyingContract: this.fusionContract
        };

        const types = {
            Order: [
                { name: 'src', type: 'address' },
                { name: 'dst', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'from', type: 'address' },
                { name: 'receiver', type: 'address' },
                { name: 'nonce', type: 'uint256' }
            ]
        };

        return await this.wallet.signTypedData(domain, types, orderData);
    }

    /**
     * Execute batch Fusion orders
     */
    async executeBatchOrders(orders) {
        console.log(`🔄 Executing ${orders.length} Fusion orders in batch...`);
        
        const results = [];
        
        for (const order of orders) {
            try {
                const result = await this.createFusionOrder(
                    order.fromToken,
                    order.toToken,
                    order.amount,
                    order.options
                );
                results.push({ success: true, ...result });
                
                // Small delay between orders
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        }
        
        console.log(`✅ Batch execution complete: ${results.filter(r => r.success).length}/${orders.length} successful`);
        return results;
    }

    /**
     * Get active orders summary
     */
    getActiveOrdersSummary() {
        const summary = {
            totalOrders: this.activeOrders.size,
            byStatus: {},
            totalValue: 0
        };

        for (const order of this.activeOrders.values()) {
            summary.byStatus[order.status] = (summary.byStatus[order.status] || 0) + 1;
            summary.totalValue += parseFloat(ethers.formatUnits(order.amount, 18));
        }

        return summary;
    }

    /**
     * Make API call to 1inch Fusion
     */
    async makeApiCall(endpoint, params = {}, method = 'GET') {
        try {
            const config = {
                method,
                url: `${this.fusionApiUrl}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            if (method === 'GET') {
                config.params = params;
            } else {
                config.data = params;
            }

            const response = await axios(config);
            return { success: true, data: response.data };
            
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.message || error.message 
            };
        }
    }

    /**
     * Save execution proof
     */
    async saveExecutionProof(type, data) {
        const proofDir = path.join(__dirname, '../../execution-proofs');
        const filename = `fusion-${type}-${Date.now()}.json`;
        const filepath = path.join(proofDir, filename);

        const proof = {
            type,
            timestamp: new Date().toISOString(),
            wallet: this.wallet.address,
            chainId: 137,
            ...data
        };

        try {
            await fs.writeFile(filepath, JSON.stringify(proof, null, 2));
            console.log(`📄 Proof saved: ${filename}`);
        } catch (error) {
            console.error('Error saving proof:', error.message);
        }
    }

    /**
     * Start monitoring daemon
     */
    startMonitoring(intervalMs = 30000) {
        console.log('🚀 Starting Fusion order monitoring...');
        
        setInterval(async () => {
            if (this.activeOrders.size > 0) {
                await this.monitorOrders();
            }
        }, intervalMs);
    }
}

// Export for use in other modules
module.exports = OneInchFusionManager;

// CLI execution
if (require.main === module) {
    async function main() {
        const manager = new OneInchFusionManager();
        
        console.log('🌊 FEAWS 1inch Fusion Manager');
        console.log('============================');
        
        // Example: Create a USDC -> WMATIC Fusion order
        try {
            const result = await manager.createFusionOrder(
                manager.tokens.USDC,
                manager.tokens.WMATIC,
                ethers.parseUnits('1', 6), // 1 USDC
                {
                    slippage: 1,
                    allowPartialFill: false,
                    preset: 'fast'
                }
            );
            
            console.log('Order created successfully:', result);
            
            // Start monitoring
            manager.startMonitoring();
            
        } catch (error) {
            console.error('Execution failed:', error.message);
            process.exit(1);
        }
    }
    
    main().catch(console.error);
}
