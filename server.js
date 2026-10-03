// Small Express server: serves the website and gives the browser the contract address + ABI.
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Local demo uses build/EVault.json (Ganache).
// On Render, set CONTRACT_CONFIG=build/EVault.public.json (public test network).
const CONFIG_FILE = path.join(__dirname, process.env.CONTRACT_CONFIG || 'build/EVault.json');

app.use(express.static(path.join(__dirname, 'public')));

// ethers.js (browser build) is served from node_modules, so no CDN is needed.
app.get('/lib/ethers.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'ethers', 'dist', 'ethers.umd.min.js'));
});

// Contract details written by scripts/deploy.js
app.get('/api/contract', (req, res) => {
  if (!fs.existsSync(CONFIG_FILE)) {
    return res.status(404).json({ error: 'Contract not deployed yet. Run: npm run deploy' });
  }
  res.json(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
});

app.listen(PORT, () => {
  console.log(`E-Vault running on port ${PORT}`);
  console.log(`Using contract config: ${path.relative(__dirname, CONFIG_FILE)}`);
});
