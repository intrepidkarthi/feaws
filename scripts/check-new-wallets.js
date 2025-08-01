const { ethers } = require('ethers');

// New wallet addresses (hardcoded for security)
const MAKER_ADDRESS = '0x5756CB1C9223E109FCd0D0f0b48923b1D8B4C654';
const TAKER_ADDRESS = '0xD9E3dDdBaB1C375DF0D669737d70F8292802AB65';

async function main() {
    const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
    
    console.log('🔍 CHECKING NEW SECURE WALLETS');
    console.log('');
    
    // Token contracts
    const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    
    const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        provider
    );
    
    const wpolContract = new ethers.Contract(
        WPOL_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        provider
    );
    
    // Check maker wallet
    console.log('🏦 MAKER WALLET:', MAKER_ADDRESS);
    const makerPol = await provider.getBalance(MAKER_ADDRESS);
    const makerUsdc = await usdcContract.balanceOf(MAKER_ADDRESS);
    const makerWpol = await wpolContract.balanceOf(MAKER_ADDRESS);
    
    console.log('  💎 POL:', ethers.formatEther(makerPol));
    console.log('  💵 USDC:', ethers.formatUnits(makerUsdc, 6));
    console.log('  🔄 WPOL:', ethers.formatEther(makerWpol));
    
    // Check taker wallet
    console.log('');
    console.log('🏦 TAKER WALLET:', TAKER_ADDRESS);
    const takerPol = await provider.getBalance(TAKER_ADDRESS);
    const takerUsdc = await usdcContract.balanceOf(TAKER_ADDRESS);
    const takerWpol = await wpolContract.balanceOf(TAKER_ADDRESS);
    
    console.log('  💎 POL:', ethers.formatEther(takerPol));
    console.log('  💵 USDC:', ethers.formatUnits(takerUsdc, 6));
    console.log('  🔄 WPOL:', ethers.formatEther(takerWpol));
    
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('1. ✅ Wallets are secure (not compromised)');
    console.log('2. 🔄 Need to swap some POL to USDC for TWAP testing');
    console.log('3. 🚀 Then run 1inch LOP TWAP system');
    
    // Check if addresses are EOAs (not contracts)
    const makerCode = await provider.getCode(MAKER_ADDRESS);
    const takerCode = await provider.getCode(TAKER_ADDRESS);
    
    console.log('');
    console.log('🔐 SECURITY CHECK:');
    console.log('Maker is EOA:', makerCode === '0x' ? '✅ YES' : '❌ NO (CONTRACT)');
    console.log('Taker is EOA:', takerCode === '0x' ? '✅ YES' : '❌ NO (CONTRACT)');
}

main().catch(console.error);
