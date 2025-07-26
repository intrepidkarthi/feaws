const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("HTLC - Hash Time Locked Contract", function () {
    let htlc, mockUSDC, mockStETH;
    let owner, alice, bob, charlie;
    let preimage, hashLock;
    
    const INITIAL_SUPPLY = ethers.parseEther("1000000");
    const SWAP_AMOUNT = ethers.parseUnits("1000", 6); // USDC has 6 decimals
    const OUTPUT_AMOUNT = ethers.parseEther("950"); // stETH has 18 decimals
    
    beforeEach(async function () {
        [owner, alice, bob, charlie] = await ethers.getSigners();
        
        // Deploy mock tokens
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const MockStETH = await ethers.getContractFactory("MockStETH");
        
        mockUSDC = await MockUSDC.deploy();
        mockStETH = await MockStETH.deploy();
        
        await mockUSDC.waitForDeployment();
        await mockStETH.waitForDeployment();
        
        // Deploy HTLC contract
        const HTLC = await ethers.getContractFactory("HTLC");
        htlc = await HTLC.deploy();
        await htlc.waitForDeployment();
        
        // Setup test data
        preimage = ethers.keccak256(ethers.toUtf8Bytes("secret123"));
        hashLock = await htlc.generateHashLock(preimage);
        
        // Mint tokens to deployer first (MockUSDC and MockStETH mint to deployer by default)
        // Then distribute tokens
        await mockUSDC.transfer(alice.address, SWAP_AMOUNT * 2n);
        await mockStETH.transfer(bob.address, OUTPUT_AMOUNT * 2n);
        
        // Approve HTLC contract
        await mockUSDC.connect(alice).approve(await htlc.getAddress(), SWAP_AMOUNT * 2n);
        await mockStETH.connect(bob).approve(await htlc.getAddress(), OUTPUT_AMOUNT * 2n);
    });
    
    describe("Deployment", function () {
        it("Should deploy with correct constants", async function () {
            expect(await htlc.MIN_TIME_LOCK()).to.equal(3600); // 1 hour
            expect(await htlc.MAX_TIME_LOCK()).to.equal(172800); // 48 hours
        });
        
        it("Should generate correct hash locks", async function () {
            const testPreimage = ethers.keccak256(ethers.toUtf8Bytes("test"));
            const expectedHash = ethers.sha256(testPreimage);
            const actualHash = await htlc.generateHashLock(testPreimage);
            expect(actualHash).to.equal(expectedHash);
        });
    });
    
    describe("Opening Swaps", function () {
        it("Should open a swap successfully", async function () {
            const expiration = (await time.latest()) + 7200; // 2 hours
            
            const tx = await htlc.connect(alice).openSwap(
                bob.address,
                hashLock,
                expiration,
                await mockUSDC.getAddress(),
                SWAP_AMOUNT,
                await mockStETH.getAddress(),
                OUTPUT_AMOUNT
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return htlc.interface.parseLog(log).name === 'SwapOpened';
                } catch {
                    return false;
                }
            });
            
            expect(event).to.not.be.undefined;
            
            const parsedEvent = htlc.interface.parseLog(event);
            expect(parsedEvent.args.sender).to.equal(alice.address);
            expect(parsedEvent.args.receiver).to.equal(bob.address);
            expect(parsedEvent.args.hashLock).to.equal(hashLock);
            expect(parsedEvent.args.inputAmount).to.equal(SWAP_AMOUNT);
        });
        
        it("Should transfer tokens to contract", async function () {
            const expiration = (await time.latest()) + 7200;
            const initialBalance = await mockUSDC.balanceOf(alice.address);
            
            await htlc.connect(alice).openSwap(
                bob.address,
                hashLock,
                expiration,
                await mockUSDC.getAddress(),
                SWAP_AMOUNT,
                await mockStETH.getAddress(),
                OUTPUT_AMOUNT
            );
            
            const finalBalance = await mockUSDC.balanceOf(alice.address);
            const contractBalance = await mockUSDC.balanceOf(await htlc.getAddress());
            
            expect(finalBalance).to.equal(initialBalance - SWAP_AMOUNT);
            expect(contractBalance).to.equal(SWAP_AMOUNT);
        });
        
        it("Should reject invalid parameters", async function () {
            const expiration = (await time.latest()) + 7200;
            
            // Invalid receiver
            await expect(
                htlc.connect(alice).openSwap(
                    ethers.ZeroAddress,
                    hashLock,
                    expiration,
                    await mockUSDC.getAddress(),
                    SWAP_AMOUNT,
                    await mockStETH.getAddress(),
                    OUTPUT_AMOUNT
                )
            ).to.be.revertedWith("HTLC: Invalid receiver");
            
            // Invalid hash lock
            await expect(
                htlc.connect(alice).openSwap(
                    bob.address,
                    ethers.ZeroHash,
                    expiration,
                    await mockUSDC.getAddress(),
                    SWAP_AMOUNT,
                    await mockStETH.getAddress(),
                    OUTPUT_AMOUNT
                )
            ).to.be.revertedWith("HTLC: Invalid hash lock");
            
            // Invalid expiration (too short)
            await expect(
                htlc.connect(alice).openSwap(
                    bob.address,
                    hashLock,
                    (await time.latest()) + 1800, // 30 minutes
                    await mockUSDC.getAddress(),
                    SWAP_AMOUNT,
                    await mockStETH.getAddress(),
                    OUTPUT_AMOUNT
                )
            ).to.be.revertedWith("HTLC: Invalid expiration");
        });
    });
    
    describe("Closing Swaps", function () {
        let swapId;
        
        beforeEach(async function () {
            const expiration = (await time.latest()) + 7200;
            const tx = await htlc.connect(alice).openSwap(
                bob.address,
                hashLock,
                expiration,
                await mockUSDC.getAddress(),
                SWAP_AMOUNT,
                await mockStETH.getAddress(),
                OUTPUT_AMOUNT
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return htlc.interface.parseLog(log).name === 'SwapOpened';
                } catch {
                    return false;
                }
            });
            
            swapId = htlc.interface.parseLog(event).args.swapId;
        });
        
        it("Should close swap with correct preimage", async function () {
            const initialBalance = await mockUSDC.balanceOf(bob.address);
            
            await htlc.connect(bob).closeSwap(swapId, preimage);
            
            const finalBalance = await mockUSDC.balanceOf(bob.address);
            expect(finalBalance).to.equal(initialBalance + SWAP_AMOUNT);
            
            const swap = await htlc.getSwap(swapId);
            expect(swap.state).to.equal(2); // CLOSED
            expect(swap.preimage).to.equal(preimage);
        });
        
        it("Should emit SwapClosed event", async function () {
            await expect(htlc.connect(bob).closeSwap(swapId, preimage))
                .to.emit(htlc, "SwapClosed")
                .withArgs(swapId, preimage);
        });
        
        it("Should reject invalid preimage", async function () {
            const wrongPreimage = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
            
            await expect(
                htlc.connect(bob).closeSwap(swapId, wrongPreimage)
            ).to.be.revertedWith("HTLC: Invalid preimage");
        });
        
        it("Should reject closing after expiration", async function () {
            // Fast forward past expiration
            await time.increase(7300); // 2+ hours
            
            await expect(
                htlc.connect(bob).closeSwap(swapId, preimage)
            ).to.be.revertedWith("HTLC: Swap expired");
        });
    });
    
    describe("Refunding Swaps", function () {
        let swapId;
        
        beforeEach(async function () {
            const expiration = (await time.latest()) + 7200;
            const tx = await htlc.connect(alice).openSwap(
                bob.address,
                hashLock,
                expiration,
                await mockUSDC.getAddress(),
                SWAP_AMOUNT,
                await mockStETH.getAddress(),
                OUTPUT_AMOUNT
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return htlc.interface.parseLog(log).name === 'SwapOpened';
                } catch {
                    return false;
                }
            });
            
            swapId = htlc.interface.parseLog(event).args.swapId;
        });
        
        it("Should refund expired swap to sender", async function () {
            // Fast forward past expiration
            await time.increase(7300);
            
            const initialBalance = await mockUSDC.balanceOf(alice.address);
            
            await htlc.connect(alice).refundSwap(swapId);
            
            const finalBalance = await mockUSDC.balanceOf(alice.address);
            expect(finalBalance).to.equal(initialBalance + SWAP_AMOUNT);
            
            const swap = await htlc.getSwap(swapId);
            expect(swap.state).to.equal(3); // EXPIRED
        });
        
        it("Should emit refund events", async function () {
            await time.increase(7300);
            
            await expect(htlc.connect(alice).refundSwap(swapId))
                .to.emit(htlc, "SwapExpired")
                .withArgs(swapId)
                .and.to.emit(htlc, "SwapRefunded")
                .withArgs(swapId);
        });
        
        it("Should reject refund before expiration", async function () {
            await expect(
                htlc.connect(alice).refundSwap(swapId)
            ).to.be.revertedWith("HTLC: Swap not expired");
        });
        
        it("Should reject refund from non-sender", async function () {
            await time.increase(7300);
            
            await expect(
                htlc.connect(bob).refundSwap(swapId)
            ).to.be.revertedWith("HTLC: Only sender can refund");
        });
    });
    
    describe("Swap State Queries", function () {
        let swapId;
        
        beforeEach(async function () {
            const expiration = (await time.latest()) + 7200;
            const tx = await htlc.connect(alice).openSwap(
                bob.address,
                hashLock,
                expiration,
                await mockUSDC.getAddress(),
                SWAP_AMOUNT,
                await mockStETH.getAddress(),
                OUTPUT_AMOUNT
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return htlc.interface.parseLog(log).name === 'SwapOpened';
                } catch {
                    return false;
                }
            });
            
            swapId = htlc.interface.parseLog(event).args.swapId;
        });
        
        it("Should correctly report swap state", async function () {
            expect(await htlc.isSwapOpen(swapId)).to.be.true;
            expect(await htlc.isSwapExpired(swapId)).to.be.false;
            
            const timeRemaining = await htlc.getSwapTimeRemaining(swapId);
            expect(timeRemaining).to.be.gt(7000); // Should be close to 7200
        });
        
        it("Should correctly report expired state", async function () {
            await time.increase(7300);
            
            expect(await htlc.isSwapOpen(swapId)).to.be.false;
            expect(await htlc.isSwapExpired(swapId)).to.be.true;
            expect(await htlc.getSwapTimeRemaining(swapId)).to.equal(0);
        });
        
        it("Should correctly report closed state", async function () {
            await htlc.connect(bob).closeSwap(swapId, preimage);
            
            expect(await htlc.isSwapOpen(swapId)).to.be.false;
            expect(await htlc.isSwapExpired(swapId)).to.be.false;
        });
    });
    
    describe("Cross-Chain Simulation", function () {
        it("Should simulate atomic cross-chain swap", async function () {
            // Simulate Alice on Chain A wanting to swap USDC for stETH on Chain B
            const expiration = (await time.latest()) + 7200;
            
            // Step 1: Alice opens HTLC on Chain A (Sepolia) with USDC
            const tx1 = await htlc.connect(alice).openSwap(
                bob.address,
                hashLock,
                expiration,
                await mockUSDC.getAddress(),
                SWAP_AMOUNT,
                await mockStETH.getAddress(),
                OUTPUT_AMOUNT
            );
            
            const receipt1 = await tx1.wait();
            const event1 = receipt1.logs.find(log => {
                try {
                    return htlc.interface.parseLog(log).name === 'SwapOpened';
                } catch {
                    return false;
                }
            });
            const swapId1 = htlc.interface.parseLog(event1).args.swapId;
            
            // Step 2: Bob opens corresponding HTLC on Chain B (Etherlink) with stETH
            const tx2 = await htlc.connect(bob).openSwap(
                alice.address,
                hashLock,
                expiration - 1800, // 30 minutes earlier expiration
                await mockStETH.getAddress(),
                OUTPUT_AMOUNT,
                await mockUSDC.getAddress(),
                SWAP_AMOUNT
            );
            
            const receipt2 = await tx2.wait();
            const event2 = receipt2.logs.find(log => {
                try {
                    return htlc.interface.parseLog(log).name === 'SwapOpened';
                } catch {
                    return false;
                }
            });
            const swapId2 = htlc.interface.parseLog(event2).args.swapId;
            
            // Step 3: Alice claims stETH on Chain B by revealing preimage
            await htlc.connect(alice).closeSwap(swapId2, preimage);
            
            // Step 4: Bob uses the revealed preimage to claim USDC on Chain A
            await htlc.connect(bob).closeSwap(swapId1, preimage);
            
            // Verify final balances
            const aliceUSDCBalance = await mockUSDC.balanceOf(alice.address);
            const aliceStETHBalance = await mockStETH.balanceOf(alice.address);
            const bobUSDCBalance = await mockUSDC.balanceOf(bob.address);
            const bobStETHBalance = await mockStETH.balanceOf(bob.address);
            
            expect(aliceUSDCBalance).to.equal(SWAP_AMOUNT); // Alice got USDC back through Bob's claim
            expect(aliceStETHBalance).to.equal(OUTPUT_AMOUNT); // Alice got stETH
            expect(bobUSDCBalance).to.equal(SWAP_AMOUNT); // Bob got USDC
            expect(bobStETHBalance).to.equal(OUTPUT_AMOUNT); // Bob's remaining stETH
            
            // Verify both swaps are closed
            const swap1 = await htlc.getSwap(swapId1);
            const swap2 = await htlc.getSwap(swapId2);
            expect(swap1.state).to.equal(2); // CLOSED
            expect(swap2.state).to.equal(2); // CLOSED
            expect(swap1.preimage).to.equal(preimage);
            expect(swap2.preimage).to.equal(preimage);
        });
    });
    
    describe("Integration with Yield Arbitrage", function () {
        it("Should demonstrate HTLC usage in yield arbitrage scenario", async function () {
            // Scenario: Alice detects 2% yield advantage on Etherlink
            // She wants to move 1000 USDC from Sepolia to Etherlink
            
            const expiration = (await time.latest()) + 7200;
            const arbitrageAmount = ethers.parseUnits("1000", 6); // USDC has 6 decimals
            const expectedReturn = ethers.parseEther("1020"); // stETH has 18 decimals
            
            // Ensure Bob has enough stETH and allowance for this test
            await mockStETH.transfer(bob.address, expectedReturn);
            await mockStETH.connect(bob).approve(await htlc.getAddress(), expectedReturn);
            
            // Alice opens HTLC to swap USDC for yield-bearing position
            const tx = await htlc.connect(alice).openSwap(
                bob.address, // Bob acts as liquidity provider on Etherlink
                hashLock,
                expiration,
                await mockUSDC.getAddress(),
                arbitrageAmount,
                await mockStETH.getAddress(), // Represents yield-bearing asset
                expectedReturn
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return htlc.interface.parseLog(log).name === 'SwapOpened';
                } catch {
                    return false;
                }
            });
            const swapId = htlc.interface.parseLog(event).args.swapId;
            
            // Verify swap details match arbitrage parameters
            const swap = await htlc.getSwap(swapId);
            expect(swap.inputAmount).to.equal(arbitrageAmount);
            expect(swap.outputAmount).to.equal(expectedReturn);
            expect(swap.inputToken).to.equal(await mockUSDC.getAddress());
            expect(swap.outputToken).to.equal(await mockStETH.getAddress());
            
            // In a real cross-chain scenario, Bob would open a corresponding swap on the other chain
            // For this test, we'll simulate Bob providing liquidity by closing Alice's swap
            // This means Bob gets Alice's USDC and Alice should receive the stETH
            
            const aliceStETHBefore = await mockStETH.balanceOf(alice.address);
            const bobUSDCBefore = await mockUSDC.balanceOf(bob.address);
            
            // Bob closes the swap by revealing the preimage, which should transfer Alice's USDC to Bob
            await htlc.connect(bob).closeSwap(swapId, preimage);
            
            // Verify Bob received Alice's USDC
            const bobUSDCAfter = await mockUSDC.balanceOf(bob.address);
            expect(bobUSDCAfter).to.equal(bobUSDCBefore + arbitrageAmount);
            
            // In this HTLC design, Alice doesn't automatically receive stETH from this swap
            // She would need a corresponding swap on the other chain
            // For the test, let's verify the swap was properly closed
            const finalSwap = await htlc.getSwap(swapId);
            expect(finalSwap.state).to.equal(2); // CLOSED
            expect(finalSwap.preimage).to.equal(preimage);
        });
    });
});
