#!/usr/bin/env node

/**
 * Check USDC allowance for 1inch LOP contract
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    console.log('Checking USDC allowance for 1inch LOP...');
    
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
    
    // USDC ABI (minimal interface for allowance)
    const USDC_ABI = [
        'function allowance(address owner, address spender) view returns (uint256)'
    ];
    
    // Create contract instance
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    
    try {
        const allowance = await usdcContract.allowance(wallet.address, LOP_CONTRACT);
        console.log(`USDC Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
    } catch (error) {
        console.error('Error checking allowance:', error.message);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
