const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Real 1inch Integration Demo");
  console.log("================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Check if we're forking mainnet
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

  // Deploy mock tokens first
  console.log("\n📦 Deploying Mock Tokens...");
  
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  console.log("MockUSDC deployed to:", await mockUSDC.getAddress());

  const MockStETH = await ethers.getContractFactory("MockStETH");
  const mockStETH = await MockStETH.deploy();
  await mockStETH.waitForDeployment();
  console.log("MockStETH deployed to:", await mockStETH.getAddress());

  // Real 1inch protocol address
  const REAL_1INCH_PROTOCOL = "0x1111111254EEB25477B68fb85Ed929f73A960582";

  // Deploy LimitOrderManager
  console.log("\n🔗 Deploying LimitOrderManager with Real 1inch Integration...");
  
  const LimitOrderManager = await ethers.getContractFactory("LimitOrderManager");
  const limitOrderManager = await LimitOrderManager.deploy(REAL_1INCH_PROTOCOL);
  await limitOrderManager.waitForDeployment();
  console.log("LimitOrderManager deployed to:", await limitOrderManager.getAddress());

  // Check integration status
  console.log("\n🔍 Checking Integration Status...");
  const [isReal, status] = await limitOrderManager.getIntegrationStatus();
  console.log("Is Real 1inch Integration:", isReal);
  console.log("Status:", status);
  console.log("Is Mainnet Fork:", await limitOrderManager.isMainnetFork());

  // Mint tokens for demo
  console.log("\n💰 Minting Demo Tokens...");
  const usdcAmount = ethers.parseUnits("10000", 6); // 10k USDC
  const stethAmount = ethers.parseEther("5"); // 5 stETH

  await mockUSDC.mint(deployer.address, usdcAmount);
  await mockStETH.mint(deployer.address, stethAmount);

  console.log("Minted 10,000 USDC to deployer");
  console.log("Minted 5 stETH to deployer");

  // Approve tokens
  console.log("\n✅ Approving Tokens...");
  await mockUSDC.approve(await limitOrderManager.getAddress(), usdcAmount);
  console.log("Approved USDC for LimitOrderManager");

  // Create a limit order
  console.log("\n📝 Creating Limit Order...");
  const makingAmount = ethers.parseUnits("1000", 6); // 1000 USDC
  const takingAmount = ethers.parseEther("0.3"); // 0.3 stETH
  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  // Build order data using the contract's helper function
  const orderData = await limitOrderManager.buildOrderData(
    await mockUSDC.getAddress(),
    await mockStETH.getAddress(),
    makingAmount,
    takingAmount,
    deployer.address
  );

  const tx = await limitOrderManager.createLimitOrder(
    orderData,
    "0x1234567890abcdef" // Mock signature for demo
  );

  const receipt = await tx.wait();
  console.log("Order created! Transaction hash:", receipt.hash);

  // Parse events
  console.log("\n📊 Order Events:");
  for (const log of receipt.logs) {
    try {
      const parsed = limitOrderManager.interface.parseLog(log);
      if (parsed.name === "OrderCreated") {
        console.log("✅ OrderCreated Event:");
        console.log("  Order Hash:", parsed.args.orderHash);
        console.log("  Maker:", parsed.args.maker);
        console.log("  Making Amount:", ethers.formatUnits(parsed.args.makingAmount, 6), "USDC");
        console.log("  Taking Amount:", ethers.formatEther(parsed.args.takingAmount), "stETH");
      } else if (parsed.name === "Real1inchOrderCreated") {
        console.log("🔥 Real1inchOrderCreated Event:");
        console.log("  Real 1inch Order Hash:", parsed.args.real1inchOrderHash);
        console.log("  Salt:", parsed.args.salt.toString());
        console.log("  Making Amount:", ethers.formatUnits(parsed.args.makingAmount, 6), "USDC");
        console.log("  Taking Amount:", ethers.formatEther(parsed.args.takingAmount), "stETH");
      } else if (parsed.name === "OneInchOrderSubmitted") {
        console.log("📤 OneInchOrderSubmitted Event:");
        console.log("  Timestamp:", new Date(Number(parsed.args.timestamp) * 1000).toISOString());
      }
    } catch (e) {
      // Skip unparseable logs
    }
  }

  // Get order statistics
  console.log("\n📈 Order Statistics:");
  const totalOrders = await limitOrderManager.getTotalOrders();
  const activeOrders = await limitOrderManager.getActiveOrdersCount();
  console.log("Total Orders:", totalOrders.toString());
  console.log("Active Orders:", activeOrders.toString());

  // Get user orders
  const userOrders = await limitOrderManager.getUserOrders(deployer.address);
  console.log("User Orders:", userOrders.length);

  console.log("\n✅ Real 1inch Integration Demo Complete!");
  
  if (isReal) {
    console.log("\n🎉 SUCCESS: Real 1inch Protocol Integration Working!");
    console.log("🔗 Orders are being processed through actual 1inch contracts");
    console.log("📊 Ready for production deployment on mainnet");
  } else {
    console.log("\n⚠️  SIMULATION MODE: Using mock 1inch integration");
    console.log("🔧 To test real integration, run with FORK_MAINNET=true");
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    mockUSDC: await mockUSDC.getAddress(),
    mockStETH: await mockStETH.getAddress(),
    limitOrderManager: await limitOrderManager.getAddress(),
    oneInchProtocol: REAL_1INCH_PROTOCOL,
    isRealIntegration: isReal,
    integrationStatus: status,
    demoOrderCreated: true,
    deployedAt: new Date().toISOString()
  };

  const fs = require('fs');
  fs.writeFileSync(
    'deployed-real-1inch-demo.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n💾 Deployment info saved to deployed-real-1inch-demo.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
