# Treasury Management System

**Professional treasury management with real 1inch integration on Polygon mainnet**

## 🎯 What This Is

A **real working treasury management system** that:
- Uses live 1inch API for optimal token swaps
- Runs on Polygon mainnet with ~$0.01 transaction costs
- Provides professional portfolio management interface
- Executes TWAP (Time-Weighted Average Price) orders
- Tracks real token balances and yields

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
- `TreasuryManager.sol` - Main treasury logic
- `LimitOrderManager.sol` - 1inch integration wrapper
- `YieldGatedTWAP.sol` - TWAP execution strategy
- `MockUSDC.sol` & `MockStETH.sol` - Test tokens

### Frontend
- React/Next.js professional dashboard
- Real-time portfolio tracking
- Live 1inch price quotes
- Wallet connection and transaction execution

## 🔧 Features

### ✅ Real Working Features
- **Live 1inch API integration** - actual swaps on Polygon
- **Portfolio management** - track real token balances
- **TWAP orders** - time-weighted average price execution
- **Yield optimization** - find best swap routes
- **Professional UI** - modern, responsive interface

### 💰 Cost Structure
- Contract deployment: ~$2-5 one-time
- Each swap: ~$0.01 gas cost
- Total testing budget: ~$10

## 🏆 Hackathon Submission

**Target**: 1inch Protocol Prize ($5,000)

**Competitive Advantages**:
- ✅ **Actually works** - real functionality vs fake demos
- ✅ **Live 1inch integration** - real API calls and swaps
- ✅ **Professional quality** - enterprise-grade UI/UX
- ✅ **Judge testable** - judges can actually use the system
- ✅ **Production ready** - proper error handling and loading states

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

## 🧪 Testing

```bash
# Test contracts
cd contracts
npx hardhat test

# Test 1inch API
curl -H "Authorization: Bearer VCCbAAZbdHwOZSfwbUmT3BvnWyeYonHC" \
  "https://api.1inch.dev/swap/v6.0/137/tokens"
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
