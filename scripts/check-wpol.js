const { Wallet, JsonRpcProvider, Contract, formatUnits } = require("ethers");
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: '.env.test', override: true });

async function checkWPOL() {
    console.log('🔍 Checking WPOL Balance (New Polygon Token)');
    console.log('═══════════════════════════════════════════════');
    
    try {
        // Initialize provider
        const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
        const provider = new JsonRpcProvider(rpcUrl);
        
        // Wallet address to check
        const walletAddress = '0x5756CB1C9223E109FCd0D0f0b48923b1D8B4C654';
        
        // WPOL token address (formerly WMATIC)
        const WPOL_ADDRESS = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
        
        console.log(`👤 Wallet Address: ${walletAddress}`);
        console.log(`🪙 WPOL Address: ${WPOL_ADDRESS}`);
        console.log('');
        
        // Create contract instance
        const wpolContract = new Contract(WPOL_ADDRESS, [
            "function balanceOf(address account) external view returns (uint256)",
            "function decimals() external view returns (uint8)",
            "function symbol() external view returns (string)",
            "function name() external view returns (string)"
        ], provider);
        
        // Fetch token details
        const name = await wpolContract.name();
        const symbol = await wpolContract.symbol();
        const decimals = await wpolContract.decimals();
        const balance = await wpolContract.balanceOf(walletAddress);
        
        const formattedBalance = formatUnits(balance, decimals);
        
        console.log(`📝 Token Name: ${name}`);
        console.log(`🔤 Symbol: ${symbol}`);
        console.log(`🔢 Decimals: ${decimals}`);
        console.log(`💰 WPOL Balance: ${formattedBalance}`);
        console.log(` Raw Balance: ${balance.toString()}`);
        console.log('');
        
        // Compare with expected values
        const expectedWMATIC = '5.47860829';
        const expectedWPOL = '1.484204331101400383';
        
        console.log('📊 Comparison:');
        console.log(`   Expected WMATIC: ${expectedWMATIC}`);
        console.log(`   Actual WPOL: ${formattedBalance}`);
        console.log(`   Expected WPOL: ${expectedWPOL}`);
        
        if (formattedBalance === expectedWPOL) {
            console.log('✅ WPOL balance matches expected value!');
        } else {
            console.log('❌ WPOL balance does not match expected value.');
            
            // Calculate difference
            const expected = parseFloat(expectedWPOL);
            const actual = parseFloat(formattedBalance);
            const difference = Math.abs(expected - actual);
            const percentageDiff = (difference / expected) * 100;
            
            console.log(`📊 Difference: ${difference.toFixed(8)} (${percentageDiff.toFixed(2)}%)`);
        }
        
    } catch (error) {
        console.error('❌ Failed to check WPOL balance:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    checkWPOL();
}
