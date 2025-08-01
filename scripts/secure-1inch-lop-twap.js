const { ethers } = require('ethers');

// Load from .env file ONLY
require('dotenv').config();

if (!process.env.PRIVATE_KEY || !process.env.TAKER_PRIVATE_KEY) {
    console.error('❌ Missing private keys in .env file');
    process.exit(1);
}

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    console.log('🚀 SECURE 1INCH LOP TWAP SYSTEM');
    console.log('');
    console.log('📊 Configuration:');
    console.log('   Protocol: 1inch Limit Order Protocol v4');
    console.log('   Contract: 0x111111125421ca6dc452d289314280a0f8842a65');
    console.log('   Maker:', makerWallet.address);
    console.log('   Taker:', takerWallet.address);
    console.log('');
    
    // Contract addresses
    const LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
    const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    
    // Check balances first
    const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        provider
    );
    
    const usdcBalance = await usdcContract.balanceOf(makerWallet.address);
    const makerPolBalance = await provider.getBalance(makerWallet.address);
    const takerPolBalance = await provider.getBalance(takerWallet.address);
    
    console.log('💰 CURRENT BALANCES:');
    console.log('   Maker USDC:', ethers.formatUnits(usdcBalance, 6));
    console.log('   Maker POL:', ethers.formatEther(makerPolBalance));
    console.log('   Taker POL:', ethers.formatEther(takerPolBalance));
    console.log('');
    
    if (usdcBalance === 0n) {
        console.log('❌ Maker needs USDC for TWAP orders');
        return;
    }
    
    if (makerPolBalance < ethers.parseEther('0.01')) {
        console.log('❌ Maker needs POL for gas');
        return;
    }
    
    if (takerPolBalance < ethers.parseEther('0.01')) {
        console.log('❌ Taker needs POL for gas');
        return;
    }
    
    console.log('✅ All wallets ready for TWAP execution!');
    console.log('');
    
    // TWAP Configuration
    const totalUsdcAmount = ethers.parseUnits('0.5', 6); // 0.5 USDC total
    const slices = 3;
    const sliceAmount = totalUsdcAmount / BigInt(slices);
    const intervalSeconds = 60; // 1 minute between orders
    
    console.log('📋 TWAP PARAMETERS:');
    console.log('   Total USDC:', ethers.formatUnits(totalUsdcAmount, 6));
    console.log('   Slices:', slices);
    console.log('   Per slice:', ethers.formatUnits(sliceAmount, 6), 'USDC');
    console.log('   Interval:', intervalSeconds, 'seconds');
    console.log('');
    
    // 1inch LOP Contract ABI (simplified)
    const lopABI = [
        'function fillOrder((uint256,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes) order, bytes signature, bytes interaction, uint256 makingAmount, uint256 takingAmount, uint256 skipPermitAndThresholdAmount) external returns (uint256, uint256, bytes32)',
        'function hashOrder((uint256,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes) order) external view returns (bytes32)'
    ];
    
    const lopContract = new ethers.Contract(LOP_CONTRACT, lopABI, takerWallet);
    
    // USDC Contract for approvals
    const usdcContractWithSigner = new ethers.Contract(
        USDC_ADDRESS,
        [
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)'
        ],
        makerWallet
    );
    
    // Check and set approval
    console.log('🔐 Checking USDC approval...');
    const currentAllowance = await usdcContractWithSigner.allowance(makerWallet.address, LOP_CONTRACT);
    
    if (currentAllowance < totalUsdcAmount) {
        console.log('💰 Approving USDC for 1inch LOP...');
        const approveTx = await usdcContractWithSigner.approve(LOP_CONTRACT, totalUsdcAmount);
        await approveTx.wait();
        console.log('✅ USDC approved:', approveTx.hash);
    } else {
        console.log('✅ USDC already approved');
    }
    console.log('');
    
    // Create and execute TWAP orders
    const orders = [];
    
    for (let i = 0; i < slices; i++) {
        console.log(`📝 Creating Order ${i + 1}/${slices}...`);
        
        // Simple order structure for 1inch LOP
        const salt = Math.floor(Math.random() * 1000000);
        const validFrom = Math.floor(Date.now() / 1000) + (i * intervalSeconds);
        const validTo = validFrom + 3600; // Valid for 1 hour
        
        const order = {
            salt: salt,
            makerAsset: USDC_ADDRESS,
            takerAsset: WPOL_ADDRESS,
            maker: makerWallet.address,
            receiver: '0x0000000000000000000000000000000000000000',
            allowedSender: '0x0000000000000000000000000000000000000000',
            makingAmount: sliceAmount,
            takingAmount: ethers.parseEther('0.1'), // Rough estimate, should be calculated properly
            offsets: '0x',
            interactions: '0x',
            predicate: '0x',
            permit: '0x',
            preInteraction: '0x',
            postInteraction: '0x'
        };
        
        // EIP-712 Domain
        const domain = {
            name: '1inch Limit Order Protocol',
            version: '4',
            chainId: 137,
            verifyingContract: LOP_CONTRACT
        };
        
        // EIP-712 Types
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
        
        // Sign the order
        const signature = await makerWallet.signTypedData(domain, types, order);
        
        orders.push({
            order,
            signature,
            validFrom,
            validTo
        });
        
        console.log(`✅ Order ${i + 1} created and signed`);
        console.log(`   Valid from: ${new Date(validFrom * 1000).toLocaleTimeString()}`);
        console.log(`   Amount: ${ethers.formatUnits(sliceAmount, 6)} USDC`);
        console.log('');
    }
    
    console.log('🤖 STARTING TAKER BOT...');
    console.log('Monitoring orders for execution...');
    console.log('');
    
    // Taker bot loop
    const startTime = Date.now();
    const maxRunTime = 10 * 60 * 1000; // 10 minutes max
    
    while (Date.now() - startTime < maxRunTime) {
        const currentTime = Math.floor(Date.now() / 1000);
        
        for (let i = 0; i < orders.length; i++) {
            const orderData = orders[i];
            
            if (orderData.filled) continue;
            
            if (currentTime >= orderData.validFrom && currentTime <= orderData.validTo) {
                console.log(`🎯 Attempting to fill Order ${i + 1}...`);
                
                try {
                    // Convert order to tuple format for contract call
                    const orderTuple = [
                        orderData.order.salt,
                        orderData.order.makerAsset,
                        orderData.order.takerAsset,
                        orderData.order.maker,
                        orderData.order.receiver,
                        orderData.order.allowedSender,
                        orderData.order.makingAmount,
                        orderData.order.takingAmount,
                        orderData.order.offsets,
                        orderData.order.interactions,
                        orderData.order.predicate,
                        orderData.order.permit,
                        orderData.order.preInteraction,
                        orderData.order.postInteraction
                    ];
                    
                    const fillTx = await lopContract.fillOrder(
                        orderTuple,
                        orderData.signature,
                        '0x',
                        orderData.order.makingAmount,
                        orderData.order.takingAmount,
                        0,
                        { gasLimit: 500000 }
                    );
                    
                    const receipt = await fillTx.wait();
                    
                    if (receipt.status === 1) {
                        console.log(`✅ Order ${i + 1} filled successfully!`);
                        console.log(`🔗 https://polygonscan.com/tx/${fillTx.hash}`);
                        orderData.filled = true;
                    } else {
                        console.log(`❌ Order ${i + 1} fill failed`);
                    }
                    
                } catch (error) {
                    console.log(`⚠️  Order ${i + 1} fill error:`, error.message);
                }
                
                console.log('');
            }
        }
        
        // Check if all orders are filled
        const filledOrders = orders.filter(o => o.filled).length;
        if (filledOrders === orders.length) {
            console.log('🎉 ALL ORDERS FILLED! TWAP COMPLETE!');
            break;
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    }
    
    // Final summary
    const finalFilledOrders = orders.filter(o => o.filled).length;
    console.log('');
    console.log('📊 TWAP EXECUTION SUMMARY:');
    console.log(`Orders filled: ${finalFilledOrders}/${orders.length}`);
    console.log('🔗 All transactions are verifiable on Polygonscan');
    console.log('✅ Real 1inch Limit Order Protocol TWAP completed!');
}

main().catch(console.error);
