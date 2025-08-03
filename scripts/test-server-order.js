#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

/**
 * Test the createLimitOrderSlice endpoint on the server
 */

async function testServerOrderCreation() {
    console.log('🧪 TESTING SERVER LIMIT ORDER CREATION');
    console.log('='.repeat(40));
    
    try {
        // Test creating a limit order slice
        const response = await axios.post('http://localhost:3001/api/create-limit-order', {
            fromToken: process.env.USDC_ADDRESS || '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            toToken: process.env.WMATIC_ADDRESS || '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            amount: '100000' // 0.1 USDC
        });
        
        console.log('✅ Server response:');
        console.log(JSON.stringify(response.data, null, 2));
        
        console.log('\n🎉 SERVER LIMIT ORDER TEST COMPLETED');
        console.log('='.repeat(40));
        
    } catch (error) {
        console.error('❌ Error testing server:', error.message);
        if (error.response) {
            console.error('📝 Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testServerOrderCreation().catch(console.error);
