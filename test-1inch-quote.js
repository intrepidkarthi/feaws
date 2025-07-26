const https = require('https');

async function testRealQuote() {
  console.log("💱 Testing REAL 1inch Price Quote");
  console.log("==================================");
  
  const API_KEY = "VCCbAAZbdHwOZSfwbUmT3BvnWyeYonHC";
  const BASE_URL = "https://api.1inch.dev";
  
  // Use the CORRECT addresses we got from the API
  const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // Real USDC
  const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"; // Real WETH
  const amount = "1000000000"; // 1000 USDC (6 decimals)
  
  console.log("🪙 From Token (USDC):", USDC);
  console.log("💎 To Token (WETH):", WETH);
  console.log("💰 Amount:", "1000 USDC");
  
  try {
    const quoteURL = `${BASE_URL}/swap/v6.0/1/quote?src=${USDC}&dst=${WETH}&amount=${amount}`;
    console.log("\n🔗 Making API call...");
    
    const quoteResponse = await makeAPICall(quoteURL, API_KEY);
    const quote = JSON.parse(quoteResponse);
    
    console.log("\n🎉 SUCCESS: Got REAL price quote!");
    console.log("================================");
    console.log("💰 Input:", "1000 USDC");
    console.log("💎 Output:", (parseInt(quote.toAmount) / 1e18).toFixed(6), "WETH");
    console.log("📊 Gas Estimate:", quote.estimatedGas);
    console.log("🔗 Protocols:", quote.protocols?.length || 0, "DEX protocols used");
    
    // Calculate price
    const usdcAmount = 1000;
    const wethAmount = parseInt(quote.toAmount) / 1e18;
    const pricePerETH = usdcAmount / wethAmount;
    
    console.log("💲 ETH Price:", "$" + pricePerETH.toFixed(2), "USD");
    console.log("⚡ This is LIVE market data from 1inch!");
    
    console.log("\n🔥 PROOF OF REAL INTEGRATION:");
    console.log("==============================");
    console.log("✅ Connected to real 1inch API");
    console.log("✅ Retrieved live market prices");
    console.log("✅ Got real DEX routing data");
    console.log("✅ Your API key works perfectly!");
    
  } catch (error) {
    console.log("❌ Error:", error.message);
    
    if (error.message.includes("401")) {
      console.log("🔑 API key issue - check authorization");
    } else if (error.message.includes("400")) {
      console.log("📝 Request format issue - but API key is valid!");
    } else {
      console.log("🌐 Network or rate limit issue");
    }
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

testRealQuote();
