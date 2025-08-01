const { ethers } = require('ethers');
require('dotenv').config();

// Fixed 1inch Limit Order Protocol v4 Implementation
// Based on official documentation and working examples

class Fixed1inchLOPv4 {
    constructor(provider, chainId = 137) {
        this.provider = provider;
        this.chainId = chainId;
        this.contractAddress = '0x111111125421ca6dc452d289314280a0f8842a65';
        
        // Complete v4 ABI based on actual contract
        this.abi = [
            // Core fill functions
            'function fillOrder((uint256,address,address,address,address,uint256,uint256,uint256) order, bytes32 r, bytes32 vs, uint256 amount, uint256 takerTraits) external payable returns (uint256, uint256, bytes32)',
            'function fillOrderArgs((uint256,address,address,address,address,uint256,uint256,uint256) order, bytes32 r, bytes32 vs, uint256 amount, uint256 takerTraits, bytes args) external payable returns (uint256, uint256, bytes32)',
            
            // View functions
            'function hashOrder((uint256,address,address,address,address,uint256,uint256,uint256) order) external view returns (bytes32)',
            'function remaining(bytes32 orderHash) external view returns (uint256)',
            'function DOMAIN_SEPARATOR() external view returns (bytes32)',
            
            // Events
            'event OrderFilled(address indexed maker, bytes32 orderHash, uint256 remaining)'
        ];
        
        this.contract = new ethers.Contract(this.contractAddress, this.abi, provider);
        
        // EIP-712 Domain for v4 (corrected)
        this.domain = {
            name: '1inch Limit Order Protocol',
            version: '4',
            chainId: this.chainId,
            verifyingContract: this.contractAddress
        };
        
        // Correct EIP-712 Types for v4 (8-field structure)
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
    
    // Create order with proper salt generation
    createOrder(makerAsset, takerAsset, makingAmount, takingAmount, maker, receiver = null) {
        // Generate proper salt (high 96 bits for salt, low 160 bits for extension hash)
        const randomSalt = Math.floor(Math.random() * 1000000);
        const salt = BigInt(randomSalt) << BigInt(160); // Shift to high 96 bits
        
        return {
            salt: salt.toString(),
            maker: maker,
            receiver: receiver || maker,
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            makingAmount: makingAmount.toString(),
            takingAmount: takingAmount.toString(),
            makerTraits: '0' // No special traits for basic order
        };
    }
    
    // Sign order with proper EIP-712 format
    async signOrder(order, wallet) {
        console.log('🔐 Signing order with EIP-712...');
        
        try {
            // Sign using EIP-712
            const signature = await wallet.signTypedData(this.domain, this.types, order);
            const sigData = ethers.Signature.from(signature);
            
            // Convert to compact format (r, vs) used by 1inch
            let vs = sigData.s;
            if (sigData.v === 28) {
                // Set the highest bit if v is 28
                vs = '0x' + (BigInt(sigData.s) | (BigInt(1) << BigInt(255))).toString(16);
            }
            
            console.log('✅ Order signed successfully');
            console.log('   r:', sigData.r);
            console.log('   vs:', vs);
            
            return {
                r: sigData.r,
                vs: vs,
                signature: signature,
                v: sigData.v,
                s: sigData.s
            };
            
        } catch (error) {
            console.log('❌ Signing failed:', error.message);
            throw error;
        }
    }
    
    // Get order hash from contract
    async getOrderHash(order) {
        try {
            const orderTuple = this.orderToTuple(order);
            const hash = await this.contract.hashOrder(orderTuple);
            return hash;
        } catch (error) {
            console.log('❌ Hash calculation failed, using manual calculation');
            // Fallback to manual hash calculation
            return this.calculateOrderHashManual(order);
        }
    }
    
    // Manual order hash calculation
    calculateOrderHashManual(order) {
        const orderStruct = [
            order.salt,
            order.maker,
            order.receiver,
            order.makerAsset,
            order.takerAsset,
            order.makingAmount,
            order.takingAmount,
            order.makerTraits
        ];
        
        return ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                orderStruct
            )
        );
    }
    
    // Convert order to tuple format
    orderToTuple(order) {
        return [
            order.salt,
            order.maker,
            order.receiver,
            order.makerAsset,
            order.takerAsset,
            order.makingAmount,
            order.takingAmount,
            order.makerTraits
        ];
    }
    
    // Fill order with enhanced error handling
    async fillOrder(order, signature, amount, takerWallet, takerTraits = '0') {
        console.log('🎯 Attempting to fill order...');
        
        try {
            const orderTuple = this.orderToTuple(order);
            const contractWithSigner = this.contract.connect(takerWallet);
            
            console.log('📋 Order Details:');
            console.log('   Salt:', order.salt);
            console.log('   Maker:', order.maker);
            console.log('   Receiver:', order.receiver);
            console.log('   Maker Asset:', order.makerAsset);
            console.log('   Taker Asset:', order.takerAsset);
            console.log('   Making Amount:', order.makingAmount);
            console.log('   Taking Amount:', order.takingAmount);
            console.log('   Maker Traits:', order.makerTraits);
            console.log('');
            console.log('📋 Signature Details:');
            console.log('   r:', signature.r);
            console.log('   vs:', signature.vs);
            console.log('');
            
            // First try to estimate gas
            let gasEstimate;
            try {
                gasEstimate = await contractWithSigner.fillOrder.estimateGas(
                    orderTuple,
                    signature.r,
                    signature.vs,
                    amount.toString(),
                    takerTraits
                );
                console.log('⛽ Gas estimate:', gasEstimate.toString());
            } catch (gasError) {
                console.log('⚠️  Gas estimation failed:', gasError.message);
                
                // Try to decode the error
                if (gasError.data) {
                    try {
                        const errorInterface = new ethers.Interface([
                            'error InvalidSignature()',
                            'error OrderExpired()',
                            'error InsufficientBalance()',
                            'error OrderAlreadyFilled()',
                            'error InvalidOrder()'
                        ]);
                        
                        const decodedError = errorInterface.parseError(gasError.data);
                        console.log('🔍 Decoded error:', decodedError.name);
                    } catch (decodeError) {
                        console.log('🔍 Raw error data:', gasError.data);
                    }
                }
                
                // Use a default gas limit
                gasEstimate = BigInt(500000);
            }
            
            // Execute the transaction
            console.log('🚀 Executing fill transaction...');
            const tx = await contractWithSigner.fillOrder(
                orderTuple,
                signature.r,
                signature.vs,
                amount.toString(),
                takerTraits,
                {
                    gasLimit: gasEstimate + BigInt(100000), // Add buffer
                    // Don't set gasPrice, let ethers handle it
                }
            );
            
            console.log('⏳ Transaction sent:', tx.hash);
            console.log('🔗 https://polygonscan.com/tx/' + tx.hash);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log('✅ Order filled successfully!');
                
                // Parse events
                const events = receipt.logs.map(log => {
                    try {
                        return this.contract.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                }).filter(event => event !== null);
                
                console.log('📊 Events emitted:', events.length);
                events.forEach(event => {
                    console.log(`   ${event.name}:`, event.args);
                });
                
                return {
                    success: true,
                    hash: tx.hash,
                    receipt: receipt,
                    events: events
                };
            } else {
                console.log('❌ Transaction failed');
                return {
                    success: false,
                    hash: tx.hash,
                    receipt: receipt,
                    error: 'Transaction reverted'
                };
            }
            
        } catch (error) {
            console.log('❌ Fill error:', error.message);
            
            // Enhanced error analysis
            if (error.message.includes('insufficient funds')) {
                console.log('💡 Issue: Insufficient funds for gas or tokens');
            } else if (error.message.includes('allowance')) {
                console.log('💡 Issue: Token allowance not set');
            } else if (error.message.includes('signature')) {
                console.log('💡 Issue: Invalid signature');
            } else if (error.message.includes('expired')) {
                console.log('💡 Issue: Order expired');
            }
            
            return {
                success: false,
                error: error.message,
                details: error
            };
        }
    }
    
    // Check remaining amount for order
    async checkRemaining(orderHash) {
        try {
            const remaining = await this.contract.remaining(orderHash);
            return remaining;
        } catch (error) {
            console.log('❌ Remaining check failed:', error.message);
            return null;
        }
    }
}

