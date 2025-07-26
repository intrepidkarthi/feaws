#!/bin/bash

echo "🔧 Setting up REAL 1inch Integration"
echo "===================================="

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🔑 REQUIRED: Alchemy API Key Setup"
echo "=================================="
echo "1. Sign up at: https://www.alchemy.com/"
echo "2. Create a new app for 'Ethereum Mainnet'"
echo "3. Copy your API key"
echo "4. Update .env file with your key:"
echo ""
echo "   MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
echo ""

# Check current .env status
echo "📊 Current .env Status:"
if grep -q "YOUR_API_KEY" .env 2>/dev/null; then
    echo "⚠️  NEEDS SETUP: .env contains placeholder API key"
    echo "   Please update MAINNET_RPC_URL with your real Alchemy key"
elif grep -q "MAINNET_RPC_URL=" .env 2>/dev/null; then
    echo "✅ CONFIGURED: MAINNET_RPC_URL is set"
else
    echo "❌ MISSING: MAINNET_RPC_URL not found in .env"
fi

echo ""
echo "🚀 Testing Current Integration Mode:"
echo "===================================="

cd contracts

# Test without forking (simulation mode)
echo "🔍 Current Mode (Simulation):"
npx hardhat run scripts/demo-real-1inch.js 2>/dev/null | grep -E "(Integration:|Status:|Is Mainnet Fork:)"

echo ""
echo "🔧 To Enable Real 1inch Integration:"
echo "===================================="
echo "1. Set up your Alchemy API key in .env"
echo "2. Run: export FORK_MAINNET=true"
echo "3. Run: ./scripts/test-mainnet-fork.sh"
echo ""
echo "📊 Expected Output with Real Integration:"
echo "  Is Real 1inch Integration: true"
echo "  Status: Real 1inch Protocol Integration"
echo "  Is Mainnet Fork: true"
echo ""
echo "🎯 This will connect to REAL 1inch contracts on Ethereum mainnet!"
