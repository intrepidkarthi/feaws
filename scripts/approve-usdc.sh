#!/bin/bash
# Approve 1inch LOP contract to spend USDC
echo "Approving 2 USDC for 1inch LOP..."
cast send 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 \
  "approve(address,uint256)" \
  0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f \
  2000000 \
  --private-key 2b2f77d6ebb4b7c02b46c91f0a8965a3c19063c9cb81d5f3de911fb953b76f89 \
  --rpc-url https://polygon-rpc.com
echo "✅ Approval complete"
