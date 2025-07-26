const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("📋 Deploying 1inch Limit Order Manager...");
  console.log("📋 Network:", hre.network.name);
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
  console.log("=" .repeat(50));

  // Get 1inch protocol addresses for different networks
  const protocolAddresses = {
    1: "0x1111111254EEB25477B68fb85Ed929f73A960582", // Ethereum Mainnet
    11155111: "0x1111111254EEB25477B68fb85Ed929f73A960582", // Sepolia (using mainnet for demo)
    128123: "0x1111111254EEB25477B68fb85Ed929f73A960582", // Etherlink (mock address)
    31337: "0x1111111254EEB25477B68fb85Ed929f73A960582" // Hardhat local
  };
  
  const chainId = hre.network.config.chainId || 31337;
  const protocolAddress = protocolAddresses[chainId];
  
  if (!protocolAddress) {
    throw new Error(`No 1inch protocol address configured for chain ${chainId}`);
  }
  
  console.log("🔗 1inch Protocol Address:", protocolAddress);
  console.log("🌐 Chain ID:", chainId);

  // Deploy LimitOrderManager
  console.log("\n📦 Deploying LimitOrderManager...");
  const LimitOrderManager = await hre.ethers.getContractFactory("LimitOrderManager");
  const limitOrderManager = await LimitOrderManager.deploy(protocolAddress);
  await limitOrderManager.waitForDeployment();
  
  const managerAddress = await limitOrderManager.getAddress();
  console.log("✅ LimitOrderManager deployed to:", managerAddress);
  
  // Verify deployment
  const owner = await limitOrderManager.owner();
  const protocol = await limitOrderManager.LIMIT_ORDER_PROTOCOL();
  
  console.log("   👤 Owner:", owner);
  console.log("   🔗 Protocol:", protocol);

  // Test basic functionality
  console.log("\n🧪 Testing Basic Functionality...");
  
  // Check initial state
  const totalOrders = await limitOrderManager.getTotalOrders();
  const activeOrders = await limitOrderManager.getActiveOrdersCount();
  
  console.log("✅ Initial total orders:", totalOrders.toString());
  console.log("✅ Initial active orders:", activeOrders.toString());

  // Test order data building
  const mockUSDC = "0x0000000000000000000000000000000000000001";
  const mockStETH = "0x0000000000000000000000000000000000000002";
  const makingAmount = hre.ethers.parseUnits("1000", 6); // 1000 USDC
  const takingAmount = hre.ethers.parseEther("0.3"); // 0.3 stETH
  
  console.log("\n📋 Testing Order Data Building...");
  const orderData = await limitOrderManager.buildOrderData(
    mockUSDC,
    mockStETH,
    makingAmount,
    takingAmount,
    deployer.address
  );
  
  console.log("✅ Order data built successfully");
  console.log("   📊 Making Amount:", hre.ethers.formatUnits(makingAmount, 6), "USDC");
  console.log("   📊 Taking Amount:", hre.ethers.formatEther(takingAmount), "stETH");

  // Create a test order
  console.log("\n🔄 Creating Test Order...");
  const signature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234";
  
  const tx = await limitOrderManager.createLimitOrder(orderData, signature);
  const receipt = await tx.wait();
  
  // Get order hash from event
  const orderCreatedEvent = receipt.logs.find(log => 
    log.fragment && log.fragment.name === "OrderCreated"
  );
  
  if (orderCreatedEvent) {
    const orderHash = orderCreatedEvent.args[0];
    console.log("✅ Test order created with hash:", orderHash);
    
    // Get order details
    const order = await limitOrderManager.getOrder(orderHash);
    console.log("   📋 Maker:", order.maker);
    console.log("   💰 Making Asset:", order.makerAsset);
    console.log("   🪙 Taking Asset:", order.takerAsset);
    console.log("   ✅ Is Active:", order.isActive);
    console.log("   📊 Is Filled:", order.isFilled);
  }

  // Check updated statistics
  const newTotalOrders = await limitOrderManager.getTotalOrders();
  const newActiveOrders = await limitOrderManager.getActiveOrdersCount();
  
  console.log("\n📊 Updated Statistics:");
  console.log("✅ Total orders:", newTotalOrders.toString());
  console.log("✅ Active orders:", newActiveOrders.toString());

  // Summary
  console.log("\n" + "=" .repeat(50));
  console.log("🎉 1inch Limit Order Manager Deployment Summary");
  console.log("=" .repeat(50));
  console.log("🌐 Network:", hre.network.name);
  console.log("📋 LimitOrderManager:", managerAddress);
  console.log("🔗 1inch Protocol:", protocol);
  console.log("👤 Owner:", owner);
  console.log("📊 Test Order Created: ✅");
  console.log("🎯 Ready for 1inch Integration: ✅");
  
  // Save addresses to file
  const addresses = {
    network: hre.network.name,
    chainId: chainId,
    deployer: deployer.address,
    limitOrderManager: managerAddress,
    oneInchProtocol: protocol,
    testOrderCreated: true,
    deployedAt: new Date().toISOString()
  };
  
  const fs = require('fs');
  const addressFile = `deployed-limit-orders-${hre.network.name}.json`;
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
