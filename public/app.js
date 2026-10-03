// Blockchain E-Vault - browser logic
// 1. Hash the file in the browser (SHA-256)
// 2. Store / look up the hash on the EVault smart contract through MetaMask

let config = null;   // contract address + ABI from the server
let provider = null;
let signer = null;
let contract = null;
let account = null;

const state = { uploadFile: null, uploadHash: null, verifyFile: null, verifyHash: null };
const $ = (id) => document.getElementById(id);

/* ---------- helpers ---------- */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function sha256Hex(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function showAlert(el, type, html) {
  el.className = 'alert ' + type;
  el.innerHTML = html;
  el.hidden = false;
}

function hideAlert(el) {
  el.hidden = true;
  el.innerHTML = '';
}

function friendlyError(err) {
  if (err && (err.code === 'ACTION_REJECTED' || err.code === 4001)) {
    return 'You rejected the request in MetaMask.';
  }
  return (err && (err.reason || err.shortMessage || err.message)) || 'Something went wrong.';
}

function shortHash(hash) {
  return hash.slice(0, 10) + '...' + hash.slice(-8);
}

function formatDate(seconds) {
  return new Date(Number(seconds) * 1000).toLocaleString();
}

function networkName() {
  return (config && config.chainName) || 'Ganache';
}

function requireContract() {
  if (!contract) {
    throw new Error('Connect MetaMask (on the ' + networkName() + ' network) first.');
  }
}

/* ---------- wallet ---------- */

async function loadConfig() {
  try {
    const res = await fetch('/api/contract');
    if (!res.ok) throw new Error((await res.json()).error);
    config = await res.json();
  } catch (err) {
    showAlert($('banner'), 'warning',
      'Smart contract not found. Start Ganache, then run <code>npm run deploy</code> and refresh this page.');
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    showAlert($('banner'), 'error', 'MetaMask is not installed. Install the MetaMask browser extension and refresh.');
    return;
  }
  if (!config) {
    await loadConfig();
    if (!config) return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    await setupContract();
  } catch (err) {
    showAlert($('banner'), 'error', escapeHtml(friendlyError(err)));
  }
}

async function setupContract() {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== config.chainId) {
    contract = null;
    showAlert($('banner'), 'warning',
      'MetaMask is on a different network. Switch to ' + escapeHtml(networkName()) + ' to continue.' +
      '<br><button id="switch-btn" class="btn btn-primary">Switch to ' + escapeHtml(networkName()) + '</button>');
    $('switch-btn').addEventListener('click', switchNetwork);
    return;
  }
  signer = await provider.getSigner();
  account = await signer.getAddress();
  contract = new ethers.Contract(config.address, config.abi, signer);

  hideAlert($('banner'));
  $('wallet-status').textContent = 'Connected: ' + account.slice(0, 6) + '...' + account.slice(-4);
  $('wallet-status').className = 'pill pill-on';
  $('connect-btn').textContent = 'Connected';
  $('connect-btn').disabled = true;
  updateButtons();
}

async function switchNetwork() {
  const chainIdHex = '0x' + config.chainId.toString(16);
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
  } catch (err) {
    if (err.code === 4902 || (err.data && err.data.originalError && err.data.originalError.code === 4902)) {
      if (!config.rpcUrl) {
        showAlert($('banner'), 'error', 'Please add the ' + escapeHtml(networkName()) + ' network to MetaMask manually, then refresh.');
        return;
      }
      const symbol = config.currencySymbol || 'ETH';
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: networkName(),
          rpcUrls: [config.rpcUrl],
          nativeCurrency: { name: symbol, symbol: symbol, decimals: 18 },
          blockExplorerUrls: config.explorerUrl ? [config.explorerUrl] : undefined,
        }],
      });
    } else {
      showAlert($('banner'), 'error', escapeHtml(friendlyError(err)));
    }
  }
}

/* ---------- file selection ---------- */

function setupDropzone(zoneId, inputId, onFile) {
  const zone = $(zoneId);
  const input = $(inputId);
  input.addEventListener('change', () => input.files[0] && onFile(input.files[0]));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
}

async function onUploadFile(file) {
  state.uploadFile = file;
  state.uploadHash = await sha256Hex(file);
  $('upload-name').textContent = file.name;
  $('upload-hash').textContent = state.uploadHash;
  $('upload-hash-box').hidden = false;
  hideAlert($('upload-status'));
  updateButtons();
}

async function onVerifyFile(file) {
  state.verifyFile = file;
  state.verifyHash = await sha256Hex(file);
  $('verify-name').textContent = file.name;
  $('verify-hash').textContent = state.verifyHash;
  $('verify-hash-box').hidden = false;
  $('verify-result').hidden = true;
  updateButtons();
}

function updateButtons() {
  $('store-btn').disabled = !(contract && state.uploadHash);
  $('verify-btn').disabled = !(contract && state.verifyHash);
}

/* ---------- store ---------- */

