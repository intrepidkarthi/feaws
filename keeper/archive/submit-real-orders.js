const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// REAL 1INCH LIMIT ORDER SUBMISSION - NO SIMULATION
class RealOrderSubmitter {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        this.tokens = {
            USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
        };
        
        this.limitOrderProtocol = '0x111111125421cA6dc452d289314280a0f8842A65';
        
        this.erc20ABI = [
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)',
            'function balanceOf(address owner) view returns (uint256)'
        ];
    }
    
    async submitRealOrder(usdcAmount) {
        console.log(`🚀 SUBMITTING REAL ORDER: ${usdcAmount} USDC`);
        console.log(`📍 Wallet: ${this.wallet.address}`);
        
        try {
            // Get real quote
            const quote = await this.getRealQuote(usdcAmount);
            console.log(`💱 Rate: 1 USDC = ${quote.rate} WMATIC`);
            
            // Approve USDC
            const approveTx = await this.approveUSDC(usdcAmount);
            if (approveTx) {
                console.log(`✅ APPROVAL TX: ${approveTx.hash}`);
                console.log(`🔗 https://polygonscan.com/tx/${approveTx.hash}`);
                await approveTx.wait();
                console.log(`✅ APPROVAL CONFIRMED`);
            }
            
            // Submit order via 1inch API
            const orderResult = await this.submitViaAPI(usdcAmount, quote);
            
            if (orderResult && orderResult.success) {
                console.log(`🎉 REAL ORDER SUBMITTED!`);
                console.log(`📋 Order Hash: ${orderResult.orderHash}`);
                console.log(`🔗 1inch: https://app.1inch.io/#/137/limit-order/${orderResult.orderHash}`);
                return orderResult;
            } else {
                // If API fails, submit directly to contract
                return await this.submitToContract(usdcAmount, quote);
            }
            
        } catch (error) {
            console.error(`❌ REAL ORDER FAILED: ${error.message}`);
            throw error;
        }
    }
    
    async getRealQuote(usdcAmount) {
        const amountWei = ethers.parseUnits(usdcAmount.toString(), 6).toString();
        
        const response = await axios.get('https://api.1inch.dev/swap/v6.0/137/quote', {
            params: {
                fromTokenAddress: this.tokens.USDC,
                toTokenAddress: this.tokens.WMATIC,
                amount: amountWei
            },
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`
            }
        });
        
        const toAmount = response.data.dstAmount;
        const wmaticAmount = parseFloat(ethers.formatUnits(toAmount, 18));
        
        return {
            toAmount: toAmount,
            wmaticAmount: wmaticAmount,
            rate: wmaticAmount / usdcAmount
        };
    }
    
    async approveUSDC(usdcAmount) {
        const usdcContract = new ethers.Contract(this.tokens.USDC, this.erc20ABI, this.wallet);
        const amountWei = ethers.parseUnits(usdcAmount.toString(), 6);
        
        const currentAllowance = await usdcContract.allowance(
            this.wallet.address,
            this.limitOrderProtocol
        );
        
        if (currentAllowance < amountWei) {
            console.log(`📝 APPROVING ${usdcAmount} USDC...`);
            const tx = await usdcContract.approve(this.limitOrderProtocol, amountWei);
            return tx;
        }
        
        console.log(`✅ USDC ALREADY APPROVED`);
        return null;
    }
    
    async submitViaAPI(usdcAmount, quote) {
        try {
            const orderData = {
                makerAsset: this.tokens.USDC,
                takerAsset: this.tokens.WMATIC,
                makingAmount: ethers.parseUnits(usdcAmount.toString(), 6).toString(),
                takingAmount: quote.toAmount,
                maker: this.wallet.address,
                salt: Date.now().toString()
            };
            
            // Create order hash
            const orderHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address', 'address', 'uint256', 'uint256', 'address', 'uint256'],
                    [orderData.makerAsset, orderData.takerAsset, orderData.makingAmount, 
                     orderData.takingAmount, orderData.maker, orderData.salt]
                )
            );
            
            // Sign order
            const signature = await this.wallet.signMessage(ethers.getBytes(orderHash));
            
            // Submit to 1inch API
            const response = await axios.post('https://api.1inch.dev/orderbook/v4.0/137/order', {
                orderHash: orderHash,
                signature: signature,
                data: orderData
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            return {
                success: true,
                orderHash: orderHash,
                signature: signature,
                apiResponse: response.data
            };
            
        } catch (error) {
            console.error(`API submission failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    
    async submitToContract(usdcAmount, quote) {
        console.log(`📤 SUBMITTING DIRECTLY TO CONTRACT...`);
        
        // 1inch Limit Order Protocol contract
        const limitOrderABI = [
            'function fillOrder((uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order, bytes signature, bytes interaction, uint256 makingAmount, uint256 takingAmount) external payable returns (uint256, uint256, bytes32)'
        ];
        
        const contract = new ethers.Contract(this.limitOrderProtocol, limitOrderABI, this.wallet);
        
        const orderStruct = {
            salt: Date.now(),
            makerAsset: this.tokens.USDC,
            takerAsset: this.tokens.WMATIC,
            maker: this.wallet.address,
            receiver: this.wallet.address,
            allowedSender: '0x0000000000000000000000000000000000000000',
            makingAmount: ethers.parseUnits(usdcAmount.toString(), 6),
            takingAmount: quote.toAmount,
            offsets: 0,
            interactions: '0x'
        };
        
        // Create signature
        const orderHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'address', 'address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes'],
                [orderStruct.salt, orderStruct.makerAsset, orderStruct.takerAsset, 
                 orderStruct.maker, orderStruct.receiver, orderStruct.allowedSender,
                 orderStruct.makingAmount, orderStruct.takingAmount, orderStruct.offsets, orderStruct.interactions]
            )
        );
        
        const signature = await this.wallet.signMessage(ethers.getBytes(orderHash));
        
        // Submit transaction
        const tx = await contract.fillOrder(
            orderStruct,
            signature,
            '0x',
            orderStruct.makingAmount,
            orderStruct.takingAmount
        );
        
        console.log(`🚀 CONTRACT TX SUBMITTED: ${tx.hash}`);
        console.log(`🔗 https://polygonscan.com/tx/${tx.hash}`);
        
        const receipt = await tx.wait();
        
        console.log(`✅ CONTRACT TX CONFIRMED: Block ${receipt.blockNumber}`);
        
        return {
            success: true,
            orderHash: orderHash,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
        };
    }
}

async function main() {
    console.log('🔥 REAL 1INCH LIMIT ORDER SUBMISSION');
    console.log('====================================');
    
    const submitter = new RealOrderSubmitter();
    
    // Submit 3 USDC order
    const result = await submitter.submitRealOrder(3);
    
    if (result.success) {
        console.log('\\n🎉 SUCCESS! REAL ORDER SUBMITTED TO BLOCKCHAIN');
        console.log(`Order Hash: ${result.orderHash}`);
        if (result.txHash) {
            console.log(`TX Hash: ${result.txHash}`);
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = RealOrderSubmitter;
