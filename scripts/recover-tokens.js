const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    
    // Wallets
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    console.log('🚨 TOKEN RECOVERY SCRIPT');
    console.log('From Maker:', makerWallet.address);
    console.log('To Taker:', takerWallet.address);
    console.log('');
    
    // Token contracts
    const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    
    const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        [
            'function balanceOf(address) view returns (uint256)',
            'function transfer(address to, uint256 amount) returns (bool)',
            'function decimals() view returns (uint8)'
        ],
        makerWallet
    );
    
    const wpolContract = new ethers.Contract(
        WPOL_ADDRESS,
        [
            'function balanceOf(address) view returns (uint256)',
            'function transfer(address to, uint256 amount) returns (bool)',
            'function decimals() view returns (uint8)'
        ],
        makerWallet
    );
    
    // Check balances
    const usdcBalance = await usdcContract.balanceOf(makerWallet.address);
    const wpolBalance = await wpolContract.balanceOf(makerWallet.address);
    const polBalance = await provider.getBalance(makerWallet.address);
    
    console.log('📊 CURRENT BALANCES:');
    console.log('💵 USDC:', ethers.formatUnits(usdcBalance, 6));
    console.log('🔄 WPOL:', ethers.formatEther(wpolBalance));
    console.log('💎 POL:', ethers.formatEther(polBalance));
    console.log('');
    
    const transactions = [];
    
    // STEP 1: Send POL for gas if maker has no POL
    if (polBalance < ethers.parseEther('0.01')) {
        console.log('💸 STEP 1: Sending POL for gas from taker to maker...');
        try {
            const gasTx = await takerWallet.sendTransaction({
                to: makerWallet.address,
                value: ethers.parseEther('0.05'), // Send 0.05 POL for gas
                gasLimit: 21000
            });
            await gasTx.wait();
            console.log('✅ Gas POL sent:', gasTx.hash);
            transactions.push(gasTx.hash);
            
            // Wait a moment for balance to update
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.log('❌ Gas transfer failed:', error.message);
            return;
        }
    }
    
    console.log('🔄 STEP 2: Transferring tokens from maker to taker...');
    
    // Transfer USDC if any
    if (usdcBalance > 0n) {
        console.log('💵 Transferring USDC...');
        try {
            const tx = await usdcContract.transfer(takerWallet.address, usdcBalance);
            await tx.wait();
            console.log('✅ USDC transferred:', tx.hash);
            transactions.push(tx.hash);
        } catch (error) {
            console.log('❌ USDC transfer failed:', error.message);
        }
    }
    
    // Transfer WPOL if any
    if (wpolBalance > 0n) {
        console.log('🔄 Transferring WPOL...');
        try {
            const tx = await wpolContract.transfer(takerWallet.address, wpolBalance);
            await tx.wait();
            console.log('✅ WPOL transferred:', tx.hash);
            transactions.push(tx.hash);
        } catch (error) {
            console.log('❌ WPOL transfer failed:', error.message);
        }
    }
    
    // Transfer POL if any (leave small amount for gas)
    if (polBalance > ethers.parseEther('0.01')) {
        const transferAmount = polBalance - ethers.parseEther('0.01');
        console.log('💎 Transferring POL...');
        try {
            const tx = await makerWallet.sendTransaction({
                to: takerWallet.address,
                value: transferAmount,
                gasLimit: 21000
            });
            await tx.wait();
            console.log('✅ POL transferred:', tx.hash);
            transactions.push(tx.hash);
        } catch (error) {
            console.log('❌ POL transfer failed:', error.message);
        }
    }
    
    console.log('');
    console.log('🎯 RECOVERY COMPLETE');
    console.log('Transactions:', transactions.length);
    transactions.forEach(hash => {
        console.log('🔗 https://polygonscan.com/tx/' + hash);
    });
    
    // Check final balances
    console.log('');
    console.log('📊 FINAL TAKER BALANCES:');
    const finalUsdcBalance = await usdcContract.connect(provider).balanceOf(takerWallet.address);
    const finalWpolBalance = await wpolContract.connect(provider).balanceOf(takerWallet.address);
    const finalPolBalance = await provider.getBalance(takerWallet.address);
    
    console.log('💵 USDC:', ethers.formatUnits(finalUsdcBalance, 6));
    console.log('🔄 WPOL:', ethers.formatEther(finalWpolBalance));
    console.log('💎 POL:', ethers.formatEther(finalPolBalance));
}

main().catch(console.error);
