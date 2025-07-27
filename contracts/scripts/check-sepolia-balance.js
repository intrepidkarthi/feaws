const { ethers } = require("hardhat");

/**
 * Check Sepolia balance before deployment
 */
async function checkBalance() {
    console.log("🔍 CHECKING SEPOLIA BALANCE");
    console.log("===========================");
    
    try {
        const [signer] = await ethers.getSigners();
        const address = signer.address;
        const balance = await ethers.provider.getBalance(address);
        const network = await ethers.provider.getNetwork();
        
        console.log("📡 Network:", network.name);
        console.log("🆔 Chain ID:", network.chainId.toString());
        console.log("👤 Address:", address);
        console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
        
        const minRequired = ethers.parseEther("0.01");
        const recommended = ethers.parseEther("0.02");
        
        console.log("\n📊 DEPLOYMENT READINESS:");
        console.log("========================");
        
        if (balance >= recommended) {
            console.log("✅ EXCELLENT - Ready for deployment!");
            console.log("💚 You have more than enough ETH");
        } else if (balance >= minRequired) {
            console.log("✅ GOOD - Ready for deployment");
            console.log("💛 You have sufficient ETH");
        } else {
            console.log("❌ INSUFFICIENT - Need more ETH");
            console.log("💔 Current:", ethers.formatEther(balance), "ETH");
            console.log("💡 Required:", ethers.formatEther(minRequired), "ETH");
            console.log("🔗 Get testnet ETH: https://sepoliafaucet.com/");
            return false;
        }
        
        console.log("\n⛽ ESTIMATED COSTS:");
        console.log("==================");
        console.log("📦 Contract Deployment: ~0.005 ETH");
        console.log("⚙️ Configuration: ~0.003 ETH");
        console.log("💰 Token Minting: ~0.002 ETH");
        console.log("📊 Total Estimated: ~0.01 ETH");
        
        if (network.chainId !== 11155111n) {
            console.log("\n⚠️ WARNING: Not on Sepolia network!");
            console.log("Expected Chain ID: 11155111");
            console.log("Current Chain ID:", network.chainId.toString());
            console.log("💡 Switch to Sepolia in MetaMask");
            return false;
        }
        
        console.log("\n🚀 READY TO DEPLOY!");
        console.log("===================");
        console.log("Run: npx hardhat run scripts/deploy-with-metamask.js --network sepolia");
        
        return true;
        
    } catch (error) {
        console.error("❌ Error checking balance:", error.message);
        
        if (error.message.includes("private key")) {
            console.log("\n💡 SOLUTION:");
            console.log("1. Create .env file in contracts/ directory");
            console.log("2. Add: PRIVATE_KEY=your_metamask_private_key");
            console.log("3. Export private key from MetaMask (without 0x prefix)");
        }
        
        return false;
    }
}

checkBalance()
    .then((ready) => {
        if (ready) {
            console.log("\n🎯 All systems ready for live deployment!");
        } else {
            console.log("\n🔧 Please fix the issues above before deploying");
        }
    })
    .catch(console.error);
