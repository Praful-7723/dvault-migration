# Dvault — portable migration copy

A confidential document drive using browser-side encryption, IPFS and verifiable blockchain version records. This public copy includes the latest app, fonts, artwork, compiled demo contracts and an **encrypted bundle of the current configuration**.

## Clone and run — macOS

Install Node.js **22** with npm and Git once, then:

```sh
git clone https://github.com/Praful-7723/dvault-migration.git
cd dvault-migration
npm run demo
```

On first run, paste the migration unlock code supplied by the owner. Input is hidden. Startup restores every app variable to a local ignored `.env`, installs the exact dependencies, starts the local chain, deploys the bundled contracts, updates the frontend addresses and opens **http://127.0.0.1:4174/v2/**. No individual Pinata keys need to be entered. Subsequent runs do not ask for the code.

## Clone and run — Windows PowerShell

```powershell
git clone https://github.com/Praful-7723/dvault-migration.git
Set-Location dvault-migration
npm.cmd run demo
```

Use the same one-time unlock code. `npm.cmd` avoids PowerShell's script policy for `npm.ps1`.

## Open two terminals automatically

macOS: `npm run terminals`. Windows PowerShell: `npm.cmd run terminals`.

This opens one terminal for the blockchain and another for deployment and the app. The two processes coordinate dependency installation and configuration unlocking, so the unlock code is needed only once. You can also double-click the included `start-chain` and `start-app` shortcuts.

## Two-terminal commands manually

| Terminal | macOS | Windows PowerShell |
|---|---|---|
| 1 — blockchain | `npm run node` | `npm.cmd run node` |
| 2 — deploy + app | `npm run app` | `npm.cmd run app` |

Run both from this clone and leave them open. The user handles MetaMask. Local chain ID: **31337**; RPC: **http://127.0.0.1:8545**. If either service already runs, the launcher reuses it rather than resetting it.

## Configuration

- `migration-config.enc.json` contains the actual saved app configuration encrypted with AES-256-GCM and a scrypt-derived key. The unlock code is not in this public repository.
- `.env.example` and `ENVIRONMENT.txt` document all required and optional variables.
- Unlocking writes a complete local `.env`; keep it out of public Git history.
- An agent can supply the code through `DVAULT_MIGRATION_PASSWORD` for a non-interactive first run. Do not put the code in a commit or print secrets.
- The owner also has a complete **private** plaintext backup at https://github.com/Praful-7723/dvault-private-backup. That clone already has `.env` and requires no unlock prompt.

Dependencies are rebuilt for each OS; macOS `node_modules` is not copied to Windows. Compiled Solidity artifacts are bundled with checksums, so normal startup does not download a compiler. Contract changes require `npm run compile` followed by `npm run bundle:artifacts`.

## What a clone cannot recover

The old local blockchain was offline during backup. Fresh Hardhat nodes begin with a fresh in-memory ledger; Git does not preserve past blocks, MetaMask browser profiles or a forgotten Dvault recovery key. Existing encrypted files still require their original recovery key. The old Mac's optional phone TLS setup is archived privately; another machine needs its own certificate/IP configuration for a phone demo.

## Agent and test instructions

Read **AGENTS.md** first. `START-HERE.md` has the terminal instructions. `DVAULT_NO_OPEN=1` suppresses browser launch for automated checks. `npm run verify:contracts` checks encryption, version history and tamper rejection on a temporary in-process test chain with synthetic data.

Fresh-clone startup, saved configuration restoration, Pinata authentication and isolated crypto/contract checks passed on the migration Mac. See [the validation record](docs/MIGRATION-VALIDATION.md). Windows launch plans are provided without Mac path dependencies; no physical Windows computer was available for a live run.
