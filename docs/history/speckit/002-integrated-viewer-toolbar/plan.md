# Implementation Plan: Integrated Viewer Toolbar

**Branch**: `002-integrated-viewer-toolbar` | **Date**: 2026-07-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-integrated-viewer-toolbar/spec.md`

## Summary

Restyle and consolidate the existing, verified navigation controls into a single toolbar that
renders inside the viewer frame with identical appearance and behaviour in flipbook and document
modes, adding one net-new control (page-jump input) and `role="toolbar"` ARIA semantics. In
document (native) mode, replace the hand-rolled text/annotation layer positioning in
`src/nativepageviewer.js` with the official `pdfjs-dist/web/pdf_viewer.mjs` components
(TextLayerBuilder, AnnotationLayerBuilder, PDFLinkService, EventBus), preserving
IntersectionObserver lazy loading and distant-page cleanup. Governing constraint: reuse-first —
evolve `addNavigationControls()` in place; delete the unused duplicate `src/controls.js`; no
full prebuilt PDF.js web viewer or iframe.

## Technical Context

**Language/Version**: JavaScript ES2020 (browser), PHP 7.4+ (WordPress 5.9+)
**Primary Dependencies**: pdfjs-dist 6.1.200 (upgraded from 5.4.530 pre-implementation;
`web/pdf_viewer.mjs` exports confirmed: TextLayerBuilder, AnnotationLayerBuilder,
PDFLinkService, SimpleLinkService, EventBus, PDFFindController; builder constructor/render/
cancel shapes verified against v6 typed declarations — see research D9/D11), @tpp/htm-x,
webpack 5.104
**Storage**: N/A (WordPress options unchanged by this feature)
**Testing**: Manual per constitution §V + existing Playwright/Chrome harness pattern
(`test/verify-t028-t029.js`) extended for toolbar assertions
**Target Platform**: Browsers per compatibility matrix (constitution v1.2.0: Chrome 125+,
Safari 18+/iOS 18+, Firefox ESR, Edge last 2 — floor inherited from PDF.js 6)
**Project Type**: WordPress plugin — JS library (`src/` → `dist/` UMD) + PHP/JS integration layer (`includes/`)
**Performance Goals**: First page ≤2s on 10 Mbps (unchanged); page-jump navigation completes ≤2s (SC-005)
**Constraints**: Reuse-first (FR-016); no iframe/full prebuilt viewer (FR-015); WCAG 2.2 AA
(constitution §I); shortcode attributes unchanged (FR-009); no build-pipeline additions
(no css-loader — see research D4)
**Scale/Scope**: ~5 source files touched, 1 deleted; net-new code ≈ page-jump input (~40 lines)
+ `goToPage()` additions to two viewers (~25 lines) + CSS

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Accessibility** — Toolbar gets `role="toolbar"` + accessible name; page-jump input
      has label, `inputmode="numeric"`, and announced commit result; existing `aria-live`
      announcements preserved verbatim (FR-007); focus indicators and 24×24 targets specified
      (FR-008). Text layer moves to official TextLayerBuilder — selection and Ctrl+F explicitly
      regression-gated (FR-013, US4); no `pointer-events: none`/`user-select: none` on text layer.
- [x] **II. User Experience** — No change to load path; first-page target unaffected (toolbar is
      DOM-light). ResizeObserver reinit flow preserved; toolbar survives reinit (FR-011).
      Toolbar has no motion animations; button transitions are color-only (reduced-motion safe).
- [x] **III. Interoperability** — No new asset URLs; pdf_viewer.mjs is bundled into the existing
      `dist/flipbook-viewer.js` entry (no new worker/library URL). No shortcode attribute
      changes (FR-009 additive-zero). Multi-domain filter hooks untouched.
- [x] **IV. Code Quality** — ESLint gate retained. Page-jump input value validated/clamped in JS;
      no `innerHTML` (DOM API construction, matching existing code). Abstraction check: the one
      consolidation (delete duplicate `src/controls.js`) was explicitly confirmed by the
      developer in this feature's originating conversation — reuse-first is the user's own
      constraint, not a unilateral abstraction.
- [x] **V. Testing** — Manual plan in quickstart.md covers dev server, WordPress install, all
      three modes (flipbook, document/native, image), desktop + iOS Safari 18+, plus automated
      browser-harness assertions for toolbar DOM/ARIA and regression checks from feature 001.

## Project Structure

### Documentation (this feature)

```text
specs/002-integrated-viewer-toolbar/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── viewer-api.md    # Internal viewer interface incl. new goToPage()
│   └── toolbar-dom.md   # Toolbar DOM/ARIA contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── index.js               # Router — unchanged
├── flipbookviewer.js      # + goToPage(pageNum) (additive, ~15 lines)
├── singlepageviewer.js    # + goToPage(pageNum) (additive, ~10 lines)
├── nativepageviewer.js    # Layer internals → pdfjs-dist viewer components (net deletion)
└── controls.js            # DELETED (unused duplicate)

includes/
├── bws-pdf-viewer.js      # addNavigationControls() evolved: toolbar semantics + page-jump
├── bws-pdf-viewer.css     # Toolbar restyle; official text/annotation layer CSS vars
└── admin.php              # unchanged

bws-pdf-viewer.php         # version bump only
test/
├── harness-toolbar.html   # NEW: toolbar harness (both modes side by side)
└── verify-toolbar.js      # NEW: automated toolbar + regression assertions
```

**Structure Decision**: Existing two-layer layout retained (library `src/` bundled to `dist/`,
WordPress integration in `includes/`). Toolbar logic stays in the integration layer where it
already lives — moving it into the library was considered and rejected (research D2) because
the WP layer is its only consumer and moving it would be exactly the rewrite this feature
forbids.

## Complexity Tracking

> No constitution violations. Table intentionally empty.
