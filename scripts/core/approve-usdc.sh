#!/bin/bash
# Approve 1inch LOP contract to spend USDC

# Load environment variables
source .env
echo "Approving 1 USDC for 1inch LOP..."
cast send 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 \
  "approve(address,uint256)" \
  0x111111125421ca6dc452d289314280a0f8842a65 \
  1000000 \
  --private-key $PRIVATE_KEY \
  --rpc-url $POLYGON_RPC_URL
echo "✅ Approval complete"
