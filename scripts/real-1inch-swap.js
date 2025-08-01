#!/usr/bin/env node

require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log('🚀 REAL 1INCH SWAP - USDC → WMATIC\n');

    const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

    const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        [
            'function balanceOf(address) view returns (uint256)',
            'function approve(address spender, uint256 amount) returns (bool)',
            'function decimals() view returns (uint8)'
        ],
        wallet
    );

    const wmaticContract = new ethers.Contract(
        WMATIC_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        provider
    );

    // Check initial balances
    const initialUSDC = await usdcContract.balanceOf(wallet.address);
    const initialWMATIC = await wmaticContract.balanceOf(wallet.address);
    const decimals = await usdcContract.decimals();

    console.log(`Initial USDC: ${ethers.formatUnits(initialUSDC, decimals)}`);
    console.log(`Initial WMATIC: ${ethers.formatEther(initialWMATIC)}\n`);

    const swapAmount = ethers.parseUnits('0.1', decimals); // 0.1 USDC

    if (initialUSDC < swapAmount) {
        console.log('❌ Insufficient USDC');
        return;
    }

    // Approve USDC for 1inch router
    const ONEINCH_ROUTER = '0x111111125421ca6dc452d289314280a0f8842a65';
    console.log('🔐 Approving USDC for 1inch router...');
    
    const approveTx = await usdcContract.approve(ONEINCH_ROUTER, swapAmount);
    await approveTx.wait();
    console.log('✅ USDC approved\n');

    // Get 1inch swap data
    console.log('📡 Getting 1inch swap quote...');
    
    try {
        const quoteResponse = await axios.get('https://api.1inch.dev/swap/v6.0/137/quote', {
            params: {
                src: USDC_ADDRESS,
                dst: WMATIC_ADDRESS,
                amount: swapAmount.toString()
            },
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`
            }
        });

        console.log(`Expected output: ${ethers.formatEther(quoteResponse.data.dstAmount)} WMATIC\n`);

        // Get swap transaction data
        console.log('📡 Getting 1inch swap transaction...');
        
        const swapResponse = await axios.get('https://api.1inch.dev/swap/v6.0/137/swap', {
            params: {
                src: USDC_ADDRESS,
                dst: WMATIC_ADDRESS,
                amount: swapAmount.toString(),
                from: wallet.address,
                slippage: 1 // 1% slippage
            },
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`
            }
        });

        const swapTx = swapResponse.data.tx;
        
        console.log('⚡ Executing 1inch swap...');
        
        // Execute the swap
        const tx = await wallet.sendTransaction({
            to: swapTx.to,
            data: swapTx.data,
            value: swapTx.value || 0,
            gasLimit: 300000
        });

        console.log(`TX: ${tx.hash}`);
        console.log(`Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log('✅ SWAP SUCCESSFUL\n');
            
            // Check final balances (1inch might route to POL instead of WMATIC)
            const finalUSDC = await usdcContract.balanceOf(wallet.address);
            const finalWMATIC = await wmaticContract.balanceOf(wallet.address);
            const finalPOL = await provider.getBalance(wallet.address);
            
            const usdcUsed = initialUSDC - finalUSDC;
            const wmaticGained = finalWMATIC - initialWMATIC;
            const polGained = finalPOL - (await provider.getBalance(wallet.address, receipt.blockNumber - 1));
            
            console.log('📊 RESULTS:');
            console.log(`USDC used: ${ethers.formatUnits(usdcUsed, decimals)} USDC`);
            console.log(`WMATIC gained: ${ethers.formatEther(wmaticGained)} WMATIC`);
            console.log(`POL balance: ${ethers.formatEther(finalPOL)} POL`);
            console.log(`Final USDC: ${ethers.formatUnits(finalUSDC, decimals)}`);
            
            if (usdcUsed > 0) {
                console.log('\n✅ REAL 1INCH SWAP VERIFIED');
                console.log('- USDC balance decreased');
                console.log('- 1inch routed swap successfully');
                console.log('- Transaction confirmed on-chain');
                console.log('- Check Polygonscan for exact output token');
            } else {
                console.log('\n❌ SWAP FAILED - No USDC used');
            }
            
        } else {
            console.log('❌ TRANSACTION FAILED');
        }

    } catch (error) {
        console.log(`❌ 1inch API error: ${error.message}`);
        
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log(`Data:`, error.response.data);
        }
    }
}

main().catch(console.error);
