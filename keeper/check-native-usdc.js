const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkNativeUSDC() {
    console.log('🔍 CHECKING NATIVE USDC BALANCE');
    console.log('===============================');
    
    try {
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log(`📍 Wallet: ${wallet.address}`);
        
        // Native USDC contract address from the Polygonscan link
        const NATIVE_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        
        const erc20ABI = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)',
            'function name() view returns (string)',
            'function transfer(address to, uint256 amount) returns (bool)',
            'function approve(address spender, uint256 amount) returns (bool)'
        ];
        
        const usdcContract = new ethers.Contract(NATIVE_USDC, erc20ABI, provider);
        
        const [balance, decimals, symbol, name] = await Promise.all([
            usdcContract.balanceOf(wallet.address),
            usdcContract.decimals(),
            usdcContract.symbol(),
            usdcContract.name()
        ]);
        
        const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
        
        console.log(`\n💰 NATIVE USDC FOUND!`);
        console.log(`=====================`);
        console.log(`Name: ${name}`);
        console.log(`Symbol: ${symbol}`);
        console.log(`Contract: ${NATIVE_USDC}`);
        console.log(`Balance: ${formattedBalance.toFixed(6)} ${symbol}`);
        console.log(`USD Value: $${formattedBalance.toFixed(2)}`);
        console.log(`Raw Balance: ${balance.toString()}`);
        
        if (formattedBalance > 10) {
            console.log(`\n✅ EXCELLENT! ${formattedBalance.toFixed(2)} USDC available for real trading!`);
            console.log(`🚀 This is perfect for running actual yield strategies`);
            console.log(`💡 We can now execute real 1inch swaps with this USDC`);
            
            // Check gas balance
            const maticBalance = await provider.getBalance(wallet.address);
            console.log(`\n⛽ Gas Balance: ${ethers.formatEther(maticBalance)} MATIC`);
            
            if (parseFloat(ethers.formatEther(maticBalance)) > 1) {
                console.log(`✅ Sufficient gas for transactions`);
            } else {
                console.log(`⚠️  Low gas - consider adding more MATIC`);
            }
            
            console.log(`\n🎯 READY FOR REAL STRATEGY EXECUTION!`);
            console.log(`Next steps:`);
            console.log(`1. Update token addresses to use Native USDC`);
            console.log(`2. Run real yield monitoring strategy`);
            console.log(`3. Execute actual 1inch swaps when profitable`);
            
        } else if (formattedBalance > 0) {
            console.log(`\n⚠️  Small balance: ${formattedBalance.toFixed(6)} USDC`);
            console.log(`💡 Still usable for testing, but consider adding more for meaningful demo`);
        } else {
            console.log(`\n❌ No USDC balance found`);
        }
        
    } catch (error) {
        console.error('❌ Error checking Native USDC:', error.message);
    }
}

checkNativeUSDC();
