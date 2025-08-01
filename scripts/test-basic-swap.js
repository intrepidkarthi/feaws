#!/usr/bin/env node

/**
 * Test basic token swap functionality - MUST WORK before any TWAP implementation
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log('🧪 TESTING BASIC TOKEN SWAP FUNCTIONALITY\n');
    console.log(`Wallet: ${wallet.address}\n`);

    // WMATIC contract (simplest swap: MATIC ↔ WMATIC)
    const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    
    const wmaticContract = new ethers.Contract(
        WMATIC_ADDRESS,
        [
            'function deposit() payable',
            'function withdraw(uint256) external',
            'function balanceOf(address) view returns (uint256)'
        ],
        wallet
    );

    // Step 1: Check initial balances
    console.log('📊 STEP 1: Check Initial Balances');
    const initialMATIC = await provider.getBalance(wallet.address);
    const initialWMATIC = await wmaticContract.balanceOf(wallet.address);
    
    console.log(`   MATIC: ${ethers.formatEther(initialMATIC)}`);
    console.log(`   WMATIC: ${ethers.formatEther(initialWMATIC)}\n`);

    if (initialMATIC < ethers.parseEther('0.1')) {
        console.log('❌ Insufficient MATIC for test (need at least 0.1 MATIC)');
        return;
    }

    // Step 2: Execute wrap transaction
    console.log('📊 STEP 2: Execute MATIC → WMATIC Wrap');
    const wrapAmount = ethers.parseEther('0.05'); // 0.05 MATIC
    
    console.log(`   Wrapping ${ethers.formatEther(wrapAmount)} MATIC...`);
    
    try {
        const tx = await wmaticContract.deposit({
            value: wrapAmount,
            gasLimit: 100000
        });
        
        console.log(`   Transaction sent: ${tx.hash}`);
        console.log(`   Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
        
        // Step 3: Wait for confirmation and check status
        console.log('   Waiting for confirmation...');
        const receipt = await tx.wait();
        
        console.log(`   Status: ${receipt.status === 1 ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`   Block: ${receipt.blockNumber}\n`);
        
        if (receipt.status !== 1) {
            console.log('❌ TRANSACTION FAILED - Cannot proceed with TWAP until this works');
            return;
        }
        
    } catch (error) {
        console.log(`❌ Transaction error: ${error.message}`);
        return;
    }

    // Step 4: Verify balance changes
    console.log('📊 STEP 3: Verify Balance Changes');
    const finalMATIC = await provider.getBalance(wallet.address);
    const finalWMATIC = await wmaticContract.balanceOf(wallet.address);
    
    console.log(`   MATIC: ${ethers.formatEther(initialMATIC)} → ${ethers.formatEther(finalMATIC)}`);
    console.log(`   WMATIC: ${ethers.formatEther(initialWMATIC)} → ${ethers.formatEther(finalWMATIC)}\n`);

    // Step 5: Calculate and verify changes
    console.log('📊 STEP 4: Verify Math');
    const maticUsed = initialMATIC - finalMATIC;
    const wmaticGained = finalWMATIC - initialWMATIC;
    
    console.log(`   MATIC used: ${ethers.formatEther(maticUsed)}`);
    console.log(`   WMATIC gained: ${ethers.formatEther(wmaticGained)}`);
    
    // Account for gas costs - WMATIC gained should be close to wrap amount
    const expectedWMATIC = wrapAmount;
    const tolerance = ethers.parseEther('0.001'); // 0.001 tolerance
    
    if (wmaticGained >= expectedWMATIC - tolerance && wmaticGained <= expectedWMATIC + tolerance) {
        console.log('   ✅ MATH VERIFIED - Swap worked correctly!');
        console.log('\n🎉 BASIC SWAP TEST PASSED');
        console.log('   - Transaction succeeded');
        console.log('   - Balances changed correctly');
        console.log('   - Math checks out');
        console.log('   - Ready for TWAP implementation');
        
    } else {
        console.log('   ❌ MATH ERROR - Expected vs actual WMATIC mismatch');
        console.log(`   Expected: ~${ethers.formatEther(expectedWMATIC)}`);
        console.log(`   Actual: ${ethers.formatEther(wmaticGained)}`);
    }

} catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
}

main().catch(console.error);
