const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Import the official 1inch SDK
const { LimitOrder, MakerTraits, Address, randBigInt, Api } = require('@1inch/limit-order-sdk');
const { AxiosProviderConnector } = require('@1inch/limit-order-sdk/axios');

require('dotenv').config();

/**
 * Working 1inch Limit Order API Implementation
 * Focuses on proper API submission to 1inch orderbook
 */
class Working1inchLimitOrderAPI {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        this.chainId = 137; // Polygon
        this.USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        this.WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        this.LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
        
        this.orders = [];
        
        // Initialize the official API
        this.api = new Api({
            authKey: process.env.ONEINCH_API_KEY,
            networkId: this.chainId,
            httpConnector: new AxiosProviderConnector()
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
    }

    /**
     * Check and display balances
     */
    async checkBalances() {
        const makerUSDCBalance = await this.makerUSDC.balanceOf(this.makerWallet.address);
        console.log(`👤 Maker USDC: ${ethers.formatUnits(makerUSDCBalance, 6)}`);
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
            
            // Create maker traits with expiration
            const UINT_40_MAX = (1n << 40n) - 1n;  // Use 40-bit for nonce
            const makerTraits = MakerTraits.default()
                .withExpiration(expiration)
                .withNonce(randBigInt(UINT_40_MAX));
            
            console.log(`📝 Order parameters:`);
            console.log(`   💰 Making: ${ethers.formatUnits(makingAmount, 6)} USDC`);
            console.log(`   💰 Taking: ${ethers.formatUnits(takingAmount, 18)} WMATIC`);
            console.log(`   ⏰ Expires: ${new Date(Number(expiration) * 1000).toISOString()}`);
            
            // Create the order manually (API doesn't have createOrder method)
            const order = new LimitOrder({
                makerAsset: new Address(this.USDC_ADDRESS),
                takerAsset: new Address(this.WMATIC_ADDRESS),
                makingAmount: makingAmount.toString(),
                takingAmount: takingAmount.toString(),
                maker: new Address(this.makerWallet.address),
                receiver: new Address('0x0000000000000000000000000000000000000000'),
                salt: randBigInt(UINT_40_MAX)
            }, makerTraits);
            
            console.log(`✅ Order created with SDK`);
            return { order, makerTraits };
            
        } catch (error) {
            console.error('❌ Order creation failed:', error.message);
            throw error;
        }
    }

    /**
     * Sign order using official SDK
     */
    async signOrder(order) {
        console.log(`🔐 Signing order with maker wallet...`);
        
        try {
            // Get typed data for signing
            const typedData = order.getTypedData(this.chainId);
            
            // Sign with maker wallet
            const signature = await this.makerWallet.signTypedData(
                typedData.domain,
                { Order: typedData.types.Order },
                typedData.message
            );
            
            console.log(`✅ Order signed: ${signature.slice(0, 10)}...`);
            return signature;
            
        } catch (error) {
            console.error('❌ Order signing failed:', error.message);
            throw error;
        }
    }

