# Dvault app layout and identity

This documents the prior fixed-screen build. For the unified dashboard and current review, see the [final critique](./dvault-final-critique.md).

- [Landing](http://127.0.0.1:4174/v2/) runs in one viewport and has one entry action. The image is the approved chrome coin orbit, with file, lock, and proof faces adapted from the supplied reference. The PNG source was generated with the built-in image tool from the chrome medallion, finance materials, and Kinix lighting references. The app uses responsive transparent WebP exports.
- [Dashboard](http://127.0.0.1:4174/v2/app/) has Overview, Documents, and Guide. Desktop uses a rail and phone uses fixed bottom navigation. The top bar stays put. Long content scrolls inside the current panel.
- The gloss purple document mascot supplies the in-app mark, favicon, iOS touch icon and general and maskable PWA icons. Its source was generated with the built-in image tool using the six-icon ktnr.23 sheet for glossy collectible material and big silhouette, with a folded sheet and ruby keyhole for Dvault. The rejected crystal is unused.
- The three Guide models were generated with Meshy T2.5 at 5 credits each. The GLBs are served locally. Their shader provides obsidian, chrome and ruby lighting and applies an original Dvault engraving. If a model or WebGL is unavailable, the scene has local fallback art. Animation pauses when offscreen and honors reduced motion.
- The staged setup derives from the app photos: one action per stage, glossy artwork, clear progress, warm-to-violet surfaces, and a bottom sheet on phones. The theme switch follows the device until overridden, then remembers that choice for the current origin. Wallet and recovery remain separate states.
- Supplied Altamis is used in the private localhost display preview. Kid Games is available as an alternate local display preview with `DVAULT_PERSONAL_FONT=kid-games`. Both are personal-use faces. The LAN build delivers Bricolage Grotesque, Geist and Geist Mono under their bundled OFL licenses. The PWA starts at the dashboard.

## Checks completed

- Desktop at 1280×720: full-viewport landing and overview, side navigation, Guide and its three live Meshy models, light/dark toggle and theme persistence across routes.
- Phone-sized previews: 390×844 dashboard, bottom navigation, disconnected Documents view, and setup sheet. The 360×640 landing had no page scrolling and its CTA fit above the viewport bottom.
- Verified PWA assets and routing on the live desktop and private LAN listeners. Device-side PWA installation and MetaMask Mobile signing still require a physical device. See the [phone demo guide](./dvault-v2-demo.md).
