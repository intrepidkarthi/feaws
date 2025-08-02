const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

/**
 * Fill a created limit order directly via contract (bypassing API)
 * This demonstrates real maker/taker limit order execution
 */
class DirectOrderFiller {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, this.provider);
        
        this.chainId = 137; // Polygon
        this.USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        this.WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        this.LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65'; // 1inch LOP v4
        
        // Contracts for taker
        this.takerUSDC = new ethers.Contract(
            this.USDC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)',
                'function decimals() view returns (uint8)'
            ],
            this.takerWallet
        );
        
        this.takerWMATIC = new ethers.Contract(
            this.WMATIC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)',
                'function decimals() view returns (uint8)'
            ],
            this.takerWallet
        );

        // 1inch LOP v4 contract for filling orders
        this.lopContract = new ethers.Contract(
            this.LOP_CONTRACT,
            [
                // v4 fillOrder function with correct structure
                'function fillOrder((uint256,address,address,address,address,uint256,uint256,uint256) order, bytes signature, uint256 makingAmount, uint256 takingAmount, uint256 skipPermitAndThresholdAmount) external returns (uint256, uint256)',
                'function hashOrder((uint256,address,address,address,address,uint256,uint256,uint256) order) external view returns (bytes32)',
                'function remaining(bytes32 orderHash) external view returns (uint256)'
            ],
            this.takerWallet
        );
    }

    /**
     * Load the most recent created order
     */
    loadLatestOrder() {
        console.log('📂 LOADING LATEST CREATED ORDER');
        console.log('═══════════════════════════════════════════════════════════');
        
        const proofsDir = path.join(__dirname, '..', 'execution-proofs');
        
        if (!fs.existsSync(proofsDir)) {
            throw new Error('No execution-proofs directory found');
        }
        
        const files = fs.readdirSync(proofsDir)
            .filter(file => file.startsWith('created-order-') && file.endsWith('.json'))
            .sort()
            .reverse(); // Get most recent first
        
        if (files.length === 0) {
            throw new Error('No created order files found. Run step-by-step-lop.js first');
        }
        
        const latestFile = files[0];
        const filePath = path.join(proofsDir, latestFile);
        
        console.log(`📄 Loading: ${latestFile}`);
        
        const orderData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        console.log('📋 Order Details:');
        console.log(`   Order Hash: ${orderData.orderHash}`);
        console.log(`   Maker: ${orderData.order.maker}`);
        console.log(`   Making Amount: ${ethers.formatUnits(orderData.order.makingAmount, 6)} USDC`);
        console.log(`   Taking Amount: ${ethers.formatUnits(orderData.order.takingAmount, 18)} WMATIC`);
        console.log(`   Created: ${orderData.timestamp}`);
        console.log('✅ Order loaded successfully\n');
        
        return orderData;
    }

    /**
     * Verify order hash matches what contract would calculate
     */
    async verifyOrderHash(orderData) {
        console.log('🔍 VERIFYING ORDER HASH');
        console.log('═══════════════════════════════════════════════════════════');
        
        try {
            const order = orderData.order;
            
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
            
            console.log('📝 Order tuple for contract:');
            console.log(`   Salt: ${order.salt}`);
            console.log(`   Maker: ${order.maker}`);
            console.log(`   Receiver: ${order.receiver}`);
            console.log(`   Maker Asset: ${order.makerAsset}`);
            console.log(`   Taker Asset: ${order.takerAsset}`);
            console.log(`   Making Amount: ${order.makingAmount}`);
            console.log(`   Taking Amount: ${order.takingAmount}`);
            console.log(`   Maker Traits: ${order.makerTraits}`);
            
            // Get hash from contract
            const contractHash = await this.lopContract.hashOrder(orderTuple);
            
            console.log(`🔑 Expected Hash: ${orderData.orderHash}`);
            console.log(`🔑 Contract Hash: ${contractHash}`);
            
            if (contractHash.toLowerCase() === orderData.orderHash.toLowerCase()) {
                console.log('✅ Order hash verification successful');
                return true;
            } else {
                console.log('❌ Order hash mismatch!');
                return false;
            }
            
        } catch (error) {
            console.log(`❌ Hash verification failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Check order remaining amount
     */
    async checkOrderRemaining(orderHash) {
        console.log('📊 CHECKING ORDER STATUS');
        console.log('═══════════════════════════════════════════════════════════');
        
        try {
            const remaining = await this.lopContract.remaining(orderHash);
            
            console.log(`📈 Remaining amount: ${remaining.toString()}`);
            
            if (remaining > 0) {
                console.log('✅ Order is active and can be filled');
                return remaining;
            } else {
                console.log('❌ Order is already filled or cancelled');
                return BigInt(0);
            }
            
        } catch (error) {
            console.log(`❌ Status check failed: ${error.message}`);
            return BigInt(0);
        }
    }

    /**
     * Prepare taker for filling (check balances and approvals)
     */
    async prepareTaker(orderData) {
        console.log('💰 PREPARING TAKER FOR FILL');
        console.log('═══════════════════════════════════════════════════════════');
        
        const order = orderData.order;
        const requiredWMATIC = BigInt(order.takingAmount);
        
        console.log(`👤 Taker: ${this.takerWallet.address}`);
        console.log(`💰 Required WMATIC: ${ethers.formatUnits(requiredWMATIC, 18)}`);
        
        // Check WMATIC balance
        const wmaticBalance = await this.takerWMATIC.balanceOf(this.takerWallet.address);
        console.log(`💰 Taker WMATIC Balance: ${ethers.formatUnits(wmaticBalance, 18)}`);
        
        if (wmaticBalance < requiredWMATIC) {
            console.log('❌ Insufficient WMATIC balance');
            throw new Error(`Need ${ethers.formatUnits(requiredWMATIC, 18)} WMATIC, have ${ethers.formatUnits(wmaticBalance, 18)}`);
        }
        
        console.log('✅ Sufficient WMATIC balance');
        
        // Check WMATIC allowance
        const allowance = await this.takerWMATIC.allowance(this.takerWallet.address, this.LOP_CONTRACT);
        console.log(`🔐 Current WMATIC Allowance: ${ethers.formatUnits(allowance, 18)}`);
        
        if (allowance < requiredWMATIC) {
            console.log('🔐 Approving WMATIC for LOP contract...');
            const approveTx = await this.takerWMATIC.approve(this.LOP_CONTRACT, requiredWMATIC, {
                gasLimit: 100000
            });
            await approveTx.wait();
            console.log(`✅ WMATIC approved: ${approveTx.hash}`);
        } else {
            console.log('✅ Sufficient WMATIC allowance exists');
        }
        
        console.log('✅ Taker prepared for fill\n');
    }

    /**
     * Execute the order fill
     */
    async fillOrder(orderData) {
        console.log('⚡ EXECUTING REAL LIMIT ORDER FILL');
        console.log('═══════════════════════════════════════════════════════════');
        
        try {
            const order = orderData.order;
            
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
            
            console.log('🎯 Executing fillOrder on contract...');
            console.log(`📝 Contract: ${this.LOP_CONTRACT}`);
            console.log(`👤 Taker: ${this.takerWallet.address}`);
            console.log(`💰 Filling: ${ethers.formatUnits(order.makingAmount, 6)} USDC → ${ethers.formatUnits(order.takingAmount, 18)} WMATIC`);
            
            // Execute the fill
            const tx = await this.lopContract.fillOrder(
                orderTuple,
                orderData.signature,
                order.makingAmount,
                order.takingAmount,
                0, // skipPermitAndThresholdAmount
                { gasLimit: 500000 }
            );
            
            console.log(`📝 Fill Transaction: ${tx.hash}`);
            console.log('⏳ Waiting for confirmation...');
            
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log('🎉 REAL LIMIT ORDER FILLED SUCCESSFULLY!');
                console.log(`🔗 https://polygonscan.com/tx/${tx.hash}`);
                console.log(`📊 Block: ${receipt.blockNumber}`);
                console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);
                console.log('');
                console.log('💰 TRADE EXECUTED:');
                console.log(`   Maker gave: ${ethers.formatUnits(order.makingAmount, 6)} USDC`);
                console.log(`   Taker gave: ${ethers.formatUnits(order.takingAmount, 18)} WMATIC`);
                console.log(`   Maker received: ${ethers.formatUnits(order.takingAmount, 18)} WMATIC`);
                console.log(`   Taker received: ${ethers.formatUnits(order.makingAmount, 6)} USDC`);
                
                return {
                    success: true,
                    txHash: tx.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString()
                };
                
            } else {
                console.log('❌ Fill transaction failed');
                return { success: false, txHash: tx.hash };
            }
            
        } catch (error) {
            console.log(`❌ Fill execution failed: ${error.message}`);
            
            // Try to decode the error
            if (error.data) {
                console.log(`📝 Error data: ${error.data}`);
            }
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Check balances after fill
     */
    async checkBalancesAfter(orderData, fillResult) {
        console.log('📊 CHECKING BALANCES AFTER FILL');
        console.log('═══════════════════════════════════════════════════════════');
        
        // Check taker USDC balance (should have increased)
        const takerUSDC = await this.takerUSDC.balanceOf(this.takerWallet.address);
        console.log(`💰 Taker USDC Balance: ${ethers.formatUnits(takerUSDC, 6)} USDC`);
        
        // Check taker WMATIC balance (should have decreased)
        const takerWMATIC = await this.takerWMATIC.balanceOf(this.takerWallet.address);
        console.log(`💰 Taker WMATIC Balance: ${ethers.formatUnits(takerWMATIC, 18)} WMATIC`);
        
        console.log('✅ Balance check completed\n');
    }

    /**
     * Execute complete fill process
     */
    async executeOrderFill() {
        console.log('🚀 DIRECT LIMIT ORDER FILL - REAL MAKER/TAKER EXECUTION\n');
        
        try {
            // Step 1: Load the created order
            const orderData = await this.loadLatestOrder();
            
            // Step 2: Verify order hash
            const hashValid = await this.verifyOrderHash(orderData);
            if (!hashValid) {
                throw new Error('Order hash verification failed');
            }
            console.log('');
            
            // Step 3: Check order status
            const remaining = await this.checkOrderRemaining(orderData.orderHash);
            if (remaining === BigInt(0)) {
                throw new Error('Order is not available for filling');
            }
            console.log('');
            
            // Step 4: Prepare taker
            await this.prepareTaker(orderData);
            
            // Step 5: Execute fill
            const fillResult = await this.fillOrder(orderData);
            
            if (fillResult.success) {
                console.log('');
                
                // Step 6: Check balances after
                await this.checkBalancesAfter(orderData, fillResult);
                
                // Save fill proof
                const fillProof = {
                    timestamp: new Date().toISOString(),
                    orderHash: orderData.orderHash,
                    fillResult,
                    maker: orderData.order.maker,
                    taker: this.takerWallet.address,
                    makingAmount: orderData.order.makingAmount,
                    takingAmount: orderData.order.takingAmount,
                    polygonscanUrl: `https://polygonscan.com/tx/${fillResult.txHash}`
                };
                
                const proofPath = path.join(__dirname, '..', 'execution-proofs', `fill-proof-${Date.now()}.json`);
                fs.writeFileSync(proofPath, JSON.stringify(fillProof, null, 2));
                
                console.log('🎉 REAL LIMIT ORDER EXECUTION COMPLETED SUCCESSFULLY');
                console.log('═══════════════════════════════════════════════════════════');
                console.log('✅ Order loaded and verified');
                console.log('✅ Order hash validated by contract');
                console.log('✅ Order status confirmed as fillable');
                console.log('✅ Taker prepared with sufficient balance and approvals');
                console.log('✅ Order filled via direct contract call');
                console.log('✅ Real maker/taker exchange executed on-chain');
                console.log('✅ Transaction confirmed and verified');
                console.log('');
                console.log('🏆 GENUINE DEFI LIMIT ORDER PROTOCOL EXECUTION ACHIEVED');
                console.log(`📄 Fill proof saved: ${proofPath}`);
                
            } else {
                console.log('❌ Order fill failed');
            }
            
        } catch (error) {
            console.error('❌ Order fill process failed:', error.message);
            throw error;
        }
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        const filler = new DirectOrderFiller();
        await filler.executeOrderFill();
        
    } catch (error) {
        console.error('❌ Execution failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { DirectOrderFiller };
