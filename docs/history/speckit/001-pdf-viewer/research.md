# Research: BWS PDF Viewer

**Date**: 2026-03-02
**Branch**: `001-pdf-viewer`

## Decision Log

### 1. Rendering Engine for Document Mode

**Decision**: PDF.js via `pdfjs-dist` (already installed — not a new dependency)

**Rationale**:
- Already integrated in codebase via webpack zero-config approach (`pdfjs-dist/webpack.mjs`)
- Provides three rendering layers (canvas, text, annotation) required for WCAG text selection
  and Ctrl+F browser search
- Allows full plugin control over toolbar, aria-labels, and keyboard navigation
- PDF source URL can be passed through the `bws_pdf_viewer_pdf_url` filter hook before being
  provided to `pdfjsLib.getDocument()`
- Native `<embed>` cannot satisfy FR-005 (custom toolbar controls), FR-009 (custom keyboard
  navigation), or FR-010 (custom accessible labels)

**Alternatives considered**:
- Native browser `<embed>`: Simpler and more performant but toolbar/accessibility are
  browser-controlled. Deferred for future consideration if browsers improve keyboard nav
  or a control overlay approach is developed (noted by developer as potential future path).

**Future path**: If browser `<embed>` gains standardised keyboard nav, document mode could
switch to native for deployments where custom toolbar is not required. No code changes to
flipbook mode would be needed.

---

### 2. URL Rewriting Integration Point

**Decision**: WordPress filter hooks — `bws_pdf_viewer_pdf_url` for PDF source URL,
`bws_pdf_viewer_plugin_url` for plugin base URL

**Rationale**:
- Idiomatic WordPress plugin-to-plugin integration; no coupling between plugins
- BWS Portal System adds `add_filter()` callbacks without modifying this plugin's source
- Replaces tightly-coupled direct calls to `bws_portal_get_domain_context()` /
  `bws_portal_modify_url()` which break when BWS Portal System is absent
- Easier to test (add a test filter without installing Portal System)

**Current code to replace** (in `bws-pdf-viewer.php`, lines 185–211):
```php
// REMOVE: direct portal coupling block
if (filter_var($atts['enable_portal_integration'], FILTER_VALIDATE_BOOLEAN) &&
    function_exists('bws_portal_get_domain_context') && ...) { ... }

// REPLACE WITH:
$pdf_url = apply_filters('bws_pdf_viewer_pdf_url', $pdf_url);
```

**Plugin URL filter** — applied during asset registration:
```php
$plugin_url = apply_filters('bws_pdf_viewer_plugin_url', BWS_PDF_VIEWER_PLUGIN_URL);
wp_register_script('bws-pdfjs-lib', $plugin_url . 'dist/pdf.js', ...);
// ... all other wp_register_script / wp_register_style calls use $plugin_url
```

**Alternatives considered**:
- Configuration function (`bws_pdf_register_url_transformer`): more complex API, harder
  to document for BWS Portal System integration.
- Data-attribute post-processing: fragile, requires full HTML parsing by portal system.

---

### 3. View Mode Naming: `singlepage` → `document`

**Decision**: Rename shortcode attribute value from `view_mode="singlepage"` to
`view_mode="document"` throughout the public API

**Rationale**:
- The spec uses "document" throughout; "singlepage" is an implementation detail that
  leaks into the editor-facing API
- Plugin is pre-deployment — constitution permits breaking changes with documentation
- Internal JS routing and PHP config key (`singlepage` boolean) can be updated at the same
  time for consistency

**Internal compatibility**: The derived boolean `singlepage: true/false` in the JS config
object is retained for compatibility with the flipbook-viewer library routing logic.

---

### 4. Mobile Breakpoint Correction

**Decision**: Change mobile auto-detect threshold in JS from `< 1024` to `<= 767`

**Rationale**: Constitution §II mandates `max-width: 767px` as the standard mobile breakpoint.
Current code in `includes/bws-pdf-viewer.js` (line 46) uses `< 1024` — does not match the
admin-configurable `breakpoint` default of 768.

**Code fix** (`includes/bws-pdf-viewer.js` line 46):
```js
// CURRENT (incorrect):
isMobile: (navigator.maxTouchPoints > 0 && window.innerWidth < 1024) || window.innerWidth < 1024

// CORRECTED:
isMobile: (navigator.maxTouchPoints > 0 && window.innerWidth <= 767) || window.innerWidth <= 767
```

---

### 5. Toolbar Controls: Fullscreen and Print

**Decision**: Add fullscreen and print buttons to the controls toolbar, individually
toggleable via shortcode attributes (`show_fullscreen`, `show_print`). Admin sets global
defaults.

