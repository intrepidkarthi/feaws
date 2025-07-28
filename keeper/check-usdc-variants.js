const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkUSDCVariants() {
    console.log('🔍 CHECKING USDC VARIANTS ON POLYGON');
    console.log('====================================');
    
    try {
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log(`📍 Wallet: ${wallet.address}`);
        
        // Different USDC contract addresses on Polygon
        const usdcVariants = {
            'USDC (Native)': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
            'USDC.e (Bridged)': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // Bridged USDC (old)
            'USDT': '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
            'BUSD': '0x9C9e5fD8bbc25984B178FdCE6117Defa39d2db39',
            'FRAX': '0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89'
        };
        
        const erc20ABI = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)',
            'function name() view returns (string)'
        ];
        
        console.log('\n💰 USD STABLECOIN BALANCES:');
        console.log('===========================');
        
        let totalUSDValue = 0;
        
        for (const [label, address] of Object.entries(usdcVariants)) {
            try {
                const tokenContract = new ethers.Contract(address, erc20ABI, provider);
                
                const [balance, decimals, symbol, name] = await Promise.all([
                    tokenContract.balanceOf(wallet.address),
                    tokenContract.decimals(),
                    tokenContract.symbol(),
                    tokenContract.name()
                ]);
                
                const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
                totalUSDValue += formattedBalance;
                
                console.log(`\\n${label}:`);
                console.log(`  Symbol: ${symbol}`);
                console.log(`  Name: ${name}`);
                console.log(`  Address: ${address}`);
                console.log(`  Balance: ${formattedBalance.toFixed(6)} ${symbol}`);
                console.log(`  USD Value: $${formattedBalance.toFixed(2)}`);
                
                if (formattedBalance > 0) {
                    console.log(`  ✅ FOUND ${formattedBalance.toFixed(2)} ${symbol}!`);
                }
                
            } catch (error) {
                console.log(`\\n${label}: ❌ ERROR - ${error.message}`);
            }
        }
        
        console.log('\\n===========================');
        console.log(`💵 TOTAL USD STABLECOINS: $${totalUSDValue.toFixed(2)}`);
        
        if (totalUSDValue > 10) {
            console.log('\\n✅ SUFFICIENT USD STABLECOINS FOR REAL TRADING!');
            console.log('🚀 We can proceed with real yield strategy');
        } else {
            console.log('\\n⚠️  No significant USD stablecoins found');
            console.log('💡 Check if funds are in a different wallet or contract');
        }
        
        // Also check some other major tokens that might be there
        console.log('\\n🔍 CHECKING OTHER MAJOR TOKENS:');
        console.log('================================');
        
        const otherTokens = {
            'WETH': '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
            'WMATIC': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
            'WBTC': '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
            'LINK': '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39',
            'UNI': '0xb33eaad8d922b1083446dc23f610c2567fb5180f'
        };
        
        for (const [symbol, address] of Object.entries(otherTokens)) {
            try {
                const tokenContract = new ethers.Contract(address, erc20ABI, provider);
                const balance = await tokenContract.balanceOf(wallet.address);
                const decimals = await tokenContract.decimals();
                const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
                
                if (formattedBalance > 0.001) {
                    console.log(`${symbol}: ${formattedBalance.toFixed(6)} (${address})`);
                }
                
            } catch (error) {
                // Silently skip errors for this check
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkUSDCVariants();
