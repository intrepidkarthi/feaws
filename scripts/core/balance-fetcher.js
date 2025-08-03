const { Wallet, JsonRpcProvider, Contract, formatUnits } = require("ethers");
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: '.env.test', override: true });

// Common Polygon tokens
const tokens = [
    { name: 'MATIC', address: '0x0000000000000000000000000000000000000000', decimals: 18, symbol: 'MATIC' },
    { name: 'Wrapped MATIC', address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', decimals: 18, symbol: 'WMATIC' },
    { name: 'USD Coin', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, symbol: 'USDC' },
    { name: 'Native USD Coin', address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', decimals: 6, symbol: 'USDC.e' },
    { name: 'Tether USD', address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', decimals: 6, symbol: 'USDT' },
    { name: 'Dai Stablecoin', address: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', decimals: 18, symbol: 'DAI' },
    { name: 'Wrapped Ether', address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', decimals: 18, symbol: 'WETH' },
    { name: 'Wrapped Bitcoin', address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6', decimals: 8, symbol: 'WBTC' },
    { name: 'Staked MATIC', address: '0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4', decimals: 18, symbol: 'stMATIC' }
];

async function fetchTokenBalances() {
    console.log('💰 FEAWS Token Balance Fetcher');
    console.log('════════════════════════════════');
    
    try {
        // Initialize provider and wallet
        const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
        const privateKey = process.env.MAKER_PRIVATE_KEY || process.env.PRIVATE_KEY;
        
        if (!privateKey) {
            throw new Error('No private key found in environment variables');
        }
        
        const provider = new JsonRpcProvider(rpcUrl);
        const wallet = new Wallet(privateKey, provider);
        
        console.log(`👤 Wallet Address: ${wallet.address}`);
        console.log('');
        
        // Fetch balances for all tokens
        console.log('📊 Fetching token balances...');
        console.log('');
        
        const balances = [];
        
        for (const token of tokens) {
            try {
                let balance;
                let formattedBalance;
                
                if (token.address === "0x0000000000000000000000000000000000000000") {
                    // Native token (MATIC)
                    balance = await provider.getBalance(wallet.address);
                    formattedBalance = formatUnits(balance, token.decimals);
                } else {
                    // ERC-20 token
                    const contract = new Contract(token.address, [
                        "function balanceOf(address account) external view returns (uint256)",
                        "function decimals() external view returns (uint8)"
                    ], provider);
                    
                    balance = await contract.balanceOf(wallet.address);
                    formattedBalance = formatUnits(balance, token.decimals);
                }
                
                const balanceNum = parseFloat(formattedBalance);
                
                balances.push({
                    symbol: token.symbol,
                    name: token.name,
                    address: token.address,
                    rawBalance: balance.toString(),
                    formattedBalance: formattedBalance,
                    balance: balanceNum
                });
                
                console.log(`${token.symbol}: ${formattedBalance}`);
                
            } catch (error) {
                console.warn(`⚠️  Failed to fetch balance for ${token.symbol}: ${error.message}`);
            }
        }
        
        console.log('');
        console.log('✅ Balance fetching completed successfully!');
        
        // Filter out zero balances
        const nonZeroBalances = balances.filter(token => token.balance > 0);
        
        if (nonZeroBalances.length > 0) {
            console.log('');
            console.log('💼 Non-zero balances:');
            nonZeroBalances.forEach(token => {
                console.log(`- ${token.symbol}: ${token.formattedBalance}`);
            });
        }
        
        return balances;
        
    } catch (error) {
        console.error('❌ Failed to fetch token balances:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    fetchTokenBalances();
}

module.exports = { fetchTokenBalances, tokens };
