#!/usr/bin/env node

/**
 * Deploy TwapLogger contract to Polygon mainnet
 * 
 * Usage: npm run deploy:polygon
 * 
 * Requirements:
 * - PRIVATE_KEY in .env (wallet with MATIC for gas)
 * - POLYGON_RPC_URL in .env
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🚀 Deploying TwapLogger to Polygon mainnet...\n');

    // Validate environment
    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in .env');
    }
    if (!process.env.POLYGON_RPC_URL) {
        throw new Error('POLYGON_RPC_URL not found in .env');
    }

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log(`📍 Deployer: ${wallet.address}`);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} MATIC`);
    
    if (balance < ethers.parseEther('0.01')) {
        throw new Error('Insufficient MATIC for deployment (need at least 0.01 MATIC)');
    }

    // Load compiled contract
    const artifactPath = path.join(__dirname, '../out/TwapLogger.sol/TwapLogger.json');
    if (!fs.existsSync(artifactPath)) {
        throw new Error('Contract not compiled. Run: forge build');
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    // Deploy contract
    console.log('\n📦 Deploying contract...');
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
    
    const contract = await factory.deploy();
    console.log(`⏳ Transaction hash: ${contract.deploymentTransaction().hash}`);
    
    // Wait for deployment
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    console.log(`✅ TwapLogger deployed at: ${address}`);
    console.log(`🔍 Polygonscan: https://polygonscan.com/address/${address}`);
    
    // Save deployment info
    const deploymentInfo = {
        address: address,
        transactionHash: contract.deploymentTransaction().hash,
        blockNumber: contract.deploymentTransaction().blockNumber,
        deployer: wallet.address,
        timestamp: new Date().toISOString(),
        network: 'polygon',
        chainId: 137
    };
    
    const deploymentPath = path.join(__dirname, '../data/deployment.json');
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`💾 Deployment info saved to: ${deploymentPath}`);
    
    // Verify contract source (optional)
    console.log('\n📋 Contract verification:');
    console.log(`Contract: ${address}`);
    console.log(`Network: Polygon (137)`);
    console.log(`Compiler: Solidity 0.8.20`);
    console.log(`Optimization: Enabled (200 runs)`);
    
    console.log('\n🎉 Deployment complete!');
    console.log('\nNext steps:');
    console.log('1. Verify contract on Polygonscan');
    console.log('2. Update README with contract address');
    console.log('3. Proceed to order generation (Commit #3)');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    });
