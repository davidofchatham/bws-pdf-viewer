# Data Model: BWS PDF Viewer

**Date**: 2026-03-02
**Branch**: `001-pdf-viewer`

## Admin Settings

**WordPress storage key**: `bws_pdf_viewer_options` (wp_options table)

```php
array(
    // --- Viewer Layout ---
    'width'                   => '100%',        // string: CSS width value
    'height'                  => 'auto',        // string: CSS height value or 'auto'
    'background_color'        => '#353535',     // string: CSS colour
    'box_color'               => '#353535',     // string: CSS colour
    'box_border'              => 0,             // int: border width in px
    'margin'                  => 1,             // float: page margin factor
    'margin_top'              => null,          // float|null: top margin override
    'margin_left'             => null,          // float|null: left margin override
    'breakpoint'              => 768,           // int: container px width for single↔double switch

    // --- Viewer Behaviour ---
    'view_mode'               => 'document',    // string: 'document' | 'flipbook'
    'layout'                  => 'auto',        // string: 'auto' | 'single' | 'double'
    'book_layout'             => 'traditional', // string: 'traditional' | 'spread'
    'enable_animations'       => true,          // bool: false disables flip animation globally

    // --- Default Control Visibility ---
    'default_show_fullscreen' => true,          // bool: default fullscreen button state
    'default_show_print'      => true,          // bool: default print button state

    // --- Mode Governance (P3) ---
    'disabled_modes'          => array(),       // string[]: disabled mode names
                                                //   []             = both enabled
                                                //   ['flipbook']   = flipbook disabled site-wide
                                                //   ['document']   = document disabled site-wide
                                                //   cannot contain both simultaneously (FR-015)
)
```

**Removed from v3.0.0**:
- `enable_portal_integration` — removed; URL rewriting now via WordPress filter hooks

---

## Shortcode Configuration (Per-Instance)

**Format**: `[bws_pdf attr="value" ...]https://example.com/doc.pdf[/bws_pdf]`

All attributes optional. Resolution order: shortcode attribute → admin settings → plugin default.

```php
array(
    // content (between tags) = PDF source URL (required)

    // --- Viewer Identity ---
    'view_mode'         => 'document',    // 'document' | 'flipbook'
    'layout'            => 'auto',        // 'auto' | 'single' | 'double'
    'book_layout'       => 'traditional', // 'traditional' | 'spread'

    // --- Dimensions ---
    'width'             => '100%',
    'height'            => 'auto',
    'breakpoint'        => 768,           // int px

    // --- Styling ---
    'background_color'  => '#353535',
    'box_color'         => '#353535',
    'box_border'        => 0,
    'margin'            => 1,
    'margin_top'        => null,
    'margin_left'       => null,

    // --- Controls ---
    'show_controls'     => true,          // bool: navigation controls (always shown, cannot disable)
    'show_fullscreen'   => true,          // bool: fullscreen toggle button
    'show_print'        => true,          // bool: print button

    // --- Behaviour Overrides ---
    'enable_animations' => true,          // bool
    'force_native'      => null,          // null | 'true' | 'false' — force native/image sub-mode
)
```

**Removed from v3.0.0**:
- `enable_portal_integration` — removed (replaced by filter hooks)
- `enable_search` — removed (reserved for a future feature spec)

**Renamed shortcode values** (pre-deployment breaking change):
- `view_mode="singlepage"` → `view_mode="document"`

---

## JavaScript Config Object

Passed from PHP → JS as JSON in `data-config` attribute on the container `<div>`.
HTML-entity-escaped by `esc_attr(wp_json_encode($config))`.

```json
{
    "pdf":             "https://example.com/doc.pdf",
    "viewMode":        "document",
    "layout":          "auto",
    "bookLayout":      "traditional",
    "width":           "100%",
    "height":          "auto",
    "breakpoint":      768,
    "backgroundColor": "#353535",
    "boxColor":        "#353535",
    "boxBorder":       0,
    "margin":          1,
    "marginTop":       null,
    "marginLeft":      null,
    "singlepage":      true,
    "showControls":    true,
    "showFullscreen":  true,
    "showPrint":       true,
    "enableAnimations": true,
    "forceNative":     null
}
```

