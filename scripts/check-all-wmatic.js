const { Wallet, JsonRpcProvider, Contract, formatUnits } = require("ethers");
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: '.env.test', override: true });

// Possible WMATIC addresses
const WMATIC_ADDRESSES = [
    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // Original address (now WPOL)
    '0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4', // stMATIC address (sometimes confused)
    // Add other potential addresses here if needed
];

async function checkAllWMATIC() {
    console.log('🔍 Checking All Possible WMATIC Addresses');
    console.log('════════════════════════════════════════════');
    
    try {
        // Initialize provider
        const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
        const provider = new JsonRpcProvider(rpcUrl);
        
        // Wallet address to check
        const walletAddress = '0x5756CB1C9223E109FCd0D0f0b48923b1D8B4C654';
        
        console.log(`👤 Wallet Address: ${walletAddress}`);
        console.log('');
        
        for (const tokenAddress of WMATIC_ADDRESSES) {
            try {
                // Create contract instance
                const tokenContract = new Contract(tokenAddress, [
                    "function balanceOf(address account) external view returns (uint256)",
                    "function decimals() external view returns (uint8)",
                    "function symbol() external view returns (string)",
                    "function name() external view returns (string)"
                ], provider);
                
                // Fetch token details
                const name = await tokenContract.name();
                const symbol = await tokenContract.symbol();
                const decimals = await tokenContract.decimals();
                const balance = await tokenContract.balanceOf(walletAddress);
                
                const formattedBalance = formatUnits(balance, decimals);
                
                console.log(`🪙 Token Address: ${tokenAddress}`);
                console.log(`📝 Name: ${name}`);
                console.log(`🔤 Symbol: ${symbol}`);
                console.log(`💰 Balance: ${formattedBalance}`);
                console.log('');
                
            } catch (error) {
                console.log(`🪙 Token Address: ${tokenAddress}`);
                console.log(`❌ Error: ${error.message}`);
                console.log('');
            }
        }
        
    } catch (error) {
        console.error('❌ Failed to check tokens:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    checkAllWMATIC();
}
