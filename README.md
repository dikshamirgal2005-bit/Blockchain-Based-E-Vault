# Blockchain-Based E-Vault

A mini project that proves a digital document has not been tampered with.
The file never leaves your computer. Only its SHA-256 hash (a fingerprint) is saved on a smart contract running on a local Ganache blockchain.

## How it works

1. **Store:** choose a file. The browser creates its SHA-256 hash and MetaMask sends the hash to the `EVault` smart contract.
2. **Verify:** choose a file again. The browser re-creates the hash and compares it with the hash saved on the blockchain.
3. Change even one character in the file and the hash becomes completely different, so tampering is detected.

```
Browser (HTML/CSS/JS)  --MetaMask-->  Ganache blockchain (EVault.sol)
        ^
        |  serves pages + contract address and ABI
Node.js / Express server
```

## Folder structure

```
blockchain-evault/
  contracts/EVault.sol    Solidity smart contract
  scripts/deploy.js       Compiles and deploys the contract to Ganache
  scripts/fund.js         Sends fake ETH from Ganache to your MetaMask account
  server.js               Express server (website + contract info)
  public/index.html       User interface
  public/style.css        Styling
  public/app.js           Hashing, MetaMask and contract calls
  package.json
```

## Install once

- Node.js 18 or newer (nodejs.org, LTS version)
- MetaMask browser extension (metamask.io)

## HOW TO RUN (Windows PowerShell)

You need three PowerShell windows, all opened in the project folder.
Tip: open the folder in File Explorer, click the address bar, type `powershell`, press Enter.

**Step 1: Install packages (once)**
```
npm install
```

**Step 2: Window 1 - start the blockchain (keep it open)**
```
npm run ganache
```
Wait for `RPC Listening on 127.0.0.1:7545`.

**Step 3: Window 2 - deploy the contract, then start the website (keep it open)**
```
npm run deploy
npm start
```
You should see `EVault deployed at: 0x...` and then `E-Vault running at http://localhost:3000`.

**Step 4: Get fake ETH into MetaMask (once per Ganache start)**
1. In MetaMask, select the account you want to use and click the copy icon next to its address.
2. Window 3:
```
node scripts/fund.js 0xYOUR_METAMASK_ADDRESS
```
You should see `Sent 100 ETH ...`.

**Step 5: Open the website**
1. Go to `http://localhost:3000` (use `localhost`, not an IP address).
2. Click **Connect MetaMask**, then **Switch to Ganache** if the yellow banner appears. Approve both in MetaMask.
3. Your funded account should show 100 ETH on the Ganache network.

**Step 6: Use it**
- **Store a document:** choose a file, click *Store on blockchain*, confirm in MetaMask, and note the Document ID.
- **Verify a document:** choose the file, enter the Document ID, click *Verify document*. Green means authentic.
- **My documents:** lists everything you stored.

Next time: repeat Step 2, Step 3 and Step 4 (Ganache starts empty each time), then use the website.

## Put it online (Render + public test network)

Ganache only exists on your computer, so an online website needs the contract on a public test network.

1. Create a **new MetaMask account used only for testing**. Get free test ETH for your chosen network from a faucet.
2. Deploy the contract to the public network (PowerShell):
   ```
   $env:PRIVATE_KEY="0xYOUR_TEST_ACCOUNT_PRIVATE_KEY"
   $env:RPC_URL="https://YOUR_RPC_URL"
   $env:CHAIN_NAME="Sepolia"
   $env:EXPLORER_URL="https://sepolia.etherscan.io"
   npm run deploy
   ```
   This creates `build/EVault.public.json`. Never put the private key in a file or on GitHub.
3. Push the project to GitHub (`node_modules` is ignored, `build/EVault.public.json` must be included).
4. On render.com: New > Web Service > pick the repo. Build command `npm install`, start command `npm start`, instance type Free.
5. Add the environment variable `CONTRACT_CONFIG` = `build/EVault.public.json`.
6. Open the `onrender.com` link. Visitors need MetaMask on the same network and a little test ETH to store documents.

Free Render services sleep after 15 minutes without visitors, so the first load can take about a minute.
Local demo with Ganache keeps working as before because it uses `build/EVault.json`.

## Tamper test

1. Create `report.txt` containing `Marks: 85` and store it. Note the Document ID.
2. Change it to `Marks: 95` and save.
3. Verify the edited file with the same ID. Result: **Tampering detected**.
4. Change it back to `Marks: 85` and verify again. Result: **Document is authentic**.

## Smart contract functions

| Function | Purpose |
|---|---|
| `storeDocument(hash, fileName)` | Saves a hash with the uploader's address and time. Rejects duplicates. |
| `getDocument(id)` | Returns the stored record for an ID. |
| `findByHash(hash)` | Tells whether a hash exists and its ID. |
| `getDocumentsByOwner(address)` | Lists the IDs stored by one account. |

## Common problems

| Problem | Fix |
|---|---|
| "Smart contract not found" banner | Start Ganache, run `npm run deploy`, refresh the page. |
| MetaMask shows the wrong network | Click **Switch to Ganache** in the banner. |
| MetaMask shows 0 ETH | Run `node scripts/fund.js 0xYOUR_ADDRESS` and make sure the Ganache network is selected. |
| `ENOSPC no space left on device` | C: drive is full. Free space, or run `npm config set cache D:\npm-cache`. |
| Nonce or "chain was reset" errors after restarting Ganache | MetaMask > Settings > Advanced > *Clear activity tab data*. |
| Restarted Ganache | Run `npm run deploy` again, then refresh the website. |
| "µWS not compatible" message in Ganache | Harmless, ignore it. |

## Possible viva questions

- **Why store only the hash?** It is small, cheap, and keeps the document private.
- **Why SHA-256?** Any change to the file gives a totally different hash, and the file cannot be recovered from the hash.
- **Why a blockchain?** Records cannot be edited or deleted, so nobody can quietly replace a stored hash.
- **Role of MetaMask?** It holds the user's account and signs the transaction that stores the hash.
- **Role of Ganache?** A personal Ethereum blockchain on your computer for testing.

## Ideas to extend

IPFS storage for the files, user roles (issuer and verifier), QR code for verification, deployment to a testnet such as Sepolia.