**Notes**:
- `singlepage` (boolean derived from `viewMode === 'document'`) is retained for compatibility
  with the existing `flipbook.init()` routing logic in `src/index.js`.
- `pdf` URL has been passed through `apply_filters('bws_pdf_viewer_pdf_url', $url)` in PHP
  before JSON-encoding — JS receives the already-rewritten URL.

---

## WordPress Filter Hooks

Integration points for URL rewriting by BWS Portal System or other plugins.

### `bws_pdf_viewer_pdf_url`

Filters the PDF source URL before it is JSON-encoded into the page.

```php
// Registration (in bws-pdf-viewer.php, after URL validation):
$pdf_url = apply_filters('bws_pdf_viewer_pdf_url', $pdf_url);

// BWS Portal System hooks in:
add_filter('bws_pdf_viewer_pdf_url', 'bws_portal_modify_url');
```

- **Parameter**: `string $url` — the validated PDF source URL
- **Returns**: `string` — the (optionally rewritten) URL
- **Called from**: `BWS_PDF_Viewer::shortcode_handler()`, after `esc_url_raw()` validation

### `bws_pdf_viewer_plugin_url`

Filters the plugin base URL used when registering all plugin scripts and styles.

```php
// Registration (in bws-pdf-viewer.php):
$plugin_url = apply_filters('bws_pdf_viewer_plugin_url', BWS_PDF_VIEWER_PLUGIN_URL);

// BWS Portal System hooks in:
add_filter('bws_pdf_viewer_plugin_url', 'bws_portal_modify_url');
```

- **Parameter**: `string $url` — `plugin_dir_url(__FILE__)`, trailing slash included
- **Returns**: `string` — the (optionally rewritten) base URL
- **Called from**: `BWS_PDF_Viewer::register_assets()`
- **Assets affected**: `dist/pdf.js`, `dist/flipbook-viewer.js`, `includes/bws-pdf-viewer.js`,
  `includes/bws-pdf-viewer.css`; also passed to JS via `bwsPdfViewerData.pluginUrl`

---

## Entity Relationships

```
Admin Settings (1 per site)
    │ provides defaults to
    ▼
Shortcode Instance (0..n per page)
    │ produces
    ▼
JS Config Object (1 per instance)
    │ consumed by
    ▼
Viewer Instance (1 per container div)
    ├── viewMode='document' → nativepageviewer.js  (PDF.js canvas/text/annotation layers)
    │                       → singlepageviewer.js   (image fallback, P2, on init failure)
    └── viewMode='flipbook' → flipbookviewer.js     (canvas page-flip animation)
```

---

## Viewer Initialization State Machine

```
[Container .bws-pdf-viewer-container found]
    │
    ▼
[Parse data-config JSON]
    ├── parse error → showPdfError(container, message, config.pdf)
    │
    ▼
[Apply mode governance: check disabled_modes]
    │ (mode override applied silently if needed)
    │
    ▼
[Show loading indicator (.bws-pdf-viewer-loading)]
    │
    ▼
[loadPDF(config.pdf)]  ← URL already rewritten server-side
    ├── load error → showPdfError(container, message, config.pdf) [FR-014]
    │
    ▼
[Check numPages === 1 in flipbook mode → force layout='single']  [FR-002]
    │
    ▼
[Detect: container width, touch capability, reduced-motion]
    │
    ├── viewMode='flipbook' ──────────────────→ flipbookviewer.js
    │                                            (two-page if width>767px,
    │                                             single-page if ≤767px)
    │
    └── viewMode='document'
        ├── useNativeMode=true  → nativepageviewer.js (PDF.js layers, lazy scroll)
        └── useNativeMode=false → singlepageviewer.js (image mode, P2)
              ↑
              determined by: forceNative attr OR auto-detect (touch + width ≤767px)

    │ (on successful init)
    ▼
[Remove loading indicator]
[Add navigation controls (always)]
[Add fullscreen button (if showFullscreen && fullscreenEnabled)]
[Add print button (if showPrint)]
[Setup ResizeObserver, keyboard nav, focus detection]
[Announce initial page to screen reader]
```
