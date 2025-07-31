#!/usr/bin/env node

/**
 * Get current USDC/WMATIC price from 1inch API
 */

require('dotenv').config();
const axios = require('axios');

async function getCurrentPrice() {
    try {
        // 1inch API to get USDC -> WMATIC quote
        const response = await axios.get('https://api.1inch.dev/swap/v6.0/137/quote', {
            params: {
                src: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
                dst: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
                amount: '200000' // 0.2 USDC (6 decimals)
            },
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`
            }
        });

        const quote = response.data;
        const usdcAmount = 0.2;
        const wmaticAmount = parseFloat(quote.dstAmount) / 1e18;
        const rate = wmaticAmount / usdcAmount;

        console.log(`💱 Current USDC/WMATIC Rate:`);
        console.log(`   ${usdcAmount} USDC → ${wmaticAmount.toFixed(6)} WMATIC`);
        console.log(`   Rate: 1 USDC = ${rate.toFixed(4)} WMATIC`);
        console.log(`   Rate: 1 WMATIC = ${(1/rate).toFixed(4)} USDC`);
        
        return { usdcAmount, wmaticAmount, rate };
    } catch (error) {
        console.error('Error fetching price:', error.response?.data || error.message);
        
        // Fallback to approximate market rate (as of late 2024)
        // 1 USDC ≈ 2.5 WMATIC (MATIC around $0.40)
        const fallbackRate = 2.5;
        const wmaticAmount = 0.2 * fallbackRate;
        
        console.log(`⚠️  Using fallback rate: 1 USDC = ${fallbackRate} WMATIC`);
        console.log(`   0.2 USDC → ${wmaticAmount} WMATIC`);
        
        return { usdcAmount: 0.2, wmaticAmount, rate: fallbackRate };
    }
}

getCurrentPrice().catch(console.error);
