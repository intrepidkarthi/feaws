const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    console.log('🔍 DEBUGGING 1INCH LOP ORDER STRUCTURE');
    console.log('');
    
    // Contract addresses
    const LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
    const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    
    // Check the actual 1inch LOP contract to understand the correct structure
    const lopContract = new ethers.Contract(
        LOP_CONTRACT,
        [
            'function fillOrder((uint256,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes) order, bytes signature, bytes interaction, uint256 makingAmount, uint256 takingAmount, uint256 skipPermitAndThresholdAmount) external returns (uint256, uint256, bytes32)',
            'function hashOrder((uint256,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes) order) external view returns (bytes32)',
            'function invalidatorForOrderRFQ(address maker, uint256 slot) external view returns (uint256)',
            'function remainingRaw(bytes32 orderHash) external view returns (uint256)'
        ],
        provider
    );
    
    console.log('📋 Contract Address:', LOP_CONTRACT);
    console.log('🏦 Maker:', makerWallet.address);
    console.log('🏦 Taker:', takerWallet.address);
    console.log('');
    
    // Check balances
    const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'],
        provider
    );
    
    const usdcBalance = await usdcContract.balanceOf(makerWallet.address);
    const allowance = await usdcContract.allowance(makerWallet.address, LOP_CONTRACT);
    
    console.log('💰 Maker USDC Balance:', ethers.formatUnits(usdcBalance, 6));
    console.log('🔐 USDC Allowance:', ethers.formatUnits(allowance, 6));
    console.log('');
    
    if (usdcBalance === 0n) {
        console.log('❌ Maker has no USDC');
        return;
    }
    
    if (allowance === 0n) {
        console.log('❌ No USDC allowance for 1inch LOP');
        return;
    }
    
    // Create a simple order
    const orderAmount = ethers.parseUnits('0.1', 6); // 0.1 USDC
    const expectedWPOL = ethers.parseEther('0.05'); // Rough estimate
    
    console.log('📝 Creating simple limit order...');
    console.log('   Selling:', ethers.formatUnits(orderAmount, 6), 'USDC');
    console.log('   For:', ethers.formatEther(expectedWPOL), 'WPOL');
    console.log('');
    
    // Simplified order structure based on 1inch docs
    const order = {
        salt: BigInt(Math.floor(Math.random() * 1000000)),
        makerAsset: USDC_ADDRESS,
        takerAsset: WPOL_ADDRESS,
        maker: makerWallet.address,
        receiver: '0x0000000000000000000000000000000000000000', // Zero address = maker receives
        allowedSender: '0x0000000000000000000000000000000000000000', // Anyone can fill
        makingAmount: orderAmount,
        takingAmount: expectedWPOL,
        offsets: '0x',
        interactions: '0x',
        predicate: '0x', // No predicate = always valid
        permit: '0x',
        preInteraction: '0x',
        postInteraction: '0x'
    };
    
    console.log('🔍 Order details:');
    console.log('   Salt:', order.salt.toString());
    console.log('   Maker Asset:', order.makerAsset);
    console.log('   Taker Asset:', order.takerAsset);
    console.log('   Making Amount:', order.makingAmount.toString());
    console.log('   Taking Amount:', order.takingAmount.toString());
    console.log('');
    
    // Calculate order hash
    try {
        const orderTuple = [
            order.salt,
            order.makerAsset,
            order.takerAsset,
            order.maker,
            order.receiver,
            order.allowedSender,
            order.makingAmount,
            order.takingAmount,
            order.offsets,
            order.interactions,
            order.predicate,
            order.permit,
            order.preInteraction,
            order.postInteraction
        ];
        
        const orderHash = await lopContract.hashOrder(orderTuple);
        console.log('📋 Order Hash:', orderHash);
        
        // Check if order has any remaining amount
        const remaining = await lopContract.remainingRaw(orderHash);
        console.log('📊 Remaining Amount:', remaining.toString());
        console.log('');
        
        // EIP-712 signing
        const domain = {
            name: '1inch Limit Order Protocol',
            version: '4',
            chainId: 137,
            verifyingContract: LOP_CONTRACT
        };
        
        const types = {
            Order: [
                { name: 'salt', type: 'uint256' },
                { name: 'makerAsset', type: 'address' },
                { name: 'takerAsset', type: 'address' },
                { name: 'maker', type: 'address' },
                { name: 'receiver', type: 'address' },
                { name: 'allowedSender', type: 'address' },
                { name: 'makingAmount', type: 'uint256' },
                { name: 'takingAmount', type: 'uint256' },
                { name: 'offsets', type: 'bytes' },
                { name: 'interactions', type: 'bytes' },
                { name: 'predicate', type: 'bytes' },
                { name: 'permit', type: 'bytes' },
                { name: 'preInteraction', type: 'bytes' },
                { name: 'postInteraction', type: 'bytes' }
            ]
        };
        
        console.log('✍️  Signing order...');
        const signature = await makerWallet.signTypedData(domain, types, order);
        console.log('✅ Order signed');
        console.log('📋 Signature:', signature);
        console.log('');
        
        // Try to fill the order immediately (for testing)
        console.log('🎯 Testing order fill...');
        
        const lopContractWithTaker = lopContract.connect(takerWallet);
        
        // Estimate gas first
        try {
            const gasEstimate = await lopContractWithTaker.fillOrder.estimateGas(
                orderTuple,
                signature,
                '0x',
                order.makingAmount,
                order.takingAmount,
                0
            );
            console.log('⛽ Gas estimate:', gasEstimate.toString());
        } catch (gasError) {
            console.log('❌ Gas estimation failed:', gasError.reason || gasError.message);
            
            // Try to get more specific error
            try {
                await lopContractWithTaker.fillOrder.staticCall(
                    orderTuple,
                    signature,
                    '0x',
                    order.makingAmount,
                    order.takingAmount,
                    0
                );
            } catch (staticError) {
                console.log('❌ Static call error:', staticError.reason || staticError.message);
            }
            return;
        }
        
        // If gas estimation succeeds, try the actual transaction
        const fillTx = await lopContractWithTaker.fillOrder(
            orderTuple,
            signature,
            '0x',
            order.makingAmount,
            order.takingAmount,
            0,
            { gasLimit: 500000 }
        );
        
        console.log('⏳ Fill transaction sent:', fillTx.hash);
        console.log('🔗 https://polygonscan.com/tx/' + fillTx.hash);
        
        const receipt = await fillTx.wait();
        
        if (receipt.status === 1) {
            console.log('✅ Order filled successfully!');
            console.log('🎉 1inch LOP TWAP system is working!');
        } else {
            console.log('❌ Order fill failed');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.reason || error.message);
        if (error.data) {
            console.log('Error data:', error.data);
        }
    }
}

main().catch(console.error);
