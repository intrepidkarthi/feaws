const hre = require("hardhat");

async function main() {
  console.log("🌐 Deploying to Etherlink Testnet...");
  
  // Check if we're on the right network
  if (hre.network.name !== "etherlink") {
    console.error("❌ This script should be run with --network etherlink");
    process.exit(1);
  }
  
  // Import and run the main deployment
  const deployTokens = require("./deploy-tokens.js");
  
  console.log("🎯 ETHGlobal UNITE - Etherlink Deployment");
  console.log("🔗 Explorer: https://explorer.ghostnet.etherlink.com");
  console.log("");
  
  // Run deployment (this will execute the main function from deploy-tokens.js)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
