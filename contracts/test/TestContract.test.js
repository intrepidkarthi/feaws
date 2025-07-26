const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TestContract", function () {
  let testContract;

  beforeEach(async function () {
    const TestContract = await ethers.getContractFactory("TestContract");
    testContract = await TestContract.deploy();
    await testContract.deployed();
  });

  it("Should return the correct message", async function () {
    const message = await testContract.getMessage();
    expect(message).to.equal("ETHGlobal UNITE - Step 1 Foundation Setup Complete");
  });

  it("Should have the message set in constructor", async function () {
    const message = await testContract.message();
    expect(message).to.equal("ETHGlobal UNITE - Step 1 Foundation Setup Complete");
  });
});
