# Implementation Plan: BWS PDF Viewer

**Branch**: `001-pdf-viewer` | **Date**: 2026-03-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-pdf-viewer/spec.md`

## Summary

WordPress plugin providing inline PDF viewing in two modes: document (continuous scroll via
PDF.js with text/annotation layers) and flipbook (animated page-flip with two-page spread on
desktop, single-page on mobile ≤767px). Editors control per-instance settings via `[bws_pdf]`
shortcode; admins control global defaults and mode restrictions via a settings page. URL
rewriting for multi-domain deployments uses WordPress filter hooks. WCAG 2.2 AA compliant.

Built on the existing v3.0.0 codebase. Changes are targeted: filter-hook URL rewriting replaces
direct portal function calls, fullscreen/print toolbar buttons are added, the mobile breakpoint
is corrected, and admin mode governance is added (P3).

## Technical Context

**Language/Version**: PHP 7.4+ (server), JavaScript ES6+ (client), WordPress 5.9+
**Primary Dependencies**: pdfjs-dist ^5.4 (already installed), @tpp/htm-x ^5.8 (already installed), webpack 5 (build tool), flipbook-viewer (theproductiveprogrammer, already integrated)
**Storage**: WordPress wp_options — `bws_pdf_viewer_options` key
**Testing**: Manual — webpack dev server (`npm run test`) + WordPress installation
**Target Platform**: WordPress plugin (PHP 7.4+ server + all supported browsers)
**Project Type**: WordPress plugin (hybrid PHP shortcode + compiled client-side JavaScript)
**Performance Goals**: First PDF page visible ≤2s on 10 Mbps; lazy-load beyond first viewport via IntersectionObserver (200px buffer)
**Constraints**: No new dependencies without approval; Safari 14+ required; PHP 7.4+; ESLint zero errors; no hardcoded URLs or domain names

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify each item before proceeding. Document any exceptions in the Complexity Tracking table.

- [x] **I. Accessibility** — Keyboard navigation (arrow, PageUp/Down, Space, Home, End)
      already implemented. Focus indicators, aria-labels, and aria-live announcer already
      present. Text layer (native/document mode) remains selectable and Ctrl+F-searchable.
      New toolbar buttons (fullscreen, print) will carry accessible labels per WCAG 2.2 AA.
- [x] **II. User Experience** — PDF.js lazy loading meets ≤2s target. ResizeObserver already
      wired for container-based responsiveness. Mobile breakpoint corrected: 1024px → 767px.
      Flip/slide animations disabled under reduced-motion; fades permitted. Loading indicator
      to be added as part of toolbar controls implementation.
- [x] **III. Interoperability** — Existing direct `example_*` function calls replaced with
      `apply_filters('bws_pdf_viewer_pdf_url', $url)` and
      `apply_filters('bws_pdf_viewer_plugin_url', $url)` hooks. No hardcoded domain names.
      Worker URL handled via zero-config webpack approach (manual override to be removed).
      Shortcode attribute changes are additive except pre-deployment renames (documented).
- [x] **IV. Code Quality** — ESLint in project. No innerHTML with unsanitized strings.
      Abstraction candidates flagged per-task. Minimal scope per commit.
- [x] **V. Testing** — Plan includes dev server test cases and WordPress install verification
      across all viewer modes on desktop + Safari/iOS 14+.

## Project Structure

### Documentation (this feature)

```text
specs/001-pdf-viewer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── shortcode-api.md # Shortcode attribute contract
│   └── filter-hooks.md  # WordPress filter hook contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
bws-pdf-viewer/
├── src/                          # Compiled JS library (webpack → dist/)
│   ├── index.js                  # Router: document | flipbook | image-fallback
│   ├── flipbookviewer.js         # Flipbook mode (page-flip animation)
│   ├── singlepageviewer.js       # Image-based fallback (mobile P2)
│   ├── nativepageviewer.js       # Document mode (PDF.js, lazy scroll)
│   └── controls.js               # Shared navigation controls
├── includes/                     # WordPress integration (not compiled)
│   ├── bws-pdf-viewer.js         # WP init: shortcode → viewer bridge
│   ├── bws-pdf-viewer.css        # Viewer styles (incl. toolbar, error, a11y)
│   └── admin.php                 # Settings page (mode defaults, governance)
├── dist/                         # Webpack output (committed to repo)
│   ├── flipbook-viewer.js        # Bundled library (UMD)
│   ├── pdf.js                    # PDF.js main library (zero-config)
│   └── pdf.worker.js             # PDF.js worker
└── bws-pdf-viewer.php            # Main plugin: shortcode, asset registration
```

**Structure Decision**: Single project. Existing directory layout preserved entirely. No new
top-level directories. Changes distributed across the four existing key files listed above.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All five Constitution Check gates pass.
