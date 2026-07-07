# Tasks: BWS PDF Viewer

**Branch**: `001-pdf-viewer`
**Input**: Design documents from `specs/001-pdf-viewer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Scope**: US1 (Document Mode, P1) and US2 (Flipbook Mode, P1)
**Tests**: Manual — webpack dev server + WordPress install per `quickstart.md`

**Context for implementer**: This is a WordPress plugin build on
[flipbook-viewer](https://github.com/theproductiveprogrammer/flipbook-viewer) and PDF.js.
Key bugs found during planning:
- Controls only shown for document mode — flipbook has none (line 137 `includes/bws-pdf-viewer.js`)
- `setupResponsiveBehavior()` logs layout change but never reinitializes (line 343)
- Mobile breakpoint wrong: `< 1024` should be `<= 767` (line 46)
- Manual `workerSrc` override breaks webpack zero-config (line 35)
- Portal integration uses direct function calls instead of filter hooks

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Confirm baseline and prepare for implementation

- [x] T001 Start dev server (`npm run test`) and note all console errors and warnings in a scratch comment at the top of `includes/bws-pdf-viewer.js`; confirm flipbook canvas renders and document mode renders; confirm controls are absent in flipbook mode

**Checkpoint**: Baseline documented — proceed with foundational changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core fixes shared by both user stories. Complete in order; all must pass before Phase 3 or 4 work begins.

**⚠️ CRITICAL**: No US1 or US2 work can begin until this phase is complete.

### PHP Shortcode Handler (`bws-pdf-viewer.php`)

- [x] T002 In `bws-pdf-viewer.php`: rename `view_mode` default from `'singlepage'` to `'document'` in `$default_options` (line ~50); in `shortcode_handler()`, update the `'singlepage'` config key derivation to `in_array($atts['view_mode'], ['document', 'singlepage'])` so old shortcodes still work; add `'viewMode' => $atts['view_mode']` to the `$config` array
- [x] T003 [P] In `bws-pdf-viewer.php:shortcode_handler()`: remove the entire portal integration block (lines ~185–211 starting with `if (filter_var($atts['enable_portal_integration']...)`); replace it with `$pdf_url = apply_filters('bws_pdf_viewer_pdf_url', $pdf_url);` placed after the empty-URL return and before `wp_enqueue_script()` calls; change `esc_url($pdf_url)` in `$config` to `esc_url_raw($pdf_url)` (filter is applied before esc_url_raw, esc_url_raw is used here since we already validated with the filter)
- [x] T004 [P] In `bws-pdf-viewer.php:register_assets()`: add `$plugin_url = apply_filters('bws_pdf_viewer_plugin_url', BWS_PDF_VIEWER_PLUGIN_URL);` at the top of the function; replace all `BWS_PDF_VIEWER_PLUGIN_URL .` references in the function with `$plugin_url .`; update `wp_localize_script` `'pluginUrl'` value to `$plugin_url`
- [x] T005 In `bws-pdf-viewer.php`: remove `'enable_portal_integration'` and `'enable_search'` from `$default_options` and from the `shortcode_atts()` call in `shortcode_handler()`; remove their corresponding `$config` array entries (`'enableSearch'` and `'enablePortalIntegration'` if present)
- [x] T006 In `bws-pdf-viewer.php`: add `'show_fullscreen' => true` and `'show_print' => true` to `$default_options`; add both to `shortcode_atts()` defaults using the saved option values as default; add `'showFullscreen' => filter_var($atts['show_fullscreen'], FILTER_VALIDATE_BOOLEAN)` and `'showPrint' => filter_var($atts['show_print'], FILTER_VALIDATE_BOOLEAN)` to the `$config` array
- [x] T007 In `bws-pdf-viewer.php:shortcode_handler()`: add `<div class="bws-pdf-viewer-loading"><span>Loading PDF\xe2\x80\xa6</span></div>` inside the container div in the `$output` `sprintf()` call (between the opening `<div` tag and its closing `>`... wait, the div is self-closing — change the output to wrap the loading div: `<div id="...">` + loading div + `</div>`); ensure the loading indicator is the only child of the container div initially

### JavaScript Foundation (`includes/bws-pdf-viewer.js`)

- [x] T008 In `includes/bws-pdf-viewer.js:initViewer()`: remove lines 34–36 (`if (typeof pdfjsLib !== 'undefined') { pdfjsLib.GlobalWorkerOptions.workerSrc = ... }`) — the zero-config webpack approach via `pdfjs-dist/webpack.mjs` sets `workerPort` automatically; manual `workerSrc` override breaks this
- [x] T009 [P] In `includes/bws-pdf-viewer.js:initViewer()` line ~46: change `window.innerWidth < 1024` to `window.innerWidth <= 767` in the `isMobile` property of the `capabilities` object (fix both occurrences in the same expression)
- [x] T010 Add a `showPdfError(container, message, pdfUrl)` function to `includes/bws-pdf-viewer.js` (place it before `initViewer`); it MUST: (1) find and remove any existing `.bws-pdf-viewer-loading` element from `container`; (2) create a `div.bws-pdf-viewer-error` with `role="alert"`; (3) append a `<p>` with `textContent = message`; (4) append a second `<p>` containing an `<a>` with `href=pdfUrl`, `textContent='Open PDF directly'`, `target='_blank'`, `rel='noopener noreferrer'`; (5) append the error div to `container` (do NOT clear or replace other container contents)
- [x] T011 In `includes/bws-pdf-viewer.js`: replace both `container.innerHTML = '<p class="bws-pdf-viewer-error">...'` error assignments (one in the `loadPDF` error callback ~line 63, one in the `flipbook.init` error callback ~line 110) with calls to `showPdfError(container, errorMessage, config.pdf)`; extract the error message string from the original innerHTML for each call
- [x] T012 In `includes/bws-pdf-viewer.js:initViewer()`: after a successful `flipbook.init()` callback (inside the success branch of the callback, before `setupResponsiveBehavior`), remove the loading indicator: `const loader = container.querySelector('.bws-pdf-viewer-loading'); if (loader) loader.remove();`

### Build

- [x] T013 Run `npm run start` to rebuild `dist/flipbook-viewer.js` and `dist/pdf.js`; confirm zero webpack errors; fix any ESLint errors before proceeding

**Checkpoint**: Foundation complete. Open dev server test page — loading indicator should appear then disappear; error state should show `role="alert"` div; no "Setting up fake worker" warning in console.

---

## Phase 3: User Story 1 — Visitor Reads a PDF in Document Mode (Priority: P1) 🎯

**Goal**: Document (scroll) mode shows fully working controls including fullscreen and print; keyboard navigation follows spec; page changes announced to screen readers.

**Independent Test**: Load `test/test-pdf-sp.js` dev server page with `singlepage: true, nativeMode: true`. Verify: first page visible within ~2s; ArrowDown/Space/PageDown advances page; ArrowUp/PageUp goes back; Home/End jump to first/last; fullscreen and print buttons present and functional; page counter updates; "Page N of M" announced by screen reader on navigation.

### Implementation for US1

- [x] T014 [P] [US1] In `includes/bws-pdf-viewer.js:addNavigationControls()`: add a fullscreen button (`button.bws-pdf-fullscreen`) with `type="button"` and `aria-label="Enter fullscreen"`; on click call `container.requestFullscreen?.() ?? container.webkitRequestFullscreen?.()` ; hide the button if `!document.fullscreenEnabled && !document.webkitFullscreenEnabled` (iOS Safari 14 guard); only append the button when `config.showFullscreen !== false`; place it after the nextBtn in the controls div
- [x] T015 [P] [US1] In `includes/bws-pdf-viewer.js:addNavigationControls()`: add a print button (`button.bws-pdf-print`) with `type="button"` and `aria-label="Print PDF"`; on click call `window.print()`; only append it when `config.showPrint !== false`; place it after the fullscreen button
- [x] T016 [US1] In `includes/bws-pdf-viewer.js`: add a `fullscreenchange` event listener on `document` (inside `addNavigationControls`, after the fullscreen button is created) that updates the fullscreen button's `aria-label` and `textContent` to reflect current state: `'Exit fullscreen'` when `document.fullscreenElement || document.webkitFullscreenElement` is truthy, `'Enter fullscreen'` otherwise; store the listener reference and remove it if the viewer is torn down
- [x] T017 [P] [US1] In `includes/bws-pdf-viewer.js:setupKeyboardNavigation()`: add `'ArrowDown'` as an alias for `flip_forward` (alongside `'ArrowRight'`, `'PageDown'`, `' '`); add `'ArrowUp'` as an alias for `flip_back` (alongside `'ArrowLeft'`, `'PageUp'`); call `e.preventDefault()` for both new cases to prevent the page from also scrolling
- [x] T018 [P] [US1] In `includes/bws-pdf-viewer.js:setupKeyboardNavigation()`: after calling `viewer.flip_forward()` or `viewer.flip_back()` from the keyboard handler, also call `announcePageChange(container, viewer.currentPage, viewer.page_count)` so that screen readers announce the new page
- [x] T019 [P] [US1] Add CSS to `includes/bws-pdf-viewer.css` for `.bws-pdf-fullscreen` and `.bws-pdf-print` buttons: match the existing `.bws-pdf-viewer-controls button` base styles (padding, background, border-radius, cursor, font-size, transition); add specific `:focus-visible` outline (minimum 3:1 contrast, minimum 2px); ensure minimum 24×24px click target per WCAG 2.2

**Checkpoint**: Document mode complete. Run quickstart.md Section 2 checks. First page appears, all keyboard keys work, fullscreen expands and exits, print dialog opens, page counter and screen reader announcements are correct.

---

## Phase 4: User Story 2 — Visitor Reads a PDF in Flipbook Mode (Priority: P1)

**Goal**: Flipbook mode has working controls; adapts layout based on container width (not viewport); single-page PDFs are handled correctly; reduced-motion is respected.

**Independent Test**: Load `test/test-pdf.js` dev server page. On wide browser (>767px): two-page spread visible, prev/next/fullscreen/print controls present, page-turn animation plays. Narrow browser (≤767px) or resize below breakpoint: single-page view. OS reduced-motion enabled: navigation instant, no flip animation. One-page PDF: centered at full width.

### Implementation for US2

- [x] T020 [US2] In `includes/bws-pdf-viewer.js:initViewer()`: find the `addNavigationControls` call at line ~137 (`if (config.singlepage && config.showControls !== false)`); remove the `config.singlepage &&` guard so the condition becomes simply `if (config.showControls !== false)`; this ensures controls are added for ALL viewer modes including flipbook
- [x] T021 [US2] In `includes/bws-pdf-viewer.js:addNavigationControls()`: the flipbook viewer's `seen` event emits a 0-based display index (`left_` = `showNdx * 2`), not a 1-based page number; in the `viewer.on('seen', ...)` handler, convert the display index to an actual page number before updating `viewer.currentPage`: use `const actualPage = (displayIndex === 0) ? 1 : displayIndex;` then `viewer.currentPage = actualPage;`; for document (native) mode the `seen` event already emits 1-based page numbers so this conversion must only apply when `displayIndex` is numeric and the viewer is in flipbook mode — add a guard: `const actualPage = (typeof displayIndex === 'number' && displayIndex < 2 && displayIndex >= 0) ? 1 : displayIndex;` (handles the display-0 → page-1 mapping while passing through larger values unchanged)
- [x] T022 [US2] Refactor `includes/bws-pdf-viewer.js:setupKeyboardNavigation()`: instead of destructuring `viewer` from `viewerData` at the top of the function, access `viewerData.viewer` directly inside the keydown event handler (e.g., `viewerData.viewer.flip_forward?.()`); this allows responsive reinit (T023) to update `viewerData.viewer` and have the existing keyboard handler pick up the new viewer without re-adding listeners
- [x] T023 [US2] Fix `includes/bws-pdf-viewer.js:setupResponsiveBehavior()`: when `newLayout !== viewerData.layout`, implement responsive reinit: (1) remove the existing canvas: `container.querySelector('canvas')?.remove()`; (2) remove existing controls: `container.querySelector('.bws-pdf-viewer-controls')?.remove()`; (3) re-add loading indicator temporarily; (4) recalculate dimensions: `const newDimensions = calculateDimensions(container, config, viewerData.bookWrapper, newLayout)`; (5) build updated `viewerOpts` with new `width` and `height`; (6) call `flipbook.init(viewerData.bookWrapper, container, updatedOpts, function(err, newViewer) { /* update viewerData.viewer, remove loading, re-add controls */ })`; (7) update `viewerData.layout = newLayout`; wrap the entire ResizeObserver callback in a 150ms debounce to avoid excessive reinits on slow resize drags
- [x] T024 [US2] In `includes/bws-pdf-viewer.js:initViewer()`, after `loadPDF()` succeeds and before calling `flipbook.init()`: check `if (!config.singlepage && bookWrapper.numPages() === 1)`; if true, override `layout = 'single'` and wrap `bookWrapper` with a passthrough that skips the traditional-layout blank-page insertion (set `useTraditionalLayout = false` for single-page flipbooks); this ensures the one page is centered and fills the full canvas width (FR-002)
- [x] T025 [P] [US2] Verify reduced-motion path: add a `console.assert(typeof viewerOpts.shouldAnimate === 'boolean')` temporarily during testing; trace `shouldAnimate` from `config.enableAnimations && !prefersReducedMotion` through `viewerOpts.shouldAnimate` → `src/index.js opts.shouldAnimate` → `ctx.shouldAnimate` in `flipbookViewer`; confirm that when OS reduced-motion is on, `ctx.shouldAnimate === false` and page turns use instant transition (`ctx.showNdx = ctx.flipNdx; ctx.flipNdx = null; showPages(ctx, viewer)` branch in `flip_1`); remove the assert after confirming

**Checkpoint**: Flipbook mode complete. Run quickstart.md Section 3 checks. Two-page spread on desktop, single-page on narrow, controls visible, animation plays normally, animation instant under reduced-motion, single-page PDF shows centered full-width.

---

## Phase 5: Polish & Cross-Cutting

- [x] T026 Bump `BWS_PDF_VIEWER_VERSION` from `'3.0.0'` to `'3.1.0'` in `bws-pdf-viewer.php` (line ~21 constant, line ~10 Plugin header comment); this busts browser cache for all updated assets
- [x] T027 [P] Run `npm run start` for final production build; verify zero webpack errors and zero ESLint errors; confirm `dist/flipbook-viewer.js`, `dist/pdf.js`, `dist/pdf.worker.js` are updated
- [ ] T028 [P] Test two viewers on same page: embed two `[bws_pdf]` shortcodes in different column widths (e.g., one at 100%, one at 400px); verify each adapts layout independently (FR-003), both load, both have controls, and there are no JS errors in console
- [ ] T029 [P] Test error state: set a shortcode PDF URL to an invalid path; verify the container remains visible (not collapsed), a `div[role="alert"].bws-pdf-viewer-error` appears inside it with the error message, and an `<a target="_blank">` link to the PDF URL is present

---

## Dependencies

```
T001
  └─► T002 → T003 → T005 → T006 → T007
            → T004 (parallel with T003)
  └─► T008 → T009 (parallel)
           → T010 → T011 → T012
  └─► T013 (build — after all Phase 2)
T013
  └─► T014, T015 (parallel, US1)
  └─► T014 → T016 (fullscreen toggle, sequential)
  └─► T017, T018, T019 (parallel, US1)
  └─► T020 → T021 → T022 (sequential, US2)
  └─► T022 → T023 (sequential, reinit affects single-page check)
  └─► T024, T025 (parallel, US2)
T019, T021, T023, T025
  └─► T026 → T027 → T028, T029 (parallel)
```

## Implementation Strategy

**MVP increment (US1 first)**:
1. Complete Phase 2 (foundational) — validates infrastructure, no regression
2. Complete Phase 3 (US1 document mode) — all acceptance scenarios verifiable
3. Run quickstart.md Section 2 manual checks on dev server
4. Deliver US1 to WordPress for integration testing

**Then US2 increment**:
5. Complete Phase 4 (US2 flipbook mode)
6. Run quickstart.md Section 3 manual checks
7. Deliver US2 to WordPress for integration testing

**Parallel opportunities within phases**:
- T003 + T004 (PHP filters — different functions)
- T008 + T009 (JS fixes — different lines)
- T014 + T015 (fullscreen + print buttons — independent functions)
- T017 + T018 + T019 (keyboard nav, announcements, CSS — different concerns)
- T024 + T025 (single-page edge case + reduced-motion — independent)
- T028 + T029 (smoke tests — different scenarios)

## File Change Summary

| File | Phase | Changes |
|------|-------|---------|
| `bws-pdf-viewer.php` | 2 | Filter hooks, view_mode rename, show_fullscreen/print, loading div, version bump |
| `includes/bws-pdf-viewer.js` | 2–4 | workerSrc removal, breakpoint fix, showPdfError, loading mgmt, controls for flipbook, responsive reinit, single-page edge case |
| `includes/bws-pdf-viewer.css` | 3 | Fullscreen + print button styles |
| `dist/flipbook-viewer.js` | 2 (T013), 5 (T027) | Webpack rebuild output |
| `dist/pdf.js` | 2 (T013), 5 (T027) | Webpack rebuild output |
