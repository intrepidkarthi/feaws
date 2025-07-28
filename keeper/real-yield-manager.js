const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

/**
 * REAL Yield Manager - Actual DeFi Protocol Integration
 * No simulations, only real smart contract interactions
 */
class RealYieldManager {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        // REAL CONTRACT ADDRESSES ON POLYGON
        this.contracts = {
            // Lido stMATIC (Polygon)
            stMATIC: {
                address: '0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4',
                abi: [
                    'function submit(uint256 _amount) external payable returns (uint256)',
                    'function balanceOf(address account) external view returns (uint256)',
                    'function getTotalPooledMatic() external view returns (uint256)',
                    'function getTotalShares() external view returns (uint256)'
                ]
            },
            
            // Aave v3 Pool (Polygon)
            aavePool: {
                address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
                abi: [
                    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
                    'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
                    'function getUserAccountData(address user) external view returns (uint256,uint256,uint256,uint256,uint256,uint256)'
                ]
            },
            
            // QuickSwap Router (Polygon)
            quickswapRouter: {
                address: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
                abi: [
                    'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
                    'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)'
                ]
            },
            
            // Token contracts
            WMATIC: {
                address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
                abi: [
                    'function balanceOf(address account) external view returns (uint256)',
                    'function approve(address spender, uint256 amount) external returns (bool)',
                    'function transfer(address to, uint256 amount) external returns (bool)'
                ]
            },
            
            USDC: {
                address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                abi: [
                    'function balanceOf(address account) external view returns (uint256)',
                    'function approve(address spender, uint256 amount) external returns (bool)',
                    'function transfer(address to, uint256 amount) external returns (bool)'
                ]
            }
        };
        
        this.initializeContracts();
    }
    
    initializeContracts() {
        this.stMaticContract = new ethers.Contract(
            this.contracts.stMATIC.address,
            this.contracts.stMATIC.abi,
            this.wallet
        );
        
        this.aavePoolContract = new ethers.Contract(
            this.contracts.aavePool.address,
            this.contracts.aavePool.abi,
            this.wallet
        );
        
        this.wmaticContract = new ethers.Contract(
            this.contracts.WMATIC.address,
            this.contracts.WMATIC.abi,
            this.wallet
        );
        
        this.usdcContract = new ethers.Contract(
            this.contracts.USDC.address,
            this.contracts.USDC.abi,
            this.wallet
        );
    }
    
    /**
     * REAL stMATIC Staking - Actual Lido Protocol Integration
     */
    async stakeToStMATIC(wmaticAmount) {
        console.log(`🥩 REAL stMATIC Staking: ${wmaticAmount} WMATIC`);
        
        try {
            // Convert WMATIC amount to Wei
            const amountWei = ethers.parseUnits(wmaticAmount.toString(), 18);
            
            // Check WMATIC balance
            const wmaticBalance = await this.wmaticContract.balanceOf(this.wallet.address);
            if (wmaticBalance < amountWei) {
                throw new Error(`Insufficient WMATIC balance: ${ethers.formatUnits(wmaticBalance, 18)}`);
            }
            
            // Approve stMATIC contract to spend WMATIC
            console.log('📝 Approving WMATIC for stMATIC contract...');
            const approveTx = await this.wmaticContract.approve(
                this.contracts.stMATIC.address,
                amountWei
            );
            await approveTx.wait();
            console.log(`✅ WMATIC approved: ${approveTx.hash}`);
            
            // Execute staking transaction
            console.log('🔄 Executing stMATIC staking...');
            const stakeTx = await this.stMaticContract.submit(amountWei, {
                value: 0 // WMATIC staking, not native MATIC
            });
            
            const receipt = await stakeTx.wait();
            console.log(`✅ stMATIC staking successful!`);
            console.log(`📋 Transaction: ${stakeTx.hash}`);
            console.log(`⛽ Gas Used: ${receipt.gasUsed}`);
            
            // Get stMATIC balance after staking
            const stMaticBalance = await this.stMaticContract.balanceOf(this.wallet.address);
            const stMaticAmount = ethers.formatUnits(stMaticBalance, 18);
            
            return {
                success: true,
                transactionHash: stakeTx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                wmaticStaked: wmaticAmount,
                stMaticReceived: stMaticAmount,
                contractAddress: this.contracts.stMATIC.address,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ stMATIC staking failed:', error.message);
            throw error;
        }
    }
    
    /**
     * REAL Aave Lending - Actual Aave v3 Integration
     */
    async lendToAave(token, amount) {
        console.log(`🏦 REAL Aave Lending: ${amount} ${token}`);
        
        try {
            const tokenContract = token === 'USDC' ? this.usdcContract : this.wmaticContract;
            const tokenAddress = token === 'USDC' ? this.contracts.USDC.address : this.contracts.WMATIC.address;
            const decimals = token === 'USDC' ? 6 : 18;
            
            const amountWei = ethers.parseUnits(amount.toString(), decimals);
            
            // Check token balance
            const balance = await tokenContract.balanceOf(this.wallet.address);
            if (balance < amountWei) {
                throw new Error(`Insufficient ${token} balance`);
            }
            
            // Approve Aave pool to spend tokens
            console.log(`📝 Approving ${token} for Aave pool...`);
            const approveTx = await tokenContract.approve(
                this.contracts.aavePool.address,
                amountWei
            );
            await approveTx.wait();
            console.log(`✅ ${token} approved: ${approveTx.hash}`);
            
            // Supply to Aave
            console.log('🔄 Supplying to Aave v3...');
            const supplyTx = await this.aavePoolContract.supply(
                tokenAddress,
                amountWei,
                this.wallet.address,
                0 // referral code
            );
            
            const receipt = await supplyTx.wait();
            console.log(`✅ Aave lending successful!`);
            console.log(`📋 Transaction: ${supplyTx.hash}`);
            
            return {
                success: true,
                transactionHash: supplyTx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                token: token,
                amount: amount,
                contractAddress: this.contracts.aavePool.address,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Aave lending failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Get REAL yield positions from blockchain
     */
    async getRealYieldPositions() {
        console.log('📊 Fetching REAL yield positions from blockchain...');
        
        try {
            const positions = [];
            
            // Check stMATIC balance
            const stMaticBalance = await this.stMaticContract.balanceOf(this.wallet.address);
            if (stMaticBalance > 0) {
                const stMaticAmount = ethers.formatUnits(stMaticBalance, 18);
                positions.push({
                    protocol: 'Lido stMATIC',
                    token: 'stMATIC',
                    amount: stMaticAmount,
                    contractAddress: this.contracts.stMATIC.address,
                    estimatedAPY: '4.2%',
                    status: 'ACTIVE',
                    type: 'LIQUID_STAKING'
                });
            }
            
            // Check Aave positions (would need aToken contracts for exact amounts)
            // For now, we'll check if we have any aTokens
            
            return {
                totalPositions: positions.length,
                positions: positions,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Failed to fetch yield positions:', error.message);
            return { totalPositions: 0, positions: [], error: error.message };
        }
    }
    
    /**
     * Execute REAL yield strategy
     */
    async executeRealYieldStrategy(strategy, amount) {
        console.log(`🎯 Executing REAL yield strategy: ${strategy} with ${amount}`);
        
        switch (strategy.toLowerCase()) {
            case 'stmatic':
            case 'staking':
                return await this.stakeToStMATIC(amount);
                
            case 'aave':
            case 'lending':
                return await this.lendToAave('USDC', amount);
                
            default:
                throw new Error(`Unknown strategy: ${strategy}`);
        }
    }
}

module.exports = { RealYieldManager };
