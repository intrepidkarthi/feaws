#!/usr/bin/env node

/**
 * Check USDC, POL/MATIC, WMATIC balances for both maker and taker wallets
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const makerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);

    console.log('💰 COMPLETE BALANCE OVERVIEW\n');
    console.log('════════════════════════════════════════════════════════════');

    // Token contracts
    const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; // Now WPOL

    const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)'],
        provider
    );

    const wmaticContract = new ethers.Contract(
        WMATIC_ADDRESS,
        ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'],
        provider
    );

    // Get symbols
    const usdcSymbol = await usdcContract.symbol();
    const wmaticSymbol = await wmaticContract.symbol();
    const usdcDecimals = await usdcContract.decimals();

    console.log(`🏦 MAKER WALLET: ${makerWallet.address}`);
    console.log('────────────────────────────────────────────────────────────');
    
    // Maker balances
    const makerNative = await provider.getBalance(makerWallet.address);
    const makerUsdc = await usdcContract.balanceOf(makerWallet.address);
    const makerWmatic = await wmaticContract.balanceOf(makerWallet.address);

    console.log(`💎 Native POL:  ${ethers.formatEther(makerNative)} POL`);
    console.log(`💵 ${usdcSymbol}:        ${ethers.formatUnits(makerUsdc, usdcDecimals)} ${usdcSymbol}`);
    console.log(`🔄 ${wmaticSymbol}:       ${ethers.formatEther(makerWmatic)} ${wmaticSymbol}`);

    console.log('\n🏦 TAKER WALLET: ' + takerWallet.address);
    console.log('────────────────────────────────────────────────────────────');
    
    // Taker balances
    const takerNative = await provider.getBalance(takerWallet.address);
    const takerUsdc = await usdcContract.balanceOf(takerWallet.address);
    const takerWmatic = await wmaticContract.balanceOf(takerWallet.address);

    console.log(`💎 Native POL:  ${ethers.formatEther(takerNative)} POL`);
    console.log(`💵 ${usdcSymbol}:        ${ethers.formatUnits(takerUsdc, usdcDecimals)} ${usdcSymbol}`);
    console.log(`🔄 ${wmaticSymbol}:       ${ethers.formatEther(takerWmatic)} ${wmaticSymbol}`);

    console.log('\n📊 SUMMARY');
    console.log('════════════════════════════════════════════════════════════');
    
    const totalNative = makerNative + takerNative;
    const totalUsdc = makerUsdc + takerUsdc;
    const totalWmatic = makerWmatic + takerWmatic;

    console.log(`💎 Total Native POL:  ${ethers.formatEther(totalNative)} POL`);
    console.log(`💵 Total ${usdcSymbol}:        ${ethers.formatUnits(totalUsdc, usdcDecimals)} ${usdcSymbol}`);
    console.log(`🔄 Total ${wmaticSymbol}:       ${ethers.formatEther(totalWmatic)} ${wmaticSymbol}`);

    console.log('\n🎯 TWAP READINESS CHECK');
    console.log('────────────────────────────────────────────────────────────');
    
    if (makerUsdc >= ethers.parseUnits('2', usdcDecimals)) {
        console.log('✅ Maker has enough USDC for TWAP (≥2 USDC)');
    } else {
        console.log('❌ Maker needs more USDC for TWAP');
    }

    if (makerNative >= ethers.parseEther('0.01')) {
        console.log('✅ Maker has POL for gas');
    } else {
        console.log('❌ Maker needs POL for gas');
    }

    if (takerWmatic >= ethers.parseEther('1')) {
        console.log('✅ Taker has WPOL for fills');
    } else {
        console.log('❌ Taker needs more WPOL for fills');
    }

    if (takerNative >= ethers.parseEther('0.1')) {
        console.log('✅ Taker has POL for gas');
    } else {
        console.log('❌ Taker needs more POL for gas');
    }
}

main().catch(console.error);
