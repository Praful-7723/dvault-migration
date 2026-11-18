# Dvault V1 audit and V2 storyboard

This audit is based on V1 source and an independent critique. The phone wallet flow, device performance, and visual composition still need checks on real screens.

## What V1 should improve

| Priority | V1 finding | V2 direction |
| --- | --- | --- |
| First | The hero has a 720px minimum height before the layout stacks. On smaller screens the header and hero buttons also stack at full width. | Show the main action in the first mobile viewport. Use compact navigation and give the upload and library their own usable layouts. |
| First | Connect Wallet, Start Upload, and Open Storage compete. Wallet and contract details repeat across panels. | Give each state one primary action. Put chain and account details in a compact wallet panel. |
| First | A successful IPFS pin followed by a rejected transaction leaves the file pinned. The app gives no recovery path for the existing CID. | Keep the CID and show “Pinned to IPFS. Awaiting blockchain proof.” Let the user retry signing without uploading again. Scope a pending upload to the initiating account and chain. |
| First | The app server listens on Mac loopback and accepts uploads only from that origin. The wallet also points at loopback. | Prove the phone route early. Keep wallet signing on the device and use a controlled demo endpoint for the app and a reachable RPC. The app server and chain each need a phone connection. |
| Next | The empty Storage screen tells users to open Storage. Long identifiers compete with the files themselves. | Distinguish wallet disconnected from an empty library. Add a direct upload action, filename search, and a details panel with the full CID and proof. |
| Next | Two WebGL effects run independent animation loops. CSS includes continuous sheen, breathing, and spinning with no reduced motion stylesheet. | Use one lazy 3D scene for onboarding and short, event-driven motion in the workspace. Pause 3D offscreen and when the tab is hidden. Provide static artwork and reduced motion fallbacks. |
| Next | Overlays use visual visibility and Escape handling but lack dialog semantics and focus management. | Label dialogs, move focus inside, restore it on close, and announce the actual upload stage. Keep touch targets and keyboard controls usable throughout. |

Source areas: `frontend/index.html` (layout, motion, and dialogs), `frontend/app.js` (wallet, rendering, and upload), `scripts/serve.js` and `scripts/syncFrontendConfig.js` (demo network).

## Storyboard draft

| Beat | Desktop | Phone | Motion |
| --- | --- | --- | --- |
| Connect | Onboarding scene beside one wallet action | One active coin above a thumb-friendly action | The Connect coin turns and settles when the wallet is ready. A short confirmation appears in the wallet control. |
| Store | Upload area with drag and drop and a selected file preview | Native file picker with a compact upload sheet | The file tile settles into place. The Store coin reacts to the successful pin. Progress labels reflect real stages. |
| Verify | Receipt with CID, transaction hash, and open-file action | A receipt sheet with copy and open actions | A single stamp lands after transaction confirmation. A cancelled signature reveals the retry action. |
| Browse | Searchable library and a file detail panel | Searchable list and a full-width detail view | Brief selection and copy feedback. The library stays still while the user reads. |

Initial coin direction: a brushed metal Connect coin with a keyway, a Store coin with a recessed IPFS-inspired cube, and a Verify coin with an engraved proof seal. GLB assets should share scale and lighting. Animate transforms in the browser, with one renderer and a still frame fallback.

### Pinterest references

These were the initial picks. The updated design uses the four references you added and the looping coins. See the [final reference mapping](./dvault-v2-demo.md#design-sources-and-how-they-were-used).

Saved to the private [Dvault V2 Design References board](https://in.pinterest.com/prafuledx/dvault-v2-design-references/).

- Desktop library: use the dashboard's restrained dark surfaces and separation between navigation and content. Dvault's main view should be the file list and the selected file's proof, with wallet and chain status in the header. [Stakent by Awsmd](https://in.pinterest.com/pin/980447781372549137/)
- Phone onboarding: use the wallet onboarding format as a reference for an illustration-led screen with one prominent action. Carry Connect, Store, and Verify into the flow with concise copy and an actionable bottom area. [Crypto Wallet Application Onboarding](https://in.pinterest.com/pin/973692381935182434/)
- Coin motion: use the rotation as a reference for revealing depth and the edge of each coin. Let the Connect, Store, and Verify coins respond to their corresponding steps and settle. Keep the result accessible as a static frame. [3D Looping Coins Animation](https://in.pinterest.com/pin/1085367578956197783/)
