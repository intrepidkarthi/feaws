const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LimitOrderManager", function () {
  let limitOrderManager;
  let mockUSDC;
  let mockStETH;
  let owner;
  let user1;
  let user2;
  
  // Mock 1inch protocol address
  const MOCK_PROTOCOL_ADDRESS = "0x1111111254EEB25477B68fb85Ed929f73A960582";

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    
    const MockStETH = await ethers.getContractFactory("MockStETH");
    mockStETH = await MockStETH.deploy();
    await mockStETH.waitForDeployment();
    
    // Deploy LimitOrderManager
    const LimitOrderManager = await ethers.getContractFactory("LimitOrderManager");
    limitOrderManager = await LimitOrderManager.deploy(MOCK_PROTOCOL_ADDRESS);
    await limitOrderManager.waitForDeployment();
    
    // Setup token balances
    await mockUSDC.mint(user1.address, ethers.parseUnits("10000", 6)); // 10k USDC
    await mockStETH.mint(user2.address, ethers.parseEther("1000")); // 1k stETH
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await limitOrderManager.owner()).to.equal(owner.address);
    });

    it("Should set the correct 1inch protocol address", async function () {
      expect(await limitOrderManager.LIMIT_ORDER_PROTOCOL()).to.equal(MOCK_PROTOCOL_ADDRESS);
    });

    it("Should reject zero address for protocol", async function () {
      const LimitOrderManager = await ethers.getContractFactory("LimitOrderManager");
      await expect(
        LimitOrderManager.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid protocol address");
    });

    it("Should initialize with zero orders", async function () {
      expect(await limitOrderManager.getTotalOrders()).to.equal(0);
      expect(await limitOrderManager.getActiveOrdersCount()).to.equal(0);
    });
  });

  describe("Order Creation", function () {
    let orderData;
    let signature;

    beforeEach(async function () {
      // Build order data: 1000 USDC -> 0.3 stETH
      orderData = await limitOrderManager.buildOrderData(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        ethers.parseUnits("1000", 6), // 1000 USDC
        ethers.parseEther("0.3"), // 0.3 stETH
        user1.address
      );
      
      // Mock signature
      signature = "0x1234567890abcdef";
    });

    it("Should create a limit order successfully", async function () {
      await expect(
        limitOrderManager.connect(user1).createLimitOrder(orderData, signature)
      ).to.emit(limitOrderManager, "OrderCreated");
      
      expect(await limitOrderManager.getTotalOrders()).to.equal(1);
      expect(await limitOrderManager.getActiveOrdersCount()).to.equal(1);
    });

    it("Should emit OneInchOrderSubmitted event", async function () {
      await expect(
        limitOrderManager.connect(user1).createLimitOrder(orderData, signature)
      ).to.emit(limitOrderManager, "OneInchOrderSubmitted");
    });

    it("Should store order information correctly", async function () {
      const tx = await limitOrderManager.connect(user1).createLimitOrder(orderData, signature);
      const receipt = await tx.wait();
      
      // Get order hash from event
      const event = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "OrderCreated"
      );
      const orderHash = event.args[0];
      
      const order = await limitOrderManager.getOrder(orderHash);
      expect(order.maker).to.equal(user1.address);
      expect(order.makerAsset).to.equal(await mockUSDC.getAddress());
      expect(order.takerAsset).to.equal(await mockStETH.getAddress());
      expect(order.makingAmount).to.equal(ethers.parseUnits("1000", 6));
      expect(order.takingAmount).to.equal(ethers.parseEther("0.3"));
      expect(order.isActive).to.be.true;
      expect(order.isFilled).to.be.false;
    });

    it("Should track user orders", async function () {
      await limitOrderManager.connect(user1).createLimitOrder(orderData, signature);
      
      const userOrders = await limitOrderManager.getUserOrders(user1.address);
      expect(userOrders.length).to.equal(1);
    });
  });

  describe("Order Filling", function () {
    let orderHash;

    beforeEach(async function () {
      // Create an order first
      const orderData = await limitOrderManager.buildOrderData(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        ethers.parseUnits("1000", 6), // 1000 USDC
        ethers.parseEther("0.3"), // 0.3 stETH
        user1.address
      );
      
      const signature = "0x1234567890abcdef";
      const tx = await limitOrderManager.connect(user1).createLimitOrder(orderData, signature);
      const receipt = await tx.wait();
      
      // Get order hash from event
      const event = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "OrderCreated"
      );
      orderHash = event.args[0];
      
      // Approve tokens for filling
      await mockUSDC.connect(user1).approve(await limitOrderManager.getAddress(), ethers.parseUnits("1000", 6));
      await mockStETH.connect(user2).approve(await limitOrderManager.getAddress(), ethers.parseEther("0.3"));
    });

    it("Should fill an order completely", async function () {
      const takingAmount = ethers.parseEther("0.3");
      
      await expect(
        limitOrderManager.connect(user2).fillOrder(orderHash, takingAmount)
      ).to.emit(limitOrderManager, "OrderFilled")
        .withArgs(orderHash, user2.address, ethers.parseUnits("1000", 6), takingAmount);
      
      const order = await limitOrderManager.getOrder(orderHash);
      expect(order.isFilled).to.be.true;
      expect(order.isActive).to.be.false;
    });

    it("Should fill an order partially", async function () {
      const takingAmount = ethers.parseEther("0.15"); // Half of 0.3
      
      await limitOrderManager.connect(user2).fillOrder(orderHash, takingAmount);
      
      const order = await limitOrderManager.getOrder(orderHash);
      expect(order.isFilled).to.be.false;
      expect(order.isActive).to.be.true;
      expect(order.takingAmount).to.equal(ethers.parseEther("0.15")); // Remaining amount
    });

    it("Should reject filling inactive orders", async function () {
      // Cancel the order first
      await limitOrderManager.connect(user1).cancelOrder(orderHash);
      
      await expect(
        limitOrderManager.connect(user2).fillOrder(orderHash, ethers.parseEther("0.3"))
      ).to.be.revertedWith("Order not active");
    });

    it("Should reject filling with amount too high", async function () {
      await expect(
        limitOrderManager.connect(user2).fillOrder(orderHash, ethers.parseEther("1.0"))
      ).to.be.revertedWith("Amount too high");
    });
  });

  describe("Order Cancellation", function () {
    let orderHash;

    beforeEach(async function () {
      const orderData = await limitOrderManager.buildOrderData(
        await mockUSDC.getAddress(),
        await mockStETH.getAddress(),
        ethers.parseUnits("1000", 6),
        ethers.parseEther("0.3"),
        user1.address
      );
      
      const signature = "0x1234567890abcdef";
      const tx = await limitOrderManager.connect(user1).createLimitOrder(orderData, signature);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "OrderCreated"
      );
      orderHash = event.args[0];
    });

    it("Should allow maker to cancel order", async function () {
      await expect(
        limitOrderManager.connect(user1).cancelOrder(orderHash)
      ).to.emit(limitOrderManager, "OrderCancelled")
        .withArgs(orderHash, user1.address);
      
      const order = await limitOrderManager.getOrder(orderHash);
      expect(order.isActive).to.be.false;
    });

    it("Should allow owner to cancel any order", async function () {
      await expect(
        limitOrderManager.connect(owner).cancelOrder(orderHash)
      ).to.emit(limitOrderManager, "OrderCancelled")
        .withArgs(orderHash, user1.address);
      
      const order = await limitOrderManager.getOrder(orderHash);
      expect(order.isActive).to.be.false;
    });

    it("Should not allow unauthorized cancellation", async function () {
      await expect(
        limitOrderManager.connect(user2).cancelOrder(orderHash)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should not allow cancelling inactive orders", async function () {
      await limitOrderManager.connect(user1).cancelOrder(orderHash);
      
      await expect(
        limitOrderManager.connect(user1).cancelOrder(orderHash)
      ).to.be.revertedWith("Order not active");
    });
  });

  describe("Order Data Building", function () {
    it("Should build order data correctly", async function () {
      const makerAsset = await mockUSDC.getAddress();
      const takerAsset = await mockStETH.getAddress();
      const makingAmount = ethers.parseUnits("1000", 6);
      const takingAmount = ethers.parseEther("0.3");
      const maker = user1.address;
      
      const orderData = await limitOrderManager.buildOrderData(
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        maker
      );
      
      expect(orderData).to.not.be.empty;
      
      // Decode and verify
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["address", "address", "uint256", "uint256", "address", "uint256"],
        orderData
      );
      
      expect(decoded[0]).to.equal(makerAsset);
      expect(decoded[1]).to.equal(takerAsset);
      expect(decoded[2]).to.equal(makingAmount);
      expect(decoded[3]).to.equal(takingAmount);
      expect(decoded[4]).to.equal(maker);
    });
  });

  describe("Statistics and Queries", function () {
    beforeEach(async function () {
      // Create multiple orders
      for (let i = 0; i < 3; i++) {
        const orderData = await limitOrderManager.buildOrderData(
          await mockUSDC.getAddress(),
          await mockStETH.getAddress(),
          ethers.parseUnits("1000", 6),
          ethers.parseEther("0.3"),
          user1.address
        );
        
        await limitOrderManager.connect(user1).createLimitOrder(orderData, "0x1234");
      }
    });

    it("Should return correct total orders count", async function () {
      expect(await limitOrderManager.getTotalOrders()).to.equal(3);
    });

    it("Should return correct active orders count", async function () {
      expect(await limitOrderManager.getActiveOrdersCount()).to.equal(3);
      
      // Cancel one order
      const userOrders = await limitOrderManager.getUserOrders(user1.address);
      await limitOrderManager.connect(user1).cancelOrder(userOrders[0]);
      
      expect(await limitOrderManager.getActiveOrdersCount()).to.equal(2);
    });

    it("Should return user orders correctly", async function () {
      const userOrders = await limitOrderManager.getUserOrders(user1.address);
      expect(userOrders.length).to.equal(3);
      
      // Check that user2 has no orders
      const user2Orders = await limitOrderManager.getUserOrders(user2.address);
      expect(user2Orders.length).to.equal(0);
    });
  });

  // Helper function to get latest block timestamp
  async function getLatestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});
