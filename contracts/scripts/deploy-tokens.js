const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("🚀 Deploying Mock Tokens...");
  console.log("📋 Network:", hre.network.name);
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
  console.log("=" .repeat(50));

  // Deploy MockUSDC
  console.log("📦 Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  
  const usdcAddress = await mockUSDC.getAddress();
  console.log("✅ MockUSDC deployed to:", usdcAddress);
  
  // Verify USDC deployment
  const usdcName = await mockUSDC.name();
  const usdcSymbol = await mockUSDC.symbol();
  const usdcDecimals = await mockUSDC.decimals();
  const usdcSupply = await mockUSDC.totalSupply();
  
  console.log("   📋 Name:", usdcName);
  console.log("   🔤 Symbol:", usdcSymbol);
  console.log("   🔢 Decimals:", usdcDecimals);
  console.log("   💰 Total Supply:", hre.ethers.formatUnits(usdcSupply, 6), "USDC");

  // Deploy MockStETH
  console.log("\n📦 Deploying MockStETH...");
  const MockStETH = await hre.ethers.getContractFactory("MockStETH");
  const mockStETH = await MockStETH.deploy();
  await mockStETH.waitForDeployment();
  
  const stethAddress = await mockStETH.getAddress();
  console.log("✅ MockStETH deployed to:", stethAddress);
  
  // Verify stETH deployment
  const stethName = await mockStETH.name();
  const stethSymbol = await mockStETH.symbol();
  const stethDecimals = await mockStETH.decimals();
  const stethSupply = await mockStETH.totalSupply();
  
  console.log("   📋 Name:", stethName);
  console.log("   🔤 Symbol:", stethSymbol);
  console.log("   🔢 Decimals:", stethDecimals);
  console.log("   💰 Total Supply:", hre.ethers.formatEther(stethSupply), "stETH");

  // Test basic functionality
  console.log("\n🧪 Testing basic functionality...");
  
  // Test USDC minting
  const testUSDCAmount = hre.ethers.parseUnits("1000", 6); // 1000 USDC
  await mockUSDC.mint(deployer.address, testUSDCAmount);
  const deployerUSDCBalance = await mockUSDC.balanceOf(deployer.address);
  console.log("✅ USDC mint test:", hre.ethers.formatUnits(deployerUSDCBalance, 6), "USDC");
  
  // Test stETH yield accrual
  const initialStETHSupply = await mockStETH.totalSupply();
  await mockStETH.accrueYield(380); // 3.8% yield
  const newStETHSupply = await mockStETH.totalSupply();
  const yieldAccrued = newStETHSupply - initialStETHSupply;
  console.log("✅ stETH yield test:", hre.ethers.formatEther(yieldAccrued), "stETH accrued");

  // Summary
  console.log("\n" + "=" .repeat(50));
  console.log("🎉 Deployment Summary");
  console.log("=" .repeat(50));
  console.log("🌐 Network:", hre.network.name);
  console.log("💰 MockUSDC:", usdcAddress);
  console.log("🪙 MockStETH:", stethAddress);
  console.log("👤 Owner:", deployer.address);
  
  // Save addresses to file
  const addresses = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    mockUSDC: usdcAddress,
    mockStETH: stethAddress,
    deployedAt: new Date().toISOString()
  };
  
  const fs = require('fs');
  const addressFile = `deployed-addresses-${hre.network.name}.json`;
  fs.writeFileSync(addressFile, JSON.stringify(addresses, null, 2));
  console.log("📄 Addresses saved to:", addressFile);
  
  return addresses;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
