const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function debug500Error() {
    console.log('🔍 DEBUGGING 1INCH 500 ERROR');
    console.log('============================');
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log(`📍 Wallet: ${wallet.address}`);
    
    // First, let's check what a successful order looks like from the events
    console.log('\\n📊 Step 1: Analyzing successful orders from events...');
    
    try {
        const eventsResponse = await axios.get('https://api.1inch.dev/orderbook/v4.0/137/events', {
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`
            },
            params: {
                limit: 10
            }
        });
        
        const events = eventsResponse.data;
        console.log(`Found ${events.length} recent events`);
        
        // Look for order creation events to see the correct format
        const orderEvents = events.filter(e => e.action === 'order' || e.action === 'create');
        
        if (orderEvents.length > 0) {
            console.log('\\n📋 Found order creation events:');
            orderEvents.forEach((event, i) => {
                console.log(`Event ${i + 1}:`, JSON.stringify(event, null, 2));
            });
        } else {
            console.log('\\n⚠️  No order creation events found, checking all events...');
            events.slice(0, 3).forEach((event, i) => {
                console.log(`Event ${i + 1} (${event.action}):`, JSON.stringify(event, null, 2));
            });
        }
        
    } catch (error) {
        console.error('❌ Could not fetch events:', error.message);
    }
    
    // Step 2: Check if we need token approval first
    console.log('\\n🔐 Step 2: Checking USDC approval...');
    
    const tokens = {
        USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
    };
    
    const limitOrderProtocol = '0x111111125421cA6dc452d289314280a0f8842A65';
    
    try {
        const erc20ABI = [
            'function allowance(address owner, address spender) view returns (uint256)',
            'function balanceOf(address owner) view returns (uint256)',
            'function approve(address spender, uint256 amount) returns (bool)'
        ];
        
        const usdcContract = new ethers.Contract(tokens.USDC, erc20ABI, wallet);
        
        const balance = await usdcContract.balanceOf(wallet.address);
        const allowance = await usdcContract.allowance(wallet.address, limitOrderProtocol);
        
        console.log(`💰 USDC Balance: ${ethers.formatUnits(balance, 6)} USDC`);
        console.log(`🔓 Current Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
        
        const requiredAmount = ethers.parseUnits('3', 6);
        
        if (allowance < requiredAmount) {
            console.log('\\n📝 USDC approval needed! Submitting approval...');
            
            const approveTx = await usdcContract.approve(limitOrderProtocol, requiredAmount);
            console.log(`⏳ Approval TX: ${approveTx.hash}`);
            console.log(`🔗 Polygonscan: https://polygonscan.com/tx/${approveTx.hash}`);
            
            const receipt = await approveTx.wait();
            console.log(`✅ Approval confirmed in block ${receipt.blockNumber}`);
            
            // Now try the order submission again
            return await tryOrderAfterApproval();
            
        } else {
            console.log('✅ USDC already approved');
            return await tryOrderAfterApproval();
        }
        
    } catch (error) {
        console.error('❌ Approval check failed:', error.message);
        return false;
    }
}

async function tryOrderAfterApproval() {
    console.log('\\n📤 Step 3: Trying order submission after approval...');
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const tokens = {
        USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
    };
    
    const usdcAmount = 3;
    const amountWei = ethers.parseUnits(usdcAmount.toString(), 6).toString();
    
    try {
        // Get fresh quote
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
        
        console.log(`💱 Fresh Quote: ${usdcAmount} USDC → ${wmaticAmount.toFixed(6)} WMATIC`);
        console.log(`📊 Rate: 1 USDC = ${rate.toFixed(6)} WMATIC`);
        
        // Create order with minimal required fields
        const salt = Date.now().toString();
        
        const orderData = {
            makerAsset: tokens.USDC,
            takerAsset: tokens.WMATIC,
            maker: wallet.address,
            receiver: '0x0000000000000000000000000000000000000000',
            makingAmount: amountWei,
            takingAmount: toAmount,
            salt: salt,
            extension: '0x00',
            makerTraits: '0'
        };
        
        // Create order hash using the exact same method as 1inch
        const orderHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                [
                    'address', 'address', 'address', 'address', 
                    'uint256', 'uint256', 'uint256', 'bytes', 'uint256'
                ],
                [
                    orderData.makerAsset, orderData.takerAsset, orderData.maker, orderData.receiver,
                    orderData.makingAmount, orderData.takingAmount, orderData.salt, 
                    orderData.extension, orderData.makerTraits
                ]
            )
        );
        
        const signature = await wallet.signMessage(ethers.getBytes(orderHash));
        
        const orderPayload = {
            orderHash: orderHash,
            signature: signature,
            data: orderData
        };
        
        console.log('\\n📤 Submitting order with approval...');
        console.log('Order Hash:', orderHash);
        
        const submitResponse = await axios.post('https://api.1inch.dev/orderbook/v4.0/137', orderPayload, {
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        console.log('\\n🎉 SUCCESS! ORDER SUBMITTED TO 1INCH!');
        console.log(`✅ Status: ${submitResponse.status}`);
        console.log(`📋 Order Hash: ${orderHash}`);
        console.log(`📊 Response:`, JSON.stringify(submitResponse.data, null, 2));
        console.log(`🔗 1inch App: https://app.1inch.io/#/137/limit-order/${orderHash}`);
        
        // Save successful order
        const result = {
            success: true,
            orderHash: orderHash,
            signature: signature,
            orderData: orderData,
            quote: { usdcAmount, wmaticAmount, rate },
            apiResponse: submitResponse.data,
            submittedAt: new Date().toISOString(),
            verificationUrl: `https://app.1inch.io/#/137/limit-order/${orderHash}`
        };
        
        const fs = require('fs');
        fs.writeFileSync('../frontend/successful-real-order.json', JSON.stringify(result, null, 2));
        
        return result;
        
    } catch (error) {
        console.error('\\n❌ Order submission still failed:');
        console.error('Status:', error.response?.status);
        console.error('Error:', JSON.stringify(error.response?.data, null, 2));
        
        if (error.response?.status === 400) {
            console.log('\\n💡 400 error suggests format issue. Let me try different approaches...');
            
            // Try without extension field
            console.log('\\n🧪 Trying without extension field...');
            return await tryMinimalOrder();
        }
        
        return false;
    }
}

async function tryMinimalOrder() {
    // Try with absolute minimal fields
    console.log('🧪 Trying minimal order format...');
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const tokens = {
        USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
    };
    
    try {
        // Minimal order structure
        const orderData = {
            makerAsset: tokens.USDC,
            takerAsset: tokens.WMATIC,
            maker: wallet.address,
            makingAmount: '1000000', // 1 USDC
            takingAmount: '4000000000000000000', // 4 WMATIC
            salt: Date.now().toString()
        };
        
        const orderHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                [orderData.makerAsset, orderData.takerAsset, orderData.maker, 
                 orderData.makingAmount, orderData.takingAmount, orderData.salt]
            )
        );
        
        const signature = await wallet.signMessage(ethers.getBytes(orderHash));
        
        const minimalPayload = {
            orderHash: orderHash,
            signature: signature,
            data: orderData
        };
        
        console.log('Trying minimal payload:', JSON.stringify(minimalPayload, null, 2));
        
        const response = await axios.post('https://api.1inch.dev/orderbook/v4.0/137', minimalPayload, {
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\\n🎉 MINIMAL ORDER WORKED!');
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        
        return true;
        
    } catch (error) {
        console.error('❌ Minimal order also failed:', error.response?.status, error.response?.data);
        return false;
    }
}

if (require.main === module) {
    debug500Error()
        .then(result => {
            if (result) {
                console.log('\\n🎉 REAL ORDER SUCCESSFULLY SUBMITTED!');
            } else {
                console.log('\\n❌ All attempts failed. 1inch API may have issues.');
            }
        })
        .catch(console.error);
}

module.exports = { debug500Error };
