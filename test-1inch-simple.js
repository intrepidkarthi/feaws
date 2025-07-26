const https = require('https');

async function testSimple() {
  console.log("🔍 Raw 1inch API Response Test");
  console.log("===============================");
  
  const API_KEY = "VCCbAAZbdHwOZSfwbUmT3BvnWyeYonHC";
  
  // Test healthcheck endpoint
  console.log("🏥 Testing API Health...");
  try {
    const healthURL = "https://api.1inch.dev/swap/v6.0/1/healthcheck";
    const healthResponse = await makeAPICall(healthURL, API_KEY);
    console.log("✅ Health Response:", healthResponse);
  } catch (error) {
    console.log("❌ Health Error:", error.message);
  }
  
  // Test simple quote
  console.log("\n💱 Testing Simple Quote...");
  const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  const amount = "1000000"; // 1 USDC
  
  try {
    const quoteURL = `https://api.1inch.dev/swap/v6.0/1/quote?src=${USDC}&dst=${WETH}&amount=${amount}`;
    console.log("🔗 URL:", quoteURL);
    
    const response = await makeAPICall(quoteURL, API_KEY);
    console.log("✅ Raw Response:");
    console.log(response);
    
    const data = JSON.parse(response);
    console.log("\n📊 Parsed Data:");
    console.log("Keys:", Object.keys(data));
    
  } catch (error) {
    console.log("❌ Quote Error:", error.message);
  }
}

function makeAPICall(url, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

testSimple();
