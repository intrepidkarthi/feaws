const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * PRODUCTION TREASURY MANAGER
 * 
 * Main class for managing treasury operations with 1inch Protocol
 * Handles real swaps, limit orders, and TWAP strategies
 */

class TreasuryManager {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.apiKey = process.env.ONEINCH_API_KEY;
        
        this.tokens = {
            USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
        };
        
        this.oneinchRouter = '0x111111125421ca6dc452d289314280a0f8842a65';
        
        console.log(`🏦 Treasury Manager initialized`);
        console.log(`📍 Wallet: ${this.wallet.address}`);
        console.log(`🔗 Network: Polygon (137)`);
    }
    
    /**
     * Get current treasury balances
     */
    async getBalances() {
        const erc20ABI = [
            'function balanceOf(address owner) view returns (uint256)',
            'function symbol() view returns (string)',
            'function decimals() view returns (uint8)'
        ];
        
        const balances = {};
        
        for (const [symbol, address] of Object.entries(this.tokens)) {
            try {
                const contract = new ethers.Contract(address, erc20ABI, this.provider);
                const balance = await contract.balanceOf(this.wallet.address);
                const decimals = await contract.decimals();
                
                balances[symbol] = {
                    address: address,
                    balance: ethers.formatUnits(balance, decimals),
                    balanceWei: balance.toString(),
                    decimals: Number(decimals)
                };
            } catch (error) {
                console.error(`Error getting ${symbol} balance:`, error.message);
                balances[symbol] = { balance: '0', error: error.message };
            }
        }
        
        return balances;
    }
    
    /**
     * Get 1inch quote for token swap
     */
    async getQuote(fromToken, toToken, amount) {
        try {
            const response = await axios.get('https://api.1inch.dev/swap/v6.0/137/quote', {
                params: {
                    fromTokenAddress: this.tokens[fromToken],
                    toTokenAddress: this.tokens[toToken],
                    amount: amount
                },
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            return {
                success: true,
                fromToken: fromToken,
                toToken: toToken,
                fromAmount: amount,
                toAmount: response.data.dstAmount,
                estimatedGas: response.data.estimatedGas
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                status: error.response?.status
            };
        }
    }
    
    /**
     * Execute real 1inch swap
     */
    async executeSwap(fromToken, toToken, amount, slippage = 1) {
        console.log(`🔄 Executing swap: ${amount} ${fromToken} → ${toToken}`);
        
        try {
            // Get swap transaction data
            const swapResponse = await axios.get('https://api.1inch.dev/swap/v6.0/137/swap', {
                params: {
                    src: this.tokens[fromToken],
                    dst: this.tokens[toToken],
                    amount: amount,
                    from: this.wallet.address,
                    slippage: slippage,
                    disableEstimate: false
                },
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            const swapData = swapResponse.data;
            
            // Check and approve token if needed
            await this.ensureApproval(fromToken, swapData.tx.to, amount);
            
            // Execute the swap
            const feeData = await this.provider.getFeeData();
            
            const swapTx = {
                to: swapData.tx.to,
                data: swapData.tx.data,
                value: swapData.tx.value || 0,
                gasLimit: parseInt(swapData.tx.gas) + 50000,
                gasPrice: feeData.gasPrice
            };
            
            const executedTx = await this.wallet.sendTransaction(swapTx);
            console.log(`📋 Transaction: ${executedTx.hash}`);
            
            const receipt = await executedTx.wait();
            console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
            
            return {
                success: true,
                transactionHash: executedTx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                fromToken: fromToken,
                toToken: toToken,
                fromAmount: amount,
                toAmount: swapData.dstAmount
            };
            
        } catch (error) {
            console.error(`❌ Swap failed:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Ensure token approval for 1inch
     */
    async ensureApproval(token, spender, amount) {
        const erc20ABI = [
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)'
        ];
        
        const contract = new ethers.Contract(this.tokens[token], erc20ABI, this.wallet);
        const allowance = await contract.allowance(this.wallet.address, spender);
        
        if (allowance < BigInt(amount)) {
            console.log(`📝 Approving ${token}...`);
            const approveTx = await contract.approve(spender, amount);
            await approveTx.wait();
            console.log(`✅ ${token} approved`);
        }
    }
    
    /**
     * Create limit order (signed but not submitted)
     */
    async createLimitOrder(fromToken, toToken, fromAmount, toAmount) {
        console.log(`📋 Creating limit order: ${fromAmount} ${fromToken} → ${toAmount} ${toToken}`);
        
        try {
            const salt = Date.now().toString();
            
            const orderData = {
                makerAsset: this.tokens[fromToken],
                takerAsset: this.tokens[toToken],
                maker: this.wallet.address,
                receiver: '0x0000000000000000000000000000000000000000',
                makingAmount: fromAmount,
                takingAmount: toAmount,
                salt: salt,
                extension: '0x00',
                makerTraits: '0'
            };
            
            // Create order hash
            const orderHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes', 'uint256'],
                    [
                        orderData.makerAsset,
                        orderData.takerAsset,
                        orderData.maker,
                        orderData.receiver,
                        orderData.makingAmount,
                        orderData.takingAmount,
                        orderData.salt,
                        orderData.extension,
                        orderData.makerTraits
                    ]
                )
            );
            
            // Sign the order
            const signature = await this.wallet.signMessage(ethers.getBytes(orderHash));
            
            return {
                success: true,
                orderHash: orderHash,
                signature: signature,
                orderData: orderData,
                fromToken: fromToken,
                toToken: toToken,
                createdAt: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Execute TWAP strategy
     */
    async executeTWAP(fromToken, toToken, totalAmount, tranches, intervalMinutes) {
        console.log(`🎯 Executing TWAP: ${totalAmount} ${fromToken} → ${toToken} in ${tranches} tranches`);
        
        const trancheAmount = Math.floor(parseFloat(totalAmount) / tranches);
        const results = [];
        
        for (let i = 0; i < tranches; i++) {
            console.log(`\\n📊 TWAP Tranche ${i + 1}/${tranches}`);
            
            // Convert to wei for the specific token
            const tokenDecimals = fromToken === 'USDC' ? 6 : 18;
            const amountWei = ethers.parseUnits(trancheAmount.toString(), tokenDecimals);
            
            const result = await this.executeSwap(fromToken, toToken, amountWei.toString());
            results.push({
                tranche: i + 1,
                amount: trancheAmount,
                result: result,
                timestamp: new Date().toISOString()
            });
            
            // Wait between tranches (except for the last one)
            if (i < tranches - 1) {
                console.log(`⏳ Waiting ${intervalMinutes} minutes until next tranche...`);
                await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
            }
        }
        
        return {
            success: true,
            strategy: 'TWAP',
            fromToken: fromToken,
            toToken: toToken,
            totalAmount: totalAmount,
            tranches: tranches,
            results: results,
            completedAt: new Date().toISOString()
        };
    }
    
    /**
     * Save data to frontend
     */
    async saveToFrontend(filename, data) {
        const fs = require('fs');
        const filepath = path.join(__dirname, '../frontend', filename);
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`💾 Data saved to ${filename}`);
    }
    
    /**
     * Get treasury status
     */
    async getStatus() {
        const balances = await this.getBalances();
        
        return {
            wallet: this.wallet.address,
            network: 'Polygon (137)',
            balances: balances,
            contracts: {
                oneinchRouter: this.oneinchRouter,
                tokens: this.tokens
            },
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = { TreasuryManager };
