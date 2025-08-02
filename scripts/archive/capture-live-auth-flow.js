const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * LIVE AUTHENTICATION FLOW CAPTURE
 * 
 * This script will monitor all network requests while placing a real limit order
 * on 1inch to capture the authentication headers and API flow
 */
class LiveAuthFlowCapture {
    constructor() {
        this.capturedRequests = [];
        this.authHeaders = new Set();
        this.apiEndpoints = new Set();
        this.orderSubmissionData = null;
    }

    async captureRealFlow() {
        console.log('🎯 CAPTURING LIVE 1INCH AUTHENTICATION FLOW');
        console.log('═══════════════════════════════════════════');
        console.log('📡 Monitoring all network requests...');
        console.log('🔍 Looking for authentication patterns...');
        console.log('');

        const browser = await puppeteer.launch({
            headless: false,
            devtools: true,
            args: [
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-dev-shm-usage',
                '--no-sandbox'
            ]
        });

        const page = await browser.newPage();

        // Enable request interception
        await page.setRequestInterception(true);

        // Monitor all requests
        page.on('request', (request) => {
            const url = request.url();
            const headers = request.headers();
            
            // Capture 1inch related requests
            if (url.includes('1inch') || url.includes('orderbook') || url.includes('proxy-app')) {
                const requestData = {
                    timestamp: Date.now(),
                    url: url,
                    method: request.method(),
                    headers: headers,
                    postData: request.postData(),
                    resourceType: request.resourceType()
                };

                this.capturedRequests.push(requestData);
                
                // Extract auth headers
                if (headers.authorization) {
                    this.authHeaders.add(headers.authorization);
                    console.log(`🔑 Auth header found: ${headers.authorization.substring(0, 50)}...`);
                }

                if (headers['x-session-id']) {
                    console.log(`🆔 Session ID: ${headers['x-session-id']}`);
                }

                // Log important endpoints
                if (url.includes('orderbook') || url.includes('limit') || url.includes('orders')) {
                    this.apiEndpoints.add(url);
                    console.log(`📡 API Endpoint: ${request.method()} ${url}`);
                    
                    if (request.postData()) {
                        console.log(`📝 POST Data: ${request.postData().substring(0, 200)}...`);
                    }
                }
            }

            request.continue();
        });

        // Monitor responses
        page.on('response', async (response) => {
            const url = response.url();
            
            if (url.includes('1inch') || url.includes('orderbook') || url.includes('proxy-app')) {
                const responseData = {
                    timestamp: Date.now(),
                    url: url,
                    status: response.status(),
                    headers: response.headers(),
                    ok: response.ok()
                };

                // Try to get response body for important endpoints
                if (url.includes('orderbook') || url.includes('limit') || url.includes('orders')) {
                    try {
                        const body = await response.text();
                        responseData.body = body;
                        
                        console.log(`📥 Response: ${response.status()} ${url}`);
                        if (body && body.length < 500) {
                            console.log(`📄 Body: ${body}`);
                        }
                        
                        // Check for order submission success
                        if (response.ok() && body.includes('orderHash')) {
                            this.orderSubmissionData = {
                                url: url,
                                response: body,
                                headers: response.headers()
                            };
                            console.log('🎉 ORDER SUBMISSION DETECTED!');
                        }
                    } catch (error) {
                        console.log(`⚠️ Could not read response body: ${error.message}`);
                    }
                }

                this.capturedRequests.push(responseData);
            }
        });

        try {
            console.log('🌐 Navigating to 1inch Polygon limit orders...');
            await page.goto('https://app.1inch.io/advanced/limit?network=137&src=USDC&dst=WMATIC', {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            console.log('');
            console.log('🎯 READY FOR LIMIT ORDER PLACEMENT');
            console.log('═══════════════════════════════════════');
            console.log('👆 Please place a limit order in the browser');
            console.log('📡 All network requests are being monitored');
            console.log('🔍 Authentication headers will be captured');
            console.log('');
            console.log('Steps to follow:');
            console.log('1. Connect your wallet if not already connected');
            console.log('2. Set token amounts (e.g., 0.1 USDC → WMATIC)');
            console.log('3. Click "Place limit order"');
            console.log('4. Sign the transaction');
            console.log('5. Wait for confirmation');
            console.log('');
            console.log('⏰ Monitoring for 5 minutes...');

            // Wait for user interaction
            await page.waitForTimeout(300000); // 5 minutes

        } catch (error) {
            console.error('❌ Navigation error:', error.message);
        }

        // Save all captured data
        const results = {
            timestamp: Date.now(),
            captureSession: {
                duration: '5 minutes',
                totalRequests: this.capturedRequests.length,
                authHeadersFound: Array.from(this.authHeaders),
                apiEndpointsFound: Array.from(this.apiEndpoints),
                orderSubmissionDetected: !!this.orderSubmissionData
            },
            capturedRequests: this.capturedRequests,
            orderSubmissionData: this.orderSubmissionData,
            analysis: {
                authMethods: this.analyzeAuthMethods(),
                apiFlow: this.analyzeApiFlow(),
                recommendations: this.generateRecommendations()
            }
        };

        const resultsFile = path.join(__dirname, '..', 'execution-proofs', `live-auth-capture-${Date.now()}.json`);
        fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

        console.log('');
        console.log('🎉 CAPTURE COMPLETE');
        console.log('═══════════════════');
        console.log(`📄 Results saved: ${resultsFile}`);
        console.log(`📊 Total requests captured: ${this.capturedRequests.length}`);
        console.log(`🔑 Auth headers found: ${this.authHeaders.size}`);
        console.log(`📡 API endpoints discovered: ${this.apiEndpoints.size}`);
        
        if (this.orderSubmissionData) {
            console.log('🎉 ORDER SUBMISSION CAPTURED!');
        }

        await browser.close();
        return results;
    }

    analyzeAuthMethods() {
        const methods = [];
        
        this.capturedRequests.forEach(req => {
            if (req.headers && req.headers.authorization) {
                methods.push({
                    type: 'Bearer Token',
                    value: req.headers.authorization,
                    url: req.url
                });
            }
            
            if (req.headers && req.headers['x-session-id']) {
                methods.push({
                    type: 'Session ID',
                    value: req.headers['x-session-id'],
                    url: req.url
                });
            }
        });

        return methods;
    }

    analyzeApiFlow() {
        const flow = [];
        
        this.capturedRequests
            .filter(req => req.url && (req.url.includes('orderbook') || req.url.includes('limit')))
            .sort((a, b) => a.timestamp - b.timestamp)
            .forEach(req => {
                flow.push({
                    step: flow.length + 1,
                    method: req.method,
                    url: req.url,
                    status: req.status,
                    hasAuth: !!(req.headers && req.headers.authorization)
                });
            });

        return flow;
    }

    generateRecommendations() {
        const recommendations = [];

        if (this.authHeaders.size > 0) {
            recommendations.push('✅ Authentication headers captured - use these for API calls');
        } else {
            recommendations.push('⚠️ No auth headers found - wallet may not be connected or no orders placed');
        }

        if (this.orderSubmissionData) {
            recommendations.push('✅ Order submission flow captured - extract exact API pattern');
        } else {
            recommendations.push('⚠️ No order submission detected - try placing a limit order');
        }

        if (this.apiEndpoints.size > 0) {
            recommendations.push(`✅ ${this.apiEndpoints.size} API endpoints discovered`);
        }

        return recommendations;
    }
}

async function main() {
    try {
        const capture = new LiveAuthFlowCapture();
        const results = await capture.captureRealFlow();
        
        console.log('');
        console.log('🎯 NEXT STEPS:');
        console.log('1. Review the captured authentication headers');
        console.log('2. Extract the exact API flow pattern');
        console.log('3. Implement the captured auth in our scripts');
        console.log('4. Test real order submission with captured tokens');
        
    } catch (error) {
        console.error('❌ Capture failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { LiveAuthFlowCapture };
