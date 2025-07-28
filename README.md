# FEAWS Treasury Management System

A production-ready treasury management system with real 1inch Protocol integration on Polygon mainnet.

## 🏦 Features

- **Real 1inch Swaps**: Execute actual token swaps through 1inch Protocol
- **Limit Orders**: Create cryptographically signed limit orders
- **TWAP Strategies**: Time-weighted average price execution
- **Live Dashboard**: Real-time treasury monitoring
- **Multi-token Support**: USDC, WMATIC, WETH, DAI

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Polygon wallet with USDC balance
- 1inch API key

### Setup

1. **Install dependencies**:
```bash
cd keeper
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your credentials:
# PRIVATE_KEY=your_wallet_private_key
# POLYGON_RPC_URL=your_polygon_rpc_url
# ONEINCH_API_KEY=your_1inch_api_key
```

3. **Run treasury operations**:
```bash
# Get treasury status
node main.js status

# Check balances
node main.js balances

# Execute swap
node main.js swap USDC WMATIC 1000000

# Run TWAP strategy
node main.js twap USDC WMATIC 5 3 10

# Run full demo
node main.js
```

4. **Start dashboard**:
```bash
cd ../frontend
node serve.js
# Open http://localhost:3000
```

## 📊 Dashboard

The live dashboard shows:
- Real-time token balances
- Transaction history with Polygonscan links
- Active limit orders
- TWAP strategy status

## 🔧 Architecture

### Core Components

- **`treasury-manager.js`**: Main treasury operations class
- **`main.js`**: CLI interface and demo execution
- **`dashboard.html`**: Real-time web interface
- **`serve.js`**: Simple HTTP server

### Key Functions

- `executeSwap()`: Real 1inch swap execution
- `createLimitOrder()`: Signed limit order creation
- `executeTWAP()`: Multi-tranche TWAP strategy
- `getBalances()`: Multi-token balance checking

## 🌐 Live Integration

### Verified Transactions
- **Real Swap**: `0x03e26c894270f8c9e00acb17a6d67e389b53b98dcf9427fdbc6b0655ef0f939d`
- **Block**: `74521584`
- **Gas Used**: `199,620`
- **Received**: `2.169497879499409306 WMATIC`

### Contracts
- **1inch Router**: `0x111111125421ca6dc452d289314280a0f8842a65`
- **USDC**: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`
- **WMATIC**: `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`

## 📈 Usage Examples

### Execute Single Swap
```javascript
const { TreasuryManager } = require('./keeper/treasury-manager');
const treasury = new TreasuryManager();

const result = await treasury.executeSwap('USDC', 'WMATIC', '1000000');
console.log('Swap result:', result);
```

### Create Limit Order
```javascript
const order = await treasury.createLimitOrder('USDC', 'WMATIC', '1000000', '4000000000000000000');
console.log('Order hash:', order.orderHash);
```

### TWAP Strategy
```javascript
const twap = await treasury.executeTWAP('USDC', 'WMATIC', '5', 3, 10);
console.log('TWAP completed:', twap);
```

## 🔐 Security

- Private keys stored in environment variables
- Token approvals managed automatically
- Transaction signing with ethers.js
- Rate limiting on API calls

## 📝 Data Files

Generated in `frontend/` directory:
- `treasury-status.json`: Current balances and status
- `latest-swap.json`: Most recent swap transaction
- `latest-limit-order.json`: Most recent limit order
- `executed-swap.json`: Verified swap execution data

## 🎯 Production Ready

This system has been tested with real transactions on Polygon mainnet:
- ✅ Real USDC/WMATIC swaps executed
- ✅ Real gas fees paid
- ✅ Real tokens received
- ✅ Verifiable on Polygonscan
- ✅ Live 1inch API integration

## 🚀 Deployment

The system is ready for production deployment with:
- Error handling and retry logic
- Comprehensive logging
- Real-time monitoring
- Multi-token support
- Scalable architecture

---

**Built for hackathon demonstration of real 1inch Protocol integration**
