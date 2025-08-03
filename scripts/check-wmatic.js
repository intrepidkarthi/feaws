const { Wallet, JsonRpcProvider, Contract, formatUnits } = require("ethers");
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: '.env.test', override: true });

async function checkWMATICBalance() {
    console.log('🔍 Checking WMATIC Balance');
    console.log('═══════════════════════════');
    
    try {
        // Initialize provider
        const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
        const provider = new JsonRpcProvider(rpcUrl);
        
        // WMATIC token address
        const WMATIC_ADDRESS = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
        
        // Create contract instance
        const wmaticContract = new Contract(WMATIC_ADDRESS, [
            "function balanceOf(address account) external view returns (uint256)",
            "function decimals() external view returns (uint8)"
        ], provider);
        
        // Check Maker wallet
        console.log('MAKER WALLET');
        console.log('════════════');
        const makerPrivateKey = process.env.MAKER_PRIVATE_KEY;
        if (!makerPrivateKey) {
            throw new Error('No MAKER_PRIVATE_KEY found in environment variables');
        }
        const makerWallet = new Wallet(makerPrivateKey, provider);
        console.log(`👤 Address: ${makerWallet.address}`);
        
        const makerBalance = await wmaticContract.balanceOf(makerWallet.address);
        const decimals = await wmaticContract.decimals();
        const makerFormattedBalance = formatUnits(makerBalance, decimals);
        console.log(`💰 WMATIC Balance: ${makerFormattedBalance}`);
        console.log('');
        
        // Check Taker wallet
        console.log('TAKER WALLET');
        console.log('════════════');
        const takerPrivateKey = process.env.TAKER_PRIVATE_KEY;
        if (!takerPrivateKey) {
            throw new Error('No TAKER_PRIVATE_KEY found in environment variables');
        }
        const takerWallet = new Wallet(takerPrivateKey, provider);
        console.log(`👤 Address: ${takerWallet.address}`);
        
        const takerBalance = await wmaticContract.balanceOf(takerWallet.address);
        const takerFormattedBalance = formatUnits(takerBalance, decimals);
        console.log(`💰 WMATIC Balance: ${takerFormattedBalance}`);
        console.log('');
        
        console.log(` Raw Maker Balance: ${makerBalance.toString()}`);
        console.log(` Raw Taker Balance: ${takerBalance.toString()}`);
        console.log(` Decimals: ${decimals}`);
        
    } catch (error) {
        console.error('❌ Failed to check WMATIC balance:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    checkWMATICBalance();
}
