# FEAWS Scripts Directory

This directory contains the core, production-ready scripts for the FEAWS (Financial Engineering Automated Workflow System) project.

## 📁 Directory Structure

### `/core/` - Production Scripts
Essential, production-ready implementations:

- **`limit-order-protocol.js`** - 🎯 **MAIN IMPLEMENTATION**
  - Complete 1inch Limit Order Protocol v4 integration
  - Follows official documentation exactly
  - Handles token approval, order creation, EIP-712 signing, and API submission
  - Includes automatic payload validation fixes
  - Production-ready with proper error handling

- **`twap-engine.js`** - ⏰ **TWAP Implementation**
  - Time-Weighted Average Price execution engine
  - Real on-chain transactions using 1inch Aggregator API
  - Configurable slice size and intervals
  - Verified transaction logging

- **`live-demo.js`** - 🚀 **Live Demo System**
  - Interactive demonstration of all features
  - Real-time execution monitoring
  - Production demonstration ready

- **`monitor.js`** - 📊 **Monitoring System**
  - Transaction monitoring and verification
  - Health checks and status reporting
  - Real-time logging

- **`deploy.js`** - 🏗️ **Deployment Script**
  - Smart contract deployment
  - Network configuration
  - Verification utilities

- **`approve-usdc.sh`** - 🔑 **Token Approval Utility**
  - Quick token approval script
  - USDC/WMATIC approval automation

### `/examples/` - Example Implementations
Reference implementations and examples:

- **`fill-order-direct.js`** - Direct order filling example

### `/archive/` - Historical Implementations
Contains 40+ experimental and development files that led to the final working implementations. These are preserved for reference but not needed for production use.

## 🚀 Quick Start

### Run the Main 1inch Limit Order Protocol Implementation:
```bash
node scripts/core/limit-order-protocol.js
```

### Run the TWAP Engine:
```bash
node scripts/core/twap-engine.js
```

### Run Live Demo:
```bash
node scripts/core/live-demo.js
```

## 🎯 Key Features

✅ **Real Blockchain Transactions** - All scripts create actual on-chain transactions  
✅ **1inch Protocol Integration** - Complete Limit Order Protocol v4 support  
✅ **Production Ready** - Proper error handling, logging, and verification  
✅ **Enterprise Ready** - Fully prepared for production deployment  
✅ **Clean Architecture** - Organized, maintainable codebase  

## 🔧 Environment Setup

Ensure your `.env` file contains:
```
PRIVATE_KEY=your_wallet_private_key
POLYGON_RPC_URL=your_polygon_rpc_url
ONEINCH_API_KEY=your_1inch_api_key
```

## 📊 Verified Results

The implementations in `/core/` have been thoroughly tested and verified with real on-chain transactions on Polygon mainnet. All order creation, signing, and submission processes are working correctly.

---

**Status: ✅ Production Ready**  
**Last Updated: August 2025**  
**Enterprise Grade: Ready for Deployment**
