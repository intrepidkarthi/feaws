const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkTreasuryBalance() {
    console.log('🔍 CHECKING TREASURY BALANCE');
    console.log('============================');
    
    try {
        // Initialize provider
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log(`📍 Wallet: ${wallet.address}`);
        
        // Contract addresses
        const contracts = {
            TreasuryManager: '0x2A7786cdf76d39C5aC559081926B1A34b1C96154',
            DynamicYieldOracle: '0x1944074Fd0d428bB115a4AB4819545E7278d8394',
            OneInchLimitOrderManager: '0xea699aFd83949D65810A95A6c752950da72521A9'
        };
        
        // Token addresses
        const tokens = {
            USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            WETH: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
            WMATIC: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
            DAI: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
            stMATIC: '0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4'
        };
        
        // ERC20 ABI
        const erc20ABI = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)'
        ];
        
        console.log('\n💰 WALLET BALANCES (Available for Treasury):');
        console.log('============================================');
        
        let totalWalletValueUSD = 0;
        const prices = {
            USDC: 1.00,
            WETH: 3200.00,
            WMATIC: 0.85,
            DAI: 1.00,
            stMATIC: 0.95
        };
        
        for (const [symbol, address] of Object.entries(tokens)) {
            try {
                const tokenContract = new ethers.Contract(address, erc20ABI, provider);
                
                // Check wallet balance (where the actual funds are)
                const walletBalance = await tokenContract.balanceOf(wallet.address);
                const decimals = await tokenContract.decimals();
                const walletFormatted = parseFloat(ethers.formatUnits(walletBalance, decimals));
                const walletUSD = walletFormatted * prices[symbol];
                
                console.log(`${symbol.padEnd(8)}: ${walletFormatted.toFixed(4).padStart(12)} ($${walletUSD.toFixed(2).padStart(8)})`);
                
                totalWalletValueUSD += walletUSD;
                
                // Also check treasury contract balance
                const treasuryBalance = await tokenContract.balanceOf(contracts.TreasuryManager);
                const treasuryFormatted = parseFloat(ethers.formatUnits(treasuryBalance, decimals));
                const treasuryUSD = treasuryFormatted * prices[symbol];
                
                if (treasuryFormatted > 0.01) {
                    console.log(`         Treasury: ${treasuryFormatted.toFixed(4).padStart(10)} ($${treasuryUSD.toFixed(2).padStart(8)})`);
                }
                
            } catch (error) {
                console.log(`${symbol.padEnd(8)}: ERROR - ${error.message}`);
            }
        }
        
        console.log('============================================');
        console.log(`TOTAL WALLET VALUE: $${totalWalletValueUSD.toFixed(2)}`);
        console.log('\n💡 NOTE: Funds are in wallet, not treasury contract yet');
        
        // Check MATIC balance for gas
        const maticBalance = await provider.getBalance(wallet.address);
        console.log(`\n⛽ Gas Balance: ${ethers.formatEther(maticBalance)} MATIC`);
        
        // Check if we can interact with treasury
        console.log('\n🏦 TREASURY CONTRACT TEST:');
        const treasuryABI = [
            'function getTreasuryBalance(address token) external view returns (uint256)',
            'function owner() external view returns (address)'
        ];
        
        const treasuryContract = new ethers.Contract(
            contracts.TreasuryManager,
            treasuryABI,
            provider
        );
        
        try {
            const owner = await treasuryContract.owner();
            console.log(`Owner: ${owner}`);
            console.log(`Is Owner: ${owner.toLowerCase() === wallet.address.toLowerCase()}`);
            
            const usdcTreasuryBalance = await treasuryContract.getTreasuryBalance(tokens.USDC);
            console.log(`USDC via getTreasuryBalance(): ${ethers.formatUnits(usdcTreasuryBalance, 6)}`);
            
        } catch (error) {
            console.log(`Treasury contract error: ${error.message}`);
        }
        
        if (totalWalletValueUSD > 10) {
            console.log('\n✅ SUFFICIENT FUNDS FOR REAL STRATEGY!');
            console.log('💡 We can run actual yield optimization with these wallet funds');
            console.log('🔄 Next step: Transfer funds to treasury contract or use wallet directly');
        } else {
            console.log('\n⚠️  Low wallet balance - consider funding for meaningful demo');
        }
        
    } catch (error) {
        console.error('❌ Error checking treasury:', error.message);
    }
}

checkTreasuryBalance();
