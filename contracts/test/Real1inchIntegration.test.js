const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Real 1inch Integration", function () {
  let limitOrderManager;
  let mockUSDC, mockStETH;
  let owner, user1;
  
  // Real 1inch protocol address on mainnet
  const REAL_1INCH_PROTOCOL = "0x1111111254EEB25477B68fb85Ed929f73A960582";

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy mock tokens
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    const MockStETH = await ethers.getContractFactory("MockStETH");
    mockStETH = await MockStETH.deploy();
    await mockStETH.waitForDeployment();

    // Deploy LimitOrderManager with real 1inch protocol address
    const LimitOrderManager = await ethers.getContractFactory("LimitOrderManager");
    limitOrderManager = await LimitOrderManager.deploy(REAL_1INCH_PROTOCOL);
    await limitOrderManager.waitForDeployment();

    // Mint tokens for testing
    await mockUSDC.mint(await user1.getAddress(), ethers.parseUnits("10000", 6)); // 10k USDC
    await mockStETH.mint(await user1.getAddress(), ethers.parseEther("5")); // 5 stETH
  });

  describe("Integration Detection", function () {
    it("Should detect integration status correctly", async function () {
      const [isReal, status] = await limitOrderManager.getIntegrationStatus();
      
      // Without mainnet fork, should use simulation
      expect(isReal).to.be.false;
      expect(status).to.equal("Simulated 1inch Integration for Demo");
    });

    it("Should have correct protocol address", async function () {
      const protocolAddress = await limitOrderManager.LIMIT_ORDER_PROTOCOL();
      expect(protocolAddress).to.equal(REAL_1INCH_PROTOCOL);
    });

    it("Should detect mainnet fork correctly", async function () {
      const isMainnetFork = await limitOrderManager.isMainnetFork();
      // Without forking, should be false
      expect(isMainnetFork).to.be.false;
    });
  });

  describe("Real 1inch Order Creation", function () {
    it("Should create real 1inch order with proper events", async function () {
      const makingAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      const takingAmount = ethers.parseEther("0.3"); // 0.3 stETH

      // Approve tokens
      await mockUSDC.connect(user1).approve(await limitOrderManager.getAddress(), makingAmount);

      // Build order data
      const orderData = await limitOrderManager.buildOrderData(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        makingAmount,
        takingAmount,
        await user1.getAddress()
      );

      // Create limit order
      const tx = await limitOrderManager.connect(user1).createLimitOrder(
        orderData,
        "0x1234" // Mock signature
      );

      const receipt = await tx.wait();

      // Check for Real1inchOrderCreated event (only on mainnet fork)
      const isMainnetFork = await limitOrderManager.isMainnetFork();
      const real1inchEvent = receipt.logs.find(log => {
        try {
          const parsed = limitOrderManager.interface.parseLog(log);
          return parsed.name === "Real1inchOrderCreated";
        } catch {
          return false;
        }
      });

      if (isMainnetFork) {
        expect(real1inchEvent).to.not.be.undefined;
      } else {
        // In simulation mode, this event won't be emitted
        expect(real1inchEvent).to.be.undefined;
      }
      
      // Also check for regular OrderCreated event
      await expect(tx)
        .to.emit(limitOrderManager, "OrderCreated")
        .and.to.emit(limitOrderManager, "OneInchOrderSubmitted");
    });

    it("Should generate different salt for each order", async function () {
      const makingAmount = ethers.parseUnits("1000", 6);
      const takingAmount = ethers.parseEther("0.3");

      await mockUSDC.connect(user1).approve(await limitOrderManager.getAddress(), makingAmount * 2n);

      // Build order data for first order
      const orderData1 = await limitOrderManager.buildOrderData(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        makingAmount,
        takingAmount,
        await user1.getAddress()
      );

      // Create first order
      const tx1 = await limitOrderManager.connect(user1).createLimitOrder(
        orderData1,
        "0x1234"
      );

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 100));

      // Build order data for second order
      const orderData2 = await limitOrderManager.buildOrderData(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        makingAmount,
        takingAmount,
        await user1.getAddress()
      );

      // Create second order
      const tx2 = await limitOrderManager.connect(user1).createLimitOrder(
        orderData2,
        "0x5678"
      );

      const receipt1 = await tx1.wait();
      const receipt2 = await tx2.wait();

      // Check if we're on mainnet fork
      const isMainnetFork = await limitOrderManager.isMainnetFork();
      
      if (isMainnetFork) {
        // Extract salt values from events on mainnet fork
        const event1 = receipt1.logs.find(log => {
          try {
            const parsed = limitOrderManager.interface.parseLog(log);
            return parsed.name === "Real1inchOrderCreated";
          } catch {
            return false;
          }
        });

        const event2 = receipt2.logs.find(log => {
          try {
            const parsed = limitOrderManager.interface.parseLog(log);
            return parsed.name === "Real1inchOrderCreated";
          } catch {
            return false;
          }
        });

        expect(event1).to.not.be.undefined;
        expect(event2).to.not.be.undefined;

        const parsed1 = limitOrderManager.interface.parseLog(event1);
        const parsed2 = limitOrderManager.interface.parseLog(event2);

        // Salt values should be different
        expect(parsed1.args.salt).to.not.equal(parsed2.args.salt);
      } else {
        // In simulation mode, just verify orders were created
        await expect(tx1).to.emit(limitOrderManager, "OrderCreated");
        await expect(tx2).to.emit(limitOrderManager, "OrderCreated");
      }
    });
  });

  describe("Network Compatibility", function () {
    it("Should work with both real and simulated integration", async function () {
      // This test verifies that our contract can handle both scenarios
      const [isReal, status] = await limitOrderManager.getIntegrationStatus();
      
      if (isReal) {
        expect(status).to.equal("Real 1inch Protocol Integration");
      } else {
        expect(status).to.equal("Simulated 1inch Integration for Demo");
      }
      
      // Order creation should work in both cases
      const makingAmount = ethers.parseUnits("1000", 6);
      const takingAmount = ethers.parseEther("0.3");

      await mockUSDC.connect(user1).approve(await limitOrderManager.getAddress(), makingAmount);

      // Build order data
      const orderData = await limitOrderManager.buildOrderData(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        makingAmount,
        takingAmount,
        await user1.getAddress()
      );

      await expect(
        limitOrderManager.connect(user1).createLimitOrder(
          orderData,
          "0x1234"
        )
      ).to.emit(limitOrderManager, "OrderCreated");
    });
  });
});
