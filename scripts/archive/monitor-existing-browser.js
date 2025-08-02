/**
 * MONITOR EXISTING BROWSER TAB
 * 
 * This script will help capture network requests from the existing browser tab
 * where the wallet is already connected. We'll use browser developer tools
 * approach to capture the authentication flow.
 */

console.log('🎯 MONITORING EXISTING BROWSER TAB');
console.log('═══════════════════════════════════');
console.log('');
console.log('Since you have a wallet connected in the browser, let\'s capture');
console.log('the authentication flow by monitoring the existing tab.');
console.log('');
console.log('📋 MANUAL STEPS TO CAPTURE AUTH:');
console.log('');
console.log('1. 🌐 Open Browser Developer Tools:');
console.log('   - Press F12 or Cmd+Option+I');
console.log('   - Go to "Network" tab');
console.log('   - Check "Preserve log"');
console.log('');
console.log('2. 🔄 Clear existing logs:');
console.log('   - Click the clear button in Network tab');
console.log('');
console.log('3. 🎯 Place a limit order:');
console.log('   - Set amount (e.g., 0.1 USDC → WMATIC)');
console.log('   - Click "Place limit order"');
console.log('   - Sign the transaction');
console.log('');
console.log('4. 🔍 Look for these requests in Network tab:');
console.log('   - proxy-app.1inch.io');
console.log('   - api.1inch.dev');
console.log('   - Any requests with "orderbook" or "limit"');
console.log('');
console.log('5. 📋 Copy important headers:');
console.log('   - Right-click on successful requests');
console.log('   - "Copy" → "Copy as cURL"');
console.log('   - Look for Authorization headers');
console.log('   - Look for x-session-id headers');
console.log('');
console.log('6. 📝 Save the captured data:');
console.log('   - Copy the cURL commands');
console.log('   - Note the request/response bodies');
console.log('   - Save any order hashes or transaction IDs');
console.log('');

// Let's also create a helper function to parse captured cURL commands
function parseCurlCommand(curlCommand) {
    console.log('🔧 CURL COMMAND PARSER');
    console.log('═══════════════════════');
    
    const lines = curlCommand.split('\n');
    const result = {
        url: '',
        method: 'GET',
        headers: {},
        data: null
    };
    
    lines.forEach(line => {
        line = line.trim();
        
        if (line.startsWith('curl ')) {
            // Extract URL
            const urlMatch = line.match(/curl '([^']+)'/);
            if (urlMatch) {
                result.url = urlMatch[1];
            }
        }
        
        if (line.includes('-X ')) {
            // Extract method
            const methodMatch = line.match(/-X (\w+)/);
            if (methodMatch) {
                result.method = methodMatch[1];
            }
        }
        
        if (line.includes('-H ')) {
            // Extract headers
            const headerMatch = line.match(/-H '([^:]+): ([^']+)'/);
            if (headerMatch) {
                result.headers[headerMatch[1]] = headerMatch[2];
            }
        }
        
        if (line.includes('--data-raw ')) {
            // Extract POST data
            const dataMatch = line.match(/--data-raw '(.+)'/);
            if (dataMatch) {
                result.data = dataMatch[1];
            }
        }
    });
    
    return result;
}

// Example of what we're looking for
console.log('🎯 EXAMPLE OF WHAT TO LOOK FOR:');
console.log('');
console.log('Expected request patterns:');
console.log('• POST to proxy-app.1inch.io/v2.0/orderbook/v4.0/137/orders');
console.log('• Authorization: Bearer <token>');
console.log('• x-session-id: <session-id>');
console.log('• Request body with order data and signature');
console.log('');
console.log('Expected response:');
console.log('• 200 OK with order hash');
console.log('• Order visible at: https://app.1inch.io/#/137/limit-order/<hash>');
console.log('');

// Function to test captured auth
async function testCapturedAuth(authData) {
    console.log('🧪 TESTING CAPTURED AUTH');
    console.log('═══════════════════════');
    
    const axios = require('axios');
    
    try {
        // Test the captured headers against known endpoints
        const testEndpoints = [
            'https://api.1inch.dev/orderbook/v4.0/137/build',
            'https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/orders'
        ];
        
        for (const endpoint of testEndpoints) {
            console.log(`Testing: ${endpoint}`);
            
            try {
                const response = await axios.get(endpoint, {
                    headers: authData.headers,
                    timeout: 10000
                });
                
                console.log(`✅ ${endpoint}: ${response.status}`);
            } catch (error) {
                console.log(`❌ ${endpoint}: ${error.response?.status || error.message}`);
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

console.log('🚀 READY TO CAPTURE!');
console.log('');
console.log('Once you have captured the cURL commands, you can:');
console.log('1. Paste them into this script');
console.log('2. Use parseCurlCommand() to extract headers');
console.log('3. Use testCapturedAuth() to validate them');
console.log('4. Implement them in our limit order scripts');
console.log('');
console.log('💡 TIP: Look for successful POST requests to orderbook endpoints');
console.log('    These will contain the real authentication tokens we need!');

module.exports = { parseCurlCommand, testCapturedAuth };
