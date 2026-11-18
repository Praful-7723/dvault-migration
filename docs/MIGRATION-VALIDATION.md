# Migration validation

Validated on 18 November 2026 from a fresh clone of the public GitHub repository, in an isolated directory on the owner's Mac. No browser was opened and the owner's existing preview and wallet were left alone.

Environment: macOS, Node.js 22.23.3, npm 10.9.9, Hardhat 2.22.17.

| Check | Result |
|---|---|
| Public GitHub clone with no existing dependencies or `.env` | Passed |
| First-run installation from `package-lock.json` | Passed |
| Unlock encrypted configuration and restore saved Pinata credentials | Passed; values compared locally without printing them |
| Pinata authentication | HTTP 200; no files uploaded by this check |
| Start local chain and deploy all three bundled contracts without compilation | Passed; isolated chain ID 31337 |
| Serve the app locally | HTTP 200 at `/v2/` |
| Run app startup again against the same services | Passed; existing contracts and server reused |
| Web Crypto and contract verification | Passed on an isolated in-process Hardhat chain |
| JavaScript syntax for launchers and verification script | Passed |
| Windows command construction | Checked paths with spaces and apostrophes; `.cmd` files use real CRLF line endings |
| macOS terminal command construction | Checked shell quoting; automatic terminal opening not invoked during validation |

The contract check covers encrypted labels/files, wrong-key rejection, two saved revisions, ownership, revision conflicts, duplicate documents, and tamper rejection. It decodes custom errors using the bundled ABI, so it does not depend on compiler build metadata absent from a fresh clone.

The isolated live startup used RPC port 18545 and web port 4194 to avoid the owner's services. Normal defaults remain 8545 and 4174. The test services were stopped after validation.

Windows launchers have not been run on a physical Windows computer. Browser rendering, MetaMask setup, wallet approval and a complete live IPFS upload were not exercised in this migration check. Git does not migrate the old in-memory blockchain, browser wallets or recovery keys. See `README.md` for setup and recovery limits.
