#!/usr/bin/env node

/**
 * Approve 1inch LOP contract to spend USDC
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    console.log('Approving 1 USDC for 1inch LOP...');
    
    // Validate environment
    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in .env');
    }
    
    if (!process.env.POLYGON_RPC_URL) {
        throw new Error('POLYGON_RPC_URL not found in .env');
    }
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // USDC contract address on Polygon
    const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    
    // 1inch LOP contract address on Polygon
    const LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
    
    // USDC ABI (minimal interface for approval)
    const USDC_ABI = [
        'function approve(address spender, uint256 amount) returns (bool)'
    ];
    
    // Create contract instance
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
    
    // Approve 1 USDC (with 6 decimals)
    const amount = ethers.parseUnits('1', 6);
    
    try {
        const tx = await usdcContract.approve(LOP_CONTRACT, amount, {
            gasLimit: 100000,
            gasPrice: ethers.parseUnits('30', 'gwei')
        });
        
        console.log(`Approval transaction sent: ${tx.hash}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log('✅ USDC approval successful!');
            console.log(`🔍 Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
        } else {
            console.log('❌ USDC approval failed');
        }
    } catch (error) {
        console.error('❌ Error approving USDC:', error.message);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('❌ Approval failed:', error.message);
    process.exit(1);
});