async function storeDocument() {
  const status = $('upload-status');
  const btn = $('store-btn');
  btn.disabled = true;
  try {
    requireContract();
    const hash = '0x' + state.uploadHash;

    const existing = await contract.findByHash(hash);
    if (existing.found) {
      showAlert(status, 'warning', 'This exact file is already stored on the blockchain (Document ID ' + existing.id + ').');
      return;
    }

    showAlert(status, 'info', 'Please confirm the transaction in MetaMask...');
    const tx = await contract.storeDocument(hash, state.uploadFile.name);
    showAlert(status, 'info', 'Transaction sent. Waiting for it to be mined...');
    const receipt = await tx.wait();

    let id = '?';
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === 'DocumentStored') id = parsed.args.id.toString();
      } catch (e) { /* log from another contract, ignore */ }
    }

    showAlert(status, 'success',
      '<strong>Stored on the blockchain.</strong><br>Document ID: <strong>' + escapeHtml(id) + '</strong>' +
      '<br>Keep this ID. You can use it later to verify the file.' +
      '<br>Transaction: <code>' + escapeHtml(shortHash(receipt.hash)) + '</code>' +
      (config.explorerUrl
        ? ' <a href="' + escapeHtml(config.explorerUrl) + '/tx/' + escapeHtml(receipt.hash) + '" target="_blank" rel="noopener">View on explorer</a>'
        : ''));
  } catch (err) {
    showAlert(status, 'error', escapeHtml(friendlyError(err)));
  } finally {
    updateButtons();
  }
}

/* ---------- verify ---------- */

function renderResult(ok, title, message, rows) {
  const box = $('verify-result');
  const details = rows.map(([label, value, mono]) =>
    '<dt>' + escapeHtml(label) + '</dt><dd' + (mono ? ' class="mono"' : '') + '>' + escapeHtml(value) + '</dd>'
  ).join('');
  box.className = 'result ' + (ok ? 'ok' : 'bad');
  box.innerHTML = '<h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(message) + '</p><dl>' + details + '</dl>';
  box.hidden = false;
}

function recordRows(doc) {
  return [
    ['Document ID', doc.id.toString()],
    ['File name', doc.fileName],
    ['Stored by', doc.owner, true],
    ['Stored on', formatDate(doc.timestamp)],
  ];
}

async function verifyDocument() {
  const btn = $('verify-btn');
  btn.disabled = true;
  try {
    requireContract();
    const computed = ('0x' + state.verifyHash).toLowerCase();
    const idText = $('doc-id').value.trim();

    if (idText !== '') {
      // Mode 1: compare against one specific record
      if (!/^\d+$/.test(idText)) throw new Error('Document ID must be a whole number such as 0, 1, 2.');
      let doc;
      try {
        doc = await contract.getDocument(BigInt(idText));
      } catch (e) {
        throw new Error('No document with ID ' + idText + ' exists on the blockchain.');
      }
      const stored = doc.hash.toLowerCase();
      const rows = [['Hash on blockchain', stored, true], ['Hash of this file', computed, true], ...recordRows(doc)];
      if (stored === computed) {
        renderResult(true, 'Document is authentic', 'The hashes match. This file has not been changed since it was stored.', rows);
      } else {
        renderResult(false, 'Tampering detected', 'The hashes do not match. This file is different from the one that was stored.', rows);
      }
    } else {
      // Mode 2: search the blockchain for this file's hash
      const res = await contract.findByHash(computed);
      if (res.found) {
        const doc = await contract.getDocument(res.id);
        renderResult(true, 'Document is authentic',
          'This exact file was found on the blockchain, so it has not been changed.',
          [['Hash of this file', computed, true], ...recordRows(doc)]);
      } else {
        renderResult(false, 'Document not found',
          'This file was never stored, or it has been modified since it was stored. Enter the Document ID to compare against a specific record.',
          [['Hash of this file', computed, true]]);
      }
    }
  } catch (err) {
    renderResult(false, 'Could not verify', friendlyError(err), []);
  } finally {
    updateButtons();
  }
}

/* ---------- my documents ---------- */

async function loadMyDocuments() {
  const body = $('mine-body');
  const status = $('mine-status');
  hideAlert(status);
  if (!contract) {
    body.innerHTML = '<tr><td colspan="4" class="empty">Connect your wallet to see your documents.</td></tr>';
    return;
  }
  try {
    const ids = await contract.getDocumentsByOwner(account);
    if (ids.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="empty">You have not stored any documents yet.</td></tr>';
      return;
    }
    const docs = await Promise.all(ids.map((id) => contract.getDocument(id)));
    body.innerHTML = docs.reverse().map((d) =>
      '<tr><td>' + escapeHtml(d.id.toString()) + '</td>' +
      '<td>' + escapeHtml(d.fileName) + '</td>' +
      '<td class="mono" title="' + escapeHtml(d.hash) + '">' + escapeHtml(shortHash(d.hash)) + '</td>' +
      '<td>' + escapeHtml(formatDate(d.timestamp)) + '</td></tr>'
    ).join('');
  } catch (err) {
    showAlert(status, 'error', escapeHtml(friendlyError(err)));
  }
}

/* ---------- tabs and start-up ---------- */

function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  ['upload', 'verify', 'mine'].forEach((p) => { $('panel-' + p).hidden = p !== name; });
  if (name === 'mine') loadMyDocuments();
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
$('connect-btn').addEventListener('click', connectWallet);
$('store-btn').addEventListener('click', storeDocument);
$('verify-btn').addEventListener('click', verifyDocument);
$('refresh-btn').addEventListener('click', loadMyDocuments);
setupDropzone('upload-zone', 'upload-input', onUploadFile);
setupDropzone('verify-zone', 'verify-input', onVerifyFile);

if (window.ethereum) {
  window.ethereum.on('accountsChanged', () => location.reload());
  window.ethereum.on('chainChanged', () => location.reload());
}

(async function init() {
  await loadConfig();
  // Reconnect automatically if MetaMask is already authorised for this site
  if (config && window.ethereum) {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length) await connectWallet();
  }
})();
