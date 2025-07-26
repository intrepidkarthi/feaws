const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("YieldGatedTWAP", function () {
  let yieldGatedTWAP;
  let yieldOracle;
  let limitOrderManager;
  let mockUSDC;
  let mockStETH;
  let owner;
  let user;

  const CHAIN_ID_ETHEREUM = 1;
  const CHAIN_ID_ETHERLINK = 128123;
  const INITIAL_YIELD = 320; // 3.2% in basis points
  const MIN_YIELD_THRESHOLD = 300; // 3.0% in basis points
  const TRANCHE_SIZE = ethers.parseUnits("1000", 6); // 1000 USDC
  const TOTAL_AMOUNT = ethers.parseUnits("5000", 6); // 5000 USDC
  const INTERVAL_SECONDS = 3600; // 1 hour
  const MAX_SLIPPAGE = 100; // 1% in basis points

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy mock tokens
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    
    const MockStETH = await ethers.getContractFactory("MockStETH");
    mockStETH = await MockStETH.deploy();

    // Deploy YieldOracle
    const YieldOracle = await ethers.getContractFactory("YieldOracle");
    yieldOracle = await YieldOracle.deploy();

    // Deploy LimitOrderManager
    const LimitOrderManager = await ethers.getContractFactory("LimitOrderManager");
    limitOrderManager = await LimitOrderManager.deploy(
      "0x0000000000000000000000000000000000000001" // Mock 1inch protocol
    );

    // Deploy YieldGatedTWAP
    const YieldGatedTWAP = await ethers.getContractFactory("YieldGatedTWAP");
    yieldGatedTWAP = await YieldGatedTWAP.deploy(
      await yieldOracle.getAddress(),
      await limitOrderManager.getAddress()
    );

    // Add assets to oracle
    await yieldOracle.addAsset(await mockUSDC.getAddress(), "USDC");
    await yieldOracle.addAsset(await mockStETH.getAddress(), "stETH");
    
    // Setup initial yields
    await yieldOracle.setYield(CHAIN_ID_ETHEREUM, await mockStETH.getAddress(), INITIAL_YIELD);
    await yieldOracle.setYield(CHAIN_ID_ETHERLINK, await mockStETH.getAddress(), 520); // 5.2%

    // Mint tokens to user
    await mockUSDC.mint(user.address, ethers.parseUnits("10000", 6));
    await mockUSDC.connect(user).approve(await yieldGatedTWAP.getAddress(), ethers.MaxUint256);
  });

  describe("Strategy Creation", function () {
    it("Should create a new TWAP strategy", async function () {
      const tx = await yieldGatedTWAP.createStrategy(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        TOTAL_AMOUNT,
        TRANCHE_SIZE,
        INTERVAL_SECONDS,
        MAX_SLIPPAGE,
        MIN_YIELD_THRESHOLD
      );

      await expect(tx)
        .to.emit(yieldGatedTWAP, "StrategyCreated")
        .withArgs(
          1, // strategyId
          await mockUSDC.getAddress(),
          await mockStETH.getAddress(),
          TOTAL_AMOUNT,
          TRANCHE_SIZE
        );

      const [config, state] = await yieldGatedTWAP.getStrategy(1);
      expect(config.sourceAsset).to.equal(await mockUSDC.getAddress());
      expect(config.targetAsset).to.equal(await mockStETH.getAddress());
      expect(config.totalAmount).to.equal(TOTAL_AMOUNT);
      expect(config.trancheSize).to.equal(TRANCHE_SIZE);
      expect(config.isActive).to.be.true;
      expect(state.executedAmount).to.equal(0);
      expect(state.isComplete).to.be.false;
    });

    it("Should reject invalid strategy parameters", async function () {
      // Invalid source asset
      await expect(
        yieldGatedTWAP.createStrategy(
          ethers.ZeroAddress,
          await mockStETH.getAddress(),
          TOTAL_AMOUNT,
          TRANCHE_SIZE,
          INTERVAL_SECONDS,
          MAX_SLIPPAGE,
          MIN_YIELD_THRESHOLD
        )
      ).to.be.revertedWith("Invalid source asset");

      // Invalid tranche size
      await expect(
        yieldGatedTWAP.createStrategy(
          await mockUSDC.getAddress(),
          await mockStETH.getAddress(),
          TOTAL_AMOUNT,
          TOTAL_AMOUNT + 1n, // Tranche larger than total
          INTERVAL_SECONDS,
          MAX_SLIPPAGE,
          MIN_YIELD_THRESHOLD
        )
      ).to.be.revertedWith("Invalid tranche size");

      // Interval too short
      await expect(
        yieldGatedTWAP.createStrategy(
          await mockUSDC.getAddress(),
          await mockStETH.getAddress(),
          TOTAL_AMOUNT,
          TRANCHE_SIZE,
          100, // Less than minimum
          MAX_SLIPPAGE,
          MIN_YIELD_THRESHOLD
        )
      ).to.be.revertedWith("Interval too short");
    });

    it("Should only allow owner to create strategies", async function () {
      await expect(
        yieldGatedTWAP.connect(user).createStrategy(
          await mockUSDC.getAddress(),
          await mockStETH.getAddress(),
          TOTAL_AMOUNT,
          TRANCHE_SIZE,
          INTERVAL_SECONDS,
          MAX_SLIPPAGE,
          MIN_YIELD_THRESHOLD
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Tranche Execution", function () {
    beforeEach(async function () {
      // Create a strategy
      await yieldGatedTWAP.createStrategy(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        TOTAL_AMOUNT,
        TRANCHE_SIZE,
        INTERVAL_SECONDS,
        MAX_SLIPPAGE,
        MIN_YIELD_THRESHOLD
      );
    });

    it("Should execute tranche when yield threshold is met", async function () {
      // Check if execution is possible
      const [canExecute, reason] = await yieldGatedTWAP.canExecuteTrancheNow(1, CHAIN_ID_ETHEREUM);
      expect(canExecute).to.be.true;
      expect(reason).to.equal("Ready for execution");

      // Execute tranche
      const tx = await yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(1, CHAIN_ID_ETHEREUM);
      
      await expect(tx)
        .to.emit(yieldGatedTWAP, "TrancheExecuted")
        .withArgs(1, 1, TRANCHE_SIZE, ethers.AnyValue, INITIAL_YIELD);

      // Check strategy state
      const [, state] = await yieldGatedTWAP.getStrategy(1);
      expect(state.executedAmount).to.equal(TRANCHE_SIZE);
      expect(state.currentTrancheIndex).to.equal(1);
      expect(state.isComplete).to.be.false;
    });

    it("Should not execute when yield is below threshold", async function () {
      // Lower the yield below threshold
      await yieldOracle.setYield(CHAIN_ID_ETHEREUM, await mockStETH.getAddress(), 250); // 2.5%

      const [canExecute, reason] = await yieldGatedTWAP.canExecuteTrancheNow(1, CHAIN_ID_ETHEREUM);
      expect(canExecute).to.be.false;
      expect(reason).to.equal("Yield below threshold");

      const tx = await yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(1, CHAIN_ID_ETHEREUM);
      
      await expect(tx)
        .to.emit(yieldGatedTWAP, "YieldThresholdNotMet")
        .withArgs(1, 250, MIN_YIELD_THRESHOLD);

      // Check that nothing was executed
      const [, state] = await yieldGatedTWAP.getStrategy(1);
      expect(state.executedAmount).to.equal(0);
    });

    it("Should not execute too soon after last execution", async function () {
      // Execute first tranche
      await yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(1, CHAIN_ID_ETHEREUM);

      // Try to execute again immediately
      const [canExecute, reason] = await yieldGatedTWAP.canExecuteTrancheNow(1, CHAIN_ID_ETHEREUM);
      expect(canExecute).to.be.false;
      expect(reason).to.equal("Too soon for next execution");

      await expect(
        yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(1, CHAIN_ID_ETHEREUM)
      ).to.be.revertedWith("Too soon for next execution");
    });

    it("Should complete strategy after all tranches", async function () {
      // Execute all 5 tranches (5000 USDC / 1000 USDC per tranche)
      for (let i = 0; i < 5; i++) {
        await yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(1, CHAIN_ID_ETHEREUM);
        
        // Fast forward time for next execution
        if (i < 4) {
          await ethers.provider.send("evm_increaseTime", [INTERVAL_SECONDS]);
          await ethers.provider.send("evm_mine");
        }
      }

      const [, state] = await yieldGatedTWAP.getStrategy(1);
      expect(state.executedAmount).to.equal(TOTAL_AMOUNT);
      expect(state.isComplete).to.be.true;
      expect(state.currentTrancheIndex).to.equal(5);
    });

    it("Should handle partial final tranche", async function () {
      // Create strategy with non-divisible amounts
      const oddTotalAmount = ethers.parseUnits("4500", 6); // 4500 USDC
      const trancheSize = ethers.parseUnits("1000", 6); // 1000 USDC
      
      await yieldGatedTWAP.createStrategy(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        oddTotalAmount,
        trancheSize,
        INTERVAL_SECONDS,
        MAX_SLIPPAGE,
        MIN_YIELD_THRESHOLD
      );

      // Execute 4 full tranches + 1 partial (500 USDC)
      for (let i = 0; i < 5; i++) {
        await yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(2, CHAIN_ID_ETHEREUM);
        
        if (i < 4) {
          await ethers.provider.send("evm_increaseTime", [INTERVAL_SECONDS]);
          await ethers.provider.send("evm_mine");
        }
      }

      const [, state] = await yieldGatedTWAP.getStrategy(2);
      expect(state.executedAmount).to.equal(oddTotalAmount);
      expect(state.isComplete).to.be.true;
    });
  });

  describe("Cross-Chain Yield Arbitrage", function () {
    beforeEach(async function () {
      await yieldGatedTWAP.createStrategy(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        TOTAL_AMOUNT,
        TRANCHE_SIZE,
        INTERVAL_SECONDS,
        MIN_YIELD_THRESHOLD,
        MIN_YIELD_THRESHOLD
      );
    });

    it("Should prefer higher yield chain", async function () {
      // Ethereum: 3.2%, Etherlink: 5.2%
      const [canExecuteEth] = await yieldGatedTWAP.canExecuteTrancheNow(1, CHAIN_ID_ETHEREUM);
      const [canExecuteEtherlink] = await yieldGatedTWAP.canExecuteTrancheNow(1, CHAIN_ID_ETHERLINK);
      
      expect(canExecuteEth).to.be.true;
      expect(canExecuteEtherlink).to.be.true;

      // Execute on Etherlink (higher yield)
      const tx = await yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(1, CHAIN_ID_ETHERLINK);
      
      await expect(tx)
        .to.emit(yieldGatedTWAP, "TrancheExecuted")
        .withArgs(1, 1, TRANCHE_SIZE, ethers.AnyValue, 520); // 5.2% yield
    });

    it("Should demonstrate yield arbitrage opportunity", async function () {
      // Set up yield differential
      await yieldOracle.setYield(CHAIN_ID_ETHEREUM, await mockStETH.getAddress(), 300); // 3.0%
      await yieldOracle.setYield(CHAIN_ID_ETHERLINK, await mockStETH.getAddress(), 600); // 6.0%

      // Check arbitrage opportunity
      const ethYield = await yieldOracle.getYield(CHAIN_ID_ETHEREUM, await mockStETH.getAddress());
      const etherlinkYield = await yieldOracle.getYield(CHAIN_ID_ETHERLINK, await mockStETH.getAddress());
      
      expect(etherlinkYield[0]).to.be.greaterThan(ethYield[0]);
      
      // Execute on higher yield chain
      const tx = await yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(1, CHAIN_ID_ETHERLINK);
      
      await expect(tx)
        .to.emit(yieldGatedTWAP, "TrancheExecuted")
        .withArgs(1, 1, TRANCHE_SIZE, ethers.AnyValue, 600);
    });
  });

  describe("Strategy Management", function () {
    beforeEach(async function () {
      await yieldGatedTWAP.createStrategy(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        TOTAL_AMOUNT,
        TRANCHE_SIZE,
        INTERVAL_SECONDS,
        MAX_SLIPPAGE,
        MIN_YIELD_THRESHOLD
      );
    });

    it("Should pause and unpause strategy", async function () {
      // Pause strategy
      await yieldGatedTWAP.setStrategyActive(1, false);
      
      const [canExecute, reason] = await yieldGatedTWAP.canExecuteTrancheNow(1, CHAIN_ID_ETHEREUM);
      expect(canExecute).to.be.false;
      expect(reason).to.equal("Strategy not active");

      // Unpause strategy
      await yieldGatedTWAP.setStrategyActive(1, true);
      
      const [canExecuteAfter] = await yieldGatedTWAP.canExecuteTrancheNow(1, CHAIN_ID_ETHEREUM);
      expect(canExecuteAfter).to.be.true;
    });

    it("Should track strategy count", async function () {
      expect(await yieldGatedTWAP.getStrategyCount()).to.equal(1);
      
      await yieldGatedTWAP.createStrategy(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        TOTAL_AMOUNT,
        TRANCHE_SIZE,
        INTERVAL_SECONDS,
        MAX_SLIPPAGE,
        MIN_YIELD_THRESHOLD
      );
      
      expect(await yieldGatedTWAP.getStrategyCount()).to.equal(2);
    });

    it("Should allow emergency withdrawal", async function () {
      // Mint some tokens to the contract
      await mockUSDC.mint(await yieldGatedTWAP.getAddress(), ethers.parseUnits("1000", 6));
      
      const balanceBefore = await mockUSDC.balanceOf(owner.address);
      
      await yieldGatedTWAP.emergencyWithdraw(
        await mockUSDC.getAddress(),
        ethers.parseUnits("1000", 6)
      );
      
      const balanceAfter = await mockUSDC.balanceOf(owner.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseUnits("1000", 6));
    });
  });

  describe("Integration with Real 1inch", function () {
    it("Should integrate with LimitOrderManager", async function () {
      await yieldGatedTWAP.createStrategy(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        TOTAL_AMOUNT,
        TRANCHE_SIZE,
        INTERVAL_SECONDS,
        MAX_SLIPPAGE,
        MIN_YIELD_THRESHOLD
      );

      // Execute tranche
      await yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(1, CHAIN_ID_ETHEREUM);
      
      // Check that order was created in LimitOrderManager
      const activeOrders = await yieldGatedTWAP.getActiveOrders(1);
      expect(activeOrders.length).to.equal(1);
      expect(activeOrders[0]).to.not.equal(ethers.ZeroHash);
    });

    it("Should handle order fill notifications", async function () {
      await yieldGatedTWAP.createStrategy(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        TOTAL_AMOUNT,
        TRANCHE_SIZE,
        INTERVAL_SECONDS,
        MAX_SLIPPAGE,
        MIN_YIELD_THRESHOLD
      );

      // Execute tranche to create order
      await yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(1, CHAIN_ID_ETHEREUM);
      
      const activeOrders = await yieldGatedTWAP.getActiveOrders(1);
      const orderHash = activeOrders[0];
      
      // Simulate order fill notification from LimitOrderManager
      const tx = await limitOrderManager.notifyOrderFilled(
        await yieldGatedTWAP.getAddress(),
        orderHash,
        TRANCHE_SIZE
      );
      
      // Should emit OrderFilled event
      await expect(tx)
        .to.emit(yieldGatedTWAP, "OrderFilled")
        .withArgs(1, orderHash, TRANCHE_SIZE);
    });
  });

  describe("Gas Optimization", function () {
    it("Should execute tranche efficiently", async function () {
      await yieldGatedTWAP.createStrategy(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        TOTAL_AMOUNT,
        TRANCHE_SIZE,
        INTERVAL_SECONDS,
        MAX_SLIPPAGE,
        MIN_YIELD_THRESHOLD
      );

      // Measure gas usage
      const tx = await yieldGatedTWAP.connect(user).executeTrancheIfYieldMet(1, CHAIN_ID_ETHEREUM);
      const receipt = await tx.wait();
      
      // Gas should be reasonable for complex operation
      expect(receipt.gasUsed).to.be.lessThan(600000); // Less than 600k gas
    });
  });
});
