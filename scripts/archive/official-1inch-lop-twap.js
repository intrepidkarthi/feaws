const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Import 1inch official utils
const { 
    LimitOrderBuilder, 
    LimitOrderProtocolFacade,
    Web3ProviderConnector,
    PrivateKeyProviderConnector
} = require('@1inch/limit-order-protocol-utils');

require('dotenv').config();

/**
 * Official 1inch Limit Order Protocol TWAP Implementation
 * Uses the official @1inch/limit-order-protocol-utils library
 * and 1inch API for proper order creation and submission
 */
class Official1inchLOPTWAP {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, this.provider);
        
        this.chainId = 137; // Polygon
        this.USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        this.WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        
        // 1inch API configuration
        this.API_BASE_URL = 'https://api.1inch.dev';
        this.API_KEY = process.env.ONEINCH_API_KEY;
        
        // Initialize 1inch utils
        this.connector = new PrivateKeyProviderConnector(process.env.PRIVATE_KEY, this.provider);
        this.limitOrderBuilder = new LimitOrderBuilder(
            this.chainId,
            this.connector
        );
        
        this.facade = new LimitOrderProtocolFacade(
            this.chainId,
            this.connector
        );
        
        this.orders = [];
        this.fills = [];
        
        // USDC contract for balance and approval
        this.usdcContract = new ethers.Contract(
            this.USDC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)',
                'function decimals() view returns (uint8)'
            ],
            this.wallet
        );
    }

    /**
     * Get 1inch swap quote for price calculation
     */
    async getSwapQuote(fromToken, toToken, amount) {
        try {
            const response = await axios.get(`${this.API_BASE_URL}/swap/v6.0/${this.chainId}/quote`, {
                params: {
                    src: fromToken,
                    dst: toToken,
                    amount: amount.toString()
                },
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'accept': 'application/json'
                }
            });
            
            return response.data;
        } catch (error) {
            console.log(`   ⚠️ Quote error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create a limit order using official 1inch utils
     */
    async createLimitOrder(makingAmount, takingAmount, duration = 3600) {
        try {
            console.log(`   🔨 Building limit order...`);
            
            // Calculate expiration timestamp
            const expiration = Math.floor(Date.now() / 1000) + duration;
            
            // Build the limit order using official utils
            const limitOrder = this.limitOrderBuilder.buildLimitOrder({
                makerAsset: this.USDC_ADDRESS,
                takerAsset: this.WMATIC_ADDRESS,
                makingAmount: makingAmount.toString(),
                takingAmount: takingAmount.toString(),
                maker: this.wallet.address,
                receiver: ethers.ZeroAddress, // Use maker as receiver
                allowedSender: ethers.ZeroAddress, // Allow anyone to fill
                predicate: this.limitOrderBuilder.and(
                    this.limitOrderBuilder.timestampBelow(expiration)
                ),
                permit: '0x',
                interaction: '0x'
            });
            
            console.log(`   ✅ Limit order built`);
            return limitOrder;
            
        } catch (error) {
            console.log(`   ❌ Failed to build limit order: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sign the limit order
     */
    async signLimitOrder(limitOrder) {
        try {
            console.log(`   ✍️ Signing limit order...`);
            
            const signature = await this.facade.signLimitOrder(limitOrder);
            
            console.log(`   ✅ Order signed`);
            return signature;
            
        } catch (error) {
            console.log(`   ❌ Failed to sign order: ${error.message}`);
            throw error;
        }
    }

    /**
     * Submit order to 1inch API
     */
    async submitOrderToAPI(limitOrder, signature) {
        try {
            console.log(`   📤 Submitting order to 1inch API...`);
            
            const orderData = {
                orderHash: this.facade.getOrderHash(limitOrder),
                signature: signature,
                data: limitOrder
            };
            
            const response = await axios.post(
                `${this.API_BASE_URL}/orderbook/v4.0/${this.chainId}/order`,
                orderData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.API_KEY}`,
                        'Content-Type': 'application/json',
                        'accept': 'application/json'
                    }
                }
            );
            
            console.log(`   ✅ Order submitted to API`);
            return response.data;
            
        } catch (error) {
            console.log(`   ❌ API submission failed: ${error.message}`);
            if (error.response) {
                console.log(`   📝 API Error Details:`, error.response.data);
            }
            throw error;
        }
    }

    /**
     * Fill order using taker wallet
     */
    async fillOrder(limitOrder, signature, fillAmount) {
        try {
            console.log(`   ⚡ Filling order with taker wallet...`);
            
            // Use the facade to fill the order
            const tx = await this.facade.fillLimitOrder(
                limitOrder,
                signature,
                fillAmount,
                0, // no threshold
                ethers.ZeroAddress // target address
            );
            
            console.log(`   📝 Fill TX: ${tx.hash}`);
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log(`   ✅ Order filled successfully`);
                console.log(`   🔗 https://polygonscan.com/tx/${tx.hash}`);
                return { success: true, txHash: tx.hash, blockNumber: receipt.blockNumber };
            } else {
                console.log(`   ❌ Fill transaction failed`);
                return { success: false, txHash: tx.hash };
            }
            
        } catch (error) {
            console.log(`   ❌ Fill failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute TWAP strategy
     */
    async executeTWAP(totalAmount, slices, intervalSeconds) {
        console.log('🚀 OFFICIAL 1INCH LOP TWAP SYSTEM\n');
        
        console.log('📊 Limit Order Protocol TWAP:');
        console.log(`   Protocol: 1inch Limit Order Protocol v4 (Official Utils)`);
        console.log(`   Chain: Polygon (${this.chainId})`);
        console.log(`   Total USDC: ${ethers.formatUnits(totalAmount, 6)} USDC`);
        console.log(`   Slices: ${slices}`);
        console.log(`   Slice Size: ${ethers.formatUnits(totalAmount / BigInt(slices), 6)} USDC`);
        console.log(`   Interval: ${intervalSeconds}s\n`);

        // Check initial balance
        const initialBalance = await this.usdcContract.balanceOf(this.wallet.address);
        const decimals = await this.usdcContract.decimals();
        console.log(`Initial USDC Balance: ${ethers.formatUnits(initialBalance, decimals)} USDC\n`);

        if (initialBalance < totalAmount) {
            throw new Error(`Insufficient USDC balance. Need ${ethers.formatUnits(totalAmount, 6)} USDC, have ${ethers.formatUnits(initialBalance, 6)} USDC`);
        }

        // Check and approve USDC for 1inch LOP
        console.log('🔐 Checking USDC allowance for 1inch LOP...');
        const lopAddress = await this.facade.getContractAddress();
        const currentAllowance = await this.usdcContract.allowance(this.wallet.address, lopAddress);
        console.log(`   Current allowance: ${ethers.formatUnits(currentAllowance, 6)} USDC`);
        console.log(`   LOP Contract: ${lopAddress}`);
        
        if (currentAllowance < totalAmount) {
            console.log('   Approving additional USDC...');
            const approveTx = await this.usdcContract.approve(lopAddress, totalAmount, {
                gasLimit: 100000
            });
            await approveTx.wait();
            console.log('   ✅ USDC approved');
        } else {
            console.log('   ✅ Sufficient allowance already exists');
        }
        console.log('');

        // Create orders
        const sliceAmount = totalAmount / BigInt(slices);
        const baseTime = Math.floor(Date.now() / 1000);
        
        for (let i = 0; i < slices; i++) {
            console.log(`📝 Creating Limit Order ${i + 1}/${slices}...`);
            
            try {
                // Get current market price for this slice
                const quote = await this.getSwapQuote(
                    this.USDC_ADDRESS,
                    this.WMATIC_ADDRESS,
                    sliceAmount
                );
                
                const takingAmount = BigInt(quote.dstAmount);
                console.log(`   💰 Market rate: ${ethers.formatUnits(sliceAmount, 6)} USDC → ${ethers.formatUnits(takingAmount, 18)} WMATIC`);
                
                // Create the limit order
                const limitOrder = await this.createLimitOrder(sliceAmount, takingAmount, 3600);
                
                // Sign the order
                const signature = await this.signLimitOrder(limitOrder);
                
                // Submit to API
                const apiResult = await this.submitOrderToAPI(limitOrder, signature);
                
                // Store order data
                const orderHash = this.facade.getOrderHash(limitOrder);
                this.orders.push({
                    limitOrder,
                    signature,
                    orderHash,
                    sliceIndex: i,
                    executeTime: baseTime + (i * intervalSeconds),
                    amount: sliceAmount,
                    takingAmount,
                    apiResult
                });
                
                console.log(`   ✅ Order ${i + 1} created and submitted`);
                console.log(`   🔑 Order Hash: ${orderHash.slice(0, 10)}...`);
                console.log(`   ⏰ Execute at: ${new Date((baseTime + (i * intervalSeconds)) * 1000).toLocaleTimeString()}\n`);
                
            } catch (error) {
                console.log(`   ❌ Failed to create order ${i + 1}: ${error.message}\n`);
            }
        }

        console.log(`🎯 ${this.orders.length}/${slices} limit orders created and submitted!\n`);

        // Execute fills with timing
        console.log('⚡ EXECUTING LIMIT ORDER FILLS\n');
        
        for (let i = 0; i < this.orders.length; i++) {
            const orderData = this.orders[i];
            const currentTime = Math.floor(Date.now() / 1000);
            
            console.log(`🕐 Order ${i + 1}: Waiting for execution time...`);
            
            // Wait for execution time
            if (currentTime < orderData.executeTime) {
                const waitTime = orderData.executeTime - currentTime;
                console.log(`   ⏳ Waiting ${waitTime}s until ${new Date(orderData.executeTime * 1000).toLocaleTimeString()}`);
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            }
            
            console.log(`⚡ Filling Limit Order ${i + 1}...`);
            
            // Fill the order using taker wallet
            const fillResult = await this.fillOrder(
                orderData.limitOrder,
                orderData.signature,
                orderData.amount
            );
            
            if (fillResult.success) {
                console.log(`   ✅ LIMIT ORDER FILLED - Block ${fillResult.blockNumber}`);
                console.log(`   💰 ${ethers.formatUnits(orderData.amount, 6)} USDC → ${ethers.formatUnits(orderData.takingAmount, 18)} WMATIC\n`);
                
                this.fills.push({
                    orderHash: orderData.orderHash,
                    txHash: fillResult.txHash,
                    blockNumber: fillResult.blockNumber,
                    sliceIndex: i,
                    amount: orderData.amount,
                    takingAmount: orderData.takingAmount
                });
            } else {
                console.log(`   ❌ Fill failed: ${fillResult.error || 'Unknown error'}\n`);
            }
        }

        // Final report
        await this.generateReport();
    }

    /**
     * Generate execution report
     */
    async generateReport() {
        console.log('🎉 OFFICIAL 1INCH LOP TWAP COMPLETED\n');
        
        const finalBalance = await this.usdcContract.balanceOf(this.wallet.address);
        const totalFilled = this.fills.reduce((sum, fill) => sum + fill.amount, BigInt(0));
        
        console.log('📊 FINAL REPORT');
        console.log('════════════════════════════════════════════════════════════');
        console.log(`Protocol: 1inch Limit Order Protocol v4 (Official Utils)`);
        console.log(`Chain: Polygon Mainnet (${this.chainId})`);
        console.log(`Maker: ${this.wallet.address}`);
        console.log(`Taker: ${this.takerWallet.address}`);
        console.log(`Orders Created: ${this.orders.length}`);
        console.log(`Orders Filled: ${this.fills.length}`);
        console.log(`Total USDC Filled: ${ethers.formatUnits(totalFilled, 6)} USDC`);
        console.log(`Final USDC Balance: ${ethers.formatUnits(finalBalance, 6)} USDC`);
        console.log('');
        
        // Save execution proof
        const proof = {
            timestamp: new Date().toISOString(),
            protocol: '1inch Limit Order Protocol v4 (Official Utils)',
            chain: 'Polygon',
            chainId: this.chainId,
            maker: this.wallet.address,
            taker: this.takerWallet.address,
            ordersCreated: this.orders.length,
            ordersFilled: this.fills.length,
            totalFilledUSDC: ethers.formatUnits(totalFilled, 6),
            finalBalanceUSDC: ethers.formatUnits(finalBalance, 6),
            orders: this.orders.map(order => ({
                orderHash: order.orderHash,
                sliceIndex: order.sliceIndex,
                amount: ethers.formatUnits(order.amount, 6),
                takingAmount: ethers.formatUnits(order.takingAmount, 18),
                executeTime: order.executeTime,
                apiSubmitted: !!order.apiResult
            })),
            fills: this.fills.map(fill => ({
                orderHash: fill.orderHash,
                txHash: fill.txHash,
                blockNumber: fill.blockNumber,
                sliceIndex: fill.sliceIndex,
                amount: ethers.formatUnits(fill.amount, 6),
                takingAmount: ethers.formatUnits(fill.takingAmount, 18),
                polygonscanUrl: `https://polygonscan.com/tx/${fill.txHash}`
            }))
        };
        
        const proofPath = path.join(__dirname, '..', 'execution-proofs', `official-lop-twap-${Date.now()}.json`);
        fs.mkdirSync(path.dirname(proofPath), { recursive: true });
        fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
        
        if (this.fills.length === this.orders.length) {
            console.log('✅ ALL ORDERS SUCCESSFULLY FILLED');
            console.log('════════════════════════════════════════════════════════════');
            console.log('🎯 1INCH OFFICIAL LOP TWAP SYSTEM COMPLETE');
        } else {
            console.log('⚠️  PARTIAL EXECUTION');
            console.log('════════════════════════════════════════════════════════════');
            console.log('✅ Orders created and submitted to API');
            console.log('❌ Some fills failed - check individual order status');
            console.log('💡 Orders remain active on 1inch orderbook for other takers');
            console.log('🎯 1INCH OFFICIAL LOP TWAP SYSTEM COMPLETE');
        }
        
        console.log(`📄 Execution proof saved: ${proofPath}`);
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        const twap = new Official1inchLOPTWAP();
        
        // Execute TWAP with small amounts for testing
        const totalAmount = ethers.parseUnits('0.2', 6); // 0.2 USDC
        const slices = 2;
        const intervalSeconds = 45; // 45 seconds between orders
        
        await twap.executeTWAP(totalAmount, slices, intervalSeconds);
        
    } catch (error) {
        console.error('❌ TWAP execution failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { Official1inchLOPTWAP };
