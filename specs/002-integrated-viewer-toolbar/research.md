# Research: Integrated Viewer Toolbar

**Feature**: 002-integrated-viewer-toolbar | **Date**: 2026-07-07

All decisions verified against the installed dependency tree (pdfjs-dist 5.4.530) and current
source, not documentation from memory.

## D1 — PDF.js component selection for document mode

**Decision**: Import `TextLayerBuilder`, `AnnotationLayerBuilder`, `PDFLinkService`,
`SimpleLinkService`, and `EventBus` from `pdfjs-dist/web/pdf_viewer.mjs` inside
`src/nativepageviewer.js`. Do NOT adopt `PDFViewer`/`PDFPageView` wholesale.

**Rationale**: Verified exports of the installed `web/pdf_viewer.mjs` include all five symbols.
`TextLayerBuilder`/`AnnotationLayerBuilder` replace exactly the two hand-rolled blocks in
`nativepageviewer.js` (manual span positioning; manual link rect math) while leaving the
existing, working page-container/canvas/IntersectionObserver/cleanup structure untouched —
minimum change, maximum deletion of our own reimplementation. Adopting `PDFViewer` wholesale
would replace the whole scroll/lazy-load pipeline (working, verified) — a rewrite, forbidden by
the governing constraint. `PDFFindController` is confirmed available for the future search
feature but is not wired in this release.

**Alternatives considered**:
- `PDFViewer` full component — rejected: replaces working scroll/lazy-load/cleanup code
  (rewrite), imposes its own container structure, complicates container-based responsiveness.
- Full prebuilt viewer (`web/viewer.html` iframe) — rejected by spec FR-015.
- Keep hand-rolled layers — rejected: it is our reimplementation of PDF.js functionality; the
  official builders are maintained upstream and version-matched to the bundled core.

## D2 — Where the toolbar code lives

**Decision**: Keep and evolve `addNavigationControls()` in `includes/bws-pdf-viewer.js`.
Delete `src/controls.js`.

**Rationale**: The WP integration layer is the only consumer. `src/controls.js` is imported
nowhere (verified by grep — no import site in `src/` or `includes/`); it has already drifted
from the live implementation (no fullscreen/print). Deleting the dead copy satisfies FR-016
(one implementation) with zero behavioural risk. Moving the live logic into `src/` would churn
the bundle and the WP layer simultaneously for no functional gain — the rewrite the user
explicitly forbade.

**Alternatives considered**:
- Consolidate into `src/controls.js` and re-export via the UMD bundle — rejected: touches every
  call site, requires rebuild-coupled deploys of `includes/` and `dist/` in lockstep, and
  rewrites proven code.

## D3 — Page-jump capability per viewer mode

**Decision**: Add an additive `goToPage(pageNum)` to the two viewers that lack it:
- `flipbookviewer.js`: map page → spread index (`ndx = Math.floor(pageNum / 2)` under the
  existing display convention), set `ctx.showNdx`, call `showPages(ctx, viewer)` (instant, no
  flip animation for multi-spread jumps), emit `seen`. ~15 lines beside `flip_forward`.
- `singlepageviewer.js` (image mode): navigate to the requested page using its existing page
  display path, emit `seen`. ~10 lines.
`nativepageviewer.js` already has `goToPage()` (verified at src/nativepageviewer.js:23) — no change.

**Rationale**: The toolbar's page-field commit calls `viewer.goToPage(n)` uniformly; the
existing prev/next fallback chain in `addNavigationControls()` already prefers `goToPage` when
present, so the addition slots into current logic without modifying it. Jumping without a flip
animation matches PDF.js viewer behaviour and avoids animating through dozens of spreads;
single-step navigation keeps its existing animation.

**Alternatives considered**:
- Repeated `flip_forward()` calls to reach the target — rejected: O(n) animations, motion-heavy
  (reduced-motion violation risk), slow for SC-005.
- Toolbar-side per-mode branching — rejected: spreads mode knowledge into the toolbar; a uniform
  viewer method keeps the toolbar mode-agnostic (FR-001).

## D4 — CSS strategy for official layer styles

**Decision**: No webpack CSS pipeline. Port the required rules for `.textLayer` and
`.annotationLayer` from `pdfjs-dist/web/pdf_viewer.css` (v5.4.530) into
`includes/bws-pdf-viewer.css`, replacing the current hand-written layer styles, and set the
`--scale-factor` CSS custom property on each page container (required by v5 layer rendering).

**Rationale**: The build has no css-loader and the constitution's minimal-scope rule discourages
build-pipeline additions for one stylesheet. `includes/bws-pdf-viewer.css` is already the single
enqueued stylesheet; porting the official rules keeps deployment unchanged. v5 text layers
position spans relative to `--scale-factor` — omitting it is the classic misalignment bug, so it
is called out as an explicit task.

**Alternatives considered**:
- Add css-loader/MiniCssExtract to webpack — rejected: new build machinery, new dist artifact,
  new enqueue; disproportionate to need.
- Enqueue `pdf_viewer.css` from node_modules copy — rejected: ships a large unused surface
  (sidebar, findbar, print styles) and creates a second stylesheet to cache-bust.

## D5 — Toolbar placement and visual integration

**Decision**: Toolbar is a static bar docked at the bottom edge inside the viewer container,
rendered as part of the container's normal flow (flex column: viewer area + toolbar), styled in
the PDF.js idiom (dark bar, compact icon-and-text buttons, centred grouping). Not an absolute
overlay; no auto-hide.

