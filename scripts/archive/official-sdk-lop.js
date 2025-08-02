const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Import the official 1inch SDK
const { LimitOrder, MakerTraits, Address, Api, randBigInt } = require('@1inch/limit-order-sdk');

require('dotenv').config();

/**
 * Official 1inch SDK Implementation
 * Uses the official @1inch/limit-order-sdk for proper v4 integration
 */
class Official1inchSDK {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, this.provider);
        
        this.chainId = 137; // Polygon
        this.USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        this.WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        this.LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
        
        this.orders = [];
        this.fills = [];
        
        // Initialize the official API client
        this.api = new Api({
            authKey: process.env.ONEINCH_API_KEY,
            networkId: this.chainId
        });
        
        // Token contracts for approvals and balance checks
        this.makerUSDC = new ethers.Contract(
            this.USDC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)'
            ],
            this.makerWallet
        );
        
        this.takerWMATIC = new ethers.Contract(
            this.WMATIC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)'
            ],
            this.takerWallet
        );
        
        // LOP contract for direct fills - using minimal interface
        this.lopContract = new ethers.Contract(
            this.LOP_CONTRACT,
            [
                'function fillOrder((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256) order, bytes32 r, bytes32 vs, uint256 amount, uint256 takerTraits) external payable returns (uint256, uint256, bytes32)'
            ],
            this.takerWallet
        );
    }

    /**
     * Ensure maker has approved USDC
     */
    async ensureMakerApproval(amount) {
        console.log(`🔐 Checking maker USDC approval...`);
        
        const allowance = await this.makerUSDC.allowance(this.makerWallet.address, this.LOP_CONTRACT);
        console.log(`💰 Current allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
        
        if (allowance < amount) {
            console.log(`🔐 Approving USDC for LOP contract...`);
            const approveTx = await this.makerUSDC.approve(this.LOP_CONTRACT, amount);
            await approveTx.wait();
            console.log(`✅ USDC approved for maker`);
        } else {
            console.log(`✅ Maker USDC already approved`);
        }
    }

    /**
     * Create limit order using official SDK
     */
    async createLimitOrder(makingAmount, takingAmount, duration = 3600) {
        console.log(`🎯 Creating limit order with official SDK...`);
        
        try {
            // Calculate expiration
            const expiresIn = BigInt(duration);
            const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn;
            
            // Create maker traits with expiration and nonce
            const UINT_40_MAX = (1n << 40n) - 1n;
            const makerTraits = MakerTraits.default()
                .withExpiration(expiration)
                .withNonce(randBigInt(UINT_40_MAX));
            
            console.log(`📝 Order parameters:`);
            console.log(`   💰 Making: ${ethers.formatUnits(makingAmount, 6)} USDC`);
            console.log(`   💰 Taking: ${ethers.formatUnits(takingAmount, 18)} WMATIC`);
            console.log(`   ⏰ Expires: ${new Date(Number(expiration) * 1000).toISOString()}`);
            
            // Create order directly using LimitOrder class
            const order = new LimitOrder({
                makerAsset: new Address(this.USDC_ADDRESS),
                takerAsset: new Address(this.WMATIC_ADDRESS),
                makingAmount: makingAmount,
                takingAmount: takingAmount,
                maker: new Address(this.makerWallet.address)
            }, makerTraits);
            
            console.log(`✅ Order created with SDK`);
            return { order, makerTraits };
            
        } catch (error) {
            console.log(`❌ Order creation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sign order using official SDK
     */
    async signOrder(order) {
        console.log(`🔐 Signing order with maker wallet...`);
        
        try {
            const typedData = order.getTypedData();
            
            const signature = await this.makerWallet.signTypedData(
                typedData.domain,
                { Order: typedData.types.Order },
                typedData.message
            );
            
            console.log(`📤 Submitting order to 1inch orderbook...`);
            try {
                // Use axios directly for API submission
                const orderHash = order.getOrderHash(this.chainId);
                const makerTraitsValue = order.makerTraits.value;
                const orderData = {
                    orderHash,
                    signature,
                    data: {
                        makerAsset: order.makerAsset.val,
                        takerAsset: order.takerAsset.val,
                        makingAmount: order.makingAmount.toString(),
                        takingAmount: order.takingAmount.toString(),
                        maker: order.maker.val,
                        receiver: order.receiver.val,
                        salt: order.salt.toString(),
                        makerTraits: makerTraitsValue.toString()
                    }
                };
                
                const response = await axios.post(
                    `https://api.1inch.dev/orderbook/v4.0/137/order`,
                    orderData,
                    {
                        headers: {
                            'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                console.log(`✅ Order submitted to orderbook successfully`);
                console.log(`📋 API Response:`, response.data);
                
                // Save successful submission proof
                const submissionProof = {
                    timestamp: Date.now(),
                    orderHash,
                    signature,
                    submissionMethod: 'API_ORDERBOOK',
                    status: 'SUBMITTED',
                    apiResponse: response.data,
                    viewUrl: `https://app.1inch.io/#/137/limit-order/${orderHash}`
                };
                
                const submissionFile = `execution-proofs/submitted-order-${Date.now()}.json`;
                fs.writeFileSync(submissionFile, JSON.stringify(submissionProof, null, 2));
                console.log(`📄 Submission proof saved: ${submissionFile}`);
                
                return { success: true, method: 'API_ORDERBOOK', orderHash };
                
            } catch (error) {
                console.log(`❌ Orderbook submission failed: ${error.message}`);
                if (error.response) {
                    console.log(`📋 Error response:`, error.response.data);
                }
                console.log(`⚠️  Will attempt direct contract fill instead`);
            }
            
            console.log(`✅ Order signed: ${signature.slice(0, 10)}...`);
            return signature;
            
        } catch (error) {
            console.log(`❌ Signing failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Submit order to 1inch orderbook
     */
    async submitOrder(order, signature) {
        console.log(`📤 Submitting order to 1inch orderbook...`);
        
        try {
            const result = await this.api.submitOrder(order, signature);
            console.log(`✅ Order submitted to orderbook`);
            console.log(`📋 Result:`, result);
            return { success: true, result };
            
        } catch (error) {
            console.log(`❌ Orderbook submission failed: ${error.message}`);
            console.log(`⚠️  Will attempt direct contract fill instead`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fill order directly via contract (fallback method)
     */
    async fillOrderDirect(order, signature, fillAmount) {
        console.log(`⚡ Filling order directly via contract...`);
        
        try {
            // Ensure taker has WMATIC and approval
            const requiredWMATIC = BigInt(order.takingAmount.toString());
            const takerBalance = await this.takerWMATIC.balanceOf(this.takerWallet.address);
            
            console.log(`💰 Required WMATIC: ${ethers.formatUnits(requiredWMATIC, 18)}`);
            console.log(`💰 Taker balance: ${ethers.formatUnits(takerBalance, 18)}`);
            
            if (takerBalance < requiredWMATIC) {
                throw new Error(`Insufficient WMATIC balance`);
            }
            
            // Check and set approval
            const allowance = await this.takerWMATIC.allowance(this.takerWallet.address, this.LOP_CONTRACT);
            if (allowance < requiredWMATIC) {
                console.log(`🔐 Approving WMATIC...`);
                const approveTx = await this.takerWMATIC.approve(this.LOP_CONTRACT, requiredWMATIC);
                await approveTx.wait();
                console.log(`✅ WMATIC approved`);
            }
            
            // Get order hash
            const orderHash = order.getOrderHash(this.chainId);
            console.log(`📋 Order hash: ${orderHash}`);
            
            // Skip remaining check - proceed directly to fill
            
            // Debug order structure
            console.log(`🔍 Order object keys:`, Object.keys(order));
            console.log(`🔍 MakerTraits object:`, order.makerTraits);
            console.log(`🔍 MakerTraits.value:`, order.makerTraits.value);
            console.log(`🔍 MakerTraits.value type:`, typeof order.makerTraits.value);
            
            // Try to get the actual BigInt value
            let makerTraitsValue;
            if (typeof order.makerTraits.value === 'object' && order.makerTraits.value.value) {
                makerTraitsValue = order.makerTraits.value.value;
            } else if (typeof order.makerTraits.value === 'bigint') {
                makerTraitsValue = order.makerTraits.value;
            } else {
                makerTraitsValue = BigInt(order.makerTraits.value.toString());
            }
            
            console.log(`🔧 Final makerTraits value:`, makerTraitsValue.toString());
            
            // Convert order to contract format using correct SDK structure
            const orderStruct = [
                order.salt,
                order.maker.val,  // SDK uses .val not .value
                order.receiver.val || order.maker.val,
                order.makerAsset.val,
                order.takerAsset.val,
                order.makingAmount,
                order.takingAmount,
                makerTraitsValue  // Use the properly extracted value
            ];
            
            console.log(`🔧 Order struct:`, orderStruct.map(v => v.toString()));
            
            // Split signature
            const sig = ethers.Signature.from(signature);
            const r = sig.r;
            const vs = sig.yParityAndS;
            
            // Execute fill
            console.log(`🎯 Executing fillOrder...`);
            const tx = await this.lopContract.fillOrder(
                orderStruct,
                r,
                vs,
                fillAmount,
                0, // takerTraits
                { gasLimit: 500000 }
            );
            
            console.log(`📝 Fill TX: ${tx.hash}`);
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log(`✅ ORDER FILLED SUCCESSFULLY!`);
                console.log(`🔗 https://polygonscan.com/tx/${tx.hash}`);
                return { 
                    success: true, 
                    txHash: tx.hash, 
                    blockNumber: receipt.blockNumber 
                };
            } else {
                return { success: false, txHash: tx.hash };
            }
            
        } catch (error) {
            console.log(`❌ Direct fill failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute complete flow
     */
    async executeFlow() {
        try {
            console.log('🚀 Starting Official 1inch SDK Flow');
            console.log('════════════════════════════════════════');
            
            // Check balances
            const makerBalance = await this.makerUSDC.balanceOf(this.makerWallet.address);
            const takerBalance = await this.takerWMATIC.balanceOf(this.takerWallet.address);
            
            console.log(`👤 Maker USDC: ${ethers.formatUnits(makerBalance, 6)}`);
            console.log(`👤 Taker WMATIC: ${ethers.formatUnits(takerBalance, 18)}`);
            
            // Create order (0.05 USDC for 0.25 WMATIC)
            const makingAmount = ethers.parseUnits('0.05', 6);
            const takingAmount = ethers.parseUnits('0.25', 18);
            
            // Ensure maker approval
            await this.ensureMakerApproval(makingAmount);
            
            // Create order
            const { order, makerTraits } = await this.createLimitOrder(makingAmount, takingAmount, 3600);
            
            // Sign order
            const signature = await this.signOrder(order);
            
            // Get order hash
            const orderHash = order.getOrderHash(this.chainId);
            console.log(`📋 Order Hash: ${orderHash}`);
            
            // Store order
            this.orders.push({
                order: {
                    salt: order.salt.toString(),
                    maker: order.maker.value,
                    receiver: order.receiver?.value || order.maker.value,
                    makerAsset: order.makerAsset.value,
                    takerAsset: order.takerAsset.value,
                    makingAmount: order.makingAmount.toString(),
                    takingAmount: order.takingAmount.toString(),
                    makerTraits: order.makerTraits.value.toString()
                },
                signature,
                orderHash,
                timestamp: new Date().toISOString()
            });
            
            // Try to submit to orderbook
            const submissionResult = await this.submitOrder(order, signature);
            
            // Wait before attempting fill
            console.log('⏳ Waiting 5 seconds before fill attempt...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Try direct fill regardless of submission result
            const fillResult = await this.fillOrderDirect(order, signature, makingAmount);
            
            if (fillResult.success) {
                this.fills.push({
                    orderHash,
                    txHash: fillResult.txHash,
                    blockNumber: fillResult.blockNumber,
                    timestamp: new Date().toISOString(),
                    method: 'direct_contract_fill'
                });
            }
            
            // Generate report
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Flow execution failed:', error.message);
            throw error;
        }
    }

    /**
     * Generate execution report
     */
    async generateReport() {
        console.log('');
        console.log('📊 EXECUTION REPORT');
        console.log('════════════════════════════════════════');
        console.log(`📋 Orders Created: ${this.orders.length}`);
        console.log(`✅ Orders Filled: ${this.fills.length}`);
        
        // Save proof
        const proof = {
            timestamp: new Date().toISOString(),
            protocol: '1inch Limit Order Protocol v4 (Official SDK)',
            chain: 'Polygon',
            chainId: this.chainId,
            maker: this.makerWallet.address,
            taker: this.takerWallet.address,
            orders: this.orders,
            fills: this.fills
        };
        
        const proofPath = path.join(__dirname, '..', 'execution-proofs', `official-sdk-lop-${Date.now()}.json`);
        fs.mkdirSync(path.dirname(proofPath), { recursive: true });
        fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
        
        console.log(`📄 Proof saved: ${proofPath}`);
        
        if (this.fills.length > 0) {
            console.log('🎉 OFFICIAL SDK IMPLEMENTATION SUCCESS!');
            console.log('🏆 REAL LIMIT ORDER EXECUTED ON-CHAIN!');
        } else {
            console.log('⚠️  Orders created but fills failed - check logs above');
        }
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        const officialSDK = new Official1inchSDK();
        await officialSDK.executeFlow();
        
    } catch (error) {
        console.error('❌ Execution failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { Official1inchSDK };
