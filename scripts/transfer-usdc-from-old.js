#!/usr/bin/env node

/**
 * Transfer USDC from old contract wallet to new maker wallet
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    
    // Old contract wallet (has USDC but is a contract)
    const oldPrivateKey = '696629dbed4af02507c2d315587cbfd1a38301be78d03c39e29b16d7d7271cdf';
    const oldWallet = new ethers.Wallet(oldPrivateKey, provider);
    
    // New maker wallet (EOA, needs USDC)
    const newMakerAddress = new ethers.Wallet(process.env.PRIVATE_KEY).address;
    
    console.log('💸 Transferring USDC from old wallet to new maker...\n');
    console.log(`From (Old): ${oldWallet.address}`);
    console.log(`To (New):   ${newMakerAddress}`);

    // USDC contract
    const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        [
            'function balanceOf(address) view returns (uint256)',
            'function transfer(address to, uint256 amount) returns (bool)',
            'function decimals() view returns (uint8)'
        ],
        oldWallet // Connect with old wallet
    );

    // Check old wallet balance
    const oldBalance = await usdcContract.balanceOf(oldWallet.address);
    const decimals = await usdcContract.decimals();
    
    console.log(`\nOld wallet USDC balance: ${ethers.formatUnits(oldBalance, decimals)} USDC`);
    
    if (oldBalance === 0n) {
        console.log('❌ No USDC to transfer');
        return;
    }

    // Transfer 10 USDC (enough for TWAP demo)
    const transferAmount = ethers.parseUnits('10', decimals);
    const actualAmount = oldBalance < transferAmount ? oldBalance : transferAmount;
    
    console.log(`\n📤 Transferring ${ethers.formatUnits(actualAmount, decimals)} USDC...`);
    
    try {
        const tx = await usdcContract.transfer(newMakerAddress, actualAmount, {
            gasLimit: 100000
        });

        console.log(`Transaction hash: ${tx.hash}`);
        console.log(`🔍 Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
        
        console.log('\n⏳ Waiting for confirmation...');
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log('✅ Transfer successful!');
            
            // Check new balances
            const newOldBalance = await usdcContract.balanceOf(oldWallet.address);
            const newMakerBalance = await usdcContract.balanceOf(newMakerAddress);
            
            console.log('\n💰 Updated USDC balances:');
            console.log(`Old wallet: ${ethers.formatUnits(newOldBalance, decimals)} USDC`);
            console.log(`New maker:  ${ethers.formatUnits(newMakerBalance, decimals)} USDC`);
            
        } else {
            console.log('❌ Transfer failed!');
        }
        
    } catch (error) {
        console.log(`❌ Transfer failed: ${error.message}`);
        
        // If contract wallet can't send, suggest alternative
        console.log('\n💡 Alternative: Get USDC from an exchange or swap some WPOL to USDC');
    }
}

main().catch(console.error);
