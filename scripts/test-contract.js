require('dotenv').config();
const { ethers } = require('ethers');

// Contract addresses
const LIMIT_ORDER_PROTOCOL = '0x111111125421cA6dc452d289314280a0f8842A65';

async function main() {
    console.log('Testing contract...');
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.TAKER_PRIVATE_KEY, provider);
    
    // Create contract instance
    const abi = [
        'function fillOrder(tuple(address,address,address,address,address,address,uint256,uint256,bytes,bytes,bytes,bytes,bytes,bytes,bytes), bytes, bytes) public payable returns(uint256, uint256)',
    ];
    const contract = new ethers.Contract(LIMIT_ORDER_PROTOCOL, abi, wallet);
    
    console.log('Contract address:', contract.target);
    
    // Try to get the contract code
    try {
        const code = await provider.getCode(contract.target);
        console.log('Contract code length:', code.length);
        
        if (code === '0x') {
            console.log('❌ Contract not deployed');
        } else {
            console.log('✅ Contract deployed');
        }
    } catch (error) {
        console.error('❌ Error getting contract code:', error.message);
    }
}

main().catch(console.error);
