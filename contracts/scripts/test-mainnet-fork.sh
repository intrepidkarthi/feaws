#!/bin/bash

echo "🔗 Testing Real 1inch Integration with Mainnet Fork"
echo "=================================================="

# Set environment variable to enable mainnet forking
export FORK_MAINNET=true

# Optional: Set your own RPC URL for better performance
# export MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"

echo "📡 Forking Ethereum Mainnet..."
echo "🔧 FORK_MAINNET=$FORK_MAINNET"

# Run the demo with mainnet forking enabled
npx hardhat run scripts/demo-real-1inch.js

echo ""
echo "✅ Mainnet Fork Test Complete!"
echo "📊 Check deployed-real-1inch-demo.json for results"
