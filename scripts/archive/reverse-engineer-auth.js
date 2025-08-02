const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * REVERSE ENGINEER 1INCH AUTHENTICATION
 * Analyze the frontend to understand how tokens are generated
 */
class AuthReverseEngineer {
    constructor() {
        this.findings = [];
    }

    async analyzeAuth() {
        console.log('🔍 REVERSE ENGINEERING 1INCH AUTHENTICATION');
        console.log('════════════════════════════════════════');
        console.log('');

        try {
            // Step 1: Analyze the main 1inch app JavaScript
            console.log('📜 STEP 1: Analyzing 1inch app JavaScript...');
            
            const mainAppResponse = await axios.get('https://app.1inch.io', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });

            // Extract JavaScript file URLs
            const jsFiles = [];
            const jsRegex = /src="([^"]*\.js[^"]*)"/g;
            let match;
            while ((match = jsRegex.exec(mainAppResponse.data)) !== null) {
                if (match[1].includes('1inch.io') || match[1].startsWith('/')) {
                    const fullUrl = match[1].startsWith('/') ? `https://app.1inch.io${match[1]}` : match[1];
                    jsFiles.push(fullUrl);
                }
            }

            console.log(`✅ Found ${jsFiles.length} JavaScript files`);
            this.findings.push({ step: 'js_files', count: jsFiles.length, files: jsFiles.slice(0, 5) });

            // Step 2: Look for authentication patterns in main JS
            console.log('🔐 STEP 2: Searching for auth patterns...');
            
            const authPatterns = [
                /bearer["\s]*[:=]["\s]*([^"'\s]+)/gi,
                /authorization["\s]*[:=]["\s]*["`']([^"'`]+)/gi,
                /api[_-]?key["\s]*[:=]["\s]*["`']([^"'`]+)/gi,
                /token["\s]*[:=]["\s]*["`']([^"'`]+)/gi,
                /1inch[_-]?auth["\s]*[:=]["\s]*["`']([^"'`]+)/gi,
                /proxy[_-]?app["\s]*[:=]["\s]*["`']([^"'`]+)/gi
            ];

            for (const jsFile of jsFiles.slice(0, 3)) { // Check first 3 JS files
                try {
                    console.log(`   🔍 Analyzing: ${jsFile.split('/').pop()}`);
                    
                    const jsResponse = await axios.get(jsFile, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        },
                        timeout: 10000
                    });

                    const jsContent = jsResponse.data;
                    
                    // Search for auth patterns
                    for (const pattern of authPatterns) {
                        const matches = jsContent.match(pattern);
                        if (matches) {
                            console.log(`      🎯 Found pattern: ${pattern.source}`);
                            console.log(`         Matches: ${matches.slice(0, 3).join(', ')}`);
                            this.findings.push({
                                step: 'auth_patterns',
                                file: jsFile,
                                pattern: pattern.source,
                                matches: matches.slice(0, 5)
                            });
                        }
                    }

                    // Look for API endpoints
                    const apiEndpoints = jsContent.match(/https?:\/\/[^"'\s]+1inch[^"'\s]*/g);
                    if (apiEndpoints) {
                        console.log(`      🌐 Found API endpoints: ${apiEndpoints.slice(0, 3).join(', ')}`);
                        this.findings.push({
                            step: 'api_endpoints',
                            file: jsFile,
                            endpoints: [...new Set(apiEndpoints)].slice(0, 10)
                        });
                    }

                } catch (error) {
                    console.log(`      ❌ Failed to analyze ${jsFile}: ${error.message}`);
                }
            }

            // Step 3: Try to understand the unleash token format
            console.log('');
            console.log('🔧 STEP 3: Analyzing unleash token format...');
            
            const unleashToken = '1inch-v2:production.a9fa089671657f45d864d999f16c11f1d4723aa7f9930379d81591d0';
            const parts = unleashToken.split(':');
            const secondPart = parts[1]?.split('.');
            
            console.log(`📋 Token structure analysis:`);
            console.log(`   App identifier: ${parts[0]}`);
            console.log(`   Environment: ${secondPart?.[0]}`);
            console.log(`   Hash/Key: ${secondPart?.[1]?.slice(0, 20)}...`);
            
            this.findings.push({
                step: 'token_analysis',
                original: unleashToken,
                parts: { app: parts[0], env: secondPart?.[0], hash: secondPart?.[1] }
            });

            // Step 4: Test different token generation approaches
            console.log('');
            console.log('🧪 STEP 4: Testing token generation approaches...');
            
            const testApproaches = [
                {
                    name: 'Static Unleash Token',
                    token: unleashToken
                },
                {
                    name: 'Modified Environment',
                    token: '1inch-v2:development.a9fa089671657f45d864d999f16c11f1d4723aa7f9930379d81591d0'
                },
                {
                    name: 'Current Timestamp Hash',
                    token: `1inch-v2:production.${this.generateHash(Date.now().toString())}`
                },
                {
                    name: 'Session-based Hash',
                    token: `1inch-v2:production.${this.generateHash('272640013')}`
                }
            ];

            for (const approach of testApproaches) {
                try {
                    console.log(`   🧪 Testing: ${approach.name}`);
                    
                    const testResponse = await axios.get('https://proxy-app.1inch.io/v2.0/orderbook/v4.0/137/build', {
                        params: {
                            makerToken: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                            takerToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
                            makingAmount: '50000',
                            takingAmount: '250000000000000000',
                            expiration: Math.floor(Date.now() / 1000) + 3600,
                            makerAddress: '0x5756CB1C9223E109FCd0D0f0b48923b1D8B4C654'
                        },
                        headers: {
                            'authorization': `Bearer ${approach.token}`,
                            'accept': 'application/json',
                            'origin': 'https://app.1inch.io',
                            'referer': 'https://app.1inch.io/',
                            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        },
                        timeout: 8000
                    });

                    console.log(`      ✅ SUCCESS! ${approach.name} works!`);
                    console.log(`      📊 Status: ${testResponse.status}`);
                    
                    this.findings.push({
                        step: 'working_token',
                        approach: approach.name,
                        token: approach.token,
                        success: true,
                        response: testResponse.data
                    });
                    
                    // If we found a working token, we're done!
                    return approach.token;

                } catch (error) {
                    if (error.response) {
                        console.log(`      ❌ ${approach.name}: ${error.response.status}`);
                        if (error.response.status !== 401 && error.response.status !== 400) {
                            console.log(`         📋 Unexpected error:`, error.response.data);
                        }
                    } else {
                        console.log(`      💥 ${approach.name}: ${error.message}`);
                    }
                }
            }

            // Step 5: Try to generate a new session-based token
            console.log('');
            console.log('🎲 STEP 5: Attempting to generate new session token...');
            
            try {
                // Try to get a new session from the unleash endpoint
                const sessionResponse = await axios.get('https://unleash-edge.1inch.io/api/frontend', {
                    params: {
                        sessionId: Date.now(),
                        appName: '1inch-v2',
                        environment: 'production',
                        userId: this.generateUUID()
                    },
                    headers: {
                        'accept': 'application/json',
                        'origin': 'https://app.1inch.io',
                        'referer': 'https://app.1inch.io/',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                });

                console.log('✅ Got new session response');
                console.log('📋 Response:', JSON.stringify(sessionResponse.data, null, 2));
                
                this.findings.push({
                    step: 'new_session',
                    success: true,
                    response: sessionResponse.data
                });

            } catch (error) {
                console.log('❌ Failed to get new session:', error.response?.status || error.message);
            }

        } catch (error) {
            console.error('❌ Analysis failed:', error.message);
        }

        // Save findings
        const findingsFile = path.join(__dirname, '..', 'execution-proofs', `auth-analysis-${Date.now()}.json`);
        fs.mkdirSync(path.dirname(findingsFile), { recursive: true });
        fs.writeFileSync(findingsFile, JSON.stringify(this.findings, null, 2));

        console.log('');
        console.log('📊 ANALYSIS COMPLETE');
        console.log('════════════════════════════════════════');
        console.log(`📄 Findings saved: ${findingsFile}`);
        console.log(`🔍 Found ${this.findings.length} analysis points`);
        console.log('');
        console.log('💡 NEXT STEPS:');
        console.log('1. Check the findings file for discovered patterns');
        console.log('2. Look for working token approaches');
        console.log('3. Analyze JavaScript files for auth logic');
        console.log('4. Consider browser automation for token capture');

        return null;
    }

    generateHash(input) {
        // Simple hash generation (not cryptographically secure)
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0').repeat(8).slice(0, 64);
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

async function main() {
    const analyzer = new AuthReverseEngineer();
    const workingToken = await analyzer.analyzeAuth();
    
    if (workingToken) {
        console.log('');
        console.log('🎉 FOUND WORKING TOKEN!');
        console.log(`🔐 Token: ${workingToken}`);
        console.log('');
        console.log('Add this to your .env file:');
        console.log(`ONEINCH_WORKING_TOKEN="${workingToken}"`);
    }
}

if (require.main === module) {
    main();
}

module.exports = { AuthReverseEngineer };
