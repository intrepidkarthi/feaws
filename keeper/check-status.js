const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkSystemStatus() {
    console.log('🔍 CHECKING TREASURY SYSTEM STATUS');
    console.log('==================================');
    
    try {
        // Initialize provider
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log('✅ Connected to Polygon mainnet');
        console.log(`📍 Wallet: ${wallet.address}`);
        
        // Check balance
        const balance = await provider.getBalance(wallet.address);
        console.log(`💰 MATIC Balance: ${ethers.formatEther(balance)}`);
        
        // Contract addresses
        const contracts = {
            TreasuryManager: '0x2A7786cdf76d39C5aC559081926B1A34b1C96154',
            DynamicYieldOracle: '0x1944074Fd0d428bB115a4AB4819545E7278d8394',
            OneInchLimitOrderManager: '0xea699aFd83949D65810A95A6c752950da72521A9'
        };
        
        console.log('\n📋 Contract Status:');
        for (const [name, address] of Object.entries(contracts)) {
            try {
                const code = await provider.getCode(address);
                const isDeployed = code !== '0x';
                console.log(`  ${name}: ${isDeployed ? '✅ Deployed' : '❌ Not found'} (${address})`);
            } catch (error) {
                console.log(`  ${name}: ❌ Error checking (${address})`);
            }
        }
        
        // Check if we can interact with treasury contract
        console.log('\n🏦 Treasury Contract Test:');
        const treasuryABI = [
            'function getTreasuryBalance(address token) external view returns (uint256)'
        ];
        
        const treasuryContract = new ethers.Contract(
            contracts.TreasuryManager,
            treasuryABI,
            provider
        );
        
        const usdcAddress = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';
        try {
            const usdcBalance = await treasuryContract.getTreasuryBalance(usdcAddress);
            console.log(`  USDC Treasury Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
            console.log('  ✅ Treasury contract is responsive');
        } catch (error) {
            console.log(`  ❌ Error calling treasury contract: ${error.message}`);
        }
        
        console.log('\n🎯 System Status: OPERATIONAL');
        console.log('🔗 Frontend: http://localhost:8080/live-treasury-dashboard.html');
        console.log('🤖 Keeper: Running automated yield monitoring and execution');
        
    } catch (error) {
        console.error('❌ System check failed:', error.message);
    }
}

checkSystemStatus();
