const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * CAPTURE REAL BEARER TOKEN FROM 1INCH FRONTEND
 * Using browser automation to intercept actual API calls
 */
class TokenCapture {
    constructor() {
        this.capturedTokens = new Set();
        this.apiCalls = [];
    }

    async captureRealToken() {
        console.log('🔍 CAPTURING REAL BEARER TOKEN FROM 1INCH FRONTEND');
        console.log('════════════════════════════════════════');
        console.log('🤖 Starting browser automation...');
        console.log('');

        let browser;
        try {
            // Launch browser with network interception
            browser = await puppeteer.launch({
                headless: false, // Keep visible so you can interact
                devtools: true,
                args: [
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--no-sandbox'
                ]
            });

            const page = await browser.newPage();

            // Enable request interception
            await page.setRequestInterception(true);

            // Intercept all network requests
            page.on('request', (request) => {
                const url = request.url();
                const headers = request.headers();
                
                // Look for 1inch API calls
                if (url.includes('1inch.io') || url.includes('1inch.dev')) {
                    console.log(`📡 Intercepted: ${request.method()} ${url}`);
                    
                    // Capture authorization headers
                    if (headers.authorization) {
                        console.log(`🔐 Found auth header: ${headers.authorization}`);
                        this.capturedTokens.add(headers.authorization);
                    }
                    
                    // Log other relevant headers
                    const relevantHeaders = ['x-api-key', 'x-session-id', 'x-1inch-auth', 'cookie'];
                    relevantHeaders.forEach(headerName => {
                        if (headers[headerName]) {
                            console.log(`📋 ${headerName}: ${headers[headerName]}`);
                        }
                    });

                    // Store the API call details
                    this.apiCalls.push({
                        method: request.method(),
                        url: url,
                        headers: headers,
                        timestamp: Date.now()
                    });
                }
                
                request.continue();
            });

            // Intercept responses too
            page.on('response', async (response) => {
                const url = response.url();
                
                if (url.includes('1inch.io') || url.includes('1inch.dev')) {
                    console.log(`📥 Response: ${response.status()} ${url}`);
                    
                    // Try to capture response headers that might contain tokens
                    const responseHeaders = response.headers();
                    if (responseHeaders['set-cookie']) {
                        console.log(`🍪 Set-Cookie: ${responseHeaders['set-cookie']}`);
                    }
                }
            });

            console.log('🌐 Navigating to 1inch app...');
            await page.goto('https://app.1inch.io/#/137/simple/swap', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            console.log('✅ Page loaded. Now please:');
            console.log('1. Connect your wallet if needed');
            console.log('2. Navigate to Limit Orders tab');
            console.log('3. Try to create a limit order');
            console.log('4. Watch the console for captured tokens');
            console.log('');
            console.log('⏳ Waiting 60 seconds for you to interact...');
            console.log('   (Browser will stay open for manual interaction)');

            // Wait for user interaction
            await new Promise(resolve => setTimeout(resolve, 60000));

            // Try to navigate to limit orders programmatically
            console.log('🔄 Attempting to navigate to limit orders...');
            try {
                await page.click('a[href*="limit-order"]', { timeout: 5000 });
                await page.waitForTimeout(3000);
            } catch (e) {
                console.log('⚠️ Could not auto-navigate to limit orders');
            }

            // Wait more for additional API calls
            console.log('⏳ Waiting additional 30 seconds for API calls...');
            await new Promise(resolve => setTimeout(resolve, 30000));

            // Save captured data
            const captureResults = {
                timestamp: Date.now(),
                capturedTokens: Array.from(this.capturedTokens),
                apiCalls: this.apiCalls,
                instructions: {
                    message: 'If no tokens were captured automatically, please:',
                    steps: [
                        '1. Open browser DevTools (F12)',
                        '2. Go to Network tab',
                        '3. Filter by "1inch"',
                        '4. Create a limit order',
                        '5. Look for API calls and copy authorization headers',
                        '6. Look for calls to proxy-app.1inch.io or api.1inch.dev'
                    ]
                }
            };

            const resultsFile = path.join(__dirname, '..', 'execution-proofs', `token-capture-${Date.now()}.json`);
            fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
            fs.writeFileSync(resultsFile, JSON.stringify(captureResults, null, 2));

            console.log('');
            console.log('📊 CAPTURE RESULTS:');
            console.log('════════════════════════════════════════');
            console.log(`🔐 Captured ${this.capturedTokens.size} unique tokens`);
            console.log(`📡 Intercepted ${this.apiCalls.length} API calls`);
            console.log(`📄 Results saved: ${resultsFile}`);
            console.log('');

            if (this.capturedTokens.size > 0) {
                console.log('✅ TOKENS FOUND:');
                Array.from(this.capturedTokens).forEach((token, index) => {
                    console.log(`${index + 1}. ${token}`);
                });
            } else {
                console.log('❌ No tokens captured automatically');
                console.log('💡 Manual steps required:');
                console.log('   1. Check browser DevTools Network tab');
                console.log('   2. Look for 1inch API calls');
                console.log('   3. Copy authorization headers');
            }

            console.log('');
            console.log('🔍 Press Enter to close browser or wait 30 more seconds...');
            
            // Keep browser open a bit longer
            await new Promise(resolve => setTimeout(resolve, 30000));

        } catch (error) {
            console.error('❌ Token capture failed:', error.message);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async manualTokenExtraction() {
        console.log('');
        console.log('🔧 MANUAL TOKEN EXTRACTION GUIDE');
        console.log('════════════════════════════════════════');
        console.log('');
        console.log('If automation failed, follow these steps:');
        console.log('');
        console.log('1. 🌐 Open https://app.1inch.io in your browser');
        console.log('2. 🔧 Open DevTools (F12 or Cmd+Opt+I)');
        console.log('3. 📡 Go to Network tab');
        console.log('4. 🔍 Filter by "1inch" or "proxy-app"');
        console.log('5. 🔗 Connect your wallet');
        console.log('6. 📝 Navigate to Limit Orders');
        console.log('7. ⚡ Try to create a limit order');
        console.log('8. 👀 Look for API calls to:');
        console.log('   - proxy-app.1inch.io');
        console.log('   - api.1inch.dev');
        console.log('   - api.1inch.io');
        console.log('9. 🔐 Click on the API call and copy the "authorization" header');
        console.log('10. 📋 Look for headers like:');
        console.log('    - authorization: Bearer xxx');
        console.log('    - x-api-key: xxx');
        console.log('    - cookie: xxx');
        console.log('');
        console.log('🎯 Once you have the real token, update your .env file:');
        console.log('   ONEINCH_REAL_TOKEN="Bearer your_real_token_here"');
        console.log('');
    }
}

async function main() {
    const capture = new TokenCapture();
    
    // Check if puppeteer is available
    try {
        require('puppeteer');
        await capture.captureRealToken();
    } catch (error) {
        console.log('❌ Puppeteer not available. Install with: npm install puppeteer');
        console.log('');
        await capture.manualTokenExtraction();
    }
}

if (require.main === module) {
    main();
}

module.exports = { TokenCapture };
