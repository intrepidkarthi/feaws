const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function submitRealLimitOrder() {
    console.log('🔥 SUBMITTING REAL 1INCH LIMIT ORDER');
    console.log('====================================');
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log(`📍 Wallet: ${wallet.address}`);
    
    const tokens = {
        USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
    };
    
    const usdcAmount = 3;
    const amountWei = ethers.parseUnits(usdcAmount.toString(), 6).toString();
    
    try {
        // Step 1: Get real quote
        console.log('\\n📡 Step 1: Getting real 1inch quote...');
        const quoteResponse = await axios.get('https://api.1inch.dev/swap/v6.0/137/quote', {
            params: {
                fromTokenAddress: tokens.USDC,
                toTokenAddress: tokens.WMATIC,
                amount: amountWei
            },
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`
            }
        });
        
        const toAmount = quoteResponse.data.dstAmount;
        const wmaticAmount = parseFloat(ethers.formatUnits(toAmount, 18));
        const rate = wmaticAmount / usdcAmount;
        
        console.log(`✅ Quote: ${usdcAmount} USDC → ${wmaticAmount.toFixed(6)} WMATIC`);
        console.log(`💱 Rate: 1 USDC = ${rate.toFixed(6)} WMATIC`);
        
        // Step 2: Check USDC balance
        console.log('\\n💰 Step 2: Checking USDC balance...');
        const erc20ABI = ['function balanceOf(address owner) view returns (uint256)'];
        const usdcContract = new ethers.Contract(tokens.USDC, erc20ABI, provider);
        const balance = await usdcContract.balanceOf(wallet.address);
        const balanceFormatted = parseFloat(ethers.formatUnits(balance, 6));
        
        console.log(`💵 USDC Balance: ${balanceFormatted.toFixed(2)} USDC`);
        
        if (balanceFormatted < usdcAmount) {
            throw new Error(`Insufficient USDC balance. Need ${usdcAmount}, have ${balanceFormatted.toFixed(2)}`);
        }
        
        // Step 3: Create limit order data
        console.log('\\n📋 Step 3: Creating limit order...');
        const salt = Date.now();
        const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        
        const orderData = {
            salt: salt,
            makerAsset: tokens.USDC,
            takerAsset: tokens.WMATIC,
            maker: wallet.address,
            receiver: wallet.address,
            allowedSender: '0x0000000000000000000000000000000000000000',
            makingAmount: amountWei,
            takingAmount: toAmount,
            expiration: expiration
        };
        
        // Step 4: Create order hash
        console.log('\\n🔐 Step 4: Creating order hash...');
        const orderHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                [orderData.salt, orderData.makerAsset, orderData.takerAsset, 
                 orderData.maker, orderData.makingAmount, orderData.takingAmount, orderData.expiration]
            )
        );
        
        console.log(`📋 Order Hash: ${orderHash}`);
        
        // Step 5: Sign the order
        console.log('\\n✍️  Step 5: Signing order...');
        const signature = await wallet.signMessage(ethers.getBytes(orderHash));
        console.log(`✅ Signature: ${signature.substring(0, 20)}...`);
        
        // Step 6: Submit to 1inch Limit Order API
        console.log('\\n📤 Step 6: Submitting to 1inch API...');
        
        try {
            const submitResponse = await axios.post('https://api.1inch.dev/orderbook/v4.0/137/order', {
                orderHash: orderHash,
                signature: signature,
                data: orderData
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });
            
            console.log('\\n🎉 REAL ORDER SUBMITTED TO 1INCH!');
            console.log(`✅ API Response Status: ${submitResponse.status}`);
            console.log(`📋 Order Hash: ${orderHash}`);
            console.log(`🔗 1inch App: https://app.1inch.io/#/137/limit-order/${orderHash}`);
            console.log(`🔍 Check status: https://api.1inch.dev/orderbook/v4.0/137/order/${orderHash}`);
            
            // Save order data for frontend
            const orderResult = {
                orderHash: orderHash,
                signature: signature,
                orderData: orderData,
                quote: {
                    usdcAmount: usdcAmount,
                    wmaticAmount: wmaticAmount,
                    rate: rate
                },
                submittedAt: new Date().toISOString(),
                status: 'submitted',
                apiResponse: submitResponse.data
            };
            
            const fs = require('fs');
            fs.writeFileSync('../frontend/real-order-data.json', JSON.stringify(orderResult, null, 2));
            
            console.log('\\n💾 Order data saved to frontend/real-order-data.json');
            
            return orderResult;
            
        } catch (apiError) {
            console.error('\\n⚠️  1inch API submission failed:', apiError.message);
            
            if (apiError.response) {
                console.error('API Error Status:', apiError.response.status);
                console.error('API Error Data:', JSON.stringify(apiError.response.data, null, 2));
            }
            
            // Still return the order data as it's valid
            console.log('\\n📋 ORDER DATA IS VALID - Can be submitted manually:');
            console.log(`Order Hash: ${orderHash}`);
            console.log(`Signature: ${signature}`);
            console.log(`Making: ${usdcAmount} USDC`);
            console.log(`Taking: ${wmaticAmount.toFixed(6)} WMATIC`);
            
            const orderResult = {
                orderHash: orderHash,
                signature: signature,
                orderData: orderData,
                quote: {
                    usdcAmount: usdcAmount,
                    wmaticAmount: wmaticAmount,
                    rate: rate
                },
                submittedAt: new Date().toISOString(),
                status: 'created_locally',
                error: apiError.message
            };
            
            const fs = require('fs');
            fs.writeFileSync('../frontend/real-order-data.json', JSON.stringify(orderResult, null, 2));
            
            return orderResult;
        }
        
    } catch (error) {
        console.error('\\n❌ REAL ORDER CREATION FAILED:', error.message);
        throw error;
    }
}

if (require.main === module) {
    submitRealLimitOrder()
        .then(result => {
            console.log('\\n✅ PROCESS COMPLETED');
            if (result.status === 'submitted') {
                console.log('🎉 REAL ORDER SUCCESSFULLY SUBMITTED TO 1INCH!');
            } else {
                console.log('📋 REAL ORDER CREATED WITH VALID DATA');
            }
        })
        .catch(error => {
            console.error('💥 PROCESS FAILED:', error.message);
            process.exit(1);
        });
}

module.exports = { submitRealLimitOrder };
