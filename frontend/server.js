const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// Serve static files from current directory
app.use(express.static(__dirname));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to test backend connectivity
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        message: 'Cross-Chain Yield-Gated TWAP Backend Online'
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Frontend server running at http://localhost:${PORT}`);
    console.log(`📱 Open in browser to see live demo interface`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/api/status`);
});
