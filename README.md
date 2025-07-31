# FEAWS - Advanced TWAP Engine for 1inch Limit Order Protocol

**ETHGlobal UNITE 2025 Submission**

## Project Overview

FEAWS implements an advanced Time-Weighted Average Price (TWAP) execution engine built on top of the 1inch Limit Order Protocol. The system allows treasuries and large traders to execute large orders in small, time-spaced slices to minimize market impact while maintaining full on-chain transparency.

## Core Value Proposition

- **Treasury Management**: Execute large token swaps (e.g., 100 USDC → WMATIC) in 50 small slices over time
- **Market Impact Reduction**: Each slice is small enough to avoid moving the market
- **Full On-Chain Execution**: Every slice is a real 1inch limit order, verifiable on Polygonscan
- **Zero Custody Risk**: Funds never leave the maker's control until each slice fills
- **Transparent Progress**: All fills emit events for accounting and compliance

## Technical Architecture

### Smart Contracts
- `TwapLogger.sol` - Stateless event logger that receives callbacks from filled limit orders
- No token custody, no complex state management
- Emits `SliceFilled(sliceIndex, maker, taker, makingAmount, takingAmount)` events

### Backend Scripts
- `build-orders.ts` - Generates and signs N limit orders with time predicates
- `taker-bot.ts` - Autonomous bot that fills live slices when time conditions are met
- `monitor.ts` - Real-time event listener for tracking progress

### 1inch LOP Integration
- Uses native LOP **predicates** for time-gating (no external oracles needed)
- Uses **interaction** callbacks to log fills on-chain
- Orders never posted to official 1inch API (per hackathon rules)
- All fills are direct `fillOrder()` calls on Polygon mainnet

## Prize Track Alignment

### 1inch "Advanced Limit Order Strategies" Prize
✅ **Advanced Strategy**: TWAP/Iceberg execution using predicates + interactions  
✅ **On-chain Execution**: All slices filled on Polygon mainnet during demo  
✅ **No Official API**: Orders stored as JSON in repo, filled directly via LOP contract  
✅ **Consistent Commits**: 8+ granular commits with tests and documentation  

### NEAR "Aurora Deployment" Prize (Optional Phase 2)
✅ **Cross-chain Extension**: Same TWAP engine deployed on Aurora  
✅ **Bridge Integration**: Interaction callbacks trigger Wormhole bridge transfers  
✅ **Dual-chain Demo**: Show Polygon fill → Wormhole message → Aurora receipt  

## Demo Flow

### Phase 1: Polygon TWAP Demo
1. **Setup**: Deploy `TwapLogger` contract to Polygon mainnet
2. **Order Generation**: Create 50 signed limit orders (0.2 USDC each, 60s intervals)
3. **Live Execution**: Run taker bot, fill 3-5 slices during judging
4. **Verification**: Show Polygonscan transactions + event logs in real-time

### Phase 2: Cross-Chain Extension (Stretch)
1. **Aurora Deployment**: Deploy LOP contracts to Aurora
2. **Bridge Integration**: Add Wormhole bridge calls to interaction callbacks
3. **Cross-Chain Demo**: Polygon fill → bridge → Aurora receipt

## Capital Requirements

- **Total Demo Size**: 10 USDC (50 slices × 0.2 USDC each)
- **Gas Costs**: ~0.003 MATIC per fill (~$0.002)
- **Bridge Fees**: 0.0001 native token per Wormhole transfer
- **Total Cost**: <$5 for complete demo including gas

## File Structure

```
feaws/
├── contracts/
│   ├── TwapLogger.sol           # Event logger contract
│   └── test/TwapLogger.t.sol    # Foundry unit tests
├── scripts/
│   ├── build-orders.ts          # Order generation script
│   ├── taker-bot.ts             # Autonomous filling bot
│   ├── monitor.ts               # Event monitoring
│   └── deploy.ts                # Contract deployment
├── data/
│   ├── orders.json              # Generated signed orders
│   ├── fills.csv                # Fill tracking log
│   └── meta.json                # Order metadata
├── foundry.toml                 # Foundry configuration
├── package.json                 # Node.js dependencies
└── README.md                    # This file
```

## Development Milestones

### Commit #1: Contract Foundation
- [ ] `TwapLogger.sol` with `onFill()` function
- [ ] Comprehensive Foundry tests
- [ ] Gas optimization and security review

### Commit #2: Deployment Infrastructure
- [ ] Hardhat deployment script
- [ ] Deploy to Polygon mainnet
- [ ] Verify contract on Polygonscan

### Commit #3: Order Generation
- [ ] `build-orders.ts` using 1inch LOP SDK
- [ ] Time predicate implementation
- [ ] Interaction calldata encoding

### Commit #4: Autonomous Execution
- [ ] `taker-bot.ts` with profit checking
- [ ] Automatic slice filling logic
- [ ] Transaction logging and error handling

### Commit #5: Monitoring & Analytics
- [ ] `monitor.ts` WebSocket event listener
- [ ] Progress tracking and reporting
- [ ] Real-time dashboard data

### Commit #6: Documentation & Demo
- [ ] Complete setup instructions
- [ ] Judge demo script
- [ ] Video walkthrough

### Commit #7: Cross-Chain Extension (Optional)
- [ ] Aurora LOP deployment
- [ ] Wormhole bridge integration
- [ ] Dual-chain monitoring

### Commit #8: Final Polish
- [ ] Code cleanup and optimization
- [ ] Security audit checklist
- [ ] Prize submission preparation

## Success Criteria

### Technical Requirements
- [ ] All Foundry tests pass (`forge test`)
- [ ] Contract deployed and verified on Polygon
- [ ] Successful on-chain TWAP execution during demo
- [ ] Real-time event monitoring working
- [ ] Complete documentation and setup instructions

### Prize Requirements
- [ ] Advanced LOP strategy demonstrated
- [ ] On-chain execution shown live to judges
- [ ] No use of official 1inch API
- [ ] Consistent commit history (8+ commits)
- [ ] Optional: Working UI for extra points

### Demo Requirements
- [ ] 2-minute live demo script
- [ ] Real Polygonscan transaction links
- [ ] Event logs visible in real-time
- [ ] Clear explanation of treasury use case
- [ ] Judge Q&A preparation

## Risk Mitigation

- **Smart Contract Risk**: Minimal contract surface area, comprehensive tests
- **Capital Risk**: Small demo amounts (<$5 total exposure)
- **Technical Risk**: Fallback to manual execution if bot fails
- **Time Risk**: Core functionality in Phase 1, cross-chain as stretch goal

## Next Steps

1. **Confirm Parameters**: Slice size, interval, total amount
2. **Wallet Setup**: Maker and taker addresses for demo
3. **Begin Development**: Start with Commit #1 (contract + tests)
4. **Iterative Review**: Each commit reviewed before proceeding
5. **Demo Preparation**: Practice run before judging

---

**This README will be updated as development progresses. All commits will be made incrementally with full transparency and verification.**
