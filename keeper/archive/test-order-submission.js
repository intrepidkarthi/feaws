const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testOrderSubmissionEndpoints() {
    console.log('🔍 TESTING ORDER SUBMISSION ENDPOINTS');
    console.log('====================================');
    
    const apiKey = process.env.ONEINCH_API_KEY;
    
    // We know events endpoint works, so let's try related endpoints
    const baseUrl = 'https://api.1inch.dev/orderbook/v4.0/137';
    
    const submissionPaths = [
        '/order',
        '/orders', 
        '/create',
        '/submit',
        '/place',
        '/new',
        '/add'
    ];
    
    // Create a test order payload
    const testOrder = {
        orderHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        signature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
        data: {
            salt: Date.now(),
            makerAsset: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
            takerAsset: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
            maker: "0x4D3e9A008CfA2eBa34d5D32F86141678427E7CF4",
            makingAmount: "1000000",
            takingAmount: "4000000000000000000"
        }
    };
    
    for (const path of submissionPaths) {
        const fullUrl = baseUrl + path;
        console.log(`\\n📤 Testing POST ${fullUrl}`);
        
        try {
            const response = await axios.post(fullUrl, testOrder, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            console.log(`✅ SUCCESS: ${response.status}`);
            console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
            
            console.log(`\\n🎉 WORKING SUBMISSION ENDPOINT: ${fullUrl}`);
            return fullUrl;
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ ${error.response.status}: ${error.response.statusText}`);
                
                if (error.response.data) {
                    console.log(`📊 Error data:`, JSON.stringify(error.response.data, null, 2));
                }
                
                // 400 Bad Request might mean endpoint exists but our data is wrong
                if (error.response.status === 400) {
                    console.log(`💡 Endpoint might exist but requires different data format`);
                }
            } else {
                console.log(`❌ Network error: ${error.message}`);
            }
        }
    }
    
    console.log('\\n❌ No working submission endpoint found');
    
    // Let's check what the events endpoint returns to understand the API structure
    console.log('\\n🔍 Analyzing events endpoint for API structure...');
    
    try {
        const eventsResponse = await axios.get(`${baseUrl}/events`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            params: {
                limit: 5
            }
        });
        
        console.log('📊 Recent events structure:');
        console.log(JSON.stringify(eventsResponse.data, null, 2));
        
        // Look for order creation events to understand the format
        const events = eventsResponse.data;
        if (Array.isArray(events)) {
            const createEvents = events.filter(e => e.action === 'create' || e.action === 'order');
            if (createEvents.length > 0) {
                console.log('\\n💡 Found order creation events - API does accept orders!');
                console.log('Example order event:', JSON.stringify(createEvents[0], null, 2));
            }
        }
        
    } catch (error) {
        console.log('❌ Could not analyze events:', error.message);
    }
    
    return null;
}

async function tryDirectContractSubmission() {
    console.log('\\n🔧 TRYING DIRECT CONTRACT SUBMISSION');
    console.log('====================================');
    
    const { ethers } = require('ethers');
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // 1inch Limit Order Protocol v4
    const limitOrderProtocol = '0x111111125421cA6dc452d289314280a0f8842A65';
    
    // Simplified ABI for order creation
    const limitOrderABI = [
        'function fillOrder((uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order, bytes signature, bytes interaction, uint256 makingAmount, uint256 takingAmount) external payable returns (uint256, uint256, bytes32)',
        'function cancelOrder((uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order) external returns (uint256, uint256)',
        'function hashOrder((uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order) external view returns (bytes32)'
    ];
    
    const contract = new ethers.Contract(limitOrderProtocol, limitOrderABI, wallet);
    
    console.log(`📍 Contract: ${limitOrderProtocol}`);
    console.log(`📍 Wallet: ${wallet.address}`);
    
    // Create a test order
    const orderStruct = {
        salt: Date.now(),
        makerAsset: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC
        takerAsset: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
        maker: wallet.address,
        receiver: wallet.address,
        allowedSender: '0x0000000000000000000000000000000000000000',
        makingAmount: ethers.parseUnits('1', 6), // 1 USDC
        takingAmount: ethers.parseUnits('4', 18), // 4 WMATIC
        offsets: 0,
        interactions: '0x'
    };
    
    try {
        // First, get the order hash
        console.log('📋 Getting order hash...');
        const orderHash = await contract.hashOrder(orderStruct);
        console.log(`✅ Order hash: ${orderHash}`);
        
        // Sign the order hash
        console.log('✍️  Signing order...');
        const signature = await wallet.signMessage(ethers.getBytes(orderHash));
        console.log(`✅ Signature: ${signature.substring(0, 20)}...`);
        
        console.log('\\n💡 ORDER IS READY FOR SUBMISSION');
        console.log('This proves we can create valid 1inch limit orders!');
        console.log(`Order Hash: ${orderHash}`);
        console.log(`Signature: ${signature}`);
        
        // Note: We don't actually submit because fillOrder is for takers, not makers
        // Makers just need to create the signed order and share it
        
        return {
            orderHash: orderHash,
            signature: signature,
            orderStruct: orderStruct
        };
        
    } catch (error) {
        console.error(`❌ Contract interaction failed: ${error.message}`);
        return null;
    }
}

async function main() {
    // Test API endpoints
    const workingEndpoint = await testOrderSubmissionEndpoints();
    
    if (workingEndpoint) {
        console.log(`\\n🎉 SOLUTION: Use ${workingEndpoint} for order submission`);
    } else {
        console.log('\\n⚠️  No API submission endpoint found, trying direct contract...');
        
        const contractResult = await tryDirectContractSubmission();
        
        if (contractResult) {
            console.log('\\n🎉 SOLUTION: Create signed orders directly, no API needed!');
            console.log('Orders can be shared off-chain and filled by takers');
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testOrderSubmissionEndpoints, tryDirectContractSubmission };
