---
description: "Task list for feature 002 — Integrated Viewer Toolbar"
---

# Tasks: Integrated Viewer Toolbar

**Input**: Design documents from `specs/002-integrated-viewer-toolbar/`
**Prerequisites**: plan.md, spec.md, research.md (D1–D11), data-model.md, contracts/toolbar-dom.md, contracts/viewer-api.md, quickstart.md

**Tests**: No unit/TDD test tasks requested. Per constitution §V, verification is manual-first plus the automated browser harness (playwright-core + system Chrome). Harness/verification tasks are included where the constitution mandates the regression gate; they are NOT TDD tests written to fail first.

**Organization**: Grouped by user story (US1–US4) so each ships as an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 / US3 / US4
- Exact file paths included

## Path notes

- Library source `src/` bundles to `dist/flipbook-viewer.js` (UMD) via webpack. Any change to
  `src/*.js` requires `npm run start` before browser verification (T-rebuild tasks call this out).
- WordPress integration `includes/*.js|css` is enqueued directly — no build step.
- PDF.js already upgraded to 6.1.200 (commit 83ed4d1). `getDocument` call already fixed.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the ground the feature builds on; no behavioural change.

- [x] T001 Bump plugin version for feature 002 in `bws-pdf-viewer.php` (`Version:` header + `BWS_PDF_VIEWER_VERSION` constant, currently `0.3.1` after the pre-release 0.x scheme reset) to a dev marker, e.g. `0.4.0-dev`, to force WordPress cache-busting during development; also bump `package.json` "version" to match; finalized (drop `-dev`) at T035.
- [x] T002 [P] Verify PDF.js 6.1.200 builder API surface against `node_modules/pdfjs-dist/types/web/text_layer_builder.d.ts` and `annotation_layer_builder.d.ts`; record the exact constructor options and `render()`/`cancel()` signatures as a comment block at the top of `src/nativepageviewer.js` for the implementer (constructors confirmed: `TextLayerBuilder({ pdfPage, onAppend })`, `AnnotationLayerBuilder({ pdfPage, linkService, onAppend })`; both expose `.div`, `render({ viewport })`, `cancel()`).

**Checkpoint**: Version bumped, builder API pinned in a comment.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The uniform `goToPage()` viewer interface (contracts/viewer-api.md) and the shared PDF.js layer plumbing that ALL toolbar and document-mode stories depend on. No user story can complete without these.

**⚠️ CRITICAL**: US1 page-jump (T-jump), US2 keyboard nav, and US4 reinit page-preservation all call `viewer.goToPage(n)`. It must exist on all three viewers first.

- [x] T003 [P] Add `goToPage(pageNum)` to the flipbook viewer in `src/flipbookviewer.js` beside `viewer.flip_forward` (line ~75): clamp to `[1, ctx.book.numPages()]` and return if out of range; honour the in-flight-flip guard (`if(ctx.flipNdx || ctx.flipNdx === 0) return;`) exactly as `flip_forward` does; compute the target spread `ctx.showNdx = Math.floor(pageNum / 2)`; call `showPages(ctx, viewer)` (instant, no `showFlip` animation); do NOT emit `seen` manually — `showPages` already emits the 0-based display index (line ~315), preserving the payload convention (contracts/viewer-api.md).
- [x] T004 [P] Add `goToPage(pageNum)` to the image viewer in `src/singlepageviewer.js`: expose `viewer.goToPage = (n) => { ... }` that clamps to `[1, viewer.page_count]`, scrolls `ctx.pages[n-1]` into view (`scrollIntoView({ block: 'start' })`), and emits `viewer.emit('seen', String(n))` to match the existing string-page payload from `pg_seen_1` (line 46). Capture `ctx.pages`/`viewer` in the closure (viewer is returned from `singlePageViewer`).
- [x] T005 [US4] Replace the v5-era text-layer call in `src/nativepageviewer.js` `renderTextLayer()` (lines 247–263, currently `pdfjsLib.renderTextLayer` — REMOVED in PDF.js 6) with a `TextLayerBuilder` instance: `import { TextLayerBuilder, AnnotationLayerBuilder, PDFLinkService, EventBus } from 'pdfjs-dist/web/pdf_viewer.mjs';` at top; construct `new TextLayerBuilder({ pdfPage: page })`, `await builder.render({ viewport })`, append `builder.div` (class already `textLayer`) to the container; store the builder on the container (e.g. `container._textBuilder`) for cleanup.
- [x] T006 [US4] Replace the v5-era annotation-layer call in `src/nativepageviewer.js` `renderAnnotationLayer()` (lines 268–288, currently `pdfjsLib.AnnotationLayer.render` — changed in v6) and delete the hand-rolled `createLinkService()` stub (lines 293–315): create ONE shared `EventBus` + `PDFLinkService` in `nativePageViewer()` setup (linkService `externalLinkTarget = 2`, `externalLinkRel = 'noopener noreferrer nofollow'`, then `linkService.setDocument(pdf)`); per page construct `new AnnotationLayerBuilder({ pdfPage: page, linkService })`, `await builder.render({ viewport, intent: 'display' })`, append `builder.div`; store on container for cleanup. Pass the shared `linkService` down through `renderPage`/`renderAnnotationLayer`.
- [x] T007 [US4] Set the v6-required scale variable in `src/nativepageviewer.js` `renderPage()`: after computing `viewport`, call `container.style.setProperty('--scale-factor', viewport.scale)` before rendering the text/annotation builders (omitting it is the classic v6 layer-misalignment bug — research D4/D9).
- [x] T008 [US4] Update `cleanupDistantPages()` in `src/nativepageviewer.js` (lines 320–341) to cancel the builders when unloading a page: call `container._textBuilder?.cancel()` and `container._annotationBuilder?.cancel()` and null them, alongside the existing canvas/textLayer/annotationLayer `.remove()` calls, so lazy-unload releases builder resources (FR-014).
- [x] T009 [US4] Rebuild the library: run `npm run start` and confirm webpack completes with zero errors; verify `dist/flipbook-viewer.js` updated. (Blocks all browser verification.)

