const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * SUBMIT REAL 1INCH FUSION+ ORDER
 * 
 * Uses the correct 1inch Fusion+ API endpoint to submit orders
 * This is the REAL way to submit orders to 1inch
 */

async function submitFusionOrder() {
    console.log('🔥 SUBMITTING REAL 1INCH FUSION+ ORDER');
    console.log('=====================================');
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log(`📍 Wallet: ${wallet.address}`);
    console.log(`🔗 Network: Polygon (137)`);
    
    const tokens = {
        USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
    };
    
    const usdcAmount = 1;
    
    try {
        // Step 1: Get real quote
        console.log('\\n📡 Step 1: Getting Fusion+ quote...');
        const amountWei = ethers.parseUnits(usdcAmount.toString(), 6);
        
        const quoteResponse = await axios.get('https://api.1inch.dev/fusion/quoter/v1.0/137/quote/receive', {
            params: {
                fromTokenAddress: tokens.USDC,
                toTokenAddress: tokens.WMATIC,
                amount: amountWei.toString(),
                walletAddress: wallet.address
            },
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                'accept': 'application/json'
            }
        });
        
        console.log('Quote response:', JSON.stringify(quoteResponse.data, null, 2));
        
        const quote = quoteResponse.data;
        const toAmount = quote.toAmount;
        const wmaticAmount = parseFloat(ethers.formatUnits(toAmount, 18));
        const rate = wmaticAmount / usdcAmount;
        
        console.log(`✅ Fusion Quote: ${usdcAmount} USDC → ${wmaticAmount.toFixed(6)} WMATIC`);
        console.log(`💱 Rate: 1 USDC = ${rate.toFixed(6)} WMATIC`);
        
        // Step 2: Ensure USDC approval for Fusion+ contract
        console.log('\\n🔐 Step 2: Checking Fusion+ approval...');
        
        const fusionContract = quote.allowanceTarget || '0x111111125421cA6dc452d289314280a0f8842A65';
        
        const erc20ABI = [
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)',
            'function balanceOf(address owner) view returns (uint256)'
        ];
        
        const usdcContract = new ethers.Contract(tokens.USDC, erc20ABI, wallet);
        
        const balance = await usdcContract.balanceOf(wallet.address);
        const allowance = await usdcContract.allowance(wallet.address, fusionContract);
        
        console.log(`💰 USDC Balance: ${ethers.formatUnits(balance, 6)} USDC`);
        console.log(`🔓 Current Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
        console.log(`🎯 Fusion Contract: ${fusionContract}`);
        
        if (allowance < amountWei) {
            console.log('📝 Approving USDC for Fusion+...');
            const approveTx = await usdcContract.approve(fusionContract, amountWei);
            console.log(`⏳ Approval TX: ${approveTx.hash}`);
            console.log(`🔗 Polygonscan: https://polygonscan.com/tx/${approveTx.hash}`);
            
            const receipt = await approveTx.wait();
            console.log(`✅ USDC approved in block ${receipt.blockNumber}`);
        } else {
            console.log('✅ USDC already approved for Fusion+');
        }
        
        // Step 3: Submit Fusion+ order
        console.log('\\n🚀 Step 3: Submitting Fusion+ order...');
        
        const orderPayload = {
            fromTokenAddress: tokens.USDC,
            toTokenAddress: tokens.WMATIC,
            amount: amountWei.toString(),
            fromAddress: wallet.address,
            slippage: 1, // 1% slippage
            preset: 'fast', // or 'medium', 'slow'
            fee: {
                takingFeeBps: 0,
                takingFeeReceiver: '0x0000000000000000000000000000000000000000'
            }
        };
        
        console.log('Order payload:', JSON.stringify(orderPayload, null, 2));
        
        const submitResponse = await axios.post('https://api.1inch.dev/fusion/relayer/v1.0/137/order/submit', orderPayload, {
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            timeout: 30000
        });
        
        console.log('\\n🎉 FUSION+ ORDER SUBMITTED SUCCESSFULLY!');
        console.log(`✅ Status: ${submitResponse.status}`);
        console.log(`📊 Response:`, JSON.stringify(submitResponse.data, null, 2));
        
        const orderResult = {
            success: true,
            method: 'fusion_plus_submission',
            orderHash: submitResponse.data.orderHash || 'pending',
            transactionHash: submitResponse.data.transactionHash,
            orderData: orderPayload,
            quote: { usdcAmount, wmaticAmount, rate },
            fusionContract: fusionContract,
            submittedAt: new Date().toISOString(),
            apiResponse: submitResponse.data,
            polygonscanUrl: submitResponse.data.transactionHash ? 
                `https://polygonscan.com/tx/${submitResponse.data.transactionHash}` : null,
            verificationUrl: submitResponse.data.orderHash ? 
                `https://app.1inch.io/#/137/limit-order/${submitResponse.data.orderHash}` : null
        };
        
        const fs = require('fs');
        fs.writeFileSync('../frontend/fusion-submitted-order.json', JSON.stringify(orderResult, null, 2));
        
        console.log('\\n🎯 REAL FUSION+ ORDER SUBMITTED!');
        console.log('================================');
        if (submitResponse.data.orderHash) {
            console.log(`📋 Order Hash: ${submitResponse.data.orderHash}`);
        }
        if (submitResponse.data.transactionHash) {
            console.log(`🔗 Transaction: https://polygonscan.com/tx/${submitResponse.data.transactionHash}`);
        }
        console.log(`💰 Trading: ${usdcAmount} USDC → ${wmaticAmount.toFixed(6)} WMATIC`);
        console.log(`🎯 Fusion Contract: ${fusionContract}`);
        
        return orderResult;
        
    } catch (error) {
        console.error('\\n❌ FUSION+ SUBMISSION FAILED:', error.message);
        
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error data:', JSON.stringify(error.response.data, null, 2));
            
            // Try alternative Fusion endpoint
            console.log('\\n🔄 Trying alternative Fusion endpoint...');
            
            try {
                const altResponse = await axios.post('https://api.1inch.dev/fusion/relayer/v1.0/137/order/submit/many', {
                    orders: [orderPayload]
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('\\n🎉 ALTERNATIVE FUSION SUBMISSION SUCCESS!');
                console.log(`📊 Response:`, JSON.stringify(altResponse.data, null, 2));
                
                return {
                    success: true,
                    method: 'fusion_alternative',
                    response: altResponse.data
                };
                
            } catch (altError) {
                console.log('Alternative also failed:', altError.message);
            }
        }
        
        throw error;
    }
}

if (require.main === module) {
    submitFusionOrder()
        .then(result => {
            console.log('\\n🎉 FUSION+ ORDER SUCCESSFULLY SUBMITTED!');
            console.log('This is a REAL order submission to 1inch Fusion+');
        })
        .catch(error => {
            console.error('💥 FAILED:', error.message);
            process.exit(1);
        });
}

module.exports = { submitFusionOrder };
