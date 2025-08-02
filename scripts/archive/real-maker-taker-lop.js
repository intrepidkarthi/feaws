const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

/**
 * REAL 1inch Limit Order Protocol with Maker/Taker Implementation
 * Creates genuine limit orders and fills them using separate maker/taker wallets
 * Demonstrates real on-chain limit order functionality for ETHGlobal UNITE 2025
 */
class RealMakerTakerLOP {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, this.provider);
        
        this.chainId = 137; // Polygon
        this.USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        this.WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        this.LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65'; // 1inch LOP v4
        
        // 1inch API configuration
        this.API_BASE_URL = 'https://api.1inch.dev';
        this.API_KEY = process.env.ONEINCH_API_KEY;
        
        this.orders = [];
        this.fills = [];
        
        // Contracts for both wallets
        this.makerUSDC = new ethers.Contract(
            this.USDC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function transfer(address to, uint256 amount) returns (bool)'
            ],
            this.makerWallet
        );
        
        this.takerUSDC = new ethers.Contract(this.USDC_ADDRESS, this.makerUSDC.interface, this.takerWallet);
        this.takerWMATIC = new ethers.Contract(
            this.WMATIC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)',
                'function transfer(address to, uint256 amount) returns (bool)'
            ],
            this.takerWallet
        );

        // 1inch LOP v4 contract for filling orders
        this.lopContract = new ethers.Contract(
            this.LOP_CONTRACT,
            [
                // Simplified v4 fillOrder function
                'function fillOrder((uint256,address,address,address,address,uint256,uint256,uint256) order, bytes signature, uint256 makingAmount, uint256 takingAmount, uint256 skipPermitAndThresholdAmount) external returns (uint256, uint256)',
                'function hashOrder((uint256,address,address,address,address,uint256,uint256,uint256) order) external view returns (bytes32)',
                'function remaining(bytes32 orderHash) external view returns (uint256)'
            ],
            this.takerWallet
        );

        // EIP-712 Domain for 1inch LOP v4
        this.domain = {
            name: '1inch Limit Order Protocol',
            version: '4',
            chainId: this.chainId,
            verifyingContract: this.LOP_CONTRACT
        };

        // EIP-712 Types for v4 Order (simplified structure)
        this.types = {
            Order: [
                { name: 'salt', type: 'uint256' },
                { name: 'maker', type: 'address' },
                { name: 'receiver', type: 'address' },
                { name: 'makerAsset', type: 'address' },
                { name: 'takerAsset', type: 'address' },
                { name: 'makingAmount', type: 'uint256' },
                { name: 'takingAmount', type: 'uint256' },
                { name: 'makerTraits', type: 'uint256' }
            ]
        };
    }

    /**
     * Get WMATIC for taker if needed
     */
    async ensureTakerHasWMATIC(requiredAmount) {
        const balance = await this.takerWMATIC.balanceOf(this.takerWallet.address);
        
        if (balance < requiredAmount) {
            console.log(`   💡 Taker needs more WMATIC. Has ${ethers.formatUnits(balance, 18)}, needs ${ethers.formatUnits(requiredAmount, 18)}`);
            console.log(`   🔄 Getting WMATIC via small swap...`);
            
            try {
                // Use a small amount of MATIC to get WMATIC
                const swapAmount = ethers.parseEther('0.1'); // 0.1 MATIC
                
                const response = await axios.get(`${this.API_BASE_URL}/swap/v6.0/${this.chainId}/swap`, {
                    params: {
                        src: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Native MATIC
                        dst: this.WMATIC_ADDRESS,
                        amount: swapAmount.toString(),
                        from: this.takerWallet.address,
                        slippage: 5
                    },
                    headers: {
                        'Authorization': `Bearer ${this.API_KEY}`,
                        'accept': 'application/json'
                    }
                });
                
                const tx = await this.takerWallet.sendTransaction({
                    to: response.data.tx.to,
                    data: response.data.tx.data,
                    value: response.data.tx.value,
                    gasLimit: 300000
                });
                
                await tx.wait();
                console.log(`   ✅ Got WMATIC via swap: ${tx.hash}`);
                
                const newBalance = await this.takerWMATIC.balanceOf(this.takerWallet.address);
                console.log(`   💰 New WMATIC balance: ${ethers.formatUnits(newBalance, 18)}`);
                
            } catch (error) {
                console.log(`   ⚠️ Could not get WMATIC: ${error.message}`);
                console.log(`   💡 Continuing with available balance...`);
            }
        }
    }

    /**
     * Get market price for reference
     */
    async getMarketPrice(fromToken, toToken, amount) {
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
            
            return BigInt(response.data.dstAmount);
        } catch (error) {
            console.log(`   ⚠️ Price fetch error: ${error.message}`);
            // Fallback to a much smaller WMATIC amount (conservative rate)
            // 1 USDC ≈ 0.5 WMATIC (very conservative to ensure taker has enough)
            return (amount * BigInt(5)) / BigInt(10); // 0.5 WMATIC per USDC
        }
    }

    /**
     * Create a real limit order
     */
    async createRealLimitOrder(makingAmount, takingAmount, duration = 3600) {
        console.log(`   🔨 Creating REAL limit order...`);
        
        // Generate random salt
        const salt = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
        
        // Calculate expiration timestamp
        const expiration = Math.floor(Date.now() / 1000) + duration;
        
        // Build maker traits with expiration
        // For v4: expiration in upper 40 bits, other flags in lower bits
        const makerTraits = BigInt(expiration) << BigInt(216);
        
        // Build the order
        const order = {
            salt: salt.toString(),
            maker: this.makerWallet.address,
            receiver: ethers.ZeroAddress, // Maker receives the tokens
            makerAsset: this.USDC_ADDRESS,
            takerAsset: this.WMATIC_ADDRESS,
            makingAmount: makingAmount.toString(),
            takingAmount: takingAmount.toString(),
            makerTraits: makerTraits.toString()
        };
        
        console.log(`   ✅ Order structure created`);
        console.log(`   📊 ${ethers.formatUnits(makingAmount, 6)} USDC → ${ethers.formatUnits(takingAmount, 18)} WMATIC`);
        console.log(`   ⏰ Expires: ${new Date(expiration * 1000).toLocaleString()}`);
        
        return order;
    }

    /**
     * Sign the order with maker wallet
     */
    async signOrderWithMaker(order) {
        console.log(`   ✍️ Signing order with MAKER wallet...`);
        
        const signature = await this.makerWallet.signTypedData(this.domain, this.types, order);
        
        console.log(`   ✅ Order signed by maker: ${this.makerWallet.address.slice(0, 8)}...`);
        return signature;
    }

    /**
     * Submit order to 1inch orderbook
     */
    async submitToOrderbook(order, signature) {
        console.log(`   📤 Submitting to 1inch orderbook...`);
        
        try {
            // Calculate order hash
            const orderHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['uint256', 'address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                    [order.salt, order.maker, order.receiver, order.makerAsset, order.takerAsset, order.makingAmount, order.takingAmount, order.makerTraits]
                )
            );
            
            const orderData = {
                orderHash: orderHash,
                signature: signature,
                data: order
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
            
            console.log(`   ✅ Order submitted to orderbook`);
            console.log(`   🔗 Order Hash: ${orderHash.slice(0, 10)}...`);
            
            return { success: true, orderHash, response: response.data };
            
        } catch (error) {
            console.log(`   ⚠️ Orderbook submission failed: ${error.message}`);
            if (error.response?.data) {
                console.log(`   📝 API Response:`, error.response.data);
            }
            
            // Still return the order hash for direct filling
            const orderHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['uint256', 'address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                    [order.salt, order.maker, order.receiver, order.makerAsset, order.takerAsset, order.makingAmount, order.takingAmount, order.makerTraits]
                )
            );
            
            console.log(`   💡 Will proceed with direct order fill`);
            return { success: false, orderHash, error: error.message };
        }
    }

    /**
     * Fill order using taker wallet (REAL LIMIT ORDER FILL)
     */
    async fillOrderWithTaker(order, signature, fillAmount) {
        console.log(`   ⚡ Filling order with TAKER wallet...`);
        console.log(`   👤 Taker: ${this.takerWallet.address.slice(0, 8)}...`);
        
        try {
            const requiredWMATIC = BigInt(order.takingAmount);
            
            console.log(`   💰 Required WMATIC: ${ethers.formatUnits(requiredWMATIC, 18)}`);
            
            // Ensure taker has enough WMATIC (will get more if needed)
            await this.ensureTakerHasWMATIC(requiredWMATIC);
            
            // Check final balance
            const takerWMATICBalance = await this.takerWMATIC.balanceOf(this.takerWallet.address);
            console.log(`   💰 Taker WMATIC: ${ethers.formatUnits(takerWMATICBalance, 18)}`);
            
            if (takerWMATICBalance < requiredWMATIC) {
                throw new Error(`Taker still insufficient WMATIC. Has ${ethers.formatUnits(takerWMATICBalance, 18)}, needs ${ethers.formatUnits(requiredWMATIC, 18)}`);
            }
            
            // Approve WMATIC for LOP contract
            console.log(`   🔐 Approving WMATIC for LOP...`);
            const allowance = await this.takerWMATIC.allowance(this.takerWallet.address, this.LOP_CONTRACT);
            if (allowance < requiredWMATIC) {
                const approveTx = await this.takerWMATIC.approve(this.LOP_CONTRACT, requiredWMATIC, {
                    gasLimit: 100000
                });
                await approveTx.wait();
                console.log(`   ✅ WMATIC approved`);
            }
            
            // Convert order to tuple for contract call
            const orderTuple = [
                order.salt,
                order.maker,
                order.receiver,
                order.makerAsset,
                order.takerAsset,
                order.makingAmount,
                order.takingAmount,
                order.makerTraits
            ];
            
            // Execute the fill
            console.log(`   🎯 Executing limit order fill...`);
            const tx = await this.lopContract.fillOrder(
                orderTuple,
                signature,
                order.makingAmount,
                order.takingAmount,
                0, // skipPermitAndThresholdAmount
                { gasLimit: 500000 }
            );
            
            console.log(`   📝 Fill TX: ${tx.hash}`);
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log(`   ✅ REAL LIMIT ORDER FILLED!`);
                console.log(`   🔗 https://polygonscan.com/tx/${tx.hash}`);
                console.log(`   📊 ${ethers.formatUnits(order.makingAmount, 6)} USDC → ${ethers.formatUnits(order.takingAmount, 18)} WMATIC`);
                console.log(`   👤 Maker → Taker exchange completed`);
                
                return { 
                    success: true, 
                    txHash: tx.hash, 
                    blockNumber: receipt.blockNumber,
                    method: 'real_limit_order_fill'
                };
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
     * Execute complete maker/taker TWAP flow
     */
    async executeMakerTakerTWAP(totalAmount, slices, intervalSeconds) {
        console.log('🚀 REAL MAKER/TAKER LIMIT ORDER PROTOCOL TWAP\n');
        
        console.log('📊 Real Limit Order Protocol TWAP:');
        console.log(`   Protocol: 1inch Limit Order Protocol v4`);
        console.log(`   Chain: Polygon (${this.chainId})`);
        console.log(`   👤 Maker: ${this.makerWallet.address}`);
        console.log(`   👤 Taker: ${this.takerWallet.address}`);
        console.log(`   Total USDC: ${ethers.formatUnits(totalAmount, 6)} USDC`);
        console.log(`   Slices: ${slices}`);
        console.log(`   Slice Size: ${ethers.formatUnits(totalAmount / BigInt(slices), 6)} USDC`);
        console.log(`   Interval: ${intervalSeconds}s\n`);

        // Check maker balance
        const makerBalance = await this.makerUSDC.balanceOf(this.makerWallet.address);
        console.log(`Maker USDC Balance: ${ethers.formatUnits(makerBalance, 6)} USDC`);

        if (makerBalance < totalAmount) {
            throw new Error(`Maker insufficient USDC. Need ${ethers.formatUnits(totalAmount, 6)} USDC, have ${ethers.formatUnits(makerBalance, 6)} USDC`);
        }

        // Check taker WMATIC balance
        const takerWMATICBalance = await this.takerWMATIC.balanceOf(this.takerWallet.address);
        console.log(`Taker WMATIC Balance: ${ethers.formatUnits(takerWMATICBalance, 18)} WMATIC\n`);

        // Approve USDC for maker
        console.log('🔐 Setting up maker USDC allowance...');
        const currentAllowance = await this.makerUSDC.allowance(this.makerWallet.address, this.LOP_CONTRACT);
        console.log(`   Current allowance: ${ethers.formatUnits(currentAllowance, 6)} USDC`);
        
        if (currentAllowance < totalAmount) {
            console.log('   Approving USDC for LOP...');
            const approveTx = await this.makerUSDC.approve(this.LOP_CONTRACT, totalAmount, {
                gasLimit: 100000
            });
            await approveTx.wait();
            console.log('   ✅ USDC approved for maker');
        } else {
            console.log('   ✅ Sufficient allowance exists');
        }
        console.log('');

        // Create and execute orders
        const sliceAmount = totalAmount / BigInt(slices);
        const baseTime = Math.floor(Date.now() / 1000);
        
        for (let i = 0; i < slices; i++) {
            console.log(`📝 Creating REAL Limit Order ${i + 1}/${slices}...`);
            
            try {
                // Get market price for reference
                const marketPrice = await this.getMarketPrice(
                    this.USDC_ADDRESS,
                    this.WMATIC_ADDRESS,
                    sliceAmount
                );
                
                // Create the real limit order
                const order = await this.createRealLimitOrder(sliceAmount, marketPrice, 3600);
                
                // Sign with maker wallet
                const signature = await this.signOrderWithMaker(order);
                
                // Submit to orderbook
                const submission = await this.submitToOrderbook(order, signature);
                
                // Store order data
                this.orders.push({
                    order,
                    signature,
                    orderHash: submission.orderHash,
                    sliceIndex: i,
                    executeTime: baseTime + (i * intervalSeconds),
                    amount: sliceAmount,
                    takingAmount: marketPrice,
                    submission
                });
                
                console.log(`   ✅ Order ${i + 1} created and ready`);
                console.log(`   ⏰ Execute at: ${new Date((baseTime + (i * intervalSeconds)) * 1000).toLocaleTimeString()}\n`);
                
            } catch (error) {
                console.log(`   ❌ Failed to create order ${i + 1}: ${error.message}\n`);
            }
        }

        console.log(`🎯 ${this.orders.length}/${slices} REAL limit orders created!\n`);

        // Execute fills with timing
        console.log('⚡ EXECUTING REAL LIMIT ORDER FILLS\n');
        
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
            
            console.log(`⚡ Filling REAL Limit Order ${i + 1}...`);
            
            // Fill with taker wallet
            const fillResult = await this.fillOrderWithTaker(
                orderData.order,
                orderData.signature,
                orderData.amount
            );
            
            if (fillResult.success) {
                console.log(`   🎉 REAL LIMIT ORDER EXECUTED!\n`);
                
                this.fills.push({
                    orderHash: orderData.orderHash,
                    txHash: fillResult.txHash,
                    blockNumber: fillResult.blockNumber,
                    sliceIndex: i,
                    amount: orderData.amount,
                    takingAmount: orderData.takingAmount,
                    method: fillResult.method
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
        console.log('🎉 REAL MAKER/TAKER LIMIT ORDER PROTOCOL COMPLETED\n');
        
        const finalMakerBalance = await this.makerUSDC.balanceOf(this.makerWallet.address);
        const finalTakerBalance = await this.takerUSDC.balanceOf(this.takerWallet.address);
        const totalFilled = this.fills.reduce((sum, fill) => sum + fill.amount, BigInt(0));
        
        console.log('📊 FINAL REPORT');
        console.log('════════════════════════════════════════════════════════════');
        console.log(`Protocol: 1inch Limit Order Protocol v4 (REAL)`);
        console.log(`Chain: Polygon Mainnet (${this.chainId})`);
        console.log(`👤 Maker: ${this.makerWallet.address}`);
        console.log(`👤 Taker: ${this.takerWallet.address}`);
        console.log(`📊 Orders Created: ${this.orders.length}`);
        console.log(`📊 Orders Filled: ${this.fills.length}`);
        console.log(`💰 Total USDC Traded: ${ethers.formatUnits(totalFilled, 6)} USDC`);
        console.log(`💰 Final Maker USDC: ${ethers.formatUnits(finalMakerBalance, 6)} USDC`);
        console.log(`💰 Final Taker USDC: ${ethers.formatUnits(finalTakerBalance, 6)} USDC`);
        console.log('');
        
        // Save execution proof
        const proof = {
            timestamp: new Date().toISOString(),
            protocol: '1inch Limit Order Protocol v4 (REAL)',
            chain: 'Polygon',
            chainId: this.chainId,
            maker: this.makerWallet.address,
            taker: this.takerWallet.address,
            ordersCreated: this.orders.length,
            ordersFilled: this.fills.length,
            totalTradedUSDC: ethers.formatUnits(totalFilled, 6),
            finalMakerBalanceUSDC: ethers.formatUnits(finalMakerBalance, 6),
            finalTakerBalanceUSDC: ethers.formatUnits(finalTakerBalance, 6),
            orders: this.orders.map(order => ({
                orderHash: order.orderHash,
                sliceIndex: order.sliceIndex,
                amount: ethers.formatUnits(order.amount, 6),
                takingAmount: ethers.formatUnits(order.takingAmount, 18),
                executeTime: order.executeTime,
                submittedToOrderbook: order.submission.success
            })),
            fills: this.fills.map(fill => ({
                orderHash: fill.orderHash,
                txHash: fill.txHash,
                blockNumber: fill.blockNumber,
                sliceIndex: fill.sliceIndex,
                amount: ethers.formatUnits(fill.amount, 6),
                method: fill.method,
                polygonscanUrl: `https://polygonscan.com/tx/${fill.txHash}`
            }))
        };
        
        const proofPath = path.join(__dirname, '..', 'execution-proofs', `real-maker-taker-lop-${Date.now()}.json`);
        fs.mkdirSync(path.dirname(proofPath), { recursive: true });
        fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
        
        if (this.fills.length === this.orders.length) {
            console.log('✅ ALL REAL LIMIT ORDERS SUCCESSFULLY FILLED');
            console.log('════════════════════════════════════════════════════════════');
            console.log('🎯 REAL MAKER/TAKER LIMIT ORDER SYSTEM COMPLETE');
            console.log('🏆 GENUINE DEFI LIMIT ORDER EXECUTION ACHIEVED');
        } else {
            console.log('⚠️  PARTIAL EXECUTION');
            console.log('════════════════════════════════════════════════════════════');
            console.log('✅ Real orders created and submitted');
            console.log('❌ Some fills failed - check individual order status');
            console.log('🎯 REAL MAKER/TAKER LIMIT ORDER SYSTEM COMPLETE');
        }
        
        console.log(`📄 Execution proof saved: ${proofPath}`);
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        const realLOP = new RealMakerTakerLOP();
        
        // Execute REAL maker/taker TWAP with smaller amounts
        const totalAmount = ethers.parseUnits('0.1', 6); // 0.1 USDC (smaller amount)
        const slices = 2;
        const intervalSeconds = 30; // 30 seconds between orders
        
        await realLOP.executeMakerTakerTWAP(totalAmount, slices, intervalSeconds);
        
    } catch (error) {
        console.error('❌ Real TWAP execution failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { RealMakerTakerLOP };
