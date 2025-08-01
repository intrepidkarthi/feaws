const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

async function main() {
    console.log('🔄 Getting WPOL for Taker Wallet');
    console.log('');
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    console.log('🏦 Taker:', takerWallet.address);
    
    // Check current balances
    const polBalance = await provider.getBalance(takerWallet.address);
    
    console.log('💰 Current POL balance:', ethers.formatEther(polBalance));
    
    if (polBalance === 0n) {
        console.log('❌ Taker wallet has no POL for gas or swapping');
        console.log('💡 Please send some POL to the taker wallet first');
        return;
    }
    
    // WPOL contract address
    const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    
    // WPOL contract (deposit POL to get WPOL)
    const wpolContract = new ethers.Contract(
        WPOL_ADDRESS,
        [
            'function deposit() payable',
            'function balanceOf(address) view returns (uint256)',
            'function withdraw(uint256) external'
        ],
        takerWallet
    );
    
    const currentWpol = await wpolContract.balanceOf(takerWallet.address);
    console.log('💰 Current WPOL balance:', ethers.formatEther(currentWpol));
    
    // Wrap some POL to WPOL (keep some POL for gas)
    const wrapAmount = ethers.parseEther('0.5'); // Wrap 0.5 POL to WPOL
    
    if (polBalance > wrapAmount + ethers.parseEther('0.1')) { // Keep 0.1 POL for gas
        console.log('🔄 Wrapping', ethers.formatEther(wrapAmount), 'POL to WPOL...');
        
        try {
            const depositTx = await wpolContract.deposit({ 
                value: wrapAmount,
                gasLimit: 100000
            });
            
            console.log('⏳ Deposit transaction:', depositTx.hash);
            console.log('🔗 https://polygonscan.com/tx/' + depositTx.hash);
            
            await depositTx.wait();
            
            const newWpolBalance = await wpolContract.balanceOf(takerWallet.address);
            const newPolBalance = await provider.getBalance(takerWallet.address);
            
            console.log('✅ WPOL wrap successful!');
            console.log('💰 New POL balance:', ethers.formatEther(newPolBalance));
            console.log('💰 New WPOL balance:', ethers.formatEther(newWpolBalance));
            
        } catch (error) {
            console.log('❌ Wrap failed:', error.message);
        }
    } else {
        console.log('⚠️  Not enough POL to wrap (need to keep some for gas)');
        console.log('💡 Current balance:', ethers.formatEther(polBalance));
        console.log('💡 Needed:', ethers.formatEther(wrapAmount + ethers.parseEther('0.1')));
    }
    
    console.log('');
    console.log('🎯 Taker wallet is now ready for LOP orders!');
}

main().catch(console.error);