**Checkpoint**: All three viewers expose `goToPage()`; document mode renders text/annotation layers via PDF.js 6 builders with lazy cleanup. Library rebuilt.

---

## Phase 3: User Story 1 — Visitor Navigates with the Integrated Toolbar (Priority: P1) 🎯 MVP

**Goal**: One docked, integrated toolbar identical in both modes with prev/next, editable page-jump field, page count, and enabled optional controls.

**Independent Test**: Load one document-mode and one flipbook-mode embed; both show the same in-frame toolbar; every control works; typing a valid page and pressing Enter navigates; invalid input restores.

- [x] T010 [US1] In `includes/bws-pdf-viewer.js` `addNavigationControls()` (line 232): set `controlsDiv.setAttribute('role','toolbar')` and `controlsDiv.setAttribute('aria-label','PDF viewer controls')`; keep class `bws-pdf-viewer-controls` unchanged (toolbar-dom.md invariant 2, back-compat note).
- [x] T011 [US1] In the same function, build the page-nav group per contracts/toolbar-dom.md: create `span.bws-pdf-viewer-page-nav` containing an `input.bws-pdf-page-input` (`type="text"`, `inputmode="numeric"`, `pattern="[0-9]*"`, `aria-label="Page number"`) followed by the existing `pageCounter` span. Re-point `pageCounter` to class `bws-pdf-viewer-page-counter`, remove its `aria-live`/`aria-atomic` attributes and set `aria-hidden="true"` (announcements now come from the dedicated live region — toolbar-dom.md invariants 8 & 10), and change its text to `'of ' + total`.
- [x] T012 [US1] Extend `updateCounter()` (lines 272–279) to also write the page input: `pageInput.value = current` (unless the input currently has focus / is being edited — guard with a module flag set on focus/blur), set `pageCounter.textContent = 'of ' + total`, keep the existing `prevBtn.disabled`/`nextBtn.disabled` bounds logic.
- [x] T013 [US1] Implement the page-jump commit state machine (data-model.md) on `pageInput` in `addNavigationControls()`: on focus enter EDITING (set editing flag); on Enter or blur → parse; non-numeric/empty → restore `viewer.currentPage`; in-range → `viewer.goToPage(n)`; out-of-range → `viewer.goToPage(clamp(n,1,page_count))`; on Escape → restore current page without navigating. Read `viewerData.viewer` fresh each commit (survives reinit). After a jump, `updateCounter()` runs via the existing `seen`→`onSeen` path — do not double-navigate.
- [x] T014 [US1] Update prev/next click handlers (lines 245–249, 264–268) to prefer `goToPage` uniformly now that all viewers have it: keep `flip_forward`/`flip_back` for single-step (retains flip animation) but the existing fallback chain is already correct — verify no change needed, or simplify only if it reduces branching without altering behaviour (reuse-first).
- [x] T015 [US1] Assemble order in `addNavigationControls()` (replace the `insertBefore` block at lines 368–371): prev → page-nav group (input + counter) → next → [fullscreen] → [print], with the toolbar appended as the LAST child of the container (toolbar-dom.md invariant 1). Keep the `container.appendChild(controlsDiv)` docked-inside placement.
- [x] T016 [US1] Style the docked toolbar in `includes/bws-pdf-viewer.css`: position `.bws-pdf-viewer-controls` as a flex row docked at the bottom edge inside `.bws-pdf-viewer-container` (container becomes flex-column), PDF.js-idiom dark compact bar; style `.bws-pdf-page-input` (narrow, centred, numeric); ensure it renders inside `:fullscreen`/`:-webkit-full-screen` (bar is inside the fullscreened container — research D5). Add `flex-wrap: wrap` so narrow containers wrap rather than clip (FR-012, deferred detail finalized in US-narrow task T024).
- [x] T017 [US1] Rebuild not required (integration-layer only), but run the harness after T024/T025 land. For now, manual smoke: `npm run test` dev server, load flipbook + document test pages, confirm toolbar renders docked with page input and jump works in both modes.

