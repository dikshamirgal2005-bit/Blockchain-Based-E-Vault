// Compiles contracts/EVault.sol and deploys it.
//
// Local (Ganache):   npm run deploy
// Public test net:   set PRIVATE_KEY and RPC_URL first (see README), then npm run deploy
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const isPublic = PRIVATE_KEY !== '';

async function getChainId() {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  return parseInt(data.result, 16);
}

function compile() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'contracts', 'EVault.sol'), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'EVault.sol': { content: source } },
    settings: {
      evmVersion: 'paris', // works on every Ganache version and public networks
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  if (errors.length) {
    errors.forEach((e) => console.error(e.formattedMessage));
    process.exit(1);
  }
  const contract = output.contracts['EVault.sol'].EVault;
  return { abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object };
}

async function main() {
  console.log('Compiling EVault.sol ...');
  const { abi, bytecode } = compile();

  let chainId;
  try {
    chainId = await getChainId();
  } catch (err) {
    console.error(`\nCould not reach the blockchain at ${RPC_URL}.`);
    console.error(isPublic
      ? 'Check your RPC_URL and internet connection.'
      : 'Start Ganache first (npm run ganache).');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, chainId, { staticNetwork: true });

  let deployer;
  if (isPublic) {
    const key = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : '0x' + PRIVATE_KEY;
    deployer = new ethers.Wallet(key, provider);
  } else {
    deployer = await provider.getSigner(0); // first Ganache account
  }
  const deployerAddress = await deployer.getAddress();

  const balance = await provider.getBalance(deployerAddress);
  if (balance === 0n) {
    console.error(`\nAccount ${deployerAddress} has 0 ETH on chain ${chainId}.`);
    console.error('Get free test ETH from a faucet for this network, then run the deploy again.');
    process.exit(1);
  }

  console.log(`Deploying from ${deployerAddress} on chain ${chainId} ...`);
  const factory = new ethers.ContractFactory(abi, bytecode, deployer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  // Saved for the website. The private RPC_URL is NOT saved (it may contain an API key).
  const config = {
    address,
    abi,
    chainId,
    chainName: process.env.CHAIN_NAME || (isPublic ? 'Public test network' : 'Ganache Local'),
    currencySymbol: process.env.CURRENCY || 'ETH',
  };
  if (process.env.PUBLIC_RPC_URL) config.rpcUrl = process.env.PUBLIC_RPC_URL;
  else if (!isPublic) config.rpcUrl = RPC_URL;
  if (process.env.EXPLORER_URL) config.explorerUrl = process.env.EXPLORER_URL.replace(/\/$/, '');

  const fileName = isPublic ? 'EVault.public.json' : 'EVault.json';
  const buildDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, fileName), JSON.stringify(config, null, 2));

  console.log(`\nEVault deployed at: ${address}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Saved to build/${fileName}`);
  if (!isPublic) console.log('Now run: npm start');
  provider.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
