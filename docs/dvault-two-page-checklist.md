# Dvault two-page review checklist

A checkmark records a completed review. Evidence below identifies browser observations, simulated failures, and live service results. Visual checks affected by the latest glass and motion changes have been reopened pending browser verification; the previous browser observations remain historical evidence.

## Dashboard and header

- [x] D01 One workspace heading with Documents first; no repeated Overview, hero banner, Guide, or Proof Collection.
- [x] D02 No desktop rail or need for a rail collapse control; no dead navigation.
- [x] D03 File list, upload composer, progress, and version history are separate, legible areas.
- [x] D04 Desktop progress is on the right; phone reading order follows the task.
- [x] D05 The approved brand remains small and crisp; large art does not reuse the header raster.
- [x] D06 Back to landing is visible, labeled, aligned, and keyboard usable.
- [ ] D07 Wallet, sound, and theme controls align; controls have usable targets and distinct states.
- [x] D08 Wallet address is shown only in account details, not duplicated in readiness or the header.
- [x] D09 Connection is named and visibly green when connected; a registry or connection error has red styling and actionable feedback.
- [x] D10 Vault locked and wallet disconnected are distinguishable with text; one access action per state.
- [x] D11 Registry readiness is compact; an outage expands to actionable detail and retry.
- [ ] D12 The light workspace uses purple and white frosted surfaces; the dark workspace uses black and amethyst frosted surfaces. Current browser appearance remains to be checked.
- [ ] D13 Metallic edges, restrained shadows and backdrop frosting preserve readable text. Current browser appearance remains to be checked.
- [ ] D14 The main button label and arrow are centered as one group; focus and press states remain visible.
- [x] D15 Dense headings, duplicate helper text, and unnecessary pills are removed.
- [ ] D16 Actual layouts fit with no page overflow at desktop and a short phone size.
- [ ] D17 Text enlargement and narrow content do not overlap, and bottom actions are accessible with a phone keyboard.
- [x] D18 Sound on/off and light/dark are distinguishable visually and by accessible name.

## File, version, and recovery flow

- [x] F01 Unlocked upload and library actions live with their respective areas.
- [x] F02 New document and new version are distinct; new version starts from a selected document.
- [x] F03 Filename and save destination are visible before saving.
- [x] F04 The file name or selected history identity carries through progress, receipt, and history.
- [x] F05 Version history stays inline and opens the selected document; selected file is marked.
- [x] F06 The three coins have different silhouettes and follow actual encryption, storage, and proof steps.
- [x] F07 Stage text and an icon still identify the state with motion disabled or no WebGL.
- [x] F08 Transfer percentage measures bytes sent; 100% transfer is distinguished from IPFS pinning.
- [x] F09 Stored and awaiting wallet approval, chain confirmation, and recorded proof are separate.
- [x] F10 Cancelling a signature leaves a stored file with a single Resume proof action.
- [x] F11 A failed transfer retains an encrypted draft and gives an actionable retry.
- [x] F12 The receipt gives version and proof status and opens the correct inline record.
- [x] F13 A recorded proof is distinguished from verifying downloaded bytes.
- [x] F14 Connection/registry failure does not falsely claim a save or disconnect a working wallet.
- [x] F15 Returning to the app with a pending draft does not require reuploading pinned data.
- [x] F16 Cold browser walkthrough: enter, connect, unlock, choose file, cancel signature, resume, open history, verify.
- [x] F17 Real Hardhat, Pinata, and gateway encrypted-version checks.
- [ ] F18 Physical MetaMask Mobile signing and file picking.

## Landing

- [x] L01 Keep one primary entry action and the fixed, single-screen design.
- [x] L02 Use concise stronger promise, large readable type, and a clear confidentiality explanation.
- [x] L03 Use a large purple WebGL coin with the Dvault logo on both faces.
- [x] L04 Show the approved red chrome coins during the entry transition. Use a still purple branded medallion when WebGL is unavailable.
- [ ] L05 Purple, black, and white ordered dither animates behind the art without washing out text.
- [x] L06 The background uses an original ordered-dither implementation inspired by React Bits.
- [ ] L07 Disable continuous motion for reduced-motion users and pause hidden animation.
- [ ] L08 Landing CTA remains visible and coin fits on desktop and short phone screens; no page scroll.
- [ ] L09 Both themes render legibly; control states follow the user’s selected theme.

## Ship checks

- [x] S01 Verify JavaScript parses, bindings resolve, and live frontend/assets respond.
- [x] S02 Record what was checked, what is still manual, and what could not be verified.

