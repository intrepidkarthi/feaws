const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * Deploy Treasury Management System to Polygon Mainnet
 * Real contracts for real 1inch integration
 */

async function main() {
    console.log("\n🚀 DEPLOYING TREASURY MANAGEMENT SYSTEM TO POLYGON MAINNET");
    console.log("=========================================================");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📋 Deployment Details:");
    console.log("  Network:", network.name, `(Chain ID: ${network.chainId})`);
    console.log("  Deployer:", deployer.address);
    
    // Check balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("  Balance:", ethers.formatEther(balance), "MATIC");
    
    if (balance < ethers.parseEther("0.1")) {
        console.log("⚠️  Warning: Low MATIC balance. You may need more for deployment.");
    }
    
    const deployedContracts = {};
    
    // 1. Deploy Mock Tokens (for testing)
    console.log("\n📦 Deploying Mock Tokens...");
    
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    deployedContracts.MockUSDC = await mockUSDC.getAddress();
    console.log("  MockUSDC deployed to:", deployedContracts.MockUSDC);
    
    const MockStETH = await ethers.getContractFactory("MockStETH");
    const mockStETH = await MockStETH.deploy();
    await mockStETH.waitForDeployment();
    deployedContracts.MockStETH = await mockStETH.getAddress();
    console.log("  MockStETH deployed to:", deployedContracts.MockStETH);
    
    // 2. Deploy Yield Oracle
    console.log("\n📊 Deploying Yield Oracle...");
    
    const YieldOracle = await ethers.getContractFactory("YieldOracle");
    const yieldOracle = await YieldOracle.deploy();
    await yieldOracle.waitForDeployment();
    deployedContracts.YieldOracle = await yieldOracle.getAddress();
    console.log("  YieldOracle deployed to:", deployedContracts.YieldOracle);
    
    // 3. Deploy Limit Order Manager (1inch integration)
    console.log("\n🔗 Deploying 1inch Limit Order Manager...");
    
    // Polygon 1inch Limit Order Protocol address
    const POLYGON_1INCH_LIMIT_ORDER = "0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f";
    
    const LimitOrderManager = await ethers.getContractFactory("LimitOrderManager");
    const limitOrderManager = await LimitOrderManager.deploy(POLYGON_1INCH_LIMIT_ORDER);
    await limitOrderManager.waitForDeployment();
    deployedContracts.LimitOrderManager = await limitOrderManager.getAddress();
    console.log("  LimitOrderManager deployed to:", deployedContracts.LimitOrderManager);
    console.log("  Connected to 1inch Protocol:", POLYGON_1INCH_LIMIT_ORDER);
    
    // 4. Deploy TWAP Strategy
    console.log("\n⚡ Deploying Yield-Gated TWAP Strategy...");
    
    const YieldGatedTWAP = await ethers.getContractFactory("YieldGatedTWAP");
    const yieldGatedTWAP = await YieldGatedTWAP.deploy(
        deployedContracts.YieldOracle,
        deployedContracts.LimitOrderManager
    );
    await yieldGatedTWAP.waitForDeployment();
    deployedContracts.YieldGatedTWAP = await yieldGatedTWAP.getAddress();
    console.log("  YieldGatedTWAP deployed to:", deployedContracts.YieldGatedTWAP);
    
    // 5. Initial Configuration
    console.log("\n⚙️  Configuring Contracts...");
    
    // Configure yield oracle with Polygon chain
    await yieldOracle.addChain(137, "Polygon"); // Polygon mainnet
    console.log("  ✅ Added Polygon chain to YieldOracle");
    
    // Add assets
    await yieldOracle.addAsset(deployedContracts.MockUSDC, "USDC", 6);
    await yieldOracle.addAsset(deployedContracts.MockStETH, "stETH", 18);
    console.log("  ✅ Added USDC and stETH to YieldOracle");
    
    // Set initial yields (example values)
    await yieldOracle.setYield(137, deployedContracts.MockUSDC, 380); // 3.8%
    await yieldOracle.setYield(137, deployedContracts.MockStETH, 520); // 5.2%
    console.log("  ✅ Set initial yield rates");
    
    // Mint some test tokens to deployer
    const mintAmount = ethers.parseUnits("100000", 6); // 100k USDC
    await mockUSDC.mint(deployer.address, mintAmount);
    console.log("  ✅ Minted 100,000 USDC to deployer");
    
    const mintAmountStETH = ethers.parseEther("1000"); // 1k stETH
    await mockStETH.mint(deployer.address, mintAmountStETH);
    console.log("  ✅ Minted 1,000 stETH to deployer");
    
    // 6. Save deployment data
    const deploymentData = {
        network: {
            name: network.name,
            chainId: Number(network.chainId),
            deployer: deployer.address,
            deployedAt: new Date().toISOString(),
            gasUsed: "TBD" // Will be calculated post-deployment
        },
        contracts: deployedContracts,
        configuration: {
            polygon1inchProtocol: POLYGON_1INCH_LIMIT_ORDER,
            initialYields: {
                USDC: "3.8%",
                stETH: "5.2%"
            },
            testTokens: {
                usdcMinted: "100,000",
                stethMinted: "1,000"
            }
        }
    };
    
    const filename = `deployed-polygon-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentData, null, 2));
    console.log(`\n💾 Deployment data saved to: ${filename}`);
    
    // 7. Verification instructions
    console.log("\n🔍 CONTRACT VERIFICATION");
    console.log("========================");
    console.log("To verify contracts on PolygonScan, run:");
    console.log(`npx hardhat verify --network polygon ${deployedContracts.MockUSDC}`);
    console.log(`npx hardhat verify --network polygon ${deployedContracts.MockStETH}`);
    console.log(`npx hardhat verify --network polygon ${deployedContracts.YieldOracle}`);
    console.log(`npx hardhat verify --network polygon ${deployedContracts.LimitOrderManager} "${POLYGON_1INCH_LIMIT_ORDER}"`);
    console.log(`npx hardhat verify --network polygon ${deployedContracts.YieldGatedTWAP} "${deployedContracts.YieldOracle}" "${deployedContracts.LimitOrderManager}"`);
    
    // 8. Frontend configuration
    console.log("\n🖥️  FRONTEND CONFIGURATION");
    console.log("==========================");
    console.log("Add these to your frontend .env:");
    console.log(`NEXT_PUBLIC_POLYGON_USDC_ADDRESS=${deployedContracts.MockUSDC}`);
    console.log(`NEXT_PUBLIC_POLYGON_STETH_ADDRESS=${deployedContracts.MockStETH}`);
    console.log(`NEXT_PUBLIC_POLYGON_YIELD_ORACLE=${deployedContracts.YieldOracle}`);
    console.log(`NEXT_PUBLIC_POLYGON_LIMIT_ORDER_MANAGER=${deployedContracts.LimitOrderManager}`);
    console.log(`NEXT_PUBLIC_POLYGON_TWAP_STRATEGY=${deployedContracts.YieldGatedTWAP}`);
    
    console.log("\n🎉 DEPLOYMENT COMPLETE!");
    console.log("=======================");
    console.log("✅ All contracts deployed to Polygon mainnet");
    console.log("✅ 1inch Protocol integration configured");
    console.log("✅ Test tokens minted for testing");
    console.log("✅ Ready for frontend integration");
    console.log("\n🔗 Next steps:");
    console.log("1. Verify contracts on PolygonScan");
    console.log("2. Configure frontend with contract addresses");
    console.log("3. Test 1inch API integration");
    console.log("4. Start treasury management operations!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
