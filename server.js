#!/usr/bin/env node

/**
 * FEAWS Real Backend Server
 * Uses actual working scripts for real blockchain operations
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('.'));

// Initialize blockchain connection
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

console.log('🌊 FEAWS REAL BACKEND SERVER');
console.log('============================');
console.log('🏦 Wallet:', wallet.address);
console.log('🌐 Network: Polygon Mainnet');
console.log('');

// Token contracts (real addresses)
const tokens = {
    USDC: {
        address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        decimals: 6,
        contract: new ethers.Contract(
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            ['function balanceOf(address) view returns (uint256)'],
            provider
        )
    },
    WPOL: {
        address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        decimals: 18,
        contract: new ethers.Contract(
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            ['function balanceOf(address) view returns (uint256)'],
            provider
        )
    }
};

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        wallet: wallet.address,
        network: 'Polygon Mainnet'
    });
});

// Get real wallet balances
app.get('/api/balances', async (req, res) => {
    try {
        console.log('📊 Fetching real wallet balances...');
        
        const balances = {};
        
        for (const [symbol, token] of Object.entries(tokens)) {
            try {
                const balance = await token.contract.balanceOf(wallet.address);
                const formatted = ethers.formatUnits(balance, token.decimals);
                balances[symbol] = {
                    raw: balance.toString(),
                    formatted: formatted,
                    address: token.address
                };
                console.log(`   ${symbol}: ${formatted}`);
            } catch (error) {
                console.log(`   ${symbol}: Error - ${error.message}`);
                balances[symbol] = { error: error.message };
            }
        }
        
        res.json({
            success: true,
            wallet: wallet.address,
            balances: balances,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Balance fetch error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Execute real TWAP using working script
app.post('/api/execute/twap', async (req, res) => {
    try {
        const { amount = '0.1', slices = 2 } = req.body;
        
        console.log('🌊 Executing REAL TWAP...');
        console.log(`   Amount: ${amount} USDC`);
        console.log(`   Slices: ${slices}`);
        
        // Run the actual working TWAP script
        const scriptPath = path.join(__dirname, 'scripts', 'working-1inch-twap-final.js');
        
        const child = spawn('node', [scriptPath], {
            cwd: __dirname,
            env: { ...process.env }
        });
        
        let output = '';
        let error = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
            console.log(data.toString());
        });
        
        child.stderr.on('data', (data) => {
            error += data.toString();
            console.error(data.toString());
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                // Check if proof file was created
                const proofPath = path.join(__dirname, 'data', 'twap-execution-proof.json');
                let proof = null;
                
                if (fs.existsSync(proofPath)) {
                    try {
                        proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
                    } catch (e) {
                        console.log('Could not read proof file');
                    }
                }
                
                res.json({
                    success: true,
                    message: 'TWAP executed successfully',
                    output: output,
                    proof: proof,
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'TWAP execution failed',
                    error: error,
                    output: output
                });
            }
        });
        
    } catch (error) {
        console.error('❌ TWAP execution error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Execute real LOP TWAP using working script
app.post('/api/execute/lop-twap', async (req, res) => {
    try {
        const { amount = '0.1' } = req.body;
        
        console.log('🎯 Executing REAL LOP TWAP...');
        console.log(`   Amount: ${amount} USDC`);
        
        // Run the actual working LOP TWAP script
        const scriptPath = path.join(__dirname, 'scripts', 'working-1inch-lop-twap.js');
        
        const child = spawn('node', [scriptPath], {
            cwd: __dirname,
            env: { ...process.env }
        });
        
        let output = '';
        let error = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
            console.log(data.toString());
        });
        
        child.stderr.on('data', (data) => {
            error += data.toString();
            console.error(data.toString());
        });
        
        child.on('close', (code) => {
            res.json({
                success: code === 0,
                message: code === 0 ? 'LOP TWAP executed successfully' : 'LOP TWAP execution failed',
                output: output,
                error: error,
                timestamp: new Date().toISOString()
            });
        });
        
    } catch (error) {
        console.error('❌ LOP TWAP execution error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get execution history from data files
app.get('/api/history', (req, res) => {
    try {
        const dataDir = path.join(__dirname, 'data');
        const history = [];
        
        if (fs.existsSync(dataDir)) {
            const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
            
            files.forEach(file => {
                try {
                    const filePath = path.join(dataDir, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    history.push({
                        file: file,
                        ...data
                    });
                } catch (e) {
                    console.log(`Could not read ${file}`);
                }
            });
        }
        
        res.json({
            success: true,
            history: history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Execute balance fetcher
app.post('/api/execute/balance', async (req, res) => {
    try {
        console.log('💰 Executing Balance Fetcher...');
        
        const scriptPath = path.join(__dirname, 'scripts', 'core', 'balance-fetcher.js');
        const child = spawn('node', [scriptPath], {
            cwd: __dirname,
            env: { ...process.env }
        });
        
        let output = '';
        let error = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
            console.log(data.toString());
        });
        
        child.stderr.on('data', (data) => {
            error += data.toString();
            console.error(data.toString());
        });
        
        child.on('close', (code) => {
            res.json({
                success: code === 0,
                message: code === 0 ? 'Balance check completed' : 'Balance check failed',
                output: output,
                error: error,
                timestamp: new Date().toISOString()
            });
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Execute USDC approval
app.post('/api/execute/approve', async (req, res) => {
    try {
        console.log('✅ Executing USDC Approval...');
        
        const scriptPath = path.join(__dirname, 'scripts', 'core', 'approve-usdc.js');
        const child = spawn('node', [scriptPath], {
            cwd: __dirname,
            env: { ...process.env }
        });
        
        let output = '';
        let error = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
            console.log(data.toString());
        });
        
        child.stderr.on('data', (data) => {
            error += data.toString();
            console.error(data.toString());
        });
        
        child.on('close', (code) => {
            res.json({
                success: code === 0,
                message: code === 0 ? 'USDC approval completed' : 'USDC approval failed',
                output: output,
                error: error,
                timestamp: new Date().toISOString()
            });
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Execute Limit Order Protocol
app.post('/api/execute/lop', async (req, res) => {
    try {
        console.log('🎯 Executing Limit Order Protocol...');
        
        const scriptPath = path.join(__dirname, 'scripts', 'core', 'limit-order-protocol.js');
        const child = spawn('node', [scriptPath], {
            cwd: __dirname,
            env: { ...process.env }
        });
        
        let output = '';
        let error = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
            console.log(data.toString());
        });
        
        child.stderr.on('data', (data) => {
            error += data.toString();
            console.error(data.toString());
        });
        
        child.on('close', (code) => {
            res.json({
                success: code === 0,
                message: code === 0 ? 'Limit order created' : 'Limit order failed',
                output: output,
                error: error,
                timestamp: new Date().toISOString()
            });
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Execute Monitor
app.post('/api/execute/monitor', async (req, res) => {
    try {
        console.log('📊 Starting Transaction Monitor...');
        
        const scriptPath = path.join(__dirname, 'scripts', 'core', 'monitor.js');
        const child = spawn('node', [scriptPath], {
            cwd: __dirname,
            env: { ...process.env }
        });
        
        let output = '';
        let error = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
            console.log(data.toString());
        });
        
        child.stderr.on('data', (data) => {
            error += data.toString();
            console.error(data.toString());
        });
        
        child.on('close', (code) => {
            res.json({
                success: code === 0,
                message: code === 0 ? 'Monitor started' : 'Monitor failed',
                output: output,
                error: error,
                timestamp: new Date().toISOString()
            });
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// List available working scripts
app.get('/api/scripts', (req, res) => {
    try {
        const scriptsDir = path.join(__dirname, 'scripts');
        const scripts = fs.readdirSync(scriptsDir)
            .filter(f => f.endsWith('.js'))
            .map(f => ({
                name: f,
                path: `/scripts/${f}`,
                size: fs.statSync(path.join(scriptsDir, f)).size
            }));
        
        res.json({
            success: true,
            scripts: scripts,
            count: scripts.length
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log('🚀 FEAWS Real Backend Started');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log('');
    console.log('🔗 Available Endpoints:');
    console.log('   GET  /health              - Server health');
    console.log('   GET  /api/balances        - Real wallet balances');
    console.log('   POST /api/execute/balance - Execute balance fetcher');
    console.log('   POST /api/execute/approve - Execute USDC approval');
    console.log('   POST /api/execute/twap    - Execute real TWAP');
    console.log('   POST /api/execute/lop     - Execute limit order protocol');
    console.log('   POST /api/execute/lop-twap - Execute real LOP TWAP');
    console.log('   POST /api/execute/monitor - Execute transaction monitor');
    console.log('   GET  /api/history         - Execution history');
    console.log('   GET  /api/scripts         - Available scripts');
    console.log('');
    console.log('✅ Ready for real blockchain operations!');
});
