# Dvault V2 acceptance cases

These cases define the minimum acceptance bar for the V2 classroom demo. They describe target behavior; the current V1 source does not yet encrypt files, store version proofs, or provide interrupted-upload recovery. Use a local/demo chain and disposable test files and wallets. Never use real credentials, private keys, or sensitive documents.

## Test fixtures and observables

- Wallet A owns the test vault; Wallet B is a separate account. Use a fresh test key or wallet and a chain configured for the demo.
- Prepare `note.txt` containing a unique phrase such as `dvault-acceptance-<random>`, plus a small binary file and a second revision of `note.txt` with different bytes.
- Observe the exact bytes sent to the IPFS pinning endpoint, the resulting gateway bytes, transaction/event data, the wallet prompt, and UI status. Keep a copy of original inputs to compare after recovery.
- A **version proof** means a transaction receipt/event that commits to the version identity and integrity metadata (at minimum the encrypted-content CID and cryptographic digest, with owner and version ordering). The chain must not receive plaintext or a decryption key. A successful upload is not accepted as verified until its proof transaction is confirmed.

## Encrypted IPFS bytes

| ID | Case and steps | Pass condition | Fail condition |
| --- | --- | --- | --- |
| ENC-01 | Upload `note.txt` with Wallet A. Capture request body at the pinning boundary and fetch the pinned object through the configured gateway. | Pinned payload is ciphertext/encrypted package, not original bytes; neither captured payload nor gateway response contains the unique plaintext phrase. After authorized decryption, downloaded bytes exactly match the original file. | Plaintext or filename-derived secret is sent to the pinning provider, decrypted output differs, or the UI claims encryption while upload fails before encryption. |
| ENC-02 | Inspect browser network traffic, browser storage, logs, chain calldata/events, and public file metadata after upload. | No plaintext content or decryption secret appears in network requests to IPFS, public chain data, logs, or persistent browser storage. Public metadata is limited to what the product explicitly documents. | Any content key or plaintext is exposed in a URL, analytics/log, chain event, or persistent storage without an explicit protected design. |
| ENC-03 | Upload same file twice with independently generated encryption randomness. Compare ciphertext CIDs and on-chain records. | Ciphertexts are independently randomized (normally distinct); each record has its own digest/proof and both decrypt to the exact original bytes. | Reuse of a deterministic content key/nonce leaks equality, duplicate versions collapse, or one record cannot be independently verified/decrypted. |
| ENC-04 | Change one byte in a downloaded encrypted object, then attempt verification/decryption. | Integrity verification fails closed with a clear error; corrupted bytes are never presented as a valid recovered file. | Modified content is accepted, silently repaired without an integrity check, or shown as verified. |
| ENC-05 | Try a wrong key and a truncated/invalid encrypted package. | Decryption is rejected, no output is marked valid, and the user receives a recoverable error. | Wrong-key or malformed input yields apparently successful output or crashes the workspace. |

## On-chain version proofs

| ID | Case and steps | Pass condition | Fail condition |
| --- | --- | --- | --- |
| VER-01 | Upload initial revision as Wallet A and wait for transaction confirmation. Open its details. | Confirmed proof identifies owner, version, encrypted CID and digest; UI links the displayed proof to the transaction/receipt and shows confirmed status only after confirmation. | UI reports verified before confirmation, or record omits/mismatches the encrypted object identity or digest. |
| VER-02 | Upload changed revision under the same logical file. Reload the library and inspect both versions. | A second immutable version is added with a greater version position and its own CID/digest/proof. The first proof and bytes remain unchanged and retrievable. | New upload overwrites prior proof, ordering is ambiguous, or old version metadata/content is altered. |
| VER-03 | Recompute the digest from the downloaded encrypted bytes and compare with the proof; then substitute another CID or digest in a test fixture. | Original digest matches; substituted/mismatched content is explicitly unverified and cannot be presented as the proven version. | UI trusts a filename or gateway response without matching the committed integrity value. |
| VER-04 | Connect Wallet B and query Wallet A's version list and public chain data. Attempt to access/decrypt the object without an authorized key. | Public proof metadata is readable as designed, but encrypted bytes do not reveal file contents and Wallet B cannot decrypt absent an explicitly granted key. | Wallet B can read plaintext from public metadata/storage or ownership is represented only by a client-side label. |
| VER-05 | Reject the wallet signature or force a reverted proof transaction after the encrypted object has pinned. | State clearly says “Pinned to IPFS. Awaiting blockchain proof”; preserve the CID and encrypted package reference for the initiating wallet and chain, and offer retry of proof without re-uploading. Do not call it verified. | A retry re-uploads unnecessarily, the CID is lost, another account/chain adopts the pending object, or UI reports success despite missing proof. |

## Recovery and failure handling