    /**
     * Submit order to 1inch orderbook via official SDK
     */
    async submitOrderToAPI(order, signature) {
        console.log(`📤 Submitting order to 1inch orderbook API...`);
        
        try {
            const orderHash = order.getOrderHash(this.chainId);
            console.log(`📋 Order Hash: ${orderHash}`);
            console.log(`📦 Submitting via official SDK...`);
            
            // Use the official API to submit the order
            await this.api.submitOrder(order, signature);
            
            console.log(`✅ Order submitted to orderbook successfully!`);
            
            // Save successful submission proof
            const submissionProof = {
                timestamp: Date.now(),
                orderHash,
                signature,
                submissionMethod: 'OFFICIAL_SDK',
                status: 'SUBMITTED',
                viewUrl: `https://app.1inch.io/#/137/limit-order/${orderHash}`,
                polygonscanUrl: `https://polygonscan.com/address/${this.LOP_CONTRACT}`
            };
            
            const submissionFile = path.join(__dirname, '..', 'execution-proofs', `sdk-submitted-order-${Date.now()}.json`);
            fs.mkdirSync(path.dirname(submissionFile), { recursive: true });
            fs.writeFileSync(submissionFile, JSON.stringify(submissionProof, null, 2));
            console.log(`📄 Submission proof saved: ${submissionFile}`);
            
            return { success: true, orderHash };
            
        } catch (error) {
            console.log(`❌ SDK submission failed: ${error.message}`);
            
            // Save failed submission proof
            const failedProof = {
                timestamp: Date.now(),
                orderHash: order.getOrderHash(this.chainId),
                signature,
                submissionMethod: 'OFFICIAL_SDK',
                status: 'FAILED',
                error: error.message
            };
            
            const failedFile = path.join(__dirname, '..', 'execution-proofs', `sdk-failed-order-${Date.now()}.json`);
            fs.mkdirSync(path.dirname(failedFile), { recursive: true });
            fs.writeFileSync(failedFile, JSON.stringify(failedProof, null, 2));
            console.log(`📄 Failed submission proof saved: ${failedFile}`);
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute complete flow
     */
    async executeFlow() {
        console.log('🚀 Starting Working 1inch API Flow');
        console.log('════════════════════════════════════════');
        
        try {
            // Check balances
            await this.checkBalances();
            
            // Define order parameters
            const makingAmount = ethers.parseUnits('0.05', 6); // 0.05 USDC
            const takingAmount = ethers.parseUnits('0.25', 18); // 0.25 WMATIC
            
            // Ensure approval
            await this.ensureMakerApproval(makingAmount);
            
            // Create order
            const { order } = await this.createLimitOrder(makingAmount, takingAmount, 3600);
            
            // Sign order
            const signature = await this.signOrder(order);
            
            // Submit via official SDK
            const submissionResult = await this.submitOrderToAPI(order, signature);
            
            // Store order
            this.orders.push({
                order: {
                    salt: order.salt.toString(),
                    maker: order.maker.val,
                    receiver: order.receiver.val,
                    makerAsset: order.makerAsset.val,
                    takerAsset: order.takerAsset.val,
                    makingAmount: order.makingAmount.toString(),
                    takingAmount: order.takingAmount.toString(),
                    makerTraits: order.makerTraits.value.toString()
                },
                signature,
                orderHash: order.getOrderHash(this.chainId),
                timestamp: new Date().toISOString(),
                submissionResult
            });
            
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
        
        const successfulSubmissions = this.orders.filter(o => o.submissionResult?.success).length;
        console.log(`✅ Orders Submitted to API: ${successfulSubmissions}`);
        
        // Save proof
        const proof = {
            timestamp: new Date().toISOString(),
            protocol: '1inch Limit Order Protocol v4 (API Submission)',
            chain: 'Polygon',
            chainId: this.chainId,
            maker: this.makerWallet.address,
            orders: this.orders,
            summary: {
                ordersCreated: this.orders.length,
                ordersSubmitted: successfulSubmissions
            }
        };
        
        const proofPath = path.join(__dirname, '..', 'execution-proofs', `working-api-lop-${Date.now()}.json`);
        fs.mkdirSync(path.dirname(proofPath), { recursive: true });
        fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
        
        console.log(`📄 Proof saved: ${proofPath}`);
        
        if (successfulSubmissions > 0) {
            console.log('🎉 API SUBMISSION SUCCESS!');
            console.log('🏆 REAL LIMIT ORDER SUBMITTED TO 1INCH ORDERBOOK!');
            console.log('📱 Orders are now live and can be filled by anyone');
            console.log('🔗 Check orders at: https://app.1inch.io/#/137/limit-order');
        } else {
            console.log('⚠️  Orders created but API submission failed - check logs above');
        }
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        const workingAPI = new Working1inchLimitOrderAPI();
        await workingAPI.executeFlow();
        
    } catch (error) {
        console.error('❌ Execution failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { Working1inchLimitOrderAPI };