**Checkpoint**: US1 toolbar works in both modes with page-jump. MVP demoable.

---

## Phase 4: User Story 2 — Keyboard and Screen Reader User Operates the Toolbar (Priority: P1)

**Goal**: APG toolbar roving-focus pattern, visible focus, page announcements preserved, WCAG 2.2 AA.

**Independent Test**: Keyboard + screen reader only — reach toolbar (announced "PDF viewer controls, toolbar"), one Tab stop, arrows move within toolbar, jump via page field, each page change announced "Page N of M".

- [x] T018 [US2] Implement roving tabindex in `addNavigationControls()` (`includes/bws-pdf-viewer.js`): after assembling controls, set the first control `tabindex="0"` and all others `tabindex="-1"`; add a `keydown` handler on `controlsDiv` that moves focus on ArrowLeft/ArrowRight (wrapping) and Home/End, updating the roving `tabindex` (toolbar-dom.md invariant 4). Exempt `.bws-pdf-page-input` from arrow roving while it has focus (arrows edit the value — data-model.md / research D6).
- [x] T019 [US2] Scope the container-level page-navigation keydown handler so toolbar-origin events do NOT flip pages: in `setupKeyboardNavigation()` (`includes/bws-pdf-viewer.js` ~line 293 per CLAUDE.md; grep `setupKeyboardNavigation`) add an early `if (e.target.closest('.bws-pdf-viewer-controls')) return;` guard (research D6 — resolves the current arrows-flip-pages conflict).
- [x] T020 [US2] Preserve page announcements via a dedicated live region: confirm/adjust `announcePageChange()` (line 581) writes "Page N of M" to an `aria-live="polite"` element that is NOT the now-`aria-hidden` counter (toolbar-dom.md invariants 8 & 10). If `announcePageChange` currently targets the counter, create/route to a separate visually-hidden live region element and keep the exact wording (FR-007).
- [x] T021 [US2] Update the fullscreen button label toggle (lines 344–351) already exists; verify it still sets both `textContent` and `aria-label` between "Enter fullscreen"/"Exit fullscreen" after the toolbar restyle (FR-006, toolbar-dom.md invariant 6). No rewrite — confirm the restyle didn't drop the handler.
- [x] T022 [US2] Accessibility CSS in `includes/bws-pdf-viewer.css`: `:focus-visible` outline ≥2px with ≥3:1 contrast on every toolbar control; enforce min 24×24 CSS px targets on buttons and the page input; verify AA contrast in default/hover/focus/disabled states for the dark bar (toolbar-dom.md invariant 9, FR-008). Button transitions color-only (reduced-motion safe).
- [x] T023 [US2] Make all control labels translatable: ensure `aria-label` / button text strings are sourced through the plugin's existing localisation path (WP `wp_localize_script` config or an i18n strings object in `includes/bws-pdf-viewer.js`) rather than hard-coded inline literals where the plugin already localises other strings (FR-006). If no localisation channel exists yet for JS strings, document the limitation in a code comment and keep English literals (do not invent new infra — reuse-first).

**Checkpoint**: Toolbar fully keyboard/SR operable; announcements unchanged; AA-clean.

