const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockUSDC", function () {
  let mockUSDC;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await mockUSDC.name()).to.equal("Mock USD Coin");
      expect(await mockUSDC.symbol()).to.equal("USDC");
    });

    it("Should have 6 decimals like real USDC", async function () {
      expect(await mockUSDC.decimals()).to.equal(6);
    });

    it("Should mint initial supply to deployer", async function () {
      const expectedSupply = ethers.parseUnits("1000000", 6); // 1M USDC
      expect(await mockUSDC.totalSupply()).to.equal(expectedSupply);
      expect(await mockUSDC.balanceOf(owner.address)).to.equal(expectedSupply);
    });

    it("Should set deployer as owner", async function () {
      expect(await mockUSDC.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      
      await expect(mockUSDC.mint(user1.address, mintAmount))
        .to.emit(mockUSDC, "TokensMinted")
        .withArgs(user1.address, mintAmount);
      
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should not allow non-owner to mint tokens", async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      
      await expect(
        mockUSDC.connect(user1).mint(user2.address, mintAmount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      // Give user1 some tokens first
      const mintAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(user1.address, mintAmount);
    });

    it("Should allow owner to burn tokens", async function () {
      const burnAmount = ethers.parseUnits("500", 6);
      const initialBalance = await mockUSDC.balanceOf(user1.address);
      
      await expect(mockUSDC.burn(user1.address, burnAmount))
        .to.emit(mockUSDC, "TokensBurned")
        .withArgs(user1.address, burnAmount);
      
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(
        initialBalance - burnAmount
      );
    });

    it("Should not allow non-owner to burn tokens", async function () {
      const burnAmount = ethers.parseUnits("500", 6);
      
      await expect(
        mockUSDC.connect(user1).burn(user1.address, burnAmount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Utility Functions", function () {
    beforeEach(async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(user1.address, mintAmount);
    });

    it("Should return balance in human readable format", async function () {
      const balance = await mockUSDC.balanceInUSDC(user1.address);
      expect(balance).to.equal(1000); // 1000 USDC
    });

    it("Should convert USDC to wei correctly", async function () {
      const usdcAmount = 1000;
      const weiAmount = await mockUSDC.toWei(usdcAmount);
      expect(weiAmount).to.equal(ethers.parseUnits("1000", 6));
    });
  });

  describe("Standard ERC20 Functions", function () {
    beforeEach(async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(user1.address, mintAmount);
    });

    it("Should transfer tokens correctly", async function () {
      const transferAmount = ethers.parseUnits("100", 6);
      
      await expect(
        mockUSDC.connect(user1).transfer(user2.address, transferAmount)
      ).to.emit(mockUSDC, "Transfer")
        .withArgs(user1.address, user2.address, transferAmount);
      
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("Should approve and transferFrom correctly", async function () {
      const approveAmount = ethers.parseUnits("100", 6);
      
      await mockUSDC.connect(user1).approve(user2.address, approveAmount);
      expect(await mockUSDC.allowance(user1.address, user2.address)).to.equal(approveAmount);
      
      await mockUSDC.connect(user2).transferFrom(user1.address, user2.address, approveAmount);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(approveAmount);
    });
  });
});
