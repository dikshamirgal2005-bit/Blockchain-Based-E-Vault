// Compiles contracts/EVault.sol and deploys it to Ganache.
// Usage: npm run deploy   (optionally: RPC_URL=http://127.0.0.1:8545 npm run deploy)
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';

async function getChainId() {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    signal: AbortSignal.timeout(4000),
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
      evmVersion: 'paris', // works on every Ganache version
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
    console.error(`\nCould not reach Ganache at ${RPC_URL}.`);
    console.error('Start Ganache first (GUI default: http://127.0.0.1:7545, CLI default: http://127.0.0.1:8545).');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, chainId, { staticNetwork: true });
  const deployer = await provider.getSigner(0); // first Ganache account
  const deployerAddress = await deployer.getAddress();

  console.log(`Deploying from ${deployerAddress} ...`);
  const factory = new ethers.ContractFactory(abi, bytecode, deployer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  const buildDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(
    path.join(buildDir, 'EVault.json'),
    JSON.stringify({ address, abi, chainId, rpcUrl: RPC_URL }, null, 2)
  );

  console.log(`\nEVault deployed at: ${address}`);
  console.log(`Chain ID: ${chainId}`);
  console.log('Saved to build/EVault.json. Now run: npm start');
  provider.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
