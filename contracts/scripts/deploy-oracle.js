const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("🔮 Deploying Yield Oracle...");
  console.log("📋 Network:", hre.network.name);
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
  console.log("=" .repeat(50));

  // Deploy YieldOracle
  console.log("📦 Deploying YieldOracle...");
  const YieldOracle = await hre.ethers.getContractFactory("YieldOracle");
  const yieldOracle = await YieldOracle.deploy();
  await yieldOracle.waitForDeployment();
  
  const oracleAddress = await yieldOracle.getAddress();
  console.log("✅ YieldOracle deployed to:", oracleAddress);
  
  // Verify deployment
  const owner = await yieldOracle.owner();
  const threshold = await yieldOracle.globalYieldThreshold();
  
  console.log("   👤 Owner:", owner);
  console.log("   🎯 Global Threshold:", threshold.toString(), "basis points (" + (Number(threshold) / 100).toFixed(1) + "%)");

  // Check supported chains
  console.log("\n🌐 Supported Chains:");
  const chainIds = await yieldOracle.getSupportedChainIds();
  for (let i = 0; i < chainIds.length; i++) {
    const chainId = chainIds[i];
    const isSupported = await yieldOracle.supportedChains(chainId);
    const chainName = getChainName(Number(chainId));
    console.log("   ✅", chainName, "(" + chainId.toString() + "):", isSupported ? "Supported" : "Not Supported");
  }

  // Check initial yields
  console.log("\n📊 Initial Demo Yields:");
  const mockStETH = "0x0000000000000000000000000000000000000002";
  
  // Sepolia yield
  const [sepoliaYield, sepoliaUpdated, sepoliaActive] = await yieldOracle.getYield(11155111, mockStETH);
  console.log("   📈 Sepolia stETH:", (Number(sepoliaYield) / 100).toFixed(1) + "%", sepoliaActive ? "(Active)" : "(Inactive)");
  
  // Etherlink yield
  const [etherlinkYield, etherlinkUpdated, etherlinkActive] = await yieldOracle.getYield(128123, mockStETH);
  console.log("   📈 Etherlink stETH:", (Number(etherlinkYield) / 100).toFixed(1) + "%", etherlinkActive ? "(Active)" : "(Inactive)");

  // Test threshold checking
  console.log("\n🎯 Threshold Analysis:");
  const sepoliaAboveThreshold = await yieldOracle.isYieldAboveThreshold(11155111, mockStETH);
  const etherlinkAboveThreshold = await yieldOracle.isYieldAboveThreshold(128123, mockStETH);
  
  console.log("   📊 Sepolia stETH above threshold:", sepoliaAboveThreshold ? "✅ YES" : "❌ NO");
  console.log("   📊 Etherlink stETH above threshold:", etherlinkAboveThreshold ? "✅ YES" : "❌ NO");

  // Find best yield
  const [bestChain, bestYield] = await yieldOracle.getBestYield(mockStETH);
  console.log("   🏆 Best yield:", getChainName(Number(bestChain)), "-", (Number(bestYield) / 100).toFixed(1) + "%");

  // Test oracle functionality
  console.log("\n🧪 Testing Oracle Functionality...");
  
  // Update a yield rate
  const newYield = 420; // 4.2%
  await yieldOracle.setYield(11155111, mockStETH, newYield);
  console.log("✅ Updated Sepolia stETH yield to 4.2%");
  
  // Check if it's now above threshold
  const updatedAboveThreshold = await yieldOracle.isYieldAboveThreshold(11155111, mockStETH);
  console.log("✅ Sepolia now above threshold:", updatedAboveThreshold ? "YES" : "NO");

  // Summary
  console.log("\n" + "=" .repeat(50));
  console.log("🎉 YieldOracle Deployment Summary");
  console.log("=" .repeat(50));
  console.log("🌐 Network:", hre.network.name);
  console.log("🔮 YieldOracle:", oracleAddress);
  console.log("👤 Owner:", owner);
  console.log("🎯 Threshold:", (Number(threshold) / 100).toFixed(1) + "%");
  console.log("🌍 Supported Chains:", chainIds.length);
  console.log("📊 Demo Ready: ✅");
  
  // Save addresses to file
  const addresses = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    yieldOracle: oracleAddress,
    globalThreshold: Number(threshold),
    supportedChains: chainIds.map(id => Number(id)),
    deployedAt: new Date().toISOString()
  };
  
  const fs = require('fs');
  const addressFile = `deployed-oracle-${hre.network.name}.json`;
  fs.writeFileSync(addressFile, JSON.stringify(addresses, null, 2));
  console.log("📄 Addresses saved to:", addressFile);
  
  return addresses;
}

function getChainName(chainId) {
  const chainNames = {
    1: "Ethereum Mainnet",
    11155111: "Sepolia",
    128123: "Etherlink Ghostnet"
  };
  return chainNames[chainId] || `Chain ${chainId}`;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