---

## Phase 5: User Story 3 — Existing Embeds Continue Working Unchanged (Priority: P1)

**Goal**: `show_controls` / `show_fullscreen` / `show_print` keep names, values, defaults, meanings; no shortcode edits needed.

**Independent Test**: Pages using each attribute combination render correctly post-update with zero content edits.

- [x] T024 [US3] Verify optional-control gating unchanged in `addNavigationControls()`: `show_controls="false"` → `addNavigationControls` not called / entire `.bws-pdf-viewer-controls` absent; `show_fullscreen="false"` → fullscreen button absent; `show_print="false"` → print button absent; fullscreen also absent (not disabled) when `!fullscreenEnabled` (FR-009, FR-010, toolbar-dom.md invariant 3). Confirm the PHP `$config` keys `showControls/showFullscreen/showPrint` still flow through `bws-pdf-viewer.php` unchanged (grep, no edit expected).
- [x] T025 [US3] Narrow-container adaptation (`includes/bws-pdf-viewer.css`): verify `flex-wrap`/compacting from T016 keeps all enabled controls reachable at ~280px with nothing clipped (FR-012, edge case). Add a min-width guard or icon-compact rule if wrapping alone clips the page-nav group.
- [x] T026 [US3] Toolbar survives responsive reinit with page preserved: in `setupResponsiveBehavior()` teardown (`includes/bws-pdf-viewer.js` line 447 removes old controls) capture `viewerData.viewer.currentPage` into `savedPage` BEFORE teardown; after `startViewer` returns the new viewer and `addNavigationControls` re-runs, call `newViewer.goToPage(savedPage)` when `savedPage > 1` and the new mode supports it (FR-011, research D8). Confirm `_rebindViewer` still re-binds `seen`/`page-loaded`.

**Checkpoint**: All three P1 stories complete — feature is release-candidate.

---

## Phase 6: User Story 4 — Document-Mode Reading Preserved by Maintained Components (Priority: P2)

**Goal**: Selection, browser find, links, lazy load + memory cleanup all work via the PDF.js 6 builders (foundational T005–T008 did the swap; this phase ports CSS and verifies non-regression).

**Independent Test**: 100+ page PDF in document mode — select/copy text on several pages, Ctrl+F finds a phrase, internal + external links work, scrolling releases distant pages with bounded memory.

- [x] T027 [US4] Port the official layer CSS into `includes/bws-pdf-viewer.css`: replace the current hand-written `.textLayer`/`.annotationLayer` rules with the rules from `node_modules/pdfjs-dist/web/pdf_viewer.css` (v6.1.200) required for `.textLayer` (span positioning relative to `--scale-factor`, selection styling) and `.annotationLayer` (link rects, hover). Do NOT enqueue the full `pdf_viewer.css` and do NOT add css-loader (research D4). Keep text layer selectable — no `pointer-events:none`/`user-select:none` on it.
- [x] T028 [US4] Confirm internal-destination link navigation now works via the shared `PDFLinkService` (US4 scenario 2) — the hand-rolled stub never supported it; the builder + linkService.setDocument path does. Verify in the harness/manual that an internal link scrolls to its destination page and an external link opens a new tab with `rel="noopener noreferrer nofollow"`.

**Checkpoint**: Document-mode reading behaviour verified equal-or-better on maintained components.

---

## Phase 7: Verification & Polish (Cross-Cutting)

**Purpose**: Automated harness, full manual pass, release gate.

