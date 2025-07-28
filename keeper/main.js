const { TreasuryManager } = require('./treasury-manager');

/**
 * MAIN TREASURY APPLICATION
 * 
 * Production-ready treasury management with 1inch Protocol
 */

async function main() {
    console.log('🏦 FEAWS TREASURY MANAGEMENT SYSTEM');
    console.log('===================================');
    
    const treasury = new TreasuryManager();
    
    try {
        // Get current status
        console.log('\\n📊 Getting treasury status...');
        const status = await treasury.getStatus();
        await treasury.saveToFrontend('treasury-status.json', status);
        
        console.log('\\n💰 Current Balances:');
        for (const [token, data] of Object.entries(status.balances)) {
            if (!data.error) {
                console.log(`  ${token}: ${parseFloat(data.balance).toFixed(6)}`);
            }
        }
        
        // Example operations based on available balance
        const usdcBalance = parseFloat(status.balances.USDC.balance);
        
        if (usdcBalance > 1) {
            console.log('\\n🎯 Executing sample operations...');
            
            // 1. Get quote
            const quote = await treasury.getQuote('USDC', 'WMATIC', '1000000'); // 1 USDC
            if (quote.success) {
                console.log(`💱 Quote: 1 USDC → ${parseFloat(quote.toAmount) / 1e18} WMATIC`);
            }
            
            // 2. Create limit order
            const limitOrder = await treasury.createLimitOrder(
                'USDC', 
                'WMATIC', 
                '1000000', // 1 USDC
                quote.toAmount
            );
            
            if (limitOrder.success) {
                console.log(`📋 Limit order created: ${limitOrder.orderHash.substring(0, 20)}...`);
                await treasury.saveToFrontend('latest-limit-order.json', limitOrder);
            }
            
            // 3. Execute small swap for demonstration
            console.log('\\n🔄 Executing demonstration swap...');
            const swapResult = await treasury.executeSwap('USDC', 'WMATIC', '500000'); // 0.5 USDC
            
            if (swapResult.success) {
                console.log(`✅ Swap completed: ${swapResult.transactionHash}`);
                await treasury.saveToFrontend('latest-swap.json', swapResult);
            }
            
        } else {
            console.log('\\n⚠️  Insufficient USDC balance for operations');
        }
        
        // Update final status
        const finalStatus = await treasury.getStatus();
        await treasury.saveToFrontend('treasury-status.json', finalStatus);
        
        console.log('\\n🎉 Treasury operations completed successfully!');
        console.log('📊 Check frontend/ directory for live data');
        
    } catch (error) {
        console.error('\\n❌ Treasury operation failed:', error.message);
        process.exit(1);
    }
}

// Command line interface
if (require.main === module) {
    const command = process.argv[2];
    const treasury = new TreasuryManager();
    
    switch (command) {
        case 'status':
            treasury.getStatus().then(status => {
                console.log(JSON.stringify(status, null, 2));
            });
            break;
            
        case 'balances':
            treasury.getBalances().then(balances => {
                console.log('💰 Treasury Balances:');
                for (const [token, data] of Object.entries(balances)) {
                    if (!data.error) {
                        console.log(`  ${token}: ${parseFloat(data.balance).toFixed(6)}`);
                    }
                }
            });
            break;
            
        case 'swap':
            const [fromToken, toToken, amount] = process.argv.slice(3);
            if (!fromToken || !toToken || !amount) {
                console.log('Usage: node main.js swap <fromToken> <toToken> <amount>');
                process.exit(1);
            }
            treasury.executeSwap(fromToken, toToken, amount).then(result => {
                console.log(JSON.stringify(result, null, 2));
            });
            break;
            
        case 'twap':
            const [from, to, total, tranches, interval] = process.argv.slice(3);
            if (!from || !to || !total || !tranches) {
                console.log('Usage: node main.js twap <fromToken> <toToken> <totalAmount> <tranches> [intervalMinutes]');
                process.exit(1);
            }
            treasury.executeTWAP(from, to, total, parseInt(tranches), parseInt(interval) || 5).then(result => {
                console.log(JSON.stringify(result, null, 2));
            });
            break;
            
        default:
            main();
    }
}

module.exports = { main };
