# Dvault V2 classroom demo

Dvault stores encrypted documents on IPFS and records each version’s proof on a blockchain. A new version adds a record with a CID, SHA-256 fingerprint, owner, revision, and chain timestamp. It cannot replace earlier records through the contract.

## Desktop walkthrough

Open [Dvault V2](http://127.0.0.1:4174/v2/app/) in the Chrome profile with MetaMask. Use the wallet you previously funded on the local Hardhat chain.

1. Choose **Connect wallet** and open MetaMask. Approve the Dvault demo network (chain ID `31337`) if prompted.
2. Use **Unlock vault** to enter your Dvault recovery key. On an empty account, choose **Create a recovery key**, save it privately, and confirm the checkbox. The wallet signs proofs. The separate Dvault key decrypts your files.
3. Choose **Add document** and upload a synthetic `.txt` file. Add a note if you want. The browser encrypts the file, pins ciphertext, and asks MetaMask to record the proof.
4. Open the file's **Blockchain proof**. Show the CID, fingerprint, and transaction hash. **Verify & download** checks the retrieved bytes against the fingerprint and decrypts them on the device.
5. Edit the sample, then choose **Add version** inside that document’s history. Upload the edited copy and confirm it. In Version 2, use **Compare with previous** to show the changed text. If you reject MetaMask once, choose **Resume proof** to retry signing the already pinned file.
6. Lock and reopen the vault with the saved key. For a cross-device demo, use the same wallet, same chain, and same Dvault recovery key.

### If you forgot the Dvault recovery key

1. Open **Unlock vault → Forgot your recovery key?** to check the current account.
2. If the account has no saved documents or unfinished upload, choose **Create a recovery key**. You can keep the current MetaMask account and demo network.
3. If the account has data, the original Dvault key is required to open it. For a fresh upload demo, select another funded account inside your existing MetaMask wallet and keep the same demo network. Use the same demo access code if the phone asks for it.

Text comparison supports text files up to 256 KiB and 500 lines. Other file types can be verified and downloaded by version. The limit per upload is 20 MiB.

### Restart from a cold start

Use the retained Node.js 22 toolchain with the project dependencies already installed. Connect ExternalSSD and open two Terminal tabs. The short standalone guide is [START-HERE.md](../START-HERE.md).

```sh
cd /Volumes/ExternalSSD/Projects/dvault
source /Volumes/ExternalSSD/MobileStudio/env.sh
npm run node
```

```sh
cd /Volumes/ExternalSSD/Projects/dvault
source /Volumes/ExternalSSD/MobileStudio/env.sh
/Users/prafula/.local/bin/ssd-run --check
```

Continue only if the SSD check succeeds:

```sh
npm run deploy
DVAULT_HTTP_PORT=4174 DVAULT_HTTPS_ORIGIN= npm run serve
```

Pinata credentials remain in the existing ignored `.env`. Hardhat is an in-memory demo chain. Restarting it resets the demo ledger. The deployment command preserves the deployed V1 and V2 contracts when they still exist on the active chain. Use the `/v2/` path for encrypted files. The old V1 UI stores plaintext and has no version proofs.

## iPhone and Android demo

The Mac can serve V2 on trusted HTTPS over the same private Wi-Fi. The app forwards a limited set of RPC methods and signed transactions. The Hardhat server itself stays on loopback. Physical device wallet compatibility still needs to be verified.

1. Connect the Mac and phone to the same private Wi-Fi. The prepared phone URL is `https://192.168.1.8:4443/v2/app/`. Start or restart its listener from the project folder with `node --env-file=.dvault-demo/phone.env scripts/serve.js`. If the Mac IP changes or the seven-day certificate expires, move `.dvault-demo` aside and run `sh scripts/setup-phone-demo.sh MAC_PRIVATE_IPV4` to issue a new certificate.
2. Transfer **only** `.dvault-demo/Dvault-Demo-CA.cer` to your phone. On iPhone install the profile and enable trust under **Settings → General → About → Certificate Trust Settings**. On Android, install it as a user CA in the system security settings if your model and MetaMask version support it. If MetaMask does not trust a user CA, use a normally trusted HTTPS endpoint for a testnet-based demo. Remove the temporary CA from the phone after the class. [Apple certificate trust instructions](https://support.apple.com/en-us/102390)
3. Open the URL in the **MetaMask Mobile in-app browser**. If asked to add the network, use **Dvault Hardhat Demo**, RPC `https://192.168.1.8:4443/api/v2/rpc`, chain ID `31337`, symbol `ETH`. If you are using a new phone demo wallet, copy its **public address** and fund it with local test ETH from the Mac using `DVAULT_DEMO_WALLET=0xYourPublicAddress ./node_modules/.bin/hardhat run --no-compile scripts/fund-demo-wallet.js --network localhost`. Use the same wallet to show a desktop document on the phone. [MetaMask Mobile browser guide](https://support.metamask.io/configure/wallet/how-to-use-the-metamask-mobile-browser)
4. Unlock with your Dvault recovery key. For phone uploads, use the `DVAULT_DEMO_TOKEN` value in the Mac’s ignored `.dvault-demo/phone.env` as the **Demo access code**. This access code authorizes pinning on your demo server. Keep the server private and stop it after the demo.

## Design sources and how they were used

| Reference | Dvault implementation |
| --- | --- |
| [ktnr.23](https://in.pinterest.com/pin/1104437508659594777/) | Glossy rounded icon tiles translated into Encrypt, Store, Verify, and document controls. |
| [Finance icons set](https://in.pinterest.com/pin/1104437508659594743/) · [Original image](https://stock.adobe.com/images/trendy-finance-icons-set-isolated-banking-money-and-business-investment-illustrations-on-transparent-background-png-ai-generated/650607180) | Warm metal and violet materials translated into original gold, violet, and pearl coin finishes. |
| [Zircon Focus & Productivity](https://in.pinterest.com/pin/1104437508659594699/) · [Original project](https://dribbble.com/shots/27852472-Screen-Time-Tracker-App-Design-Mobile-Productivity-App) | Purple crystal accent for the Store step and a compact journey with completion states. |
| [Crypto Wallet](https://in.pinterest.com/pin/1104437508659594675/) | Espresso surfaces, a warm studio glow, oversized typography, and a prominent action on a phone. |
| [3D Looping Coins](https://in.pinterest.com/pin/1104437508659594314/) | Three original procedural WebGL coins, staged turns, delayed loading, offscreen pause, and reduced motion support. |

## What the proof means

- The server sees ciphertext, its size, and network request metadata. IPFS and the chain can expose the CID, wallet address, and timing. Filenames, notes, and contents are encrypted. The transaction timestamp comes from the chain.
- The key is held in page memory while unlocked. Only encrypted upload drafts and their public proof metadata may be kept on the local device for retry. Clearing browser data clears unfinished drafts. A confirmed document can be found again using the same wallet and decrypted with the same key.
- Someone who loses their recovery key cannot decrypt the documents. Keep backups. IPFS availability depends on pinning, and the local chain operator can reset the course demo. Use synthetic files for the classroom presentation.

## Verification performed

- Two versions through the running desktop server, Pinata, the IPFS gateway, and the real local chain. Restored ciphertext matched exactly. Both versions decrypted to the expected contents. Wrong-key and tampered-content attempts failed. The contract rejected writes by another wallet and stale revision writes.
- The same checks passed on a disposable in-process Hardhat chain with fixture CIDs.
- Desktop and 390px phone layouts rendered in the browser. The live LAN TLS endpoint served V2 and correctly relayed chain ID 31337. The old plaintext upload endpoint was blocked on the LAN listener.
- Physical-phone certificate installation, wallet signing in MetaMask, and the full UI click-through with your wallet are still pending.