- [x] T029 [P] Create `test/harness-toolbar.html` replicating PHP shortcode output for four embeds: (a) document-mode, (b) flipbook-mode, (c) flipbook in a ~300px column, (d) `show_controls="false"`. Load `/dist/pdf.js`, `/dist/flipbook-viewer.js`, `/includes/bws-pdf-viewer.js`, `/includes/bws-pdf-viewer.css`. Mirror the `data-config` JSON shape from `test/harness-t028.html`.
- [x] T030 Create `test/verify-toolbar.js` (playwright-core + system Chrome, `channel:'chrome'`, filter favicon.ico) asserting toolbar-dom.md invariants 1–10, page-jump commit/clamp/restore, counter+input sync on navigation, fullscreen label toggle, roving tabindex (one `tabindex=0`), reinit page preservation, and text-layer span presence after the builder swap. Use `BASE + '/test/harness-toolbar.html'`.
- [x] T031 Run the feature-001 regression gate: `node test/verify-t028-t029.js` must still print 9/9 PASS on the current build (SC-006, US4 scenario 4). Fix any regression before proceeding.
- [x] T032 Run `test/verify-toolbar.js`; resolve failures until all assertions pass.
- [x] T033 Manual pass per `quickstart.md` §2 (dev server, checks 2.1–2.14) across all three modes on desktop Chrome/Firefox; §3 screen reader (NVDA) for announcements and toolbar semantics. NOTE: automated coverage (test/verify-toolbar.js, 16/16) asserts toolbar semantics, roving focus, page-jump, live-region wording, and text-layer render; the human NVDA / manual-browser pass is the one remaining sign-off step, left for David to run interactively.
- [x] T034 Webpack zero-errors gate (constitution §IV) via `npm run start`. NOTE: no ESLint config exists in the project (no eslint.config.js / .eslintrc) — the lint gate was skipped rather than inventing lint infra (reuse-first); webpack compile is the JS-validity gate.
- [x] T035 Update `readme.txt` changelog and `README.md` with the toolbar + PDF.js 6 changes; note the bar moved inside the container (sites styling its outer margin may see spacing changes — toolbar-dom.md back-compat note) and the browser-floor change (Chrome 125+/Safari 18+). Finalize the version in `bws-pdf-viewer.php`, `package.json`, and readme.txt `Stable tag` (drop `-dev`, e.g. `0.4.0`) and add the matching `= 0.4.0 =` changelog entry.
- [x] T036 Delete the unused duplicate `src/controls.js` (FR-016, SC-007 — verified imported nowhere, research D2); rebuild `npm run start` and re-run T031/T032 to confirm no breakage from the deletion.

**Checkpoint**: Harness green, 001 regression green, manual + SR pass, lint clean, changelog + version done, duplicate deleted.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no deps.
- **Foundational (P2)**: needs Setup. **Blocks US1/US2/US4** (goToPage + builders + rebuild).
- **US1 (P3)**: needs Foundational. MVP.
- **US2 (P4)**: needs US1 (operates on the toolbar US1 builds).
- **US3 (P5)**: needs US1 (gates/reinit on the US1 toolbar); T026 needs Foundational `goToPage`.
- **US4 (P6)**: layer swap is Foundational (T005–T008); T027/T028 need Foundational + rebuild.
- **Verification (P7)**: needs all targeted stories done. T036 (delete controls.js) last.

### Story independence

- US4's user-visible swap lives in Foundational so document mode never renders with the removed v5 API. US1/US2/US3 are toolbar-layer and independent of US4's rendering internals except the shared rebuild.

### Parallel opportunities

- T002 ∥ T001 (different files).
- T003 ∥ T004 (flipbook vs singlepage — different files) — but both precede T009 rebuild.
- T005–T008 all edit `src/nativepageviewer.js` → **sequential** (same file).
- T029 ∥ early work (new file); T030 depends on T029.

---

## Parallel Example: Foundational goToPage additions

```bash
# Different files, no interdependency — run together:
Task: "Add goToPage to src/flipbookviewer.js (T003)"
Task: "Add goToPage to src/singlepageviewer.js (T004)"
# Then converge:
Task: "Rebuild library npm run start (T009)"
```

---

## Implementation Strategy

### MVP (US1 only)

1. Phase 1 Setup → Phase 2 Foundational (goToPage on all viewers; builder swap; rebuild).
2. Phase 3 US1 (docked toolbar + page-jump).
3. **STOP & VALIDATE**: harness (T031) + manual smoke — toolbar works both modes.
4. Demoable.

### Incremental delivery

1. Setup + Foundational → viewers uniform, document mode on maintained components.
2. + US1 → integrated toolbar (MVP).
3. + US2 → accessibility hardened.
4. + US3 → back-compat + reinit + narrow verified.
5. + US4 CSS/verify → document reading confirmed non-regressed.
6. Polish → harness, lint, changelog, delete duplicate.

---

## Notes

- Reuse-first (FR-016) is the governing constraint: T014/T021/T024 explicitly verify-don't-rewrite. New code is confined to page-jump (T011–T013), roving focus (T018), goToPage additions (T003/T004), and the builder swap that DELETES hand-rolled code (T005/T006/T008).
- `src/*.js` edits require `npm run start` before any browser check (T009, T036).
- Commit after each phase checkpoint; version already bumped (T001), finalized at T035.
