# Dvault V2: product and design critique

Review date: 17 November 2026. Scope: the current desktop and 390px phone captures, `frontend/v2/index.html`, `app.mjs`, `style.css`, the coin renderer, and `docs/dvault-v2-demo.md`. This is an independent design review, not a report of a completed browser or physical-device test. No application code was changed for this review.

## Verdict

V2 has a coherent execution of an espresso-and-peach crypto landing page. That is materially different from the requested Dvault identity. Its brown surfaces, cream headline, gold CTA, generic glyphs, and framed coin display reinforce the same direction at every level. Adjusting one accent or adding another animation will not resolve the mismatch.

The more consequential product problem is that marketing, account setup, and daily work share one unchanged composition. The interface knows whether the wallet is connected and whether the key is present, but that knowledge mostly changes button labels. The user still sees the large landing hero and an illustrative process beside a locked or unlocked workspace. A deliberate visual redesign must include these states, not just a new hero.

Recommended direction: a restrained black/white interface with a strong red brand accent, glossy authored icon assets, a broad atmospheric red glow, and an unboxed coin composition that explains the document journey. Keep the brand spectacle on the introductory surface. Make the unlocked vault fast, legible, and task-oriented.

## Priorities

| Priority | Finding | Evidence | Required outcome |
| --- | --- | --- | --- |
| P0 | The dominant identity contradicts the requested palette and tone. | `style.css:3–13` defines warm brown, cream, and amber; screenshot repeats these through background, type, buttons, and illustration. | Replace the visual foundation with intentional red/black/white tokens, typography, logo, and authored asset direction. |
| P0 | Disconnected, connected-but-locked, and unlocked sessions are not distinct experiences. | `app.mjs:206–238` changes labels and visibility of small controls; the hero and explainer remain. | Design a visible state transition from introduction to setup to workspace. |
| P0 | The screen asks for a wallet before giving a sufficient reason to use Dvault. | Hero promise is brief; the detailed explanation is behind “How it works”; no substantive “Why Dvault” section exists. | Explain private contents, version history, and independently checkable fingerprints before the first wallet prompt. |
| P0 | New-vault creation is presented as returning-user unlock. | `openKey()` focuses the existing key field; the dialog headline is “Unlock your vault”; creation is a secondary button. | Separate “Create a vault” and “Open an existing vault” paths, with the recovery responsibility clear before upload. |
| P1 | The reference synthesis is largely surface-level. | Glossy tiles contain a star, diamond, or check; the coin piece is enclosed in a labelled rectangular panel. | Derive a consistent material, lighting, shape, and motion system from the references, then apply it to original Dvault assets. |
| P1 | The process strip can be mistaken for actual progress. | Every step is freely selectable; `setStep()` changes selection and art caption; unlock selects Store before any file has been stored. | Separate “How it works” illustration state from actual upload progress. Never imply a stage completed because artwork changed. |
| P1 | Mobile is resized but still follows desktop content priorities. | At 390px, the two-row header, hero, art, and three tiles place the workspace near the bottom of the capture. | Define mobile content order and a compact connected workspace; test the entire wallet return path on real devices. |
| P2 | The implementation has useful resilience worth preserving. | Static art fallback, visibility pause, reduced-motion listener, native dialogs, stage-specific recovery, and integrity checking are present. | Retain these while changing presentation; verify them against the new motion and asset system. |

P0 here means “blocks approval of the requested design,” not an allegation of a security defect.

## 1. Brand and visual language

### Palette and depth

The current UI is not literally monochrome: the violet and pearl coins introduce other hues. Nevertheless, almost all actionable and structural elements occupy the same warm tonal family. The visual result is muddy hierarchy: the hero glow, CTA, wordmark dot, panel borders, selected process step, and metadata all feel related in intensity and temperature. Red currently serves only as a pale error color.

Use near-black as the field, a slightly lifted neutral surface for working content, and crisp white for the primary reading hierarchy. Give red two distinct jobs: a saturated brand action color and a diffused environmental glow. Choose error styling separately, with explicit icon and text labels, so a red primary CTA does not read as destructive. A proposed starting point is background `#08090B`, surface `#121318`, primary text `#F7F7FA`, secondary text around `#ACADB8`, and a deeper crimson action fill. These are direction-setting values, not contrast-certified final tokens.

