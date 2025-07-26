const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("YieldOracle", function () {
  let yieldOracle;
  let owner;
  let user1;
  let user2;
  
  // Mock asset addresses
  const mockUSDC = "0x0000000000000000000000000000000000000001";
  const mockStETH = "0x0000000000000000000000000000000000000002";
  
  // Chain IDs
  const ETHEREUM_MAINNET = 1;
  const SEPOLIA = 11155111;
  const ETHERLINK = 128123;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const YieldOracle = await ethers.getContractFactory("YieldOracle");
    yieldOracle = await YieldOracle.deploy();
    await yieldOracle.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await yieldOracle.owner()).to.equal(owner.address);
    });

    it("Should initialize with correct global threshold", async function () {
      expect(await yieldOracle.globalYieldThreshold()).to.equal(380); // 3.8%
    });

    it("Should support initial chains", async function () {
      expect(await yieldOracle.supportedChains(ETHEREUM_MAINNET)).to.be.true;
      expect(await yieldOracle.supportedChains(SEPOLIA)).to.be.true;
      expect(await yieldOracle.supportedChains(ETHERLINK)).to.be.true;
    });

    it("Should support initial assets", async function () {
      expect(await yieldOracle.supportedAssets(mockUSDC)).to.be.true;
      expect(await yieldOracle.supportedAssets(mockStETH)).to.be.true;
    });

    it("Should set initial demo yields", async function () {
      // Check Sepolia stETH yield (3.2%)
      const [sepoliaYield, , sepoliaActive] = await yieldOracle.getYield(SEPOLIA, mockStETH);
      expect(sepoliaYield).to.equal(320);
      expect(sepoliaActive).to.be.true;
      
      // Check Etherlink stETH yield (4.1%)
      const [etherlinkYield, , etherlinkActive] = await yieldOracle.getYield(ETHERLINK, mockStETH);
      expect(etherlinkYield).to.equal(410);
      expect(etherlinkActive).to.be.true;
    });
  });

  describe("Yield Management", function () {
    it("Should allow owner to set yield rates", async function () {
      const newYield = 450; // 4.5%
      
      await expect(yieldOracle.setYield(SEPOLIA, mockStETH, newYield))
        .to.emit(yieldOracle, "YieldUpdated")
        .withArgs(SEPOLIA, mockStETH, 320, newYield, await getLatestTimestamp());
      
      const [yieldRate, , isActive] = await yieldOracle.getYield(SEPOLIA, mockStETH);
      expect(yieldRate).to.equal(newYield);
      expect(isActive).to.be.true;
    });

    it("Should not allow non-owner to set yield rates", async function () {
      await expect(
        yieldOracle.connect(user1).setYield(SEPOLIA, mockStETH, 450)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should reject yield rates that are too high", async function () {
      await expect(
        yieldOracle.setYield(SEPOLIA, mockStETH, 2001) // 20.01%
      ).to.be.revertedWith("Yield rate too high (max 20%)");
    });

    it("Should reject unsupported chains", async function () {
      const unsupportedChain = 999;
      await expect(
        yieldOracle.setYield(unsupportedChain, mockStETH, 400)
      ).to.be.revertedWith("Chain not supported");
    });

    it("Should reject unsupported assets", async function () {
      const unsupportedAsset = "0x0000000000000000000000000000000000000999";
      await expect(
        yieldOracle.setYield(SEPOLIA, unsupportedAsset, 400)
      ).to.be.revertedWith("Asset not supported");
    });
  });

  describe("Threshold Checking", function () {
    it("Should correctly identify yields above threshold", async function () {
      // Etherlink stETH (4.1%) should be above threshold (3.8%)
      expect(await yieldOracle.isYieldAboveThreshold(ETHERLINK, mockStETH)).to.be.true;
    });

    it("Should correctly identify yields below threshold", async function () {
      // Sepolia stETH (3.2%) should be below threshold (3.8%)
      expect(await yieldOracle.isYieldAboveThreshold(SEPOLIA, mockStETH)).to.be.false;
    });

    it("Should return false for inactive yield sources", async function () {
      // Deactivate Etherlink stETH
      await yieldOracle.setYieldSourceActive(ETHERLINK, mockStETH, false);
      
      // Should return false even though yield is above threshold
      expect(await yieldOracle.isYieldAboveThreshold(ETHERLINK, mockStETH)).to.be.false;
    });
  });

  describe("Best Yield Discovery", function () {
    it("Should find the best yield across chains", async function () {
      // Set different yields
      await yieldOracle.setYield(SEPOLIA, mockStETH, 350); // 3.5%
      await yieldOracle.setYield(ETHERLINK, mockStETH, 420); // 4.2%
      
      const [bestChain, bestYield] = await yieldOracle.getBestYield(mockStETH);
      expect(bestChain).to.equal(ETHERLINK);
      expect(bestYield).to.equal(420);
    });

    it("Should ignore inactive yield sources when finding best yield", async function () {
      // Set Etherlink to highest yield but inactive
      await yieldOracle.setYield(ETHERLINK, mockStETH, 500); // 5.0%
      await yieldOracle.setYieldSourceActive(ETHERLINK, mockStETH, false);
      
      // Set Sepolia to lower but active yield
      await yieldOracle.setYield(SEPOLIA, mockStETH, 400); // 4.0%
      
      const [bestChain, bestYield] = await yieldOracle.getBestYield(mockStETH);
      expect(bestChain).to.equal(SEPOLIA);
      expect(bestYield).to.equal(400);
    });
  });

  describe("Global Threshold Management", function () {
    it("Should allow owner to update global threshold", async function () {
      const newThreshold = 400; // 4.0%
      
      await expect(yieldOracle.setGlobalThreshold(newThreshold))
        .to.emit(yieldOracle, "ThresholdUpdated")
        .withArgs(380, newThreshold);
      
      expect(await yieldOracle.globalYieldThreshold()).to.equal(newThreshold);
    });

    it("Should not allow non-owner to update threshold", async function () {
      await expect(
        yieldOracle.connect(user1).setGlobalThreshold(400)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should reject threshold that is too high", async function () {
      await expect(
        yieldOracle.setGlobalThreshold(1001) // 10.01%
      ).to.be.revertedWith("Threshold too high (max 10%)");
    });
  });

  describe("Chain and Asset Management", function () {
    it("Should allow owner to add new chains", async function () {
      const newChainId = 137; // Polygon
      const chainName = "Polygon";
      
      await expect(yieldOracle.addChain(newChainId, chainName))
        .to.emit(yieldOracle, "ChainAdded")
        .withArgs(newChainId, chainName);
      
      expect(await yieldOracle.supportedChains(newChainId)).to.be.true;
    });

    it("Should allow owner to add new assets", async function () {
      const newAsset = "0x0000000000000000000000000000000000000003";
      const assetSymbol = "DAI";
      
      await expect(yieldOracle.addAsset(newAsset, assetSymbol))
        .to.emit(yieldOracle, "AssetAdded")
        .withArgs(newAsset, assetSymbol);
      
      expect(await yieldOracle.supportedAssets(newAsset)).to.be.true;
    });

    it("Should not allow adding zero address as asset", async function () {
      await expect(
        yieldOracle.addAsset(ethers.ZeroAddress, "INVALID")
      ).to.be.revertedWith("Invalid asset address");
    });

    it("Should not allow non-owner to add chains or assets", async function () {
      await expect(
        yieldOracle.connect(user1).addChain(137, "Polygon")
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(
        yieldOracle.connect(user1).addAsset("0x0000000000000000000000000000000000000003", "DAI")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Yield Source Activation", function () {
    it("Should allow owner to activate/deactivate yield sources", async function () {
      // Deactivate
      await expect(yieldOracle.setYieldSourceActive(ETHERLINK, mockStETH, false))
        .to.emit(yieldOracle, "YieldSourceDeactivated")
        .withArgs(ETHERLINK, mockStETH);
      
      const [, , isActive1] = await yieldOracle.getYield(ETHERLINK, mockStETH);
      expect(isActive1).to.be.false;
      
      // Reactivate
      await expect(yieldOracle.setYieldSourceActive(ETHERLINK, mockStETH, true))
        .to.emit(yieldOracle, "YieldSourceActivated")
        .withArgs(ETHERLINK, mockStETH);
      
      const [, , isActive2] = await yieldOracle.getYield(ETHERLINK, mockStETH);
      expect(isActive2).to.be.true;
    });

    it("Should not allow non-owner to activate/deactivate yield sources", async function () {
      await expect(
        yieldOracle.connect(user1).setYieldSourceActive(ETHERLINK, mockStETH, false)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Utility Functions", function () {
    it("Should return correct supported chain IDs", async function () {
      const chainIds = await yieldOracle.getSupportedChainIds();
      expect(chainIds).to.deep.equal([
        BigInt(ETHEREUM_MAINNET),
        BigInt(SEPOLIA),
        BigInt(ETHERLINK)
      ]);
    });
  });

  // Helper function to get latest block timestamp
  async function getLatestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});
