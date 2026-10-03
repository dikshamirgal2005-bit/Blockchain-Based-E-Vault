// Small Express server: serves the website and gives the browser the contract address + ABI.
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ethers.js (browser build) is served from node_modules, so no internet is needed.
app.get('/lib/ethers.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'ethers', 'dist', 'ethers.umd.min.js'));
});

// Contract details written by scripts/deploy.js
app.get('/api/contract', (req, res) => {
  const file = path.join(__dirname, 'build', 'EVault.json');
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Contract not deployed yet. Run: npm run deploy' });
  }
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.listen(PORT, () => {
  console.log(`E-Vault running at http://localhost:${PORT}`);
});