**Rationale**: Spec edge case forbids permanently obscuring content and Assumptions reject
auto-hide; a docked bar inside the container reads as "part of the viewer" (FR-001) while never
covering the page. Fullscreen mode inherits it automatically since the bar is inside the
fullscreened container — this also fixes the current detached-bar-invisible-in-fullscreen gap.

**Alternatives considered**:
- Absolute overlay over the canvas bottom — rejected: obscures content on short viewers,
  requires hover/idle logic that harms accessibility.
- Keep bar below/outside the container — rejected: this is the current detached look the
  feature exists to replace, and it vanishes in fullscreen.

## D6 — Toolbar ARIA and keyboard pattern

**Decision**: `role="toolbar"` + `aria-label` (translatable, e.g., "PDF viewer controls") on the
bar. Roving focus per WAI-ARIA APG toolbar pattern: one tab stop; ArrowLeft/ArrowRight move
focus between controls inside the toolbar; Home/End jump to first/last control. The page-jump
input is exempt from arrow-key roving while focused (arrows edit the value); Enter commits,
Escape restores. Container-level page-navigation keydown handler ignores events whose target is
inside the toolbar.

**Rationale**: A generic button row forces N tab stops; APG toolbar pattern reduces to one and
is the "established keyboard interaction pattern" FR-005 requires. The arrow-key conflict is
real today (container arrows flip pages); scoping the container handler to non-toolbar targets
resolves it deterministically. Input exemption follows APG guidance for text inputs inside
toolbars.

**Alternatives considered**:
- Plain tab-through buttons (status quo) — acceptable to WCAG but fails FR-005's toolbar
  pattern requirement and scales poorly as controls grow (search later).
- `aria-controls`/composite widget alternatives — rejected: over-engineering.

## D7 — Page-jump input semantics

**Decision**: `<input type="text" inputmode="numeric" pattern="[0-9]*">` with visible current
page value, `aria-label="Page number"`, adjacent static text "of N". Commit on Enter or blur;
non-numeric/empty → restore current page; out-of-range → clamp to [1, page_count] and navigate.
After successful commit, the existing `announcePageChange()` fires (no new announcement path).

**Rationale**: `type="text"` + `inputmode` avoids number-input spinner/scroll-increment
accessibility hazards while raising a numeric keyboard on mobile. Clamping (spec FR-003 MAY)
chosen over rejection for out-of-range because it matches PDF.js behaviour and user intent
("go to the end"). Reusing `announcePageChange()` preserves FR-007 verbatim.

**Alternatives considered**:
- `type="number"` — rejected: scroll-wheel value changes, spinner target-size issues, locale
  quirks.
- Reject out-of-range instead of clamping — spec permits either; clamping is friendlier and
  matches the reference UX.

## D8 — Toolbar survival across responsive reinit

**Decision**: Keep the existing reinit flow (`setupResponsiveBehavior()` removes and re-adds
controls) but preserve current page across the rebuild: capture `viewerData.viewer.currentPage`
before teardown, and after the new viewer initialises call `goToPage(savedPage)` when the new
mode supports it. The existing `_rebindViewer` hook continues to rebind events.

**Rationale**: FR-011 requires the toolbar functional after rebuild *with current page
preserved* — today the rebuild restarts at page 1. `goToPage()` (D3) makes preservation a
two-line addition to the existing flow rather than new machinery.

**Alternatives considered**:
- Persist/restore whole viewer state object — rejected: only page position is required.

## D9 — TextLayerBuilder/AnnotationLayerBuilder integration shape (v5.4 API)

**Decision**: Per rendered page in `nativepageviewer.js`:
- Text: `new TextLayerBuilder({ pdfPage: page })`, `await builder.render({ viewport })`, append
  `builder.div` to the page container; call `builder.cancel()` in the existing cleanup path.
- Annotations: create one shared `PDFLinkService` bound to a shared `EventBus` and the loaded
  document (`externalLinkTarget = blank`, `externalLinkRel = "noopener noreferrer nofollow"`);
  per page `new AnnotationLayerBuilder({ pdfPage: page, linkService, ... })`,
  `await builder.render({ viewport, intent: "display" })`, append `builder.div`; cancel on cleanup.
- Set `container.style.setProperty('--scale-factor', viewport.scale)` on each page container.
- Exact constructor options verified against `node_modules/pdfjs-dist/web/pdf_viewer.d.mts`
  during implementation (typed declarations ship with the package) — the task list includes
  this verification step before coding.

**Rationale**: Mirrors the upstream usage of the builders as standalone components; the shared
`PDFLinkService` gives internal-destination links (US4 scenario 2) which the hand-rolled layer
never supported — a behaviour improvement delivered by deletion, not new code.

**Alternatives considered**: covered by D1.

## D10 — Verification approach

**Decision**: Extend the feature-001 browser-harness pattern: new `test/harness-toolbar.html`
(document + flipbook embeds side by side, plus narrow-container case) and
`test/verify-toolbar.js` asserting: toolbar DOM/ARIA contract (contracts/toolbar-dom.md),
page-jump commit/clamp/restore, counter sync, fullscreen label toggle, reinit survival with
page preservation, text-selection spans present after component swap, and re-running the
feature-001 assertions (regression gate for US4 scenario 4 / SC-006). Manual pass per
constitution §V (WordPress install, iOS Safari) remains in quickstart.md.

**Rationale**: The 001 harness proved the pattern (playwright-core + system Chrome, no
WordPress needed for the JS layer). Toolbar and layer swaps are exactly the changes it can
catch cheaply and repeatably.
