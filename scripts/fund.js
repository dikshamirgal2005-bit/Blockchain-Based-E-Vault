// Sends 100 fake ETH from Ganache account 0 to any address (e.g. your MetaMask account).
// Usage: node scripts/fund.js 0xYourMetaMaskAddress
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

async function main() {
  const to = process.argv[2];
  if (!to || !ethers.isAddress(to)) {
    console.error('Usage: node scripts/fund.js 0xYourMetaMaskAddress');
    process.exit(1);
  }

  let chainId;
  try {
    chainId = await getChainId();
  } catch (err) {
    console.error(`Could not reach Ganache at ${RPC_URL}. Make sure Ganache is running.`);
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, chainId, { staticNetwork: true });
  const sender = await provider.getSigner(0); // Ganache account 0 (has 1000 fake ETH)
  const tx = await sender.sendTransaction({ to, value: ethers.parseEther('100') });
  await tx.wait();

  const balance = await provider.getBalance(to);
  console.log(`Sent 100 ETH to ${to}`);
  console.log(`New balance on Ganache: ${ethers.formatEther(balance)} ETH`);
  provider.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
