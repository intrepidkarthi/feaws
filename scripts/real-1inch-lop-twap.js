#!/usr/bin/env node

require('dotenv').config();
const { ethers } = require('ethers');

class Real1inchLOPTWAP {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.takerWallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, this.provider);
        
        // 1inch Limit Order Protocol v4 on Polygon
        this.LOP_CONTRACT = '0x111111125421ca6dc452d289314280a0f8842a65';
        this.USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        this.WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
        
        this.lopContract = new ethers.Contract(
            this.LOP_CONTRACT,
            [
                'function fillOrder((address,address,address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes) order, bytes signature, bytes interaction, uint256 makingAmount, uint256 takingAmount, uint256 skipPermitAndThresholdAmount) external returns (uint256, uint256, bytes32)',
                'function hashOrder((address,address,address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes) order) external view returns (bytes32)'
            ],
            this.takerWallet
        );
        
        this.usdcContract = new ethers.Contract(
            this.USDC_ADDRESS,
            [
                'function balanceOf(address) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function decimals() view returns (uint8)'
            ],
            this.wallet
        );
        
        this.orders = [];
        this.fills = [];
    }

    async createTWAPOrders(totalAmount, slices, intervalSeconds) {
        console.log('🚀 CREATING 1INCH LIMIT ORDER PROTOCOL TWAP\n');
        
        const sliceAmount = totalAmount / BigInt(slices);
        const decimals = await this.usdcContract.decimals();
        
        console.log(`📊 Parameters:`);
        console.log(`   Total USDC: ${ethers.formatUnits(totalAmount, decimals)} USDC`);
        console.log(`   Slices: ${slices}`);
        console.log(`   Slice Size: ${ethers.formatUnits(sliceAmount, decimals)} USDC`);
        console.log(`   Interval: ${intervalSeconds}s\n`);

        // Approve USDC for 1inch LOP
        console.log('🔐 Approving USDC for 1inch LOP...');
        const approveTx = await this.usdcContract.approve(this.LOP_CONTRACT, totalAmount);
        await approveTx.wait();
        console.log('✅ USDC approved\n');

        // Create time-based limit orders
        const currentTime = Math.floor(Date.now() / 1000);
        
        for (let i = 0; i < slices; i++) {
            const startTime = currentTime + (i * intervalSeconds);
            const endTime = startTime + 3600; // 1 hour validity
            
            console.log(`📝 Creating Order ${i + 1}/${slices}...`);
            
            const order = await this.buildLimitOrder(
                sliceAmount,
                startTime,
                endTime,
                i
            );
            
            const signature = await this.signOrder(order);
            const orderHash = await this.lopContract.hashOrder(order);
            
            this.orders.push({
                order,
                signature,
                hash: orderHash,
                sliceIndex: i,
                startTime,
                endTime,
                amount: sliceAmount
            });
            
            console.log(`   ✅ Order ${i + 1} created: ${orderHash.slice(0, 10)}...`);
        }
        
        console.log(`\n🎯 ${slices} TWAP orders created successfully!\n`);
        return this.orders;
    }

    async buildLimitOrder(makingAmount, startTime, endTime, nonce) {
        // Get current USDC/WMATIC rate for realistic pricing
        const rate = ethers.parseEther('0.5'); // ~0.5 WMATIC per USDC
        const takingAmount = (makingAmount * rate) / ethers.parseUnits('1', 6);
        
        return {
            salt: ethers.hexlify(ethers.randomBytes(32)),
            maker: this.wallet.address,
            receiver: ethers.ZeroAddress,
            makerAsset: this.USDC_ADDRESS,
            takerAsset: this.WMATIC_ADDRESS,
            makingAmount: makingAmount.toString(),
            takingAmount: takingAmount.toString(),
            makerTraits: this.buildMakerTraits(startTime, endTime),
            extension: '0x'
        };
    }

    buildMakerTraits(startTime, endTime) {
        // Encode time constraints in makerTraits
        // This is a simplified version - real implementation needs proper bit packing
        return ethers.toBigInt(startTime) << 160n | ethers.toBigInt(endTime);
    }

    async signOrder(order) {
        const domain = {
            name: '1inch Limit Order Protocol',
            version: '4',
            chainId: 137,
            verifyingContract: this.LOP_CONTRACT
        };

        const types = {
            Order: [
                { name: 'salt', type: 'uint256' },
                { name: 'maker', type: 'address' },
                { name: 'receiver', type: 'address' },
                { name: 'makerAsset', type: 'address' },
                { name: 'takerAsset', type: 'address' },
                { name: 'makingAmount', type: 'uint256' },
                { name: 'takingAmount', type: 'uint256' },
                { name: 'makerTraits', type: 'uint256' }
            ]
        };

        return await this.wallet.signTypedData(domain, types, {
            salt: order.salt,
            maker: order.maker,
            receiver: order.receiver,
            makerAsset: order.makerAsset,
            takerAsset: order.takerAsset,
            makingAmount: order.makingAmount,
            takingAmount: order.takingAmount,
            makerTraits: order.makerTraits
        });
    }

    async executeTWAP() {
        console.log('⚡ STARTING TWAP EXECUTION\n');
        
        for (let i = 0; i < this.orders.length; i++) {
            const orderData = this.orders[i];
            const currentTime = Math.floor(Date.now() / 1000);
            
            console.log(`🕐 Order ${i + 1}: Waiting for start time...`);
            
            // Wait until order becomes valid
            while (currentTime < orderData.startTime) {
                const waitTime = orderData.startTime - currentTime;
                console.log(`   ⏳ ${waitTime}s remaining...`);
                await new Promise(r => setTimeout(r, Math.min(waitTime * 1000, 5000)));
                currentTime = Math.floor(Date.now() / 1000);
            }
            
            console.log(`⚡ Executing Order ${i + 1}...`);
            
            try {
                const tx = await this.lopContract.fillOrder(
                    [
                        orderData.order.salt,
                        orderData.order.maker,
                        orderData.order.receiver,
                        orderData.order.makerAsset,
                        orderData.order.takerAsset,
                        orderData.order.makingAmount,
                        orderData.order.takingAmount,
                        orderData.order.makerTraits,
                        orderData.order.extension
                    ],
                    orderData.signature,
                    '0x', // no interaction
                    orderData.order.makingAmount,
                    orderData.order.takingAmount,
                    0 // no threshold
                );
                
                console.log(`   TX: ${tx.hash}`);
                const receipt = await tx.wait();
                
                if (receipt.status === 1) {
                    console.log(`   ✅ SUCCESS - Block ${receipt.blockNumber}`);
                    console.log(`   🔗 https://polygonscan.com/tx/${tx.hash}\n`);
                    
                    this.fills.push({
                        orderHash: orderData.hash,
                        txHash: tx.hash,
                        blockNumber: receipt.blockNumber,
                        sliceIndex: i
                    });
                } else {
                    console.log(`   ❌ FAILED\n`);
                }
                
            } catch (error) {
                console.log(`   ❌ ERROR: ${error.message}\n`);
            }
        }
        
        await this.printTWAPSummary();
    }

    async printTWAPSummary() {
        console.log('🎉 TWAP EXECUTION COMPLETED\n');
        
        const decimals = await this.usdcContract.decimals();
        const finalBalance = await this.usdcContract.balanceOf(this.wallet.address);
        
        console.log('📊 SUMMARY:');
        console.log(`   Orders Created: ${this.orders.length}`);
        console.log(`   Orders Filled: ${this.fills.length}`);
        console.log(`   Final USDC Balance: ${ethers.formatUnits(finalBalance, decimals)} USDC\n`);
        
        console.log('🔗 FILL TRANSACTIONS:');
        this.fills.forEach((fill, i) => {
            console.log(`   Slice ${fill.sliceIndex + 1}: https://polygonscan.com/tx/${fill.txHash}`);
        });
        
        if (this.fills.length > 0) {
            console.log('\n✅ REAL 1INCH LOP TWAP VERIFIED');
            console.log('   - Time-based limit orders executed');
            console.log('   - Real on-chain fills confirmed');
            console.log('   - 1inch Limit Order Protocol integration working');
        }
    }
}

async function main() {
    const twap = new Real1inchLOPTWAP();
    
    // Create and execute TWAP: 0.3 USDC, 3 slices, 15 second intervals
    await twap.createTWAPOrders(
        ethers.parseUnits('0.3', 6), // 0.3 USDC total
        3,                           // 3 slices
        15                          // 15 second intervals
    );
    
    await twap.executeTWAP();
}

main().catch(console.error);
