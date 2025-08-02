const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

/**
 * FIXED 1inch Limit Order Protocol v4 Implementation
 * Uses correct v4 contract interface and order structure
 * Addresses the contract call revert issues
 */
class Fixed1inchLOPv4 {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, this.provider);
        
        this.chainId = 137; // Polygon
        this.USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        this.WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        this.LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65'; // 1inch LOP v4
        
        this.orders = [];
        this.fills = [];
        
        // Token contracts
        this.makerUSDC = new ethers.Contract(
            this.USDC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)',
                'function decimals() view returns (uint8)'
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

        // Correct 1inch LOP v4 contract interface
        this.lopContract = new ethers.Contract(
            this.LOP_CONTRACT,
            [
                // v4 fillOrder function with correct signature
                'function fillOrder((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256) order, bytes32 r, bytes32 vs, uint256 amount, uint256 takerTraits) external payable returns (uint256, uint256, bytes32)',
                'function hashOrder((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256) order) external view returns (bytes32)',
                'function remaining(bytes32 orderHash) external view returns (uint256)',
                // Get the EIP-712 domain
                'function eip712Domain() external view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)'
            ],
            this.takerWallet
        );

        // Correct EIP-712 Domain for v4 (will be fetched from contract)
        this.domain = null; // Will be set dynamically
        
        // v4 Order type structure (packed addresses as uint256)
        this.types = {
            Order: [
                { name: 'salt', type: 'uint256' },
                { name: 'maker', type: 'uint256' },      // Packed address
                { name: 'receiver', type: 'uint256' },   // Packed address  
                { name: 'makerAsset', type: 'uint256' }, // Packed address
                { name: 'takerAsset', type: 'uint256' }, // Packed address
                { name: 'makingAmount', type: 'uint256' },
                { name: 'takingAmount', type: 'uint256' },
                { name: 'makerTraits', type: 'uint256' }
            ]
        };
    }

    /**
     * Initialize the contract domain
     */
    async initialize() {
        try {
            console.log('🔧 Initializing 1inch LOP v4 contract...');
            
            // Get EIP-712 domain from contract
            const domainInfo = await this.lopContract.eip712Domain();
            
            this.domain = {
                name: domainInfo.name,
                version: domainInfo.version,
                chainId: Number(domainInfo.chainId),
                verifyingContract: domainInfo.verifyingContract
            };
            
            console.log(`✅ Domain initialized: ${this.domain.name} v${this.domain.version}`);
            console.log(`📋 Contract: ${this.domain.verifyingContract}`);
            console.log(`🌐 Chain ID: ${this.domain.chainId}`);
            
        } catch (error) {
            console.log('⚠️  Could not fetch domain from contract, using defaults');
            // Fallback to known v4 domain
            this.domain = {
                name: '1inch Aggregation Router',
                version: '6',
                chainId: this.chainId,
                verifyingContract: this.LOP_CONTRACT
            };
        }
    }

    /**
     * Pack address to uint256 for v4 format
     */
    packAddress(address) {
        // Remove 0x prefix and pad to 64 characters, then convert to BigInt
        const cleanAddress = address.toLowerCase().replace('0x', '');
        const paddedAddress = cleanAddress.padStart(64, '0');
        return BigInt('0x' + paddedAddress);
    }

    /**
     * Create a v4 limit order with correct structure
     */
    async createLimitOrder(makingAmount, takingAmount, duration = 3600) {
        console.log(`🎯 Creating 1inch LOP v4 Order...`);
        
        // Generate random salt
        const salt = BigInt(Math.floor(Math.random() * 1000000));
        
        // Calculate expiration
        const expiration = Math.floor(Date.now() / 1000) + duration;
        
        // Create v4 order with packed addresses
        const order = {
            salt: salt,
            maker: this.packAddress(this.makerWallet.address),
            receiver: this.packAddress(this.makerWallet.address), // Maker receives
            makerAsset: this.packAddress(this.USDC_ADDRESS),
            takerAsset: this.packAddress(this.WMATIC_ADDRESS),
            makingAmount: makingAmount,
            takingAmount: takingAmount,
            makerTraits: BigInt(0) // Basic order, no special traits
        };
        
        console.log(`📝 Order created:`);
        console.log(`   💰 Making: ${ethers.formatUnits(makingAmount, 6)} USDC`);
        console.log(`   💰 Taking: ${ethers.formatUnits(takingAmount, 18)} WMATIC`);
        console.log(`   ⏰ Expires: ${new Date(expiration * 1000).toISOString()}`);
        
        return order;
    }

    /**
     * Sign order with maker wallet using correct EIP-712
     */
    async signOrder(order) {
        console.log(`🔐 Signing order with maker wallet...`);
        
        try {
            // Sign with EIP-712
            const signature = await this.makerWallet.signTypedData(
                this.domain,
                this.types,
                order
            );
            
            console.log(`✅ Order signed: ${signature.slice(0, 10)}...`);
            return signature;
            
        } catch (error) {
            console.log(`❌ Signing failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get order hash from contract
     */
    async getOrderHash(order) {
        try {
            // Convert order to tuple format for contract call
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
            
            const hash = await this.lopContract.hashOrder(orderTuple);
            return hash;
            
        } catch (error) {
            console.log(`❌ Hash calculation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Convert signature to compact format (r, vs)
     */
    splitSignature(signature) {
        const sig = ethers.Signature.from(signature);
        
        // Compact signature format for v4
        const r = sig.r;
        const vs = sig.yParityAndS;
        
        return { r, vs };
    }

    /**
     * Fill order using taker wallet with correct v4 interface
     */
    async fillOrder(order, signature, fillAmount) {
        console.log(`⚡ Filling order with taker wallet...`);
        
        try {
            // Ensure taker has WMATIC and approval
            const requiredWMATIC = BigInt(order.takingAmount);
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
            
            // Convert order to tuple
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
            
            // Split signature to compact format
            const { r, vs } = this.splitSignature(signature);
            
            // Fill the order with correct v4 parameters
            console.log(`🎯 Executing fillOrder...`);
            const tx = await this.lopContract.fillOrder(
                orderTuple,
                r,
                vs,
                fillAmount,
                0, // takerTraits (basic fill)
                { 
                    gasLimit: 500000,
                    value: 0 // No ETH needed for ERC20 swap
                }
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
                console.log(`❌ Fill transaction failed`);
                return { success: false, txHash: tx.hash };
            }
            
        } catch (error) {
            console.log(`❌ Fill failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Ensure maker has approved USDC for LOP contract
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
     * Execute complete flow
     */
    async executeFlow() {
        try {
            console.log('🚀 Starting Fixed 1inch LOP v4 Flow');
            console.log('════════════════════════════════════════');
            
            // Initialize contract
            await this.initialize();
            
            // Check balances
            const makerBalance = await this.makerUSDC.balanceOf(this.makerWallet.address);
            const takerBalance = await this.takerWMATIC.balanceOf(this.takerWallet.address);
            
            console.log(`👤 Maker USDC: ${ethers.formatUnits(makerBalance, 6)}`);
            console.log(`👤 Taker WMATIC: ${ethers.formatUnits(takerBalance, 18)}`);
            
            // Create order (0.05 USDC for 0.25 WMATIC)
            const makingAmount = ethers.parseUnits('0.05', 6);
            const takingAmount = ethers.parseUnits('0.25', 18);
            
            // Ensure maker approval BEFORE creating order
            await this.ensureMakerApproval(makingAmount);
            
            const order = await this.createLimitOrder(makingAmount, takingAmount, 3600);
            
            // Sign order
            const signature = await this.signOrder(order);
            
            // Get order hash
            const orderHash = await this.getOrderHash(order);
            console.log(`📋 Order Hash: ${orderHash}`);
            
            // Store order
            this.orders.push({
                order,
                signature,
                orderHash,
                timestamp: new Date().toISOString()
            });
            
            // Wait a moment then fill
            console.log('⏳ Waiting 5 seconds before fill...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Fill order
            const fillResult = await this.fillOrder(order, signature, makingAmount);
            
            if (fillResult.success) {
                this.fills.push({
                    orderHash,
                    txHash: fillResult.txHash,
                    blockNumber: fillResult.blockNumber,
                    timestamp: new Date().toISOString()
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
        
        // Save proof (with BigInt serialization)
        const proof = {
            timestamp: new Date().toISOString(),
            protocol: '1inch Limit Order Protocol v4 (FIXED)',
            chain: 'Polygon',
            chainId: this.chainId,
            domain: this.domain,
            maker: this.makerWallet.address,
            taker: this.takerWallet.address,
            orders: this.orders.map(o => ({
                ...o,
                order: {
                    ...o.order,
                    salt: o.order.salt.toString(),
                    maker: o.order.maker.toString(),
                    receiver: o.order.receiver.toString(),
                    makerAsset: o.order.makerAsset.toString(),
                    takerAsset: o.order.takerAsset.toString(),
                    makingAmount: o.order.makingAmount.toString(),
                    takingAmount: o.order.takingAmount.toString(),
                    makerTraits: o.order.makerTraits.toString()
                }
            })),
            fills: this.fills
        };
        
        const proofPath = path.join(__dirname, '..', 'execution-proofs', `fixed-v4-lop-${Date.now()}.json`);
        fs.mkdirSync(path.dirname(proofPath), { recursive: true });
        fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
        
        console.log(`📄 Proof saved: ${proofPath}`);
        
        if (this.fills.length > 0) {
            console.log('🎉 FIXED V4 IMPLEMENTATION SUCCESS!');
        } else {
            console.log('⚠️  Orders created but fills failed');
        }
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        const fixedLOP = new Fixed1inchLOPv4();
        await fixedLOP.executeFlow();
        
    } catch (error) {
        console.error('❌ Execution failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { Fixed1inchLOPv4 };
