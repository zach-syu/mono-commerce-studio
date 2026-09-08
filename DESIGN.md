---
version: alpha
colors:
  primary: "#5b7ce3"
  ink: "#2b303a"
  canvas: "#f2f6fc"
  paper: "#ffffff"
  muted: "#626c7d"
  line: "#d6dff2"
  mint: "#ebeff7"
  accent: "#f6bb68"
  danger: "#df3a4f"
typography:
  display:
    fontFamily: '"Noto Sans TC", "PingFang TC", sans-serif'
  body:
    fontFamily: '"Noto Sans TC", "PingFang TC", "Hiragino Sans", "Apple SD Gothic Neo", sans-serif'
rounded:
  control: "5px"
  panel: "5px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
---

## Overview
Mono Studio is a product workbench for merchants turning one item into a coordinated collection. The signature is a live contact sheet beside a focused four-step workflow. The product stays quiet so the product photography carries visual interest. This is a new independent design inspired by the source workflow, not a reproduction of its layout or copy.

## Colors
The user's explicit design source is CYBERBIZ Pitaya UI 0.45.1: https://www.npmjs.com/package/@cyberbiz-corp/pitaya-ui and its official Storybook https://main--6634a4f99422d92845cfb1e9.chromatic.com/.

The published package `dist/style.css` owns control colors: primary #5b7ce3, hover #4463c6, heading #3c5587, body #2b303a, muted #626c7d, border #d6dff2, canvas #f2f6fc, selection #ebeff7. `src/styles.css` maps those values to shared app tokens for navigation and surrounding layout. Pitaya does not export a token API or ThemeProvider; do not invent one. Keep the existing amber demo-status treatment distinct from success. Generated-artwork palettes are user choices and remain independent of the application's blue UI.

## Typography
Noto Sans TC for brand, headings, and body, matching PitayaLayout. The app self-hosts weights 400 and 700 through @fontsource/noto-sans-tc 5.3.0; no Google Fonts network request is required. System CJK fallbacks remain available. Controls and body text use 14px, supporting content normally 12px; phone text-entry fields use 16px. The UI is Taiwan Traditional Chinese. Generated content can independently use Traditional Chinese, English, Japanese, or Korean. Font loading failure must preserve useful layout.

## Layout
Desktop uses a narrow navigation rail, a central editing surface, and a sticky contact-sheet preview. Tablet collapses the rail. Phone stacks preview below controls and keeps actions reachable. Actual process steps use numbers; other items do not. Forms always retain edits when navigating backward.

## Elevation & Depth
Hairline borders and restrained shadows only for overlays and the preview sheet. No stacking of decorative cards within cards.

## Shapes
5px control and panel corners follow the published Pitaya controls and RoundBox. Product images keep their natural aspect ratios and display without accidental stretching.

## Components
Actual PitayaButton, PitayaInput, PitayaSelect, PitayaCheckbox, and PitayaRoundBox are used through src/components/ui.tsx. The app uses shipped individual ESM component entrypoints because the package barrel eagerly loads legacy date/chart code that fails in Vite browsers (global is not defined). Official CSS is imported before narrow app layout and accessibility adapters. Native dialog remains the modal owner: the published PitayaModal has no focus trap, accessible dialog role, or focus restoration. Do not replace native dialog semantics with a visual overlay. Focus outlines remain visible. Errors remain next to the operation that failed. Disabled generation explains the missing input. Selection is visible with text and a check, not color alone.

## Do's and Don'ts
One main decision per step. Keep technical provider configuration in Settings. Distinguish generated photos, uploaded originals, and template composition. Never claim a platform approval or real model call from a preset or demo run. Respect reduced motion.


## Pitaya integration and verification
- React and ReactDOM are pinned to 18.3.1, within Pitaya's declared support range; router 6.30.6 and styled-components 5.3.11 satisfy its peer requirements.
- A normal npm 11 install succeeds without force, legacy-peer-deps, or peer overrides. Some unused legacy date/chart dependencies still emit peer warnings; do not claim package-wide React 18 compatibility beyond the exercised controls.
- Shared Select retains Pitaya/react-select behavior and styles while adding combobox, listbox, option roles and linked labels. Shared Checkbox retains the official visual state while restoring a keyboard-focusable native input and visible focus.
- Canonical native dialog preserves Escape, modal background blocking and focus restoration. PitayaRoundBox supplies the primary editor surface.
- The four-step workflow and live contact-sheet composition remain the independent MONO layout. The product is an independent prototype using CYBERBIZ components, not a claim of official CYBERBIZ production ownership.
- Intentional migration: pine/rounded custom controls changed to the user's requested Pitaya blue/5px controls; body/help sizes increased for readability. Product-scene colors did not change.
