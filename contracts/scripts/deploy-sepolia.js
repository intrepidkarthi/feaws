const hre = require("hardhat");

async function main() {
  console.log("🌐 Deploying to Sepolia Testnet...");
  
  // Check if we're on the right network
  if (hre.network.name !== "sepolia") {
    console.error("❌ This script should be run with --network sepolia");
    process.exit(1);
  }
  
  // Import and run the main deployment
  const deployTokens = require("./deploy-tokens.js");
  
  console.log("🎯 ETHGlobal UNITE - Sepolia Deployment");
  console.log("🔗 Explorer: https://sepolia.etherscan.io");
  console.log("");
  
  // Run deployment (this will execute the main function from deploy-tokens.js)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
