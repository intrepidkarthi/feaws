#!/bin/bash

echo "🚀 Production-Ready Testnet Deployment"
echo "======================================"
echo "📊 Using REAL testnets with LIVE 1inch API integration"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Add your PRIVATE_KEY to .env file"
    echo "   Get testnet ETH from:"
    echo "   - Sepolia: https://sepoliafaucet.com/"
    echo "   - Etherlink: https://faucet.etherlink.com/"
    echo ""
    exit 1
fi

# Test RPC connections first
echo "🌐 Testing Network Connections..."
echo "================================="

cd contracts

echo "🔍 Testing Sepolia..."
npx hardhat run scripts/test-rpc-connection.js --network sepolia
if [ $? -ne 0 ]; then
    echo "❌ Sepolia connection failed"
    exit 1
fi

echo ""
echo "🔍 Testing Etherlink..."
npx hardhat run scripts/test-rpc-connection.js --network etherlink
if [ $? -ne 0 ]; then
    echo "❌ Etherlink connection failed"
    exit 1
fi

echo ""
echo "✅ All network connections successful!"
echo ""

# Check if private key is set
if ! grep -q "PRIVATE_KEY=" ../.env || grep -q "your_private_key_here" ../.env; then
    echo "⚠️  PRIVATE_KEY not set in .env file"
    echo "   1. Get testnet ETH from faucets"
    echo "   2. Add your private key to .env"
    echo "   3. Run this script again"
    echo ""
    echo "📋 Faucet Links:"
    echo "   Sepolia: https://sepoliafaucet.com/"
    echo "   Etherlink: https://faucet.etherlink.com/"
    exit 1
fi

# Deploy to Sepolia
echo "🚀 Deploying to Sepolia Testnet..."
echo "=================================="
npx hardhat run scripts/deploy-testnet-real.js --network sepolia

if [ $? -eq 0 ]; then
    echo "✅ Sepolia deployment successful!"
    echo "🔍 View on explorer: https://sepolia.etherscan.io"
else
    echo "❌ Sepolia deployment failed"
    exit 1
fi

echo ""

# Deploy to Etherlink
echo "🚀 Deploying to Etherlink Testnet..."
echo "====================================="
npx hardhat run scripts/deploy-testnet-real.js --network etherlink

if [ $? -eq 0 ]; then
    echo "✅ Etherlink deployment successful!"
    echo "🔍 View on explorer: https://explorer.etherlink.com"
else
    echo "❌ Etherlink deployment failed"
    exit 1
fi

echo ""
echo "🎉 PRODUCTION DEPLOYMENT COMPLETE!"
echo "=================================="
echo "✅ Deployed to REAL Sepolia testnet"
echo "✅ Deployed to REAL Etherlink testnet"  
echo "✅ Using LIVE 1inch API integration"
echo "✅ All contracts verifiable on block explorers"
echo ""
echo "🏆 Ready for ETHGlobal UNITE judges!"
echo "📊 Deployment files saved with contract addresses"
echo "🔍 Judges can verify independently on block explorers"
