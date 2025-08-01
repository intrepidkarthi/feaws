#!/usr/bin/env node

/**
 * Verify token contract addresses and their details
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerAddress = new ethers.Wallet(process.env.PRIVATE_KEY).address;
    
    console.log('🔍 TOKEN CONTRACT VERIFICATION\n');
    console.log(`Checking for wallet: ${makerAddress}\n`);
    
    // Token addresses to check
    const tokens = [
        {
            name: 'Native USDC',
            address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
        },
        {
            name: 'PoS USDC (old)',
            address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
        },
        {
            name: 'WMATIC/WPOL',
            address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
        },
        {
            name: 'USDT',
            address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
        },
        {
            name: 'DAI',
            address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
        }
    ];
    
    for (const token of tokens) {
        try {
            console.log(`📋 ${token.name} (${token.address})`);
            
            const contract = new ethers.Contract(
                token.address,
                [
                    'function balanceOf(address) view returns (uint256)',
                    'function symbol() view returns (string)',
                    'function name() view returns (string)',
                    'function decimals() view returns (uint8)'
                ],
                provider
            );
            
            const [balance, symbol, name, decimals] = await Promise.all([
                contract.balanceOf(makerAddress),
                contract.symbol(),
                contract.name(),
                contract.decimals()
            ]);
            
            const formattedBalance = ethers.formatUnits(balance, decimals);
            
            console.log(`   Name: ${name}`);
            console.log(`   Symbol: ${symbol}`);
            console.log(`   Decimals: ${decimals}`);
            console.log(`   Balance: ${formattedBalance} ${symbol}`);
            
            if (balance > 0) {
                console.log(`   ✅ HAS BALANCE: ${formattedBalance} ${symbol}`);
            } else {
                console.log(`   ❌ No balance`);
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        console.log('');
    }
    
    // Check native balance
    console.log('💎 NATIVE BALANCE (POL):');
    const nativeBalance = await provider.getBalance(makerAddress);
    console.log(`   Balance: ${ethers.formatEther(nativeBalance)} POL`);
    
    if (nativeBalance > 0) {
        console.log(`   ✅ HAS NATIVE POL: ${ethers.formatEther(nativeBalance)}`);
    } else {
        console.log(`   ❌ No native POL`);
    }
}

main().catch(console.error);
