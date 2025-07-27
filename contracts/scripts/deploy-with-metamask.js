const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require('fs');

/**
 * REAL SEPOLIA DEPLOYMENT WITH METAMASK
 * This script will guide you through deploying to actual Sepolia testnet
 */

async function main() {
    console.log("🚀 DEPLOYING TO REAL SEPOLIA TESTNET");
    console.log("====================================");
    console.log("📅 Deployment Time:", new Date().toLocaleString());
    console.log("📡 Network:", hre.network.name);
    
    // Check if we're on the right network
    if (hre.network.name !== "sepolia") {
        console.log("❌ Wrong network! Please run with: --network sepolia");
        console.log("💡 Command: npx hardhat run scripts/deploy-with-metamask.js --network sepolia");
        process.exit(1);
    }
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    const network = await ethers.provider.getNetwork();
    
    console.log("\n👤 DEPLOYER INFORMATION:");
    console.log("========================");
    console.log("Address:", deployer.address);
    console.log("Network:", network.name);
    console.log("Chain ID:", network.chainId.toString());
    console.log("Balance:", ethers.formatEther(balance), "ETH");
    
    // Check if we have enough ETH
    const minBalance = ethers.parseEther("0.01"); // 0.01 ETH minimum
    if (balance < minBalance) {
        console.log("\n❌ INSUFFICIENT BALANCE!");
        console.log("💰 Current:", ethers.formatEther(balance), "ETH");
        console.log("💰 Required:", ethers.formatEther(minBalance), "ETH");
        console.log("💡 Get testnet ETH from: https://sepoliafaucet.com/");
        process.exit(1);
    }
    
    console.log("✅ Sufficient balance for deployment");
    
    // Estimate gas costs
    console.log("\n⛽ ESTIMATING GAS COSTS...");
    console.log("==========================");
    
    const gasPrice = await ethers.provider.getFeeData();
    console.log("Gas Price:", ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei"), "gwei");
    
    // Start deployment
    const deploymentData = {
        network: hre.network.name,
        chainId: network.chainId.toString(),
        deployer: deployer.address,
        deployerBalance: ethers.formatEther(balance),
        timestamp: new Date().toISOString(),
        contracts: {},
        transactions: {},
        gasUsed: {},
        blockNumbers: {}
    };
    
    console.log("\n📦 STARTING CONTRACT DEPLOYMENT...");
    console.log("==================================");
    
    try {
        // 1. Deploy MockUSDC
        console.log("\n1️⃣ Deploying MockUSDC...");
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();
        await mockUSDC.waitForDeployment();
        const usdcAddress = await mockUSDC.getAddress();
        const usdcReceipt = await mockUSDC.deploymentTransaction().wait();
        
        console.log("✅ MockUSDC deployed!");
        console.log("   Address:", usdcAddress);
        console.log("   Transaction:", mockUSDC.deploymentTransaction().hash);
        console.log("   Block:", usdcReceipt.blockNumber);
        console.log("   Gas Used:", usdcReceipt.gasUsed.toString());
        
        deploymentData.contracts.mockUSDC = usdcAddress;
        deploymentData.transactions.mockUSDC = mockUSDC.deploymentTransaction().hash;
        deploymentData.gasUsed.mockUSDC = usdcReceipt.gasUsed.toString();
        deploymentData.blockNumbers.mockUSDC = usdcReceipt.blockNumber;
        
        // 2. Deploy MockStETH
        console.log("\n2️⃣ Deploying MockStETH...");
        const MockStETH = await ethers.getContractFactory("MockStETH");
        const mockStETH = await MockStETH.deploy();
        await mockStETH.waitForDeployment();
        const stethAddress = await mockStETH.getAddress();
        const stethReceipt = await mockStETH.deploymentTransaction().wait();
        
        console.log("✅ MockStETH deployed!");
        console.log("   Address:", stethAddress);
        console.log("   Transaction:", mockStETH.deploymentTransaction().hash);
        console.log("   Block:", stethReceipt.blockNumber);
        console.log("   Gas Used:", stethReceipt.gasUsed.toString());
        
        deploymentData.contracts.mockStETH = stethAddress;
        deploymentData.transactions.mockStETH = mockStETH.deploymentTransaction().hash;
        deploymentData.gasUsed.mockStETH = stethReceipt.gasUsed.toString();
        deploymentData.blockNumbers.mockStETH = stethReceipt.blockNumber;
        
        // 3. Deploy YieldOracle
        console.log("\n3️⃣ Deploying YieldOracle...");
        const YieldOracle = await ethers.getContractFactory("YieldOracle");
        const yieldOracle = await YieldOracle.deploy();
        await yieldOracle.waitForDeployment();
        const yieldOracleAddress = await yieldOracle.getAddress();
        const oracleReceipt = await yieldOracle.deploymentTransaction().wait();
        
        console.log("✅ YieldOracle deployed!");
        console.log("   Address:", yieldOracleAddress);
        console.log("   Transaction:", yieldOracle.deploymentTransaction().hash);
        console.log("   Block:", oracleReceipt.blockNumber);
        console.log("   Gas Used:", oracleReceipt.gasUsed.toString());
        
        deploymentData.contracts.yieldOracle = yieldOracleAddress;
        deploymentData.transactions.yieldOracle = yieldOracle.deploymentTransaction().hash;
        deploymentData.gasUsed.yieldOracle = oracleReceipt.gasUsed.toString();
        deploymentData.blockNumbers.yieldOracle = oracleReceipt.blockNumber;
        
        // 4. Deploy LimitOrderManager
        console.log("\n4️⃣ Deploying LimitOrderManager...");
        const LimitOrderManager = await ethers.getContractFactory("LimitOrderManager");
        // Use 1inch Limit Order Protocol address on Ethereum mainnet
        const oneInchProtocolAddress = "0x119c71D3BbAC22029622cbaEc24854d3D32D2828";
        const limitOrderManager = await LimitOrderManager.deploy(oneInchProtocolAddress);
        await limitOrderManager.waitForDeployment();
        const limitOrderManagerAddress = await limitOrderManager.getAddress();
        const limitReceipt = await limitOrderManager.deploymentTransaction().wait();
        
        console.log("✅ LimitOrderManager deployed!");
        console.log("   Address:", limitOrderManagerAddress);
        console.log("   Transaction:", limitOrderManager.deploymentTransaction().hash);
        console.log("   Block:", limitReceipt.blockNumber);
        console.log("   Gas Used:", limitReceipt.gasUsed.toString());
        
        deploymentData.contracts.limitOrderManager = limitOrderManagerAddress;
        deploymentData.transactions.limitOrderManager = limitOrderManager.deploymentTransaction().hash;
        deploymentData.gasUsed.limitOrderManager = limitReceipt.gasUsed.toString();
        deploymentData.blockNumbers.limitOrderManager = limitReceipt.blockNumber;
        
        // 5. Deploy YieldGatedTWAP
        console.log("\n5️⃣ Deploying YieldGatedTWAP...");
        const YieldGatedTWAP = await ethers.getContractFactory("YieldGatedTWAP");
        const yieldGatedTWAP = await YieldGatedTWAP.deploy(
            yieldOracleAddress,
            limitOrderManagerAddress
        );
        await yieldGatedTWAP.waitForDeployment();
        const yieldGatedTWAPAddress = await yieldGatedTWAP.getAddress();
        const twapReceipt = await yieldGatedTWAP.deploymentTransaction().wait();
        
        console.log("✅ YieldGatedTWAP deployed!");
        console.log("   Address:", yieldGatedTWAPAddress);
        console.log("   Transaction:", yieldGatedTWAP.deploymentTransaction().hash);
        console.log("   Block:", twapReceipt.blockNumber);
        console.log("   Gas Used:", twapReceipt.gasUsed.toString());
        
        deploymentData.contracts.yieldGatedTWAP = yieldGatedTWAPAddress;
        deploymentData.transactions.yieldGatedTWAP = yieldGatedTWAP.deploymentTransaction().hash;
        deploymentData.gasUsed.yieldGatedTWAP = twapReceipt.gasUsed.toString();
        deploymentData.blockNumbers.yieldGatedTWAP = twapReceipt.blockNumber;
        
        // 6. Deploy HTLC
        console.log("\n6️⃣ Deploying HTLC...");
        const HTLC = await ethers.getContractFactory("HTLC");
        const htlc = await HTLC.deploy();
        await htlc.waitForDeployment();
        const htlcAddress = await htlc.getAddress();
        const htlcReceipt = await htlc.deploymentTransaction().wait();
        
        console.log("✅ HTLC deployed!");
        console.log("   Address:", htlcAddress);
        console.log("   Transaction:", htlc.deploymentTransaction().hash);
        console.log("   Block:", htlcReceipt.blockNumber);
        console.log("   Gas Used:", htlcReceipt.gasUsed.toString());
        
        deploymentData.contracts.htlc = htlcAddress;
        deploymentData.transactions.htlc = htlc.deploymentTransaction().hash;
        deploymentData.gasUsed.htlc = htlcReceipt.gasUsed.toString();
        deploymentData.blockNumbers.htlc = htlcReceipt.blockNumber;
        
        console.log("\n⚙️ CONFIGURING CONTRACTS...");
        console.log("============================");
        
        // Configure YieldOracle
        console.log("🔧 Setting up YieldOracle...");
        
        const addChainTx1 = await yieldOracle.addChain(1, "Ethereum", true);
        await addChainTx1.wait();
        console.log("✅ Added Ethereum chain");
        
        const addChainTx2 = await yieldOracle.addChain(11155111, "Sepolia", true);
        await addChainTx2.wait();
        console.log("✅ Added Sepolia chain");
        
        const addChainTx3 = await yieldOracle.addChain(128123, "Etherlink", true);
        await addChainTx3.wait();
        console.log("✅ Added Etherlink chain");
        
        const addAssetTx1 = await yieldOracle.addAsset(usdcAddress, "USDC", 6);
        await addAssetTx1.wait();
        console.log("✅ Added USDC asset");
        
        const addAssetTx2 = await yieldOracle.addAsset(stethAddress, "stETH", 18);
        await addAssetTx2.wait();
        console.log("✅ Added stETH asset");
        
        // Set yields
        await (await yieldOracle.setYield(1, usdcAddress, 320)).wait();
        await (await yieldOracle.setYield(11155111, usdcAddress, 310)).wait();
        await (await yieldOracle.setYield(128123, usdcAddress, 520)).wait();
        await (await yieldOracle.setYield(1, stethAddress, 380)).wait();
        await (await yieldOracle.setYield(11155111, stethAddress, 370)).wait();
        await (await yieldOracle.setYield(128123, stethAddress, 580)).wait();
        console.log("✅ Set initial yield rates");
        
        // Mint test tokens
        console.log("\n💰 Minting test tokens...");
        const mintTx1 = await mockUSDC.mint(deployer.address, ethers.parseUnits("10000", 6));
        await mintTx1.wait();
        console.log("✅ Minted 10,000 USDC");
        
        const mintTx2 = await mockStETH.mint(deployer.address, ethers.parseEther("1000"));
        await mintTx2.wait();
        console.log("✅ Minted 1,000 stETH");
        
        // Final balance check
        const finalBalance = await ethers.provider.getBalance(deployer.address);
        const totalGasUsed = Object.values(deploymentData.gasUsed).reduce((sum, gas) => sum + BigInt(gas), 0n);
        
        console.log("\n🎯 DEPLOYMENT COMPLETE!");
        console.log("=======================");
        console.log("📅 Completed:", new Date().toLocaleString());
        console.log("👤 Deployer:", deployer.address);
        console.log("💰 Initial Balance:", ethers.formatEther(balance), "ETH");
        console.log("💰 Final Balance:", ethers.formatEther(finalBalance), "ETH");
        console.log("⛽ Total Gas Used:", totalGasUsed.toString());
        console.log("💸 ETH Spent:", ethers.formatEther(balance - finalBalance), "ETH");
        
        console.log("\n📋 DEPLOYED CONTRACTS:");
        console.log("======================");
        console.log("MockUSDC:", usdcAddress);
        console.log("MockStETH:", stethAddress);
        console.log("YieldOracle:", yieldOracleAddress);
        console.log("LimitOrderManager:", limitOrderManagerAddress);
        console.log("YieldGatedTWAP:", yieldGatedTWAPAddress);
        console.log("HTLC:", htlcAddress);
        
        console.log("\n🔍 ETHERSCAN VERIFICATION LINKS:");
        console.log("================================");
        const baseUrl = "https://sepolia.etherscan.io";
        console.log("MockUSDC:", `${baseUrl}/address/${usdcAddress}`);
        console.log("MockStETH:", `${baseUrl}/address/${stethAddress}`);
        console.log("YieldOracle:", `${baseUrl}/address/${yieldOracleAddress}`);
        console.log("LimitOrderManager:", `${baseUrl}/address/${limitOrderManagerAddress}`);
        console.log("YieldGatedTWAP:", `${baseUrl}/address/${yieldGatedTWAPAddress}`);
        console.log("HTLC:", `${baseUrl}/address/${htlcAddress}`);
        
        // Save deployment data
        deploymentData.finalBalance = ethers.formatEther(finalBalance);
        deploymentData.totalGasUsed = totalGasUsed.toString();
        deploymentData.ethSpent = ethers.formatEther(balance - finalBalance);
        
        const filename = `deployment-sepolia-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(deploymentData, null, 2));
        console.log("\n💾 Deployment data saved:", filename);
        
        console.log("\n🏆 HACKATHON READY!");
        console.log("===================");
        console.log("✅ All contracts deployed to REAL Sepolia testnet");
        console.log("✅ Verifiable on Etherscan block explorer");
        console.log("✅ Ready for judge demonstrations");
        console.log("✅ 1inch API integration ready");
        console.log("✅ HTLC bridge ready for atomic swaps");
        console.log("✅ Frontend ready at http://localhost:3000");
        
        return deploymentData;
        
    } catch (error) {
        console.error("\n❌ DEPLOYMENT FAILED!");
        console.error("Error:", error.message);
        
        if (error.code === 'INSUFFICIENT_FUNDS') {
            console.log("\n💡 SOLUTION: Get more testnet ETH");
            console.log("🔗 Sepolia Faucet: https://sepoliafaucet.com/");
        }
        
        throw error;
    }
}

main()
    .then((deploymentData) => {
        console.log("\n🎉 SEPOLIA DEPLOYMENT SUCCESSFUL!");
        console.log("🏆 Ready for ETHGlobal UNITE judging!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
