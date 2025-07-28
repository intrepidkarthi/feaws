# Treasury Management System

**Automated treasury management with 1inch Protocol integration and dynamic yield optimization**

## Technical Overview

A decentralized treasury management system that integrates 1inch Protocol for optimal token swaps and Etherlink for cross-chain yield opportunities. The system uses dynamic yield calculation based on real DeFi protocol rates and executes TWAP orders when yield thresholds are met.

### Core Features

- **1inch Protocol Integration**: Direct API integration for swap routing and execution
- **Dynamic Yield Calculation**: Real-time yield data from Aave, Compound, and other DeFi protocols
- **TWAP Execution**: Time-weighted average price orders with configurable parameters
- **Cross-chain Yield Monitoring**: Etherlink integration for yield arbitrage opportunities
- **Automated Rebalancing**: Portfolio optimization based on yield differentials

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MetaMask with Polygon mainnet
- Small amount of MATIC for gas (~$5)

### Setup
```bash
# Install dependencies
npm install
cd contracts && npm install

# Configure environment
cp .env.example .env
# Add your private key to .env

# Deploy to Polygon mainnet
cd contracts
npx hardhat deploy --network polygon

# Start frontend
cd ../frontend
npm run dev
```

## 🏗️ Architecture

### Smart Contracts (Polygon Mainnet)
- `YieldOracle.sol` - Dynamic yield data aggregation from DeFi protocols
- `LimitOrderManager.sol` - 1inch Protocol integration wrapper
- `YieldGatedTWAP.sol` - TWAP execution with yield threshold logic
- Token contracts for USDC, WMATIC, WETH, DAI on Polygon

### Frontend
- React/Next.js professional dashboard
- Real-time portfolio tracking
- Live 1inch price quotes
- Wallet connection and transaction execution

## 🔧 Technical Implementation

### Yield Data Sources
- **Aave v3**: Lending rates for USDC, WETH, WMATIC on Polygon
- **Compound**: Supply rates for supported assets
- **QuickSwap**: LP token yields and farming rewards
- **Etherlink**: Cross-chain yield opportunities via bridge protocols

### 1inch Integration
- **Swap API**: Optimal routing for token exchanges
- **Limit Orders**: Conditional execution based on price/yield thresholds
- **Price Discovery**: Real-time price feeds for yield calculations

### TWAP Strategy
- **Configurable Parameters**: Order size, time intervals, slippage tolerance
- **Yield Threshold Logic**: Execute only when target yield > current + threshold
- **Gas Optimization**: Batch operations to minimize transaction costs

## 📊 Yield Calculation Algorithm

```solidity
function calculateDynamicYield(address token, uint256 amount) external view returns (uint256) {
    uint256 aaveRate = getAaveSupplyRate(token);
    uint256 compoundRate = getCompoundSupplyRate(token);
    uint256 lpYield = getQuickSwapLPYield(token);
    
    // Weight by liquidity depth
    uint256 weightedYield = (aaveRate * aaveLiquidity + 
                            compoundRate * compoundLiquidity + 
                            lpYield * lpLiquidity) / totalLiquidity;
    
    return weightedYield;
}
```

### Cross-chain Yield Arbitrage
- Monitor yield differentials between Polygon and Etherlink
- Execute atomic swaps when arbitrage opportunities exceed gas costs
- Use 1inch for optimal routing and minimal slippage

## 📁 Project Structure

```
├── contracts/           # Smart contracts (Polygon mainnet)
│   ├── src/            # Solidity contracts
│   ├── test/           # Contract tests
│   └── scripts/        # Deployment scripts
├── frontend/           # React dashboard
├── docs/              # Documentation
└── README.md          # This file
```

## 🧪 API Integration

### 1inch Protocol API
```bash
# Get supported tokens on Polygon
curl -H "Authorization: Bearer <API_KEY>" \
  "https://api.1inch.dev/swap/v6.0/137/tokens"

# Get swap quote
curl -H "Authorization: Bearer <API_KEY>" \
  "https://api.1inch.dev/swap/v6.0/137/quote?src=0x2791bca1f2de4661ed88a30c99a7a9449aa84174&dst=0x7ceb23fd6bc0add59e62ac25578270cff1b9f619&amount=1000000"
```

### Etherlink Integration
```javascript
// Cross-chain yield monitoring
const etherlinkYield = await fetch('https://api.etherlink.com/yields/polygon');
const polygonYield = await getPolygonYields();
const arbitrageOpportunity = etherlinkYield.rate - polygonYield.rate;
```

## 🎬 Demo Flow

1. **Connect Wallet** - MetaMask to Polygon mainnet
2. **View Portfolio** - See real token balances
3. **Get Quote** - Live 1inch price quote
4. **Execute Swap** - Real transaction on Polygon
5. **Track Results** - Updated portfolio balances

## 📊 Technical Details

- **Blockchain**: Polygon mainnet (Chain ID: 137)
- **API**: 1inch Protocol v6.0
- **Gas Cost**: ~30 gwei (~$0.01 per transaction)
- **Frontend**: React 18, Next.js 13, TailwindCSS
- **Wallet**: MetaMask, WalletConnect support

---

**Built for ETHGlobal UNITE Hackathon**  
*Real treasury management, not simulation*