Let the broad gradient and blur belong to the environment behind the hero objects. Keep text, fields, and actionable edges sharp. Avoid frosting every panel or blurring the entire page: visual depth should make the primary content easier to locate. The connected workspace needs quieter depth than the introduction.

### Typography

The screenshot headline is exceptionally heavy, tightly spaced, and rounded. The CSS reinforces this with a 730 weight, `-.079em` tracking, and `.98` line height. The wordmark also uses highly compressed tracking. Together they suggest a playful crypto promotion more strongly than a precise document product. This is a judgment about fit to the stated brief, not a universal objection to bold typography.

Choose a deliberate type pairing or a single high-quality family with enough real weights. Use a controlled display weight for the hero, a practical reading weight for explanation, and compact monospaced text only for identifiers or technical proof details. Test the actual font files on both platforms rather than relying on a long fallback chain to preserve the design. Keep headings expressive without near-colliding glyphs. On mobile, avoid shrinking secondary text to compensate for an overcrowded structure.

### Logo and icons

The current logo mark is a CSS rounded square with a rotated outline square. It is serviceable as a placeholder but has no specific relationship to documents, custody, versioning, or the Dvault name. The star, diamond, check, Unicode search symbol, and upload arrow do not form an authored icon family. Gloss added behind an arbitrary character does not establish brand identity.

Develop a distinct Dvault mark: for example, a restrained D silhouette with an inset protected document or an opening that suggests a vault. The concept must remain legible as a small monochrome mark before glossy treatment. Use the same silhouette or surface logic in the hero medallion and feature artwork. Do not use image generation to render small UI text or the only production logo; keep the final mark and control icons crisp and scalable.

Create a limited family of original glossy rounded assets for privacy, storage, and proof. Maintain the same camera angle, lighting direction, corner radius, material thickness, shadow softness, and red/white/black palette. A protective enclosure, layered storage object, and stamped document are more meaningful than a star, diamond, and generic tick. Pair each with readable text. Brand artwork and utility icons need related styling but different complexity.

## 2. Reference-by-reference translation

Evidence limitation: the local Pinterest board capture is cropped and only partially shows two pins. The five sources below are listed in `docs/dvault-v2-demo.md`; the user specifically described the glossy `ktnr.23` tiles and desired motion. This review does not claim full-resolution independent inspection of all five external references. The table distinguishes the implementation's declared interpretation from a proposed design translation. A final asset review should compare the actual source images side by side.

