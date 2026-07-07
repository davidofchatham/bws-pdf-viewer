# BWS PDF Viewer — Project Memory

## Implementation Status (2026-07-07)

**Branch `001-pdf-viewer` — US1 + US2 COMPLETE. All 29 tasks done (T001–T029).**

T028/T029 verified 2026-07-07 via browser automation: `test/harness-t028.html`,
`test/harness-t029.html`, `test/verify-t028-t029.js` (playwright-core + system
Chrome, serve repo root with `npx http-server -p 8123`). All 9 assertions pass.

Committed: `75a650d` (v3.1.0 implementation), `3db38fd` (verification harness).

**Next scope (not yet tasked):**
- US4 (P3): admin settings page — global default mode, mode disable, default controls
- US5 (P2): mobile image-preview fallback on viewer init failure
- End-to-end test with bws-portal-system via `bws_pdf_viewer_pdf_url` / `bws_pdf_viewer_plugin_url` filters
- Cosmetic: narrow flipbook letterboxes page in tall dark box (dimension calc); traditional cover renders left-of-spread with blank right — confirm intended

Files changed: `bws-pdf-viewer.php` (v3.1.0), `includes/bws-pdf-viewer.js` (full rewrite), `includes/bws-pdf-viewer.css`, `dist/` (rebuilt).

### Key bugs fixed in this session
1. Controls gate: `config.singlepage &&` removed → flipbook now shows controls
2. `setupResponsiveBehavior` now reinitializes viewer on breakpoint cross (debounced 150ms)
3. Mobile breakpoint `< 1024` → `<= 767`
4. `workerSrc` manual override removed — zero-config webpack handles worker
5. Portal calls replaced with `apply_filters('bws_pdf_viewer_pdf_url')` + `apply_filters('bws_pdf_viewer_plugin_url')`
6. `showPdfError()` helper added with `role="alert"`, replaces raw innerHTML
7. Loading indicator: PHP adds it; JS removes on success / replaces on error
8. Flipbook page counter: 0-based display index → 1-based page number (T021)
9. `view_mode='singlepage'` accepted as backward-compat alias for `'document'`
10. Fullscreen + print buttons added (show_fullscreen, show_print attrs)

---

## Constitution
- `.specify/memory/constitution.md` — v1.2.0, ratified 2026-03-02, amended 2026-07-07 (browser floor now inherits bundled PDF.js release)
- Five core principles: I. Accessibility (WCAG 2.2 AA), II. User Experience, III. Interoperability, IV. Code Quality, V. Testing Standards
- Plan-template.md updated with concrete constitution check gates

## Key Principles Summary
- Accessibility: WCAG 2.2 AA mandatory — keyboard nav, focus indicators, aria-labels, text layer searchable
- UX: First page ≤2s on 10Mbps; ResizeObserver for layout; mobile breakpoint ≤767px (max-width:767px); flip/slide animations off with reduced-motion, fades permitted
- Interoperability: browser floor inherited from bundled PDF.js (v6: Chrome 125+, Safari 18+/iOS 18+, Firefox ESR); no hardcoded URLs; viewer engine URLs dynamically resolved; multi-domain URL rewriting MUST be supported (via BWS Portal System or internal)
- Code Quality: ESLint zero errors; no hardcoded URLs/secrets; abstraction by developer confirmation
- Testing: Manual — dev server + WordPress install; all three viewer modes; desktop + Safari iOS 18+

## Project Structure
- Main plugin: `bws-pdf-viewer.php`
- Source JS: `src/` — index.js, flipbookviewer.js, singlepageviewer.js, nativepageviewer.js, controls.js
- WordPress integration: `includes/bws-pdf-viewer.js`, `includes/bws-pdf-viewer.css`, `includes/admin.php`
- Built output: `dist/flipbook-viewer.js`, `dist/pdf.js`, `dist/pdf.worker.js`
- Spec/plan tooling: `.specify/`

## Build Commands
- `npm run start` — production build to /dist
- `npm run test` — dev server at localhost:8080
- `npm run clean` — clean dist directory