## Earlier browser verification

| Scope | Evidence |
| --- | --- |
| D01–D08, D10, D15 | The live workspace showed four task areas and one Documents heading with stable Back to landing navigation. I activated Back to landing with Enter. The fixture showed the connected and locked states, then account details. The address appeared in the account dialog. |
| D09, D11, F14 | The simulated registry failure showed Registry unavailable with a retry control and an explanation. The wallet stayed connected. Retry restored Registry online. The disconnected and connected wallet text rendered in red and green respectively. |
| D12–D14, D18, L09 | Inspected both themes and their computed backgrounds. Workspace cards and the landing base use solid fills. Clicked both settings and checked names and pressed state. The audio control state was verified in the browser. Audible playback was not independently measured. |
| D16, L01–L05, L08 | Browser bounds at 1280×720 and 360×640 showed no body overflow. The mobile workspace scrolls within its content region. The landing CTA ended at 624px in the 640px frame and at 552px in the 568px frame. The original responsive review tested 320×568 and 360×640. The subsequent branded-coin check observed the Dvault logo on the landing and a purple still medallion with WebGL disabled. |
| F01–F07, F12–F13 | The isolated fixture exercised new documents, new versions, and inline history. The composer identified the file and its destination. The final save collapsed the composer, refreshed the selected history, and highlighted the right version with technical details closed. Verified downloaded bytes for Versions 1 and 2. Disabled WebGL in the fixture and observed the fallback icons and labeled stages. |
| F08–F11, F15–F16 | The browser showed separate transfer-complete, pinning, paused, stored, confirming, and proof-recorded states. The meter is calculated from XHR bytes loaded and total. Forced one storage error and one cancelled signature. After reloading the pinned draft, resumed from disk and confirmed the proof. Fixture counters recorded one failed POST, one successful retry, and one POST for the next revision, with no additional POST to resume the first proof. |
| F17 | The isolated contract/crypto script passed. A separate live run pinned two synthetic encrypted versions through Pinata, committed them to the active Hardhat registry, retrieved them from the IPFS gateway, and verified and decrypted them. No personal wallet or document was used. |
| L06 | Original Canvas ordered dither inspired by [React Bits Dither Wave](https://pro.reactbits.dev/docs/components/dither-wave). The landing coin and the three workflow coins use custom WebGL. The approved red chrome artwork is the three-second entry slide. |
| S01–S02 | JavaScript syntax and HTML ID checks passed. Pages, CSS, modules, app manifest, brand icon, favicon, and both poster sizes returned HTTP 200 from the live local server. |

## Checks still open

- **D17** — Narrow browser layouts passed. Physical phone keyboard resizing and enlarged accessibility text still need device checks.
- **F18** — The browser fixture simulated MetaMask events. Picking a file and approving a live transaction in the MetaMask Mobile app need an actual phone walkthrough.
- **L07** — The renderer has reduced-motion, offscreen, and hidden-tab gates. The no-WebGL fallback passed. I did not run a system reduced-motion and background-pausing test with an active renderer or measure physical phone frame rate.

## Entry and recovery follow-up

- The live landing and return link showed the purple branded coin. The red artwork is hidden outside the entry transition.
- The live entry went directly to Documents after the three-second hold. A synthetic registry response delayed beyond three seconds kept the same slide visible with “Checking the demo registry…” until the response arrived.
- A 360×640 browser frame showed the full entry slide and landing action without body overflow.
- The recovery fixture allowed a new key on an empty account and blocked replacement on an account with saved files. The help panel explained each outcome.

## Landing refinement on 18 November

- Kept the coin mesh, camera projection, and rendered size parameters. Source comparison against the pre-edit copy passed.
- Used Prototype from the supplied edit bundle for the headline. Body text continues to use Geist. The font is a 14 KiB local WOFF2 asset and is preloaded.
- Checked actual glyph advances and letter spacing against the headline column at widths from 320px to 1920px. “Verifiable history” fits on one line at those sizes.
- Replaced the square background on the coin with a silhouette mask of the existing mascot. The same front/reverse texture mapping remains in use. The static fallback uses a matching silhouette.
- Reduced dither size and opacity, concentrated it behind the coin, and faded it near the edges.
- Raised the composition, gave the title more line spacing, softened the header controls, and refined the primary button’s border, highlight, hover, and pressed states.
- Updated the description to explain encryption before upload and a blockchain record for each version.
- The first light-theme desktop browser review showed the font, mascot silhouette, softer dither, and quieter header. Subsequent font sizing and preload changes passed source checks.
- Final phone, dark-theme, and navigation browser checks remain pending because browser permission was declined for both the temporary test origin and the live preview. Existing earlier verification does not count as a final check of this refinement.

## Entry orbit and browser-state diagnosis on 18 November

- Added an angled, slowly rotating entry composition using the existing transparent desktop and mobile WebP assets. This is a CSS perspective illusion applied to the entire image; its individual coins do not rotate independently.
- The composition turns once every 16 seconds while its angle shifts over a seven-second cycle. It pauses when the document is hidden and remains still with reduced motion. The existing three-second minimum entry hold is unchanged.
- Removed the rectangular focus outline from programmatically focused content headings. Keyboard focus outlines remain on interactive controls.
- The supplied Codex screenshot shows the custom WebGL workflow coins. The supplied Chrome screenshot shows the CSS fallback marks. The actual Chrome graphics failure has not been inspected; no claim is made that hardware acceleration or a specific shader error is the cause.
- The screenshots also show different wallet states: disconnected in Codex, connected with the vault locked in Chrome. Sound and theme preferences are stored separately in each browser profile.
- Added named renderer-fallback reasons to the canvas dataset and setup warnings in the developer console to make the actual graphics failure inspectable on the next Chrome check.
- JavaScript syntax, four simulated graphics-initialization failure paths, CSS parsing, HTML IDs and transparency in both WebP assets passed source checks. The current preview responds successfully. Live Chrome appearance and motion have not been verified because the saved browser permission still blocks access; no browser retry or workaround was used.


## Glass and cross-renderer motion update on 18 November

Implementation:
- The three workflow coins now have gentle idle motion and faster motion during active save stages. Finishing or pausing an upload returns to idle motion rather than stopping the scene.
- WebGL and the new Canvas renderer share their coin positions, stage changes and turn logic. If WebGL cannot initialize or draw its first frame, the page mounts an animated Canvas scene on a fresh canvas element. Runtime context loss also transfers to that scene and retains the selected stage.
- The Canvas scene uses distinct lock, storage and verification shapes, dark faces, metallic sidewalls and the approved Dvault mascot on both faces of the landing coin. The last CSS-only fallback also has gentle motion. Reduced motion intentionally keeps the scenes still.
- Both backgrounds now use ordered cells with varied sizes and five shades. The landing treatment is stronger and concentrated around the coin; the dashboard treatment is quieter beneath frosted panels. Background rendering is capped at 12 frames per second and stops when hidden or offscreen.
- Cards now use translucent amethyst and white materials, inset edge highlights and bounded backdrop blur. Solid reading surfaces remain available when backdrop filters are unsupported.
- Header, form and card controls use 44px minimum targets, centered icon/text groups and responsive action rows. The narrow header places the wallet action and preference controls on one aligned row. Library actions and recovery actions have dedicated narrow-screen layouts.

Checks performed on the current source:
- JavaScript syntax for every changed module and the server passed; both CSS files parsed without errors. HTML IDs, control bindings and local module paths resolved.
- The real Canvas drawing code was rasterized with the bundled native Canvas runtime. Pixel comparisons confirmed idle movement, stage selection, hidden-tab pause, reduced motion, theme refresh and disposal for four simulated WebGL failure types, the landing coin and desktop/phone background sizes.
- Separate WebGL API doubles confirmed changing idle matrices, recovery from a runtime context loss and clean recovery after a first-frame drawing error. These are lifecycle tests, not a live Chrome GPU or shader test.
- Supplied font measurements and authored grid widths checked header, wallet and library labels at 320, 360, 390, 430, 540 and 640 pixels. Card text and button contrast bounds passed. These are source constraints, not rendered mobile layout checks.
- The restarted preview served the landing, app, CSS, fonts declaration, manifest and every graphics module successfully. Served module bytes matched the files on disk. The relay still returned chain ID 31337; the existing blockchain process was not restarted.

Still unverified:
- The actual Chrome GPU failure reason and final live Chrome visual result.
- Frosting, text enlargement, keyboard resizing and button placement in actual desktop and phone browser frames after this update.
- Physical phone signing, file selection and measured browser/device frame rate.

The saved browser permission still denies preview access. No browser retry, alternate browser automation or workaround was used. Offline raster checks do not establish a live browser pass. Detailed task-local evidence is retained in /Volumes/ExternalSSD/Dev/caches/dvault-glass-motion-20261118; preserved pre-edit source is in /Volumes/ExternalSSD/Dev/AppData/dvault/history/2026-11-18-glass-motion-fsgceruu.