**Rationale**:
- FR-005 requires individually toggleable controls
- `show_controls` already gates navigation controls; extend same pattern to fullscreen/print
- Fullscreen: `element.requestFullscreen()` / `document.exitFullscreen()` — supported in all
  target browsers (Chrome, Firefox, Safari 15.1+, Edge, iOS Safari 15.4+)
  - iOS Safari 14 does not support `requestFullscreen()` on arbitrary elements — fullscreen
    button should be hidden on this platform or trigger a graceful degradation
- Print: `window.print()` — universal
- Both buttons added to the existing `controlsDiv` built in `addNavigationControls()`

**New shortcode attributes**:
- `show_fullscreen` (boolean, default: admin setting → `true`)
- `show_print` (boolean, default: admin setting → `true`)

**New admin settings keys**:
- `default_show_fullscreen` (boolean, default `true`)
- `default_show_print` (boolean, default `true`)

**Fullscreen iOS caveat**: `requestFullscreen()` is not supported on iOS Safari 14. The
fullscreen button MUST be hidden or disabled on iOS 14 to avoid a broken experience.
Detection: `!document.fullscreenEnabled && !document.webkitFullscreenEnabled`.

---

### 6. Admin Mode Governance (P3)

**Decision**: Add `disabled_modes` array to admin settings. Settings UI prevents disabling
the last enabled mode (client-side JS + PHP server-side validation).

**Config key**:
```php
'disabled_modes' => array(), // [] = both enabled; ['flipbook'] = only document; ['document'] = only flipbook
// Cannot contain both 'document' and 'flipbook' simultaneously (FR-015)
```

**PHP shortcode enforcement**: If the requested `view_mode` is in `disabled_modes`, fall back
to the other enabled mode silently (no user-facing error — the viewer still renders).

---

### 7. Worker URL Bug Fix

**Decision**: Remove the manual `workerSrc` override in `includes/bws-pdf-viewer.js` and
rely on the zero-config webpack approach (`GlobalWorkerOptions.workerPort`)

**Rationale**:
- Current code (line 35): `pdfjsLib.GlobalWorkerOptions.workerSrc = bwsPdfViewerData.pluginUrl + 'dist/pdf.worker.js'`
  overrides the automatic worker setup from `pdfjs-dist/webpack.mjs`
- This caused "Setting up fake worker" warning in earlier versions
- The zero-config approach sets `GlobalWorkerOptions.workerPort` via MessageChannel — no
  path string needed

**Note on multi-domain**: If the worker URL needs rewriting (for BWS Portal System cross-domain
delivery), pass `bwsPdfViewerData.pluginUrl` (already rewritten server-side via the
`bws_pdf_viewer_plugin_url` filter) and use it as the `workerSrc` fallback only when
`workerPort` is not set. This avoids breaking the zero-config path.

---

### 8. Error Handling (FR-014)

**Decision**: Replace inline `innerHTML` error assignment with a structured helper function
that renders a `role="alert"` container with message and direct PDF link

**Pattern**:
```js
function showPdfError(container, message, pdfUrl) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'bws-pdf-viewer-error';
    errorDiv.setAttribute('role', 'alert');
    const msg = document.createElement('p');
    msg.textContent = message;
    const link = document.createElement('a');
    link.href = pdfUrl;            // pdfUrl comes from config.pdf — server-sanitized via esc_url
    link.textContent = 'Open PDF directly';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const linkPara = document.createElement('p');
    linkPara.appendChild(link);
    errorDiv.appendChild(msg);
    errorDiv.appendChild(linkPara);
    container.appendChild(errorDiv);
}
```

Container MUST NOT be cleared or hidden — FR-014 explicitly requires it to remain visible.

---

### 9. Single-Page PDF in Flipbook (FR-002 edge case)

**Decision**: When `numPages === 1` in flipbook mode, render the single page centred and
filling the full viewer width regardless of container size

**Implementation**: In `includes/bws-pdf-viewer.js`, after `loadPDF()` resolves, check
`bookObj.numPages() === 1`. If true and `viewMode === 'flipbook'`, force `layout = 'single'`
before passing to the viewer. The `createBookWrapper()` traditional-layout logic may also
need a guard for single-page books.

---

### 10. Removed Shortcode Attribute: `enable_portal_integration`

**Decision**: Remove `enable_portal_integration` attribute from the shortcode API and
`$default_options`

**Rationale**: With filter hooks, the portal integration is always active when BWS Portal
System registers its filter. A per-shortcode boolean is redundant and confusing. Pre-deployment
breaking change — acceptable per constitution. Remove from `shortcode_atts()` call and
`$default_options` array.

---

### 11. Loading State Indicator (Constitution §II)

**Decision**: Add a CSS-based loading spinner to the viewer container while the PDF fetches
and initialises

**Implementation**: PHP shortcode adds a `<div class="bws-pdf-viewer-loading">` inside the
container div by default. JS removes it (or hides it) once `flipbook.init()` calls back
successfully. If init fails, the error helper replaces it.

This satisfies the constitution's "Loading Feedback" requirement without a new dependency.
