require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract addresses
const LIMIT_ORDER_PROTOCOL = '0x111111125421cA6dc452d289314280a0f8842A65';
const USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const WMATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

async function main() {
    console.log('Testing order fill with fixed parameters...');
    
    // Load orders
    const ordersFile = path.join(__dirname, '../data/orders.json');
    const ordersData = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    
    // Use the first order
    const order = ordersData.orders[0];
    console.log('Testing order', order.sliceIndex);
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    // Create contract instance
    const abi = [
        'function fillOrder(tuple(address,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes,bytes), bytes, bytes) public payable returns(uint256, uint256)',
        'function fillOrderArgs(tuple(address,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes,bytes), bytes, bytes) public pure returns(bytes4,bytes)',
    ];
    const contract = new ethers.Contract(LIMIT_ORDER_PROTOCOL, abi, wallet);
    
    // Prepare order struct
    const orderStruct = [
        order.order.salt,
        order.order.makerAsset,
        order.order.takerAsset,
        order.order.maker,
        order.order.receiver,
        order.order.allowedSender,
        order.order.makingAmount,
        order.order.takingAmount,
        order.order.makerAssetData,
        order.order.takerAssetData,
        order.order.getMakerAmount,
        order.order.getTakerAmount,
        order.order.predicate,
        order.order.permit,
        order.order.interaction
    ];
    
    console.log('Order struct:');
    console.log(orderStruct);
    console.log('Signature:', order.signature);
    
    try {
        // Estimate gas
        console.log('Estimating gas...');
        const gasEstimate = await contract.fillOrder.estimateGas(orderStruct, order.signature, '0x');
        console.log(`Gas estimate: ${gasEstimate.toString()}`);
        
        // Fill order
        console.log('Filling order...');
        const tx = await contract.fillOrder(orderStruct, order.signature, '0x', {
            gasLimit: gasEstimate * 150n / 100n, // Add 50% buffer
            gasPrice: ethers.parseUnits('35', 'gwei')
        });
        
        console.log(`✅ Transaction sent: ${tx.hash}`);
        console.log(`🔍 Polygonscan: https://polygonscan.com/tx/${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`✅ Order filled successfully!`);
        console.log(`Block: ${receipt.blockNumber}`);
        
    } catch (error) {
        console.error('❌ Error filling order:', error.message);
        if (error.data) {
            console.error('Error data:', error.data);
        }
    }
}

main().catch(console.error);
