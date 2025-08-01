#!/bin/bash
# Approve 1inch LOP contract to spend USDC
echo "Approving 2 USDC for 1inch LOP..."
cast send 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 \
  "approve(address,uint256)" \
  0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f \
  2000000 \
  --private-key $PRIVATE_KEY \
  --rpc-url https://polygon-rpc.com
echo "✅ Approval complete"
