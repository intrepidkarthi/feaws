const { ethers } = require("hardhat");

async function main() {
  console.log("🌐 Testing REAL Testnet RPC Connection");
  console.log("======================================");

  try {
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("✅ Connected to network:", network.name);
    console.log("🆔 Chain ID:", network.chainId.toString());

    // Get latest block
    const blockNumber = await ethers.provider.getBlockNumber();
    console.log("📦 Latest block:", blockNumber);

    // Get block details
    const block = await ethers.provider.getBlock(blockNumber);
    console.log("⏰ Block timestamp:", new Date(block.timestamp * 1000).toISOString());
    console.log("⛽ Gas limit:", block.gasLimit.toString());

    // Test gas price
    const gasPrice = await ethers.provider.getFeeData();
    console.log("💰 Gas price:", ethers.formatUnits(gasPrice.gasPrice || 0, "gwei"), "gwei");

    // Show block explorer
    const explorerURL = getBlockExplorerURL(network.chainId);
    console.log("🔍 Block explorer:", explorerURL);

    console.log("\n✅ RPC Connection Test PASSED!");
    console.log("🚀 Ready for real testnet deployment!");

  } catch (error) {
    console.log("❌ RPC Connection FAILED:", error.message);
    console.log("💡 Check network configuration in hardhat.config.js");
  }

  // Test 1inch API as well
  console.log("\n🔑 Testing 1inch API Connection...");
  console.log("==================================");

  try {
    const https = require('https');
    const API_KEY = "VCCbAAZbdHwOZSfwbUmT3BvnWyeYonHC";
    
    const response = await makeAPICall("https://api.1inch.dev/swap/v6.0/1/healthcheck", API_KEY);
    const health = JSON.parse(response);
    
    console.log("✅ 1inch API Status:", health.status);
    console.log("🔗 Provider ID:", health.provider);
    console.log("🎯 API integration ready!");

  } catch (error) {
    console.log("❌ 1inch API Error:", error.message);
  }
}

function makeAPICall(url, apiKey) {
  const https = require('https');
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

function getBlockExplorerURL(chainId) {
  const explorers = {
    11155111: 'https://sepolia.etherscan.io',
    128123: 'https://explorer.etherlink.com',
    1: 'https://etherscan.io'
  };
  
  return explorers[chainId] || 'https://etherscan.io';
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
