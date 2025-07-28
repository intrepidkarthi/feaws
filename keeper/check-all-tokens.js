const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkAllTokens() {
    console.log('🔍 CHECKING ALL TOKENS ON WALLET');
    console.log('=================================');
    
    try {
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log(`📍 Wallet: ${wallet.address}`);
        console.log(`🔗 Polygonscan: https://polygonscan.com/address/${wallet.address}#tokentxns`);
        
        // Check MATIC balance
        const maticBalance = await provider.getBalance(wallet.address);
        console.log(`\n⛽ MATIC Balance: ${ethers.formatEther(maticBalance)}`);
        
        // Use Polygonscan API to get token balances
        console.log('\n📊 Fetching token balances from Polygonscan API...');
        
        try {
            const polygonscanResponse = await axios.get('https://api.polygonscan.com/api', {
                params: {
                    module: 'account',
                    action: 'tokentx',
                    address: wallet.address,
                    page: 1,
                    offset: 100,
                    sort: 'desc',
                    apikey: process.env.POLYGONSCAN_API_KEY || 'YourApiKeyToken'
                }
            });
            
            if (polygonscanResponse.data.status === '1') {
                const transactions = polygonscanResponse.data.result;
                const uniqueTokens = new Set();
                
                // Extract unique token addresses from recent transactions
                transactions.forEach(tx => {
                    if (tx.to.toLowerCase() === wallet.address.toLowerCase() || 
                        tx.from.toLowerCase() === wallet.address.toLowerCase()) {
                        uniqueTokens.add(tx.contractAddress);
                    }
                });
                
                console.log(`\n💰 Found ${uniqueTokens.size} tokens in recent transactions:`);
                
                const erc20ABI = [
                    'function balanceOf(address owner) view returns (uint256)',
                    'function decimals() view returns (uint8)',
                    'function symbol() view returns (string)',
                    'function name() view returns (string)'
                ];
                
                let totalValueUSD = 0;
                const tokenPrices = {
                    'USDC': 1.00,
                    'USDT': 1.00,
                    'WETH': 3200.00,
                    'WMATIC': 0.85,
                    'DAI': 1.00,
                    'stMATIC': 0.95,
                    'WBTC': 65000.00
                };
                
                for (const tokenAddress of uniqueTokens) {
                    try {
                        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
                        
                        const [balance, decimals, symbol, name] = await Promise.all([
                            tokenContract.balanceOf(wallet.address),
                            tokenContract.decimals(),
                            tokenContract.symbol(),
                            tokenContract.name()
                        ]);
                        
                        const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
                        
                        if (formattedBalance > 0.001) { // Only show meaningful balances
                            const price = tokenPrices[symbol] || 0;
                            const usdValue = formattedBalance * price;
                            totalValueUSD += usdValue;
                            
                            console.log(`${symbol.padEnd(10)}: ${formattedBalance.toFixed(6).padStart(15)} ($${usdValue.toFixed(2).padStart(10)})`);
                            console.log(`             ${name} (${tokenAddress})`);
                        }
                        
                    } catch (error) {
                        console.log(`Token ${tokenAddress}: Error - ${error.message.substring(0, 50)}...`);
                    }
                }
                
                console.log(`\n💵 TOTAL ESTIMATED VALUE: $${totalValueUSD.toFixed(2)}`);
                
            } else {
                console.log('❌ Failed to fetch from Polygonscan API, checking common tokens manually...');
                await checkCommonTokensManually(wallet, provider);
            }
            
        } catch (error) {
            console.log('❌ Polygonscan API error, checking common tokens manually...');
            await checkCommonTokensManually(wallet, provider);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function checkCommonTokensManually(wallet, provider) {
    const commonTokens = {
        'USDC': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        'USDT': '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        'WETH': '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
        'WMATIC': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
        'DAI': '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
        'stMATIC': '0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4',
        'WBTC': '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6'
    };
    
    const erc20ABI = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
    ];
    
    console.log('\n💰 COMMON TOKEN BALANCES:');
    console.log('=========================');
    
    const tokenPrices = {
        'USDC': 1.00,
        'USDT': 1.00,
        'WETH': 3200.00,
        'WMATIC': 0.85,
        'DAI': 1.00,
        'stMATIC': 0.95,
        'WBTC': 65000.00
    };
    
    let totalValue = 0;
    
    for (const [symbol, address] of Object.entries(commonTokens)) {
        try {
            const tokenContract = new ethers.Contract(address, erc20ABI, provider);
            const balance = await tokenContract.balanceOf(wallet.address);
            const decimals = await tokenContract.decimals();
            const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
            
            const price = tokenPrices[symbol] || 0;
            const usdValue = formattedBalance * price;
            totalValue += usdValue;
            
            console.log(`${symbol.padEnd(8)}: ${formattedBalance.toFixed(6).padStart(15)} ($${usdValue.toFixed(2).padStart(10)})`);
            
            if (formattedBalance > 0.001) {
                console.log(`           Address: ${address}`);
            }
            
        } catch (error) {
            console.log(`${symbol.padEnd(8)}: ERROR - ${error.message.substring(0, 30)}...`);
        }
    }
    
    console.log(`\n💵 TOTAL VALUE: $${totalValue.toFixed(2)}`);
}

checkAllTokens();
