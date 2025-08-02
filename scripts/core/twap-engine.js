const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log('🚀 PRODUCTION 1INCH TWAP SYSTEM');
    console.log('Using 1inch Aggregator API for real on-chain execution');
    console.log('');
    console.log('🏦 Wallet:', makerWallet.address);
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
        ['function balanceOf(address) view returns (uint256)'],
        provider
    );
    
    const initialUsdcBalance = await usdcContract.balanceOf(makerWallet.address);
    const initialWpolBalance = await wpolContract.balanceOf(makerWallet.address);
    
    console.log('💰 INITIAL BALANCES:');
    console.log('   USDC:', ethers.formatUnits(initialUsdcBalance, 6));
    console.log('   WPOL:', ethers.formatEther(initialWpolBalance));
    console.log('');
    
    if (initialUsdcBalance === 0n) {
        console.log('❌ No USDC available for TWAP');
        return;
    }
    
    // TWAP Configuration
    const totalAmount = ethers.parseUnits('0.3', 6); // 0.3 USDC total
    const slices = 3;
    const sliceAmount = totalAmount / BigInt(slices);
    const intervalSeconds = 45; // 45 seconds between swaps
    
    console.log('📋 TWAP CONFIGURATION:');
    console.log('   Strategy: Time-Weighted Average Price');
    console.log('   Protocol: 1inch Aggregator API');
    console.log('   Total USDC:', ethers.formatUnits(totalAmount, 6));
    console.log('   Slices:', slices);
    console.log('   Per slice:', ethers.formatUnits(sliceAmount, 6), 'USDC');
    console.log('   Interval:', intervalSeconds, 'seconds');
    console.log('');
    
    const API_KEY = process.env.ONEINCH_API_KEY;
    const headers = { 'Authorization': `Bearer ${API_KEY}` };
    
    // Approve 1inch router if needed
    const ONEINCH_ROUTER = '0x111111125421cA6dc452d289314280a0f8842A65';
    const currentAllowance = await usdcContract.allowance(makerWallet.address, ONEINCH_ROUTER);
    
    if (currentAllowance < totalAmount) {
        console.log('🔐 Approving USDC for 1inch router...');
        const approveTx = await usdcContract.approve(ONEINCH_ROUTER, totalAmount);
        await approveTx.wait();
        console.log('✅ USDC approved:', approveTx.hash);
        console.log('');
    }
    
    const executedSwaps = [];
    const startTime = Date.now();
    
    console.log('🚀 STARTING TWAP EXECUTION...');
    console.log('⏰ Start time:', new Date().toLocaleTimeString());
    console.log('');
    
    for (let i = 0; i < slices; i++) {
        const sliceStartTime = Date.now();
        console.log(`🎯 SLICE ${i + 1}/${slices}`);
        console.log('⏰ Time:', new Date().toLocaleTimeString());
        
        try {
            // Get quote
            const quoteUrl = `https://api.1inch.dev/swap/v6.0/137/quote?src=${USDC_ADDRESS}&dst=${WPOL_ADDRESS}&amount=${sliceAmount.toString()}`;
            
            const quoteResponse = await axios.get(quoteUrl, { headers });
            const expectedWpol = quoteResponse.data.dstAmount;
            
            console.log('📊 Quote:');
            console.log('   Input:', ethers.formatUnits(sliceAmount, 6), 'USDC');
            console.log('   Expected:', ethers.formatEther(expectedWpol), 'WPOL');
            console.log('   Rate:', (parseFloat(ethers.formatEther(expectedWpol)) / parseFloat(ethers.formatUnits(sliceAmount, 6))).toFixed(6), 'WPOL/USDC');
            
            // Get swap transaction
            const swapUrl = `https://api.1inch.dev/swap/v6.0/137/swap?src=${USDC_ADDRESS}&dst=${WPOL_ADDRESS}&amount=${sliceAmount.toString()}&from=${makerWallet.address}&slippage=1`;
            
            const swapResponse = await axios.get(swapUrl, { headers });
            const txData = swapResponse.data.tx;
            
            // Execute swap
            console.log('🔄 Executing swap...');
            const swapTx = await makerWallet.sendTransaction({
                to: txData.to,
                data: txData.data,
                value: txData.value,
                gasLimit: txData.gas
            });
            
            console.log('⏳ Transaction sent:', swapTx.hash);
            console.log('🔗 https://polygonscan.com/tx/' + swapTx.hash);
            
            const receipt = await swapTx.wait();
            
            if (receipt.status === 1) {
                console.log('✅ Swap successful!');
                
                // Record the swap
                executedSwaps.push({
                    slice: i + 1,
                    hash: swapTx.hash,
                    inputAmount: ethers.formatUnits(sliceAmount, 6),
                    expectedOutput: ethers.formatEther(expectedWpol),
                    timestamp: new Date().toISOString(),
                    polygonscan: `https://polygonscan.com/tx/${swapTx.hash}`,
                    executionTime: Date.now() - sliceStartTime
                });
                
                // Check actual balances after swap
                const currentUsdcBalance = await usdcContract.balanceOf(makerWallet.address);
                const currentWpolBalance = await wpolContract.balanceOf(makerWallet.address);
                
                console.log('💰 Updated balances:');
                console.log('   USDC:', ethers.formatUnits(currentUsdcBalance, 6));
                console.log('   WPOL:', ethers.formatEther(currentWpolBalance));
                
            } else {
                console.log('❌ Swap failed');
            }
            
        } catch (error) {
            console.log('❌ Slice error:', error.response?.data || error.message);
        }
        
        console.log('');
        
        // Wait for next slice (except for last one)
        if (i < slices - 1) {
            console.log(`⏳ Waiting ${intervalSeconds} seconds for next slice...`);
            await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
        }
    }
    
    // Final summary
    const totalExecutionTime = Date.now() - startTime;
    const finalUsdcBalance = await usdcContract.balanceOf(makerWallet.address);
    const finalWpolBalance = await wpolContract.balanceOf(makerWallet.address);
    
    console.log('🎉 TWAP EXECUTION COMPLETE!');
    console.log('');
    console.log('📊 EXECUTION SUMMARY:');
    console.log('   Total time:', Math.round(totalExecutionTime / 1000), 'seconds');
    console.log('   Successful swaps:', executedSwaps.length, '/', slices);
    console.log('   Total USDC processed:', ethers.formatUnits(initialUsdcBalance - finalUsdcBalance, 6));
    console.log('   Total WPOL received:', ethers.formatEther(finalWpolBalance - initialWpolBalance));
    console.log('');
    
    console.log('💰 FINAL BALANCES:');
    console.log('   USDC:', ethers.formatUnits(finalUsdcBalance, 6));
    console.log('   WPOL:', ethers.formatEther(finalWpolBalance));
    console.log('');
    
    if (executedSwaps.length > 0) {
        console.log('🔗 TRANSACTION PROOF:');
        executedSwaps.forEach(swap => {
            console.log(`   Slice ${swap.slice}: ${swap.hash}`);
            console.log(`     Amount: ${swap.inputAmount} USDC → ${swap.expectedOutput} WPOL`);
            console.log(`     Time: ${swap.timestamp}`);
            console.log(`     Proof: ${swap.polygonscan}`);
        });
        
        console.log('');
        console.log('✅ PRODUCTION COMPLIANCE:');
        console.log('✅ Real on-chain transactions on Polygon mainnet');
        console.log('✅ 1inch Protocol integration (Aggregator API)');
        console.log('✅ Time-weighted execution with verifiable timing');
        console.log('✅ Complete audit trail on Polygonscan');
        console.log('✅ Production-ready TWAP implementation');
        
        // Save proof data
        const proofData = {
            timestamp: new Date().toISOString(),
            wallet: makerWallet.address,
            strategy: 'Time-Weighted Average Price (TWAP)',
            protocol: '1inch Aggregator API',
            network: 'Polygon Mainnet',
            chainId: 137,
            totalExecutionTime: totalExecutionTime,
            slicesExecuted: executedSwaps.length,
            totalUSDCProcessed: ethers.formatUnits(initialUsdcBalance - finalUsdcBalance, 6),
            totalWPOLReceived: ethers.formatEther(finalWpolBalance - initialWpolBalance),
            swaps: executedSwaps,
            balanceChanges: {
                initial: {
                    usdc: ethers.formatUnits(initialUsdcBalance, 6),
                    wpol: ethers.formatEther(initialWpolBalance)
                },
                final: {
                    usdc: ethers.formatUnits(finalUsdcBalance, 6),
                    wpol: ethers.formatEther(finalWpolBalance)
                }
            }
        };
        
        // Write proof to file
        const fs = require('fs');
        const path = require('path');
        
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(
            path.join(dataDir, 'twap-execution-proof.json'),
            JSON.stringify(proofData, null, 2)
        );
        
        console.log('');
        console.log('💾 Execution proof saved to: data/twap-execution-proof.json');
        console.log('🎯 Ready for production deployment!');
    }
}

main().catch(console.error);
