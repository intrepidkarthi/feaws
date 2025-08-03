require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

// Contract addresses
const LIMIT_ORDER_PROTOCOL = '0x111111125421cA6dc452d289314280a0f8842A65';
const USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const WMATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

async function main() {
    console.log('Testing order fill with detailed error handling...');
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    console.log('Taker wallet:', wallet.address);
    
    // Check taker's WMATIC balance
    const wmaticContract = new ethers.Contract(
        WMATIC,
        ['function balanceOf(address) view returns (uint256)'],
        provider
    );
    
    try {
        const balance = await wmaticContract.balanceOf(wallet.address);
        console.log('Taker WMATIC balance:', ethers.formatEther(balance));
    } catch (error) {
        console.error('Error checking WMATIC balance:', error.message);
    }
    
    // Load orders
    const ordersData = JSON.parse(fs.readFileSync('./data/orders.json', 'utf8'));
    const orderData = ordersData.orders[0]; // First order
    
    console.log('Order data:', orderData);
    
    // Create contract instance
    const abi = [
        'function fillOrder(tuple(address,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes,bytes), bytes, bytes) public payable returns(uint256, uint256)',
        'function remaining(bytes32 orderHash) public view returns(uint256)',
    ];
    const contract = new ethers.Contract(LIMIT_ORDER_PROTOCOL, abi, wallet);
    
    // Prepare order struct
    const order = [
        orderData.order.salt,
        orderData.order.makerAsset,
        orderData.order.takerAsset,
        orderData.order.maker,
        orderData.order.receiver,
        orderData.order.allowedSender,
        orderData.order.makingAmount,
        orderData.order.takingAmount,
        orderData.order.makerAssetData,
        orderData.order.takerAssetData,
        orderData.order.getMakerAmount,
        orderData.order.getTakerAmount,
        orderData.order.predicate,
        orderData.order.permit,
        orderData.order.interaction
    ];
    
    console.log('Order struct:', order);
    console.log('Signature:', orderData.signature);
    
    // Try to get remaining amount
    try {
        const orderHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(uint256,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes,bytes)'],
            [order]
        ));
        console.log('Order hash:', orderHash);
        
        const remaining = await contract.remaining(orderHash);
        console.log('Remaining amount:', remaining.toString());
    } catch (error) {
        console.error('Error getting remaining amount:', error.message);
    }
    
    // Try to fill order
    try {
        console.log('Estimating gas...');
        const gasEstimate = await contract.fillOrder.estimateGas(order, orderData.signature, '0x');
        console.log('Gas estimate:', gasEstimate.toString());
        
        console.log('Filling order...');
        const tx = await contract.fillOrder(order, orderData.signature, '0x', {
            gasLimit: gasEstimate * 150n / 100n // Add 50% buffer
        });
        
        console.log('Transaction sent:', tx.hash);
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt.hash);
    } catch (error) {
        console.error('❌ Error filling order:', error.message);
        
        // Log detailed error info
        if (error.error) {
            console.error('Error details:', error.error);
        }
        
        if (error.data) {
            console.error('Error data:', error.data);
        }
        
        if (error.reason) {
            console.error('Error reason:', error.reason);
        }
    }
}

main().catch(console.error);