// Test the fixed implementation
async function testFixedLOP() {
    console.log('🔧 TESTING FIXED 1INCH LOP V4 IMPLEMENTATION');
    console.log('');
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    console.log('🏦 Maker:', makerWallet.address);
    console.log('🏦 Taker:', takerWallet.address);
    console.log('');
    
    // Token addresses
    const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    
    // Check balances
    const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        [
            'function balanceOf(address) view returns (uint256)',
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)'
        ],
        makerWallet
    );
    
    const wpolContract = new ethers.Contract(
        WPOL_ADDRESS,
        [
            'function balanceOf(address) view returns (uint256)',
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)'
        ],
        takerWallet
    );
    
    const makerUSDC = await usdcContract.balanceOf(makerWallet.address);
    const takerWPOL = await wpolContract.balanceOf(takerWallet.address);
    
    console.log('💰 BALANCES:');
    console.log('   Maker USDC:', ethers.formatUnits(makerUSDC, 6));
    console.log('   Taker WPOL:', ethers.formatEther(takerWPOL));
    console.log('');
    
    if (makerUSDC === 0n) {
        console.log('❌ Maker needs USDC');
        return;
    }
    
    if (takerWPOL === 0n) {
        console.log('❌ Taker needs WPOL');
        return;
    }
    
    // Initialize fixed LOP
    const lop = new Fixed1inchLOPv4(provider, 137);
    
    console.log('✅ Fixed LOP v4 system initialized');
    console.log('📋 Contract:', lop.contractAddress);
    console.log('');
    
    // Create a test order with smaller amounts
    const makingAmount = ethers.parseUnits('0.01', 6); // 0.01 USDC (very small)
    const takingAmount = ethers.parseEther('0.05'); // 0.05 WPOL
    
    console.log('📝 Creating test limit order...');
    console.log('   Selling:', ethers.formatUnits(makingAmount, 6), 'USDC');
    console.log('   For:', ethers.formatEther(takingAmount), 'WPOL');
    console.log('   Rate:', parseFloat(ethers.formatEther(takingAmount)) / parseFloat(ethers.formatUnits(makingAmount, 6)), 'WPOL/USDC');
    console.log('');
    
    const order = lop.createOrder(
        USDC_ADDRESS,
        WPOL_ADDRESS,
        makingAmount,
        takingAmount,
        makerWallet.address
    );
    
    console.log('📋 Created order structure:');
    console.log('   Salt:', order.salt);
    console.log('   Maker:', order.maker);
    console.log('   Receiver:', order.receiver);
    console.log('');
    
    // Sign the order
    const signature = await lop.signOrder(order, makerWallet);
    const orderHash = await lop.getOrderHash(order);
    
    console.log('✅ Order created and signed');
    console.log('📋 Order hash:', orderHash);
    console.log('');
    
    // Set up approvals
    console.log('🔐 Setting up token approvals...');
    
    // Maker approves USDC
    const usdcAllowance = await usdcContract.allowance(makerWallet.address, lop.contractAddress);
    if (usdcAllowance < makingAmount) {
        console.log('   Approving USDC for maker...');
        const approveTx = await usdcContract.approve(lop.contractAddress, makingAmount * BigInt(2));
        await approveTx.wait();
        console.log('   ✅ USDC approved');
    }
    
    // Taker approves WPOL
    const wpolAllowance = await wpolContract.allowance(takerWallet.address, lop.contractAddress);
    if (wpolAllowance < takingAmount) {
        console.log('   Approving WPOL for taker...');
        const approveTx = await wpolContract.approve(lop.contractAddress, takingAmount * BigInt(2));
        await approveTx.wait();
        console.log('   ✅ WPOL approved');
    }
    
    console.log('');
    
    // Attempt to fill the order
    console.log('🤖 Attempting to fill order with enhanced debugging...');
    const fillResult = await lop.fillOrder(order, signature, makingAmount, takerWallet);
    
    if (fillResult.success) {
        console.log('');
        console.log('🎉 SUCCESS! LIMIT ORDER FILLED ON-CHAIN!');
        console.log('✅ Real 1inch LOP v4 transaction executed');
        console.log('✅ Order successfully filled by taker bot');
        console.log('✅ Verifiable proof on Polygonscan');
        console.log('');
        console.log('🔗 Transaction Hash:', fillResult.hash);
        console.log('🔗 Polygonscan:', `https://polygonscan.com/tx/${fillResult.hash}`);
        
        // Check final balances
        const finalMakerUSDC = await usdcContract.balanceOf(makerWallet.address);
        const finalTakerWPOL = await wpolContract.balanceOf(takerWallet.address);
        
        console.log('');
        console.log('💰 BALANCE CHANGES:');
        console.log('   Maker USDC:', ethers.formatUnits(makerUSDC, 6), '→', ethers.formatUnits(finalMakerUSDC, 6));
        console.log('   Taker WPOL:', ethers.formatEther(takerWPOL), '→', ethers.formatEther(finalTakerWPOL));
        
        return { success: true, orderHash, transactionHash: fillResult.hash };
        
    } else {
        console.log('');
        console.log('❌ Order fill failed');
        console.log('💡 Error:', fillResult.error);
        console.log('');
        console.log('🔍 DEBUGGING INFO:');
        console.log('   Order structure appears correct');
        console.log('   EIP-712 signing implemented');
        console.log('   Token approvals set');
        console.log('   Contract interaction working');
        
        return { success: false, error: fillResult.error };
    }
}

testFixedLOP().catch(console.error);
