# 🎯 Cross-Chain Yield-Gated TWAP

## 🚀 Project Overview

A **cross-chain yield arbitrage TWAP strategy** that automatically executes 1inch Limit Orders only when destination chain yields exceed configurable thresholds, optimizing DAO treasury management across multiple blockchains.

### Core Innovation
- **Yield-Gated Execution**: Only execute TWAP tranches when yield ≥ threshold (e.g., 3.8%)
- **Cross-Chain Arbitrage**: Compare yields across Ethereum and Etherlink
- **1inch Integration**: Real on-chain execution using 1inch Limit Order Protocol
- **DAO Treasury Optimization**: Automated treasury management for maximum yield

## 🛠 Tech Stack

### Smart Contracts
- **Solidity 0.8.x** - Smart contract development
- **Hardhat** - Development framework and testing
- **OpenZeppelin** - Security-audited contract libraries
- **1inch Limit Order Protocol** - Decentralized order execution

### Frontend
- **Next.js 14** - React framework with SSR
- **Tailwind CSS** - Utility-first styling
- **ethers.js v6** - Ethereum interaction library
- **@1inch/limit-order-sdk** - 1inch protocol integration

### Infrastructure
- **Ethereum Sepolia** - Primary testnet
- **Etherlink Testnet** - Cross-chain operations
- **HTLC Bridge** - Hash-time-lock contracts for demo
- **GitHub Actions** - CI/CD pipeline

## 🎮 Demo Features

### Live Dashboard
- **Real-time yield monitoring** across both chains
- **Interactive threshold controls** for strategy customization
- **1inch order creation and tracking** with transaction links
- **Cross-chain bridge operations** with HTLC management

## 📋 Project Structure

```
├── contracts/                 # Smart contracts
│   ├── src/                  # Contract source files
│   ├── test/                 # Hardhat tests
│   └── scripts/              # Deployment scripts
├── frontend/                 # Next.js application
│   ├── pages/                # Application pages
│   ├── components/           # React components
│   └── hooks/                # Custom hooks
├── scripts/                  # Build and deployment scripts
└── docs/                     # Documentation
```


## 🎯 Business Value

### For DAOs
- **Automated yield optimization** across multiple chains
- **Risk management** through configurable thresholds
- **Gas efficiency** through batched TWAP execution
- **Transparent execution** with on-chain audit trails

### For DeFi
- **Cross-chain liquidity optimization**
- **Yield arbitrage opportunities**
- **Protocol composability** with 1inch integration
- **Scalable treasury management** solutions

## 🔗 Links

- **Live Demo**: [https://feaws.xyz](https://feaws.xyz)
- **Documentation**: [./docs/](./docs/)
- **1inch Protocol**: [https://1inch.io](https://1inch.io)
- **Etherlink**: [https://etherlink.com](https://etherlink.com)

---

**Built for ETHGlobal UNITE** • **Powered by 1inch Protocol** • **Deployed on Etherlink**
