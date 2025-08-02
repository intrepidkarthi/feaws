const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

/**
 * Step-by-Step 1inch Limit Order Protocol Implementation
 * Focus on proper order creation first, then filling
 */
class StepByStepLOP {
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
        
        // USDC contract for maker
        this.usdcContract = new ethers.Contract(
            this.USDC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)',
                'function decimals() view returns (uint8)'
            ],
            this.makerWallet
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
     * Step 1: Create a proper limit order structure
     */
    async createOrderStructure(makingAmount, takingAmount, duration = 3600) {
        console.log('📝 STEP 1: Creating Order Structure');
        console.log('═══════════════════════════════════════════════════════════');
        
        // Generate random salt
        const salt = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
        console.log(`🎲 Salt: ${salt.toString()}`);
        
        // Calculate expiration timestamp
        const expiration = Math.floor(Date.now() / 1000) + duration;
        console.log(`⏰ Expiration: ${new Date(expiration * 1000).toLocaleString()}`);
        
        // Build maker traits with expiration (v4 format)
        // Expiration in upper 40 bits
        const makerTraits = BigInt(expiration) << BigInt(216);
        console.log(`🏷️ Maker Traits: ${makerTraits.toString()}`);
        
        // Build the order object
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
        
        console.log('📋 Order Details:');
        console.log(`   Maker: ${order.maker}`);
        console.log(`   Receiver: ${order.receiver}`);
        console.log(`   Maker Asset: ${order.makerAsset} (USDC)`);
        console.log(`   Taker Asset: ${order.takerAsset} (WMATIC)`);
        console.log(`   Making Amount: ${ethers.formatUnits(order.makingAmount, 6)} USDC`);
        console.log(`   Taking Amount: ${ethers.formatUnits(order.takingAmount, 18)} WMATIC`);
        console.log(`   Rate: 1 USDC = ${ethers.formatUnits(BigInt(order.takingAmount) * BigInt(1e6) / BigInt(order.makingAmount), 18)} WMATIC`);
        
        console.log('✅ Order structure created successfully\n');
        return order;
    }

    /**
     * Step 2: Sign the order with EIP-712
     */
    async signOrder(order) {
        console.log('✍️ STEP 2: Signing Order with EIP-712');
        console.log('═══════════════════════════════════════════════════════════');
        
        console.log('🔐 EIP-712 Domain:');
        console.log(`   Name: ${this.domain.name}`);
        console.log(`   Version: ${this.domain.version}`);
        console.log(`   Chain ID: ${this.domain.chainId}`);
        console.log(`   Verifying Contract: ${this.domain.verifyingContract}`);
        
        console.log('📝 EIP-712 Types:');
        console.log('   Order:', this.types.Order.map(t => `${t.name}: ${t.type}`).join(', '));
        
        try {
            console.log('🖊️ Signing with maker wallet...');
            const signature = await this.makerWallet.signTypedData(this.domain, this.types, order);
            
            console.log(`✅ Signature: ${signature.slice(0, 20)}...${signature.slice(-10)}`);
            console.log(`📏 Signature length: ${signature.length} characters`);
            
            // Verify signature format
            if (signature.length === 132 && signature.startsWith('0x')) {
                console.log('✅ Signature format is valid');
            } else {
                console.log('⚠️ Signature format may be invalid');
            }
            
            console.log('✅ Order signed successfully\n');
            return signature;
            
        } catch (error) {
            console.log(`❌ Signing failed: ${error.message}\n`);
            throw error;
        }
    }

    /**
     * Step 3: Calculate and verify order hash
     */
    async calculateOrderHash(order) {
        console.log('🔢 STEP 3: Calculating Order Hash');
        console.log('═══════════════════════════════════════════════════════════');
        
        try {
            // Calculate order hash using ethers
            const orderHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['uint256', 'address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                    [order.salt, order.maker, order.receiver, order.makerAsset, order.takerAsset, order.makingAmount, order.takingAmount, order.makerTraits]
                )
            );
            
            console.log(`🔑 Order Hash: ${orderHash}`);
            console.log(`📏 Hash length: ${orderHash.length} characters`);
            
            // Verify hash format
            if (orderHash.length === 66 && orderHash.startsWith('0x')) {
                console.log('✅ Order hash format is valid');
            } else {
                console.log('⚠️ Order hash format may be invalid');
            }
            
            console.log('✅ Order hash calculated successfully\n');
            return orderHash;
            
        } catch (error) {
            console.log(`❌ Hash calculation failed: ${error.message}\n`);
            throw error;
        }
    }

    /**
     * Step 4: Check balances and approvals
     */
    async checkBalancesAndApprovals(order) {
        console.log('💰 STEP 4: Checking Balances and Approvals');
        console.log('═══════════════════════════════════════════════════════════');
        
        try {
            // Check maker USDC balance
            const makerBalance = await this.usdcContract.balanceOf(this.makerWallet.address);
            const requiredAmount = BigInt(order.makingAmount);
            
            console.log(`👤 Maker: ${this.makerWallet.address}`);
            console.log(`💰 USDC Balance: ${ethers.formatUnits(makerBalance, 6)} USDC`);
            console.log(`💰 Required: ${ethers.formatUnits(requiredAmount, 6)} USDC`);
            
            if (makerBalance >= requiredAmount) {
                console.log('✅ Maker has sufficient USDC balance');
            } else {
                console.log('❌ Maker has insufficient USDC balance');
                throw new Error(`Insufficient balance. Need ${ethers.formatUnits(requiredAmount, 6)} USDC, have ${ethers.formatUnits(makerBalance, 6)} USDC`);
            }
            
            // Check USDC allowance for LOP contract
            const allowance = await this.usdcContract.allowance(this.makerWallet.address, this.LOP_CONTRACT);
            console.log(`🔐 Current Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
            
            if (allowance >= requiredAmount) {
                console.log('✅ Sufficient allowance exists');
            } else {
                console.log('⚠️ Need to approve USDC for LOP contract');
                console.log('🔐 Approving USDC...');
                
                const approveTx = await this.usdcContract.approve(this.LOP_CONTRACT, requiredAmount, {
                    gasLimit: 100000
                });
                await approveTx.wait();
                
                console.log(`✅ USDC approved: ${approveTx.hash}`);
            }
            
            console.log('✅ Balances and approvals verified\n');
            
        } catch (error) {
            console.log(`❌ Balance/approval check failed: ${error.message}\n`);
            throw error;
        }
    }

    /**
     * Step 5: Submit order to 1inch API (optional)
     */
    async submitToAPI(order, signature, orderHash) {
        console.log('📤 STEP 5: Submitting to 1inch API (Optional)');
        console.log('═══════════════════════════════════════════════════════════');
        
        try {
            const orderData = {
                orderHash: orderHash,
                signature: signature,
                data: order
            };
            
            console.log('📦 Submission payload prepared');
            console.log(`🔑 Order Hash: ${orderHash.slice(0, 10)}...`);
            console.log(`✍️ Signature: ${signature.slice(0, 10)}...`);
            
            // Try different API endpoint formats
            const possibleEndpoints = [
                `${this.API_BASE_URL}/orderbook/v4.0/${this.chainId}/order`,
                `${this.API_BASE_URL}/orderbook/v4/${this.chainId}/order`, 
                `${this.API_BASE_URL}/orderbook/${this.chainId}/order`,
                `${this.API_BASE_URL}/limit-order/v4.0/${this.chainId}/order`,
                `${this.API_BASE_URL}/limit-order/v4/${this.chainId}/order`
            ];
            
            let response = null;
            let lastError = null;
            
            for (const endpoint of possibleEndpoints) {
                try {
                    console.log(`🔄 Trying endpoint: ${endpoint}`);
                    response = await axios.post(
                        endpoint,
                        orderData,
                        {
                            headers: {
                                'Authorization': `Bearer ${this.API_KEY}`,
                                'Content-Type': 'application/json',
                                'accept': 'application/json'
                            }
                        }
                    );
                    console.log(`✅ Success with endpoint: ${endpoint}`);
                    break;
                } catch (error) {
                    console.log(`❌ Failed: ${endpoint} - ${error.response?.status || error.message}`);
                    lastError = error;
                    continue;
                }
            }
            
            if (!response) {
                throw lastError;
            }
            
            console.log('✅ Order submitted to 1inch API successfully');
            console.log(`📋 API Response:`, response.data);
            console.log('✅ Order is now live on 1inch orderbook\n');
            
            return { success: true, response: response.data };
            
        } catch (error) {
            console.log(`⚠️ API submission failed: ${error.message}`);
            if (error.response?.data) {
                console.log(`📝 API Error Details:`, error.response.data);
            }
            console.log('💡 Order can still be filled directly via contract\n');
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute the complete order creation process
     */
    async createCompleteOrder() {
        console.log('🚀 1INCH LIMIT ORDER PROTOCOL - STEP BY STEP ORDER CREATION\n');
        
        try {
            // Use small amounts for testing
            const makingAmount = ethers.parseUnits('0.05', 6); // 0.05 USDC
            const takingAmount = ethers.parseUnits('0.025', 18); // 0.025 WMATIC (very conservative rate)
            
            console.log('🎯 Target Order:');
            console.log(`   ${ethers.formatUnits(makingAmount, 6)} USDC → ${ethers.formatUnits(takingAmount, 18)} WMATIC`);
            console.log(`   Rate: 1 USDC = ${ethers.formatUnits(takingAmount * BigInt(1e6) / makingAmount, 18)} WMATIC\n`);
            
            // Step 1: Create order structure
            const order = await this.createOrderStructure(makingAmount, takingAmount, 3600);
            
            // Step 2: Sign the order
            const signature = await this.signOrder(order);
            
            // Step 3: Calculate order hash
            const orderHash = await this.calculateOrderHash(order);
            
            // Step 4: Check balances and approvals
            await this.checkBalancesAndApprovals(order);
            
            // Step 5: Submit to API (optional)
            const apiResult = await this.submitToAPI(order, signature, orderHash);
            
            // Save order data for potential filling
            const orderData = {
                order,
                signature,
                orderHash,
                apiResult,
                timestamp: new Date().toISOString(),
                maker: this.makerWallet.address,
                taker: this.takerWallet.address
            };
            
            const orderPath = path.join(__dirname, '..', 'execution-proofs', `created-order-${Date.now()}.json`);
            fs.mkdirSync(path.dirname(orderPath), { recursive: true });
            fs.writeFileSync(orderPath, JSON.stringify(orderData, null, 2));
            
            console.log('🎉 ORDER CREATION COMPLETED SUCCESSFULLY');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('✅ Order structure created');
            console.log('✅ Order signed with EIP-712');
            console.log('✅ Order hash calculated');
            console.log('✅ Balances and approvals verified');
            console.log(`${apiResult.success ? '✅' : '⚠️'} API submission ${apiResult.success ? 'successful' : 'failed'}`);
            console.log('✅ Order data saved for future filling');
            console.log('');
            console.log('📊 FINAL ORDER SUMMARY:');
            console.log(`🔑 Order Hash: ${orderHash}`);
            console.log(`👤 Maker: ${this.makerWallet.address}`);
            console.log(`💰 Amount: ${ethers.formatUnits(makingAmount, 6)} USDC → ${ethers.formatUnits(takingAmount, 18)} WMATIC`);
            console.log(`📄 Order saved: ${orderPath}`);
            console.log('');
            console.log('🎯 NEXT STEP: Use this order data to test filling with taker wallet');
            
            return orderData;
            
        } catch (error) {
            console.error('❌ Order creation failed:', error.message);
            throw error;
        }
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        const lop = new StepByStepLOP();
        await lop.createCompleteOrder();
        
    } catch (error) {
        console.error('❌ Execution failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { StepByStepLOP };
