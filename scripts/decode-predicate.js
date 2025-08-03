#!/usr/bin/env node

/**
 * Decode predicate timestamp from orders file
 */

const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

function main() {
    // Load orders
    const ordersPath = path.join(__dirname, '../data/orders.json');
    const ordersData = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    
    if (ordersData.orders.length === 0) {
        console.log("No orders found");
        return;
    }
    
    // Use the first order
    const order = ordersData.orders[0];
    const predicate = order.order.predicate;
    
    console.log(`Order slice: ${order.sliceIndex}`);
    console.log(`Available at: ${order.availableAtISO}`);
    
    // Extract the timestamp from the predicate
    const timestampHex = "0x" + predicate.slice(-8);
    const timestamp = parseInt(timestampHex);
    
    console.log(`Predicate timestamp: ${timestamp}`);
    console.log(`Date: ${new Date(timestamp * 1000).toISOString()}`);
    
    // Current time
    const now = Math.floor(Date.now() / 1000);
    console.log(`Current timestamp: ${now}`);
    console.log(`Current date: ${new Date(now * 1000).toISOString()}`);
    
    // Check if order is still valid
    if (now >= timestamp) {
        console.log("❌ Order has expired");
    } else {
        console.log("✅ Order is still valid");
    }
}

main();
