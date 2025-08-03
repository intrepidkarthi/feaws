const { Wallet, JsonRpcProvider, Contract, formatUnits } = require("ethers");
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: '.env.test', override: true });

async function detailedTokenCheck() {
    console.log('🔍 Detailed Token Check on Polygon');
    console.log('════════════════════════════════════');
    
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
        const tokenContract = new Contract(WMATIC_ADDRESS, [
            "function balanceOf(address account) external view returns (uint256)",
            "function decimals() external view returns (uint8)",
            "function symbol() external view returns (string)",
            "function name() external view returns (string)",
            "function totalSupply() external view returns (uint256)"
        ], provider);
        
        // Fetch token details
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        const decimals = await tokenContract.decimals();
        const totalSupply = await tokenContract.totalSupply();
        const balance = await tokenContract.balanceOf(walletAddress);
        
        const formattedBalance = formatUnits(balance, decimals);
        const formattedSupply = formatUnits(totalSupply, decimals);
        
        console.log(`📝 Token Name: ${name}`);
        console.log(`🔤 Symbol: ${symbol}`);
        console.log(`🔢 Decimals: ${decimals}`);
        console.log(`📊 Total Supply: ${formattedSupply}`);
        console.log(`💰 Wallet Balance: ${formattedBalance}`);
        console.log(` Raw Balance: ${balance.toString()}`);
        console.log('');
        
        // Check network
        const network = await provider.getNetwork();
        console.log(`🌐 Network: ${network.name} (${network.chainId})`);
        
        // Check block number
        const blockNumber = await provider.getBlockNumber();
        console.log(`📦 Latest Block: ${blockNumber}`);
        
    } catch (error) {
        console.error('❌ Failed to check token details:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    detailedTokenCheck();
}
