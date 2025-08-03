#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

/**
 * Test the full TWAP flow with the dashboard server
 */

async function testFullTWAPFlow() {
    console.log('🧪 TESTING FULL TWAP FLOW');
    console.log('='.repeat(30));
    
    try {
        // Test creating a limit order slice
        console.log('\\n📝 Testing limit order creation...');
        const orderResponse = await axios.post('http://localhost:3001/api/create-limit-order', {
            fromToken: process.env.USDC_ADDRESS || '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            toToken: process.env.WMATIC_ADDRESS || '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            amount: '100000' // 0.1 USDC
        });
        
        console.log('✅ Limit order creation response:');
        console.log(JSON.stringify(orderResponse.data, null, 2));
        
        // Test executing a TWAP strategy
        console.log('\\n📝 Testing TWAP execution...');
        const twapResponse = await axios.post('http://localhost:3001/api/execute-twap', {
            fromToken: process.env.USDC_ADDRESS || '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            toToken: process.env.WMATIC_ADDRESS || '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            totalAmount: '200000', // 0.2 USDC
            slices: 2,
            interval: 30, // 30 seconds
            strategy: 'WMATIC->USDC'
        });
        
        console.log('✅ TWAP execution response:');
        console.log(JSON.stringify(twapResponse.data, null, 2));
        
        console.log('\\n🎉 FULL TWAP FLOW TEST COMPLETED');
        console.log('='.repeat(30));
        
    } catch (error) {
        console.error('❌ Error testing full TWAP flow:', error.message);
        if (error.response) {
            console.error('📝 Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testFullTWAPFlow().catch(console.error);
