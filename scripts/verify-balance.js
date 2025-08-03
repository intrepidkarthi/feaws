const { Wallet, JsonRpcProvider, Contract, formatUnits } = require("ethers");
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: '.env.test', override: true });

async function verifyBalance() {
    console.log('🔍 Verifying WMATIC Balance on Polygon');
    console.log('══════════════════════════════════════════');
    
    try {
        // Initialize provider
        const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
        const provider = new JsonRpcProvider(rpcUrl);
        
        // Wallet address to check
        const walletAddress = '0x5756CB1C9223E109FCd0D0f0b48923b1D8B4C654';
        
        // WMATIC token address
        const WMATIC_ADDRESS = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
        
        console.log(`👤 Wallet Address: ${walletAddress}`);
        console.log(`🪙 Token Address: ${WMATIC_ADDRESS}`);
        console.log('');
        
        // Create contract instance
        const wmaticContract = new Contract(WMATIC_ADDRESS, [
            "function balanceOf(address account) external view returns (uint256)",
            "function decimals() external view returns (uint8)",
            "function symbol() external view returns (string)"
        ], provider);
        
        // Fetch balance and token info
        const balance = await wmaticContract.balanceOf(walletAddress);
        const decimals = await wmaticContract.decimals();
        const symbol = await wmaticContract.symbol();
        
        const formattedBalance = formatUnits(balance, decimals);
        
        console.log(`💰 ${symbol} Balance: ${formattedBalance}`);
        console.log(` Raw Balance: ${balance.toString()}`);
        console.log(` Decimals: ${decimals}`);
        console.log('');
        
        // Compare with expected value
        const expectedBalance = '5.47860829';
        console.log(`📊 Expected Balance: ${expectedBalance}`);
        console.log(`📊 Actual Balance: ${formattedBalance}`);
        
        if (formattedBalance === expectedBalance) {
            console.log('✅ Balance matches expected value!');
        } else {
            console.log('❌ Balance does not match expected value.');
            
            // Calculate difference
            const expected = parseFloat(expectedBalance);
            const actual = parseFloat(formattedBalance);
            const difference = Math.abs(expected - actual);
            const percentageDiff = (difference / expected) * 100;
            
            console.log(`📊 Difference: ${difference.toFixed(8)} (${percentageDiff.toFixed(2)}%)`);
        }
        
    } catch (error) {
        console.error('❌ Failed to verify balance:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    verifyBalance();
}
