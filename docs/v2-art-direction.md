# Dvault identity and redesign

This describes the previous red redesign. See the [current fixed-screen design](./dvault-app-layout.md).

This pass responds to the [independent design critique](./v2-design-critique.md).

## Direction applied

- **Guest.** Two lines explain the product. The primary action opens setup. A separate white section explains why exact version history matters through a clearly labeled example.
- **Setup.** Connect wallet, set up or recover the decryption key, then add a file. The current step changes only when the actual wallet or key state changes.
- **Workspace.** Connecting the wallet replaces the sales page with the vault. Violet identifies the locked state and mint identifies the unlocked state. Red is reserved for the main action and active upload stages. The account button opens a wallet panel.
- **Motion.** The primary CTA gets a brief traveling highlight. The three 3D coins illustrate encryption, storage, and verification in the explainer. They come from the existing procedural WebGL renderer, with new materials. They pause away from the viewport and honor reduced motion.
- **Mobile.** First action stays above the art. The explainer and history stack around the content. The install mark is also used for the tab and home screen. Signing on iOS and Android uses MetaMask’s built-in browser.

## Pinterest references

| Reference | Translation |
| --- | --- |
| [ktnr.23](https://in.pinterest.com/pin/1104437508659594777/) | Glossy app icon proportions and crisp silhouette informed the porcelain document latch and compact function marks. |
| [Finance icons](https://in.pinterest.com/pin/1104437508659594743/) | Glass and metal with distinct material colors informed the storage coin, verification coin, and clasp. |
| [Zircon Focus](https://in.pinterest.com/pin/1104437508659594699/) | The visual shift between phases informed violet for locked/key work and the three step setup indicator. |
| [Crypto Wallet](https://in.pinterest.com/pin/1104437508659594675/) | One dramatic isolated object and a prominent mobile action. Dark layers use the requested black, red, and white. |
| [3D Looping Coins](https://in.pinterest.com/pin/1104437508659594314/) | Turning physical objects reveal thickness and material. The interaction lives in the explainer. |

## Asset production

Generated with the built-in image generation tool. Exported using local JPEG and PNG tools.

- **Brand prompt.** A square, near-black Dvault app icon. Center one extremely readable porcelain-white folded document whose geometric bars suggest a D-shaped vault latch, with a recessed vermilion slit. Use a subtle red cast reflection, strong clear silhouette, flat camera angle, maskable safe area, and no words, stars, shields, or ornamental frame.
- **Hero prompt.** An editorial studio product photograph of two dark glass document leaves with a bright frosted fold and a single translucent scarlet security clasp. Place the mass on the right, keep the left dark, use controlled red studio lighting and crisp white reflections, and omit all interface graphics and text.
- **Exports.** `frontend/v2/assets/brand-mark.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `sealed-document.jpg`, and `sealed-document-small.jpg`.

## Fonts to supply

1. **Display:** wordmark, hero, section titles, and onboarding titles. One WOFF2 variable family is ideal, or heavy and bold files.
2. **UI:** buttons, navigation, help text, vault, and mobile labels. One WOFF2 variable family is ideal, or regular, medium, and bold files.

The stylesheet has named local font slots and uses system fallbacks until licensed files arrive.