| ID | Case and steps | Pass condition | Fail condition |
| --- | --- | --- | --- |
| REC-01 | Interrupt network after pinning succeeds but before proof confirmation; return to the app as the same wallet and chain. | The pending item is discoverable and scoped to that owner and chain; user can retry proof and complete without uploading again. | Pending state disappears, becomes available to another account, or is silently treated as complete. |
| REC-02 | Reload/close the tab during an upload at each stage: before pin, after pin, during wallet prompt, and after broadcast before confirmation. | UI distinguishes not uploaded, pinned/unproved, submitted/pending, and confirmed states. Reopening never fabricates success; safe retry behavior is offered for each state. | Duplicate untracked uploads/transactions occur, or state claims a stage that was not reached. |
| REC-03 | Revoke/deny access to a recovery key or provide an unavailable key source, then retry later with the correct recovery material. | Failure is explicit and non-destructive; encrypted object and proof remain intact; valid recovery material restores exact original bytes. | Recovery deletes/overwrites the only ciphertext, leaks key material, or reports successful recovery without verifying bytes. |
| REC-04 | Lose local app state and restore using the documented recovery method on a clean browser profile/device. | The documented method recovers the intended versions, verifies proofs and content digests, and explains any metadata that cannot be reconstructed. | Recovery depends on undocumented local-only state or cannot distinguish altered data from valid data. |
| REC-05 | Simulate IPFS/gateway timeout, pinning rejection, unsupported file, and proof transaction revert. | Each error names the failed stage, preserves only valid recoverable state, allows retry where safe, and never exposes plaintext or key material in error details. | Generic “success” on partial failure, destructive retry, secret-bearing error/log, or hung loading state. |

## Onboarding and mobile flow

| ID | Case and steps | Pass condition | Fail condition |
| --- | --- | --- | --- |
| ONB-01 | Open a clean session with no wallet connected. Follow onboarding through connect, store, and verify. | One clear primary action per step; copy explains what is encrypted, what is public on-chain, what persists, and how recovery works before the first upload. The disconnected state is distinct from an empty library. | User is led to upload before understanding the wallet/proof and recovery requirements, or the empty state implies wallet connection is already complete. |
| ONB-02 | Connect a wallet, reject the connection prompt, then connect successfully. Switch account and chain afterward. | Rejection is handled without false connected status. Account/chain changes refresh ownership and pending state; actions require the configured chain and explain how to proceed. | Stale account data is displayed as current, pending upload crosses account/chain scope, or signing proceeds on the wrong chain. |
| MOB-01 | Complete connect, choose a file, encrypt, pin, sign, verify, and inspect the version list on a real iPhone Safari and Android Chrome viewport. | App and wallet return path are usable without horizontal scrolling; native file selection works; every stage remains visible and actionable; proof details and copy/open actions fit touch layouts. | Essential action is off-screen/unreachable, wallet return loses the flow, file selection fails, or content overflows/clips. |
| MOB-02 | Repeat upload on a phone with a large-text/accessibility setting and keyboard/switch navigation where available. | Labels remain readable; controls have accessible names and practical touch targets; focus order is logical; status changes are announced to assistive technology. | Status is conveyed only by color/animation, focus is trapped or lost, or controls become inaccessible. |
| MOB-03 | Use a phone on a network where the app endpoint, RPC, or IPFS gateway is unreachable in turn. | Each dependency failure is identified separately with a retry path; no stage is marked complete prematurely and the pending CID/proof state is retained when safely available. | Failure is misattributed, data is silently lost, or an unreachable loopback/local-only endpoint is presented as a working phone flow. |

## Reduced motion and visual fallback

| ID | Case and steps | Pass condition | Fail condition |
| --- | --- | --- | --- |
| MOT-01 | Enable OS/browser `prefers-reduced-motion: reduce` before opening onboarding and workspace. | Animated scenes, looping shaders, parallax, spinning coins, sheen and nonessential transitions are disabled or reduced to a stable still. All content and actions remain available. | Motion continues continuously, essential information is hidden in animation, or reduced-motion mode breaks navigation. |
| MOT-02 | Enable reduced motion after page load, then turn it off again. | The page responds to preference changes without reload or loss of work; restored motion remains brief and nonessential. | Preference changes are ignored or restart/lose an in-progress upload. |
| MOT-03 | Disable WebGL or use a low-performance/mobile device. Scroll onboarding scene offscreen and background the tab. | Static artwork fallback renders; offscreen/hidden animation pauses; upload status and controls remain functional without WebGL. | Blank essential region, excessive battery/CPU use while hidden, or motion failure prevents core tasks. |

## Release gate

V2 is not accepted for classroom use until ENC-01/02/04, VER-01/02/03/05, REC-01/02/05, ONB-01/02, MOB-01, and MOT-01/03 pass on the supported desktop and phone setup. Record browser/device, chain, wallet, test-file hash, transaction hash, encrypted CID, and outcome for each run. Keep secrets and plaintext out of the run log.
