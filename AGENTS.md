# Dvault: clone and run

This is a plain Node/Hardhat/WebGL application. Use this clone as the working directory, not paths from the original Mac. Keep the existing application and contracts intact when the task is just to run it.

## Run it immediately

1. Use Node.js **22** with npm and Git. `.nvmrc` and `.node-version` specify the tested major version.
2. This public clone contains `migration-config.enc.json`. On first run, request only the owner's single migration unlock code, not individual API keys. The launcher decrypts every variable into an ignored `.env`. An agent may set `DVAULT_MIGRATION_PASSWORD` without printing it. The owner's complete plaintext copy is **https://github.com/Praful-7723/dvault-private-backup** (private). It already contains the real `.env`; do not overwrite it with `.env.example`, ask for its keys again, or print secrets. `ENVIRONMENT.txt` in that private copy records every configuration value. The public repository contains encrypted configuration, not plaintext credentials.
3. Run `npm run demo` in the repository. On Windows PowerShell, use `npm.cmd run demo`. The built-in launcher installs the exact dependencies on first run, starts a local chain if needed, restores checksum-verified bundled contract artifacts, deploys the contracts, generates frontend configuration, starts the app and opens its local URL.
4. Alternatively, use two terminals below. On the original Mac, `start-chain.command` / `start-app.command` automatically use the retained SSD Node runtime if available. The Windows equivalents are `start-chain.cmd` / `start-app.cmd`.

### macOS — Terminal 1

```sh
cd /your/clone/dvault-migration
npm run node
```

### macOS — Terminal 2

```sh
cd /your/clone/dvault-migration
npm run app
```

### Windows PowerShell — Terminal 1

```powershell
Set-Location C:\your\clone\dvault-migration
npm.cmd run node
```

### Windows PowerShell — Terminal 2

```powershell
Set-Location C:\your\clone\dvault-migration
npm.cmd run app
```

Use `npm run terminals` (macOS) or `npm.cmd run terminals` (Windows) to open and populate both terminals automatically. Leave both terminals open. Default URL: **http://127.0.0.1:4174/v2/**. If the user asks to open two terminals, launch two local terminal sessions and run these commands; creating a terminal is separate from explaining the commands. The user handles MetaMask. Do not import wallets, reveal wallet keys, change networks or approve transactions without a separate instruction.

## Startup behavior

- Installation has a shared lock so both terminals can be started together. Dependencies are regenerated for the current OS; never copy macOS `node_modules` to Windows.
- An existing local chain is reused, not killed or reset. Chain ID is 31337. Only loopback RPCs can be automatically started.
- Compiled artifacts are bundled in `demo-artifacts`; normal demo startup does not download solc. After changing Solidity, run `npm run compile` and `npm run bundle:artifacts`.
- `npm run app` deploys idempotently and updates `frontend/config.js`. No manual contract-address editing is required.
- HTTP port defaults to 4174. Optional phone HTTPS needs a new certificate for the new machine/IP. Do not reuse the old Mac's phone certificate as though it were trusted on another device.
- `DVAULT_NO_OPEN=1` suppresses browser opening for automated checks. Respect any user instruction not to open a browser.
- A fresh Hardhat node starts a fresh in-memory ledger. A Git clone does not restore old blocks, MetaMask's browser profile, or a Dvault recovery key. Do not promise those were recovered. The chain was offline when this migration backup was made.
- Existing encrypted documents require their original Dvault recovery key. Do not create a replacement and imply it decrypts old files.
- On the owner's Mac, follow the SSD guard and retained MobileStudio web-only workflow. Do not install native mobile SDKs. On other machines use the user's selected clone location and the portable scripts.

Read `README.md`, `START-HERE.md` and `ENVIRONMENT.txt` for details. Never change the private migration repository's visibility or publish its configuration files to the public mirror.