| Reference | Present interpretation | Why it is insufficient | Better Dvault translation |
| --- | --- | --- | --- |
| [ktnr.23](https://in.pinterest.com/pin/1104437508659594777/) | Small rounded gradient tiles with inset shadow and Unicode glyphs. | Borrows the container gloss without the authored object quality, consistent lighting, or distinctive symbols requested by the user. | Build an original family of dimensional rounded icons, one meaningful object per state. Give the primary Dvault emblem the strongest finish; use simplified variants at smaller sizes. |
| [Finance icons set](https://in.pinterest.com/pin/1104437508659594743/) | Gold, violet, and pearl materials on procedural coins. | Material borrowing dominates the entire site and makes the product look financial. The coins do not inherently explain document protection. | Borrow bevels, metal edge reflections, and photographic lighting. Translate the motif into Dvault document/proof medallions with a crimson enamel or dark metal family. Do not introduce balances, yield, or token-like promises. |
| [Zircon Focus & Productivity](https://in.pinterest.com/pin/1104437508659594699/) | Purple Store icon and a three-stage strip. | An accent color alone is not a useful synthesis; current selectable stages also blur explanation and real state. | Apply the idea of focused progression to onboarding: one task, one clear completion, one next action. If crystalline material is retained, use it sparingly as an original storage object rather than recoloring the interface purple. |
| [Crypto Wallet](https://in.pinterest.com/pin/1104437508659594675/) | Espresso surfaces, oversized heading, warm studio light. | The copied mood conflicts with the user's now-explicit red/black/white direction; mobile hierarchy still gives artwork priority over work. | Carry over confidence, strong contrast, and a dominant action. Rebuild those qualities in Dvault's palette and use a more compact mobile composition. |
| [3D Looping Coins](https://in.pinterest.com/pin/1104437508659594314/) | Three procedural WebGL coins in a rounded frame, with continuous orbit/tilt and step focus. | The “Custody series” panel feels like a component demo. Orbiting creates spectacle but does not explain a user's action. | Integrate coins across the open hero field, with controlled overlap and a clear focal point. Use a brief semantic transition between protected file, stored version, and recorded proof; keep continuous idle motion low-amplitude or let it settle. |

The composition should have one unifying material language, not five visible borrowed styles. The requested red/black/white identity should govern the references. A source's incidental palette is not a requirement to preserve.

## 3. Information architecture and first-run experience

### Disconnected introduction

Use a compact navigation containing the brand, “Why Dvault,” “How it works,” and a clear wallet action. The hero should state a concrete benefit: “Private documents. A history you can verify.” A supporting sentence can explain: “Encrypt files on your device, save versions, and check their recorded fingerprints.” These are proposed copy directions, not final claims beyond the implemented behavior.

Add an actual “Why Dvault” explanation, not another heading over the existing feature strip. Show three useful outcomes: document contents stay encrypted, earlier saved versions remain in the record, and retrieved bytes can be checked against the recorded fingerprint. A short example of a contract draft moving from version 1 to version 2 makes these benefits understandable without a lesson in IPFS. Use a visibly labelled illustrative example if showing sample documents or proof records.

Explain the boundaries beside the benefits: wallet address and proof metadata are public; a lost recovery key cannot be reset; retrieval depends on the stored encrypted object remaining available. Do not claim that a timestamp establishes real-world authorship, that the system can recover a lost key, or that local demo records are permanent. These distinctions can be brief and progressively disclosed rather than overwhelming the hero.

“Explore the vault” currently scrolls toward disabled search and a locked panel. It promises more than the destination delivers. Replace it with “See how it works,” or provide a clearly labelled read-only example. Do not show an apparently usable Add document control in a disconnected library when its actual action is setup.

### First-time setup

After wallet connection, introduce the two credentials in one plain explanation: “Your wallet records proofs. Your recovery key opens your files.” Determine whether records exist before presenting a returning-vault form. For a new wallet, lead with creation; for existing records, lead with opening. If the user chooses the other path, explain why an existing vault needs its original key rather than letting them discover that only after generating a replacement.

A suitable sequence is: connect wallet → create or enter recovery key → save and acknowledge the recovery key → add first document. Mark completed setup stages only when the underlying action succeeds. Preserve the existing key privacy and failure behavior. Avoid inventing an account-registration or email-recovery story that the product does not implement.

### State and CTA matrix

| State | Main surface | Main action | Secondary information/action |
| --- | --- | --- | --- |
| No wallet provider | Introduction with compatible-browser guidance when relevant. | Open/use a compatible wallet browser, where supported. | Explain the supported environment without implying ordinary mobile Safari has an injected wallet. |
| Disconnected, provider available | Introduction and benefit explanation. | Connect wallet. | How it works / labelled example. |
| Connecting | Preserve context and show a precise pending label. | Waiting for wallet; prevent duplicate requests. | Cancel/retry after rejection. |
| Wrong network | Clearly named network state. | Switch to the demo network. | Explain local demo; preserve safe pending work. |
| Connected, first vault | Setup. | Create recovery key. | Use an existing key if applicable. |
| Connected, existing vault locked | Compact vault access screen. | Unlock vault. | Account/network controls and recovery explanation. |
| Unlocked, empty | Workspace with meaningful empty state. | Add first document. | Short explanation of what happens next. |
| Unlocked, documents exist | Searchable document list, version access. | Add document. | Account menu, lock, refresh. |
| Encrypted/pinned but proof incomplete | Persistent, specific recovery row in the workspace. | Resume upload / Resume proof according to actual stage. | Explain what is already saved; discard remains deliberately secondary. |
| Proof submitted | Transaction progress associated with the document. | Check/wait for confirmation. | Distinguish submitted from confirmed. |
| Confirmed proof | Version history with receipt. | Verify and download. | New version / proof details. |

Use one dominant action for the current task. A repeated wallet action in a long introductory page can be reasonable; identical competing calls across the header, hero, and locked panel add little here. The connected wallet control should open account details and deliberate actions rather than using the entire address button as immediate Disconnect. Retain Lock as distinct from disconnecting the account.

## 4. Workspace and proof readability

When unlocked, reduce or remove the acquisition hero. Bring document search, upload, incomplete work, and the list into the first viewport. Preserve “Why Dvault” as navigation/help instead of repeating its full pitch. The list needs clear document name, latest version, last recorded time, and a consistent affordance to open history. Avoid a grid of decorative cards for files when a readable row supports comparison better.

Within version history, separate “proof recorded” from “bytes checked.” The application already makes that distinction in its confirmation message; visual badges must preserve it. A green check should not imply the ciphertext was fetched and verified merely because a transaction was mined. Show the plain-language result first and move CID, fingerprint, owner, and transaction identifiers into a labelled detail region with copy actions.

Retain explicit recovery states. The code already distinguishes an encrypted local draft from a pinned file awaiting proof. Make those distinctions visible in the item and main workspace, not only in a modal. Errors should state the failed dependency and the next safe action. Keep operator commands such as `npm run deploy` out of ordinary user-facing product copy; a demo administrator detail section can expose diagnostics when needed.

## 5. Buttons and motion

The current primary button uses a warm gradient and static highlight. It has no sweeping shimmer. Its hover changes the fill, and press produces a small translation/scale. Those are competent basic states but do not meet the requested interaction character.

Create a distinct primary CTA with a saturated crimson base, controlled glossy edge, white legible text, and a masked diagonal light band that sweeps across once on entry or intentional hover/focus. Keep the label at constant contrast as the band passes. Add a brief, restrained press response. Do not run a bright sheen on every button or loop it fast enough to compete with reading. Secondary buttons should have quieter neutral surfaces; text links should remain recognizably interactive.

Use motion to communicate three types of change:

1. **Orientation:** a short staged hero entrance or a gentle coin reveal establishes the focal point once.
2. **Action:** file selection, encryption completion, pin completion, and proof confirmation produce distinct transitions tied to real state.
3. **Continuity:** the active document remains recognizable when moving from upload to history; a key success transitions into the workspace rather than returning the user to the unchanged marketing hero.

The current renderer already pauses offscreen and in a hidden tab, caps pixel density, handles WebGL context loss with fallback, and listens for reduced-motion preference changes. Preserve these behaviors. Its freely selectable explanatory scene should never be reused as an authoritative transaction indicator. When reduced motion is enabled, show a designed still, maintain all state labels, disable shimmer and orbit, and make navigation immediate. Test the new preference behavior both at initial load and after changing the OS setting.

## 6. Desktop and mobile composition

On desktop, the current two-column layout is reasonably balanced, but the framed artwork consumes almost as much visual authority as the product promise. Remove the artificial exhibition labels (“Custody series,” “01—03”), corner marks, and decorative star unless they acquire a real user purpose. Let a focal medallion and secondary objects sit in the open gradient space, with sufficient empty area to preserve the heading and CTA. The scene should look composed at the page level rather than inserted into a ready-made card.

On the phone capture, the layout avoids obvious horizontal overflow in the visible portion. That is evidence of a useful responsive base, not evidence of full mobile compatibility. A 92px two-row header, introductory copy, 210px art region, and three compressed process tiles delay the workspace. The three tiles reduce explanations to 10px text. Their density is a content-order problem, not something to solve with smaller fonts.

For disconnected mobile, use a compact header, short promise, main CTA, integrated artwork, and a readable stacked or sequential explanation. For connected mobile, use the vault title, account access, relevant status, and main file action at the top; collapse introductory content. Modal actions must remain reachable with the keyboard open, long filenames and hashes must wrap, and controls must clear bottom safe areas. A sticky action may help, but only if it never covers the last list row, proof details, or feedback.

The docs explicitly say physical-phone certificate installation, MetaMask signing, and the full UI click-through remain pending. Do not describe iPhone/Android support as complete based on the 390px screenshot. Test native file selection, wallet app/browser transitions, return to a pending transaction, recovery-key entry, long version history, locked/unlocked transitions, and a failed gateway on supported physical devices. The current provider path relies on an injected wallet; ordinary Safari/Chrome support requires a deliberately supported connection mechanism or honest guidance.

## 7. Accessibility and readability

Preserve the skip link, named dialogs, visible focus styling, native file input, live status messages, and text explanations of progress. The canvas is decorative and hidden from assistive technology, which is appropriate while equivalent information is in text.

Audit the redesigned palette with measured text and control contrast, including the worst part of a gradient and shimmer pass. Do not assume white text on bright red passes. Do not communicate success, failure, selection, or connected state solely by color or glow. Ensure selected explainer controls have appropriate accessible semantics and are clearly separate from the upload-progress list.

Use practical touch targets of roughly 44px, especially icon actions and mobile navigation. Some existing small buttons use a 42px minimum and mobile navigation uses 40px; the redesign should improve consistency rather than reduce them. Keep explanatory mobile text readable instead of preserving the current 10px tile copy. Test 200% text zoom and enlarged system text, keyboard-only use, focus return after every dialog, and screen-reader announcements of pending/confirmed/verified status. Test transient toasts with essential feedback also retained in context.

## 8. Asset and delivery plan

First approve a concrete visual direction through a small asset board and two state mockups: disconnected introduction and unlocked workspace, each at desktop and phone sizes. The board should contain the Dvault mark, type hierarchy, button states, one glossy icon, and an unboxed coin composition. This prevents an attractive hero from masking an unresolved workspace.

Use custom image generation for a coherent hero still, glossy feature objects, or material exploration. Give generated artwork an explicit role and inspect its output at the intended sizes. Produce transparent cutouts where the scene needs compositing into the page. Supply a designed static fallback from the same art direction rather than the current unrelated CSS/Unicode approximation. Keep production labels and interactive controls in HTML/SVG.

Keep the implementation honest about provenance: current coins are procedural WebGL, not Meshy-generated models. A Meshy credit-consuming batch is not established as approved by this review. Confirm any required paid generation at the appropriate workflow boundary, after a concrete asset specification exists; do not block visual planning, the IA redesign, or reusable CSS motion work on that decision.

Follow the user's SSD destinations for newly generated project assets and large outputs. Avoid downloading large toolchains merely to obtain effects achievable with the existing web stack.

## Acceptance bar for the next design pass

- The first screenshot reads unmistakably as the requested red/black/white identity; warm amber is no longer the organizing color.
- The logo and glossy icon family are original and recognizable, and no generic star/diamond stands in for the primary brand assets.
- The hero coin composition is integrated into the page, with a deliberate static fallback and restrained motion.
- The primary CTA has the requested sweeping light treatment, while its text remains legible and reduced-motion mode is still.
- “Why Dvault” explains a real document/version use case before setup; it does not depend on backend jargon.
- New-vault creation, existing-vault unlock, disconnected introduction, and active workspace are visibly different and have appropriate actions.
- Illustration changes cannot be confused with encryption, pinning, proof confirmation, or byte verification.
- Returning users can reach documents and add a file without navigating past a full marketing hero.
- Desktop and phone screenshots cover the important states, not only the landing page; real-device wallet and upload checks are reported separately.
- Existing integrity checks, recovery paths, offscreen pause, reduced-motion behavior, and accessible control semantics continue to work.

The next iteration should be assessed against this brief and these states before adding more decorative detail. The strongest existing work is in the underlying document/proof flow and renderer resilience. The missing work is a deliberate product experience and a distinctive visual system that actually express the user's direction.
