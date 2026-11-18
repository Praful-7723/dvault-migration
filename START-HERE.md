# Run the complete Dvault migration copy

Use Node.js **22**, npm and Git. Clone **https://github.com/Praful-7723/dvault-migration** and paste the single migration unlock code once when startup asks. All app variables are restored automatically. The owner also has a private plaintext backup at https://github.com/Praful-7723/dvault-private-backup; access to it is optional for running the public copy.

## Open both terminals automatically

macOS: `npm run terminals`. Windows: `npm.cmd run terminals`.

## One command

macOS: `npm run demo` from the cloned folder. Windows PowerShell: `npm.cmd run demo`. This installs dependencies on first run and starts both local services. Leave the terminal open. The app opens at **http://127.0.0.1:4174/v2/**.

## Two terminals — macOS

Terminal 1:

```sh
cd /your/clone/dvault-migration
npm run node
```

Terminal 2:

```sh
cd /your/clone/dvault-migration
npm run app
```

On the original Mac, the folder is `/Volumes/ExternalSSD/Projects/dvault`. If Node is not available in that terminal, first run `source /Volumes/ExternalSSD/MobileStudio/env.sh`. The `.command` shortcuts do this automatically when that retained SSD toolkit exists. Other Macs use their normal Node.js 22 installation.

## Two terminals — Windows PowerShell

Terminal 1:

```powershell
Set-Location C:\your\clone\dvault-migration
npm.cmd run node
```

Terminal 2:

```powershell
Set-Location C:\your\clone\dvault-migration
npm.cmd run app
```

`npm.cmd` avoids the PowerShell script-execution-policy issue affecting `npm.ps1`. Alternatively double-click `start-chain.cmd` and `start-app.cmd`. Each opens its own command window.

## What startup does

- Installs exact platform-specific dependencies from the lockfile, once. Two terminals share an installation lock.
- Uses the included checksum-verified compiled contracts without downloading the Solidity compiler.
- Reuses a running chain; otherwise Terminal 1 starts one at `http://127.0.0.1:8545`, chain 31337.
- Terminal 2 deploys idempotently, generates `frontend/config.js`, and starts the web server on port 4174.
- Opens the local page. Set `DVAULT_NO_OPEN=1` to suppress opening during automated checks.

The user handles MetaMask. Existing browser wallets and Dvault recovery keys are not cloned. A fresh chain has fresh in-memory data; the old chain was offline when the backup was made. Keep the original Dvault recovery key to decrypt an existing file. Do not clear or reset a working wallet or chain as a routine setup step.

## Stop or restart

Control C stops the process in that terminal. Stopping only the web server leaves the separate chain running. `npm run demo` owns both services it started and stops its child processes when closed. An in-memory chain loses its records when stopped. Restarting only the page server does not require a new wallet.

CSS/module changes need only a Chrome refresh (`Command Shift R` / `Ctrl Shift R`). The older phone HTTPS files are preserved privately for reference; regenerate certificates for the new machine/IP before a phone demo.

If a different program owns the chosen port, do not kill it blindly. Set `DVAULT_HTTP_PORT` to another port. If contracts were edited, run `npm run compile` followed by `npm run bundle:artifacts` before startup. A Windows computer was not available for a live validation of its launchers.
