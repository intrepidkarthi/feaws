const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * EXECUTE REAL 1INCH SWAP TRANSACTION
 * 
 * This actually executes a real swap on 1inch - not just an order
 * This is REAL blockchain transaction execution
 */

async function executeRealSwap() {
    console.log('🔥 EXECUTING REAL 1INCH SWAP TRANSACTION');
    console.log('=======================================');
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log(`📍 Wallet: ${wallet.address}`);
    console.log(`🔗 Network: Polygon (137)`);
    
    const tokens = {
        USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
    };
    
    const usdcAmount = 0.5; // Start with 0.5 USDC for safety
    
    try {
        // Step 1: Get swap transaction data
        console.log('\\n📡 Step 1: Getting 1inch swap transaction...');
        const amountWei = ethers.parseUnits(usdcAmount.toString(), 6);
        
        const swapResponse = await axios.get('https://api.1inch.dev/swap/v6.0/137/swap', {
            params: {
                src: tokens.USDC,
                dst: tokens.WMATIC,
                amount: amountWei.toString(),
                from: wallet.address,
                slippage: 1, // 1% slippage
                disableEstimate: false,
                allowPartialFill: false
            },
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`
            }
        });
        
        const swapData = swapResponse.data;
        const toAmount = swapData.dstAmount;
        const wmaticAmount = parseFloat(ethers.formatUnits(toAmount, 18));
        const rate = wmaticAmount / usdcAmount;
        
        console.log(`✅ Swap: ${usdcAmount} USDC → ${wmaticAmount.toFixed(6)} WMATIC`);
        console.log(`💱 Rate: 1 USDC = ${rate.toFixed(6)} WMATIC`);
        console.log(`🎯 To Contract: ${swapData.tx.to}`);
        console.log(`⛽ Gas: ${swapData.tx.gas}`);
        
        // Step 2: Check and approve USDC
        console.log('\\n🔐 Step 2: Checking USDC approval...');
        
        const erc20ABI = [
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)',
            'function balanceOf(address owner) view returns (uint256)'
        ];
        
        const usdcContract = new ethers.Contract(tokens.USDC, erc20ABI, wallet);
        
        const balance = await usdcContract.balanceOf(wallet.address);
        const allowance = await usdcContract.allowance(wallet.address, swapData.tx.to);
        
        console.log(`💰 USDC Balance: ${ethers.formatUnits(balance, 6)} USDC`);
        console.log(`🔓 Current Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
        
        if (balance < amountWei) {
            throw new Error(`Insufficient USDC balance. Need ${usdcAmount}, have ${ethers.formatUnits(balance, 6)}`);
        }
        
        if (allowance < amountWei) {
            console.log('📝 Approving USDC...');
            const approveTx = await usdcContract.approve(swapData.tx.to, amountWei);
            console.log(`⏳ Approval TX: ${approveTx.hash}`);
            console.log(`🔗 Polygonscan: https://polygonscan.com/tx/${approveTx.hash}`);
            
            const receipt = await approveTx.wait();
            console.log(`✅ USDC approved in block ${receipt.blockNumber}`);
        } else {
            console.log('✅ USDC already approved');
        }
        
        // Step 3: Execute the swap
        console.log('\\n🚀 Step 3: EXECUTING REAL SWAP TRANSACTION...');
        
        const feeData = await provider.getFeeData();
        
        const swapTx = {
            to: swapData.tx.to,
            data: swapData.tx.data,
            value: swapData.tx.value || 0,
            gasLimit: parseInt(swapData.tx.gas) + 50000, // Add buffer
            gasPrice: feeData.gasPrice
        };
        
        console.log('Transaction details:', {
            to: swapTx.to,
            value: swapTx.value.toString(),
            gasLimit: swapTx.gasLimit.toString(),
            dataLength: swapTx.data.length
        });
        
        // Get balances before swap
        const usdcBefore = await usdcContract.balanceOf(wallet.address);
        const wmaticContract = new ethers.Contract(tokens.WMATIC, erc20ABI, wallet);
        const wmaticBefore = await wmaticContract.balanceOf(wallet.address);
        
        console.log('\\n📊 Balances before swap:');
        console.log(`💰 USDC: ${ethers.formatUnits(usdcBefore, 6)}`);
        console.log(`💎 WMATIC: ${ethers.formatUnits(wmaticBefore, 18)}`);
        
        // EXECUTE THE SWAP
        const executedTx = await wallet.sendTransaction(swapTx);
        
        console.log('\\n🎉 SWAP TRANSACTION SUBMITTED!');
        console.log(`📋 Transaction Hash: ${executedTx.hash}`);
        console.log(`🔗 Polygonscan: https://polygonscan.com/tx/${executedTx.hash}`);
        
        console.log('\\n⏳ Waiting for confirmation...');
        const receipt = await executedTx.wait();
        
        console.log(`✅ SWAP CONFIRMED IN BLOCK ${receipt.blockNumber}!`);
        console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);
        
        // Get balances after swap
        const usdcAfter = await usdcContract.balanceOf(wallet.address);
        const wmaticAfter = await wmaticContract.balanceOf(wallet.address);
        
        const usdcSpent = ethers.formatUnits(usdcBefore - usdcAfter, 6);
        const wmaticReceived = ethers.formatUnits(wmaticAfter - wmaticBefore, 18);
        const actualRate = parseFloat(wmaticReceived) / parseFloat(usdcSpent);
        
        console.log('\\n📊 Balances after swap:');
        console.log(`💰 USDC: ${ethers.formatUnits(usdcAfter, 6)} (spent: ${usdcSpent})`);
        console.log(`💎 WMATIC: ${ethers.formatUnits(wmaticAfter, 18)} (received: ${wmaticReceived})`);
        console.log(`💱 Actual Rate: ${actualRate.toFixed(6)} WMATIC per USDC`);
        
        const swapResult = {
            success: true,
            method: 'real_1inch_swap_execution',
            transactionHash: executedTx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            swapDetails: {
                usdcSpent: usdcSpent,
                wmaticReceived: wmaticReceived,
                actualRate: actualRate,
                expectedRate: rate
            },
            balances: {
                before: {
                    usdc: ethers.formatUnits(usdcBefore, 6),
                    wmatic: ethers.formatUnits(wmaticBefore, 18)
                },
                after: {
                    usdc: ethers.formatUnits(usdcAfter, 6),
                    wmatic: ethers.formatUnits(wmaticAfter, 18)
                }
            },
            contractAddress: swapData.tx.to,
            executedAt: new Date().toISOString(),
            polygonscanUrl: `https://polygonscan.com/tx/${executedTx.hash}`,
            note: 'REAL 1inch swap transaction executed on Polygon mainnet'
        };
        
        const fs = require('fs');
        fs.writeFileSync('../frontend/executed-swap.json', JSON.stringify(swapResult, null, 2));
        
        console.log('\\n🎯 REAL 1INCH SWAP EXECUTED SUCCESSFULLY!');
        console.log('==========================================');
        console.log(`📋 TX Hash: ${executedTx.hash}`);
        console.log(`🔗 Polygonscan: https://polygonscan.com/tx/${executedTx.hash}`);
        console.log(`💰 Traded: ${usdcSpent} USDC → ${wmaticReceived} WMATIC`);
        console.log(`💱 Rate: ${actualRate.toFixed(6)} WMATIC per USDC`);
        console.log(`⛽ Gas: ${receipt.gasUsed.toString()}`);
        console.log(`📦 Block: ${receipt.blockNumber}`);
        
        console.log('\\n💾 Swap data saved to frontend/executed-swap.json');
        
        return swapResult;
        
    } catch (error) {
        console.error('\\n❌ SWAP EXECUTION FAILED:', error.message);
        
        if (error.response) {
            console.log('API Status:', error.response.status);
            console.log('API Error:', JSON.stringify(error.response.data, null, 2));
        }
        
        throw error;
    }
}

if (require.main === module) {
    executeRealSwap()
        .then(result => {
            console.log('\\n🎉 REAL 1INCH SWAP COMPLETED!');
            console.log('This was a REAL blockchain transaction, not simulation');
        })
        .catch(error => {
            console.error('💥 FAILED:', error.message);
            process.exit(1);
        });
}

module.exports = { executeRealSwap };
