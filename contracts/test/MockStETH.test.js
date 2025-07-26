const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockStETH", function () {
  let mockStETH;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const MockStETH = await ethers.getContractFactory("MockStETH");
    mockStETH = await MockStETH.deploy();
    await mockStETH.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await mockStETH.name()).to.equal("Mock Liquid Staked Ether");
      expect(await mockStETH.symbol()).to.equal("stETH");
    });

    it("Should have 18 decimals like real stETH", async function () {
      expect(await mockStETH.decimals()).to.equal(18);
    });

    it("Should mint initial supply to deployer", async function () {
      const expectedSupply = ethers.parseEther("1000000"); // 1M stETH
      expect(await mockStETH.totalSupply()).to.equal(expectedSupply);
      expect(await mockStETH.balanceOf(owner.address)).to.equal(expectedSupply);
    });

    it("Should set deployer as owner", async function () {
      expect(await mockStETH.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000"); // 1000 stETH
      
      await expect(mockStETH.mint(user1.address, mintAmount))
        .to.emit(mockStETH, "TokensMinted")
        .withArgs(user1.address, mintAmount);
      
      expect(await mockStETH.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should not allow non-owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(
        mockStETH.connect(user1).mint(user2.address, mintAmount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      // Give user1 some tokens first
      const mintAmount = ethers.parseEther("1000");
      await mockStETH.mint(user1.address, mintAmount);
    });

    it("Should allow owner to burn tokens", async function () {
      const burnAmount = ethers.parseEther("500");
      const initialBalance = await mockStETH.balanceOf(user1.address);
      
      await expect(mockStETH.burn(user1.address, burnAmount))
        .to.emit(mockStETH, "TokensBurned")
        .withArgs(user1.address, burnAmount);
      
      expect(await mockStETH.balanceOf(user1.address)).to.equal(
        initialBalance - burnAmount
      );
    });

    it("Should not allow non-owner to burn tokens", async function () {
      const burnAmount = ethers.parseEther("500");
      
      await expect(
        mockStETH.connect(user1).burn(user1.address, burnAmount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Yield Accrual", function () {
    it("Should accrue yield correctly", async function () {
      const initialSupply = await mockStETH.totalSupply();
      const yieldBasisPoints = 380; // 3.8%
      
      await expect(mockStETH.accrueYield(yieldBasisPoints))
        .to.emit(mockStETH, "YieldAccrued");
      
      const newSupply = await mockStETH.totalSupply();
      const expectedYield = (initialSupply * BigInt(yieldBasisPoints)) / BigInt(10000);
      
      expect(newSupply).to.equal(initialSupply + expectedYield);
    });

    it("Should not accrue yield for zero basis points", async function () {
      const initialSupply = await mockStETH.totalSupply();
      
      await mockStETH.accrueYield(0);
      
      expect(await mockStETH.totalSupply()).to.equal(initialSupply);
    });

    it("Should only allow owner to accrue yield", async function () {
      await expect(
        mockStETH.connect(user1).accrueYield(380)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Rebase Simulation", function () {
    it("Should simulate rebase with 0.1% yield", async function () {
      const initialSupply = await mockStETH.totalSupply();
      
      await expect(mockStETH.simulateRebase())
        .to.emit(mockStETH, "YieldAccrued");
      
      const newSupply = await mockStETH.totalSupply();
      const expectedYield = (initialSupply * BigInt(10)) / BigInt(10000); // 0.1%
      
      expect(newSupply).to.equal(initialSupply + expectedYield);
    });

    it("Should only allow owner to simulate rebase", async function () {
      await expect(
        mockStETH.connect(user1).simulateRebase()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Utility Functions", function () {
    beforeEach(async function () {
      const mintAmount = ethers.parseEther("1000");
      await mockStETH.mint(user1.address, mintAmount);
    });

    it("Should return balance in human readable format", async function () {
      const balance = await mockStETH.balanceInStETH(user1.address);
      expect(balance).to.equal(1000); // 1000 stETH
    });

    it("Should convert stETH to wei correctly", async function () {
      const stethAmount = 1000;
      const weiAmount = await mockStETH.toWei(stethAmount);
      expect(weiAmount).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("Standard ERC20 Functions", function () {
    beforeEach(async function () {
      const mintAmount = ethers.parseEther("1000");
      await mockStETH.mint(user1.address, mintAmount);
    });

    it("Should transfer tokens correctly", async function () {
      const transferAmount = ethers.parseEther("100");
      
      await expect(
        mockStETH.connect(user1).transfer(user2.address, transferAmount)
      ).to.emit(mockStETH, "Transfer")
        .withArgs(user1.address, user2.address, transferAmount);
      
      expect(await mockStETH.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("Should approve and transferFrom correctly", async function () {
      const approveAmount = ethers.parseEther("100");
      
      await mockStETH.connect(user1).approve(user2.address, approveAmount);
      expect(await mockStETH.allowance(user1.address, user2.address)).to.equal(approveAmount);
      
      await mockStETH.connect(user2).transferFrom(user1.address, user2.address, approveAmount);
      expect(await mockStETH.balanceOf(user2.address)).to.equal(approveAmount);
    });
  });
});
