# Contract: WordPress Filter Hooks

**Version**: 1.0.0
**Defined in**: `bws-pdf-viewer.php`
**Purpose**: Allow external plugins (e.g. BWS Portal System) to rewrite URLs without
modifying this plugin's source code.

---

## `bws_pdf_viewer_pdf_url`

Filters the PDF source URL before it is sanitised and passed to the viewer.

### Signature

```php
apply_filters( 'bws_pdf_viewer_pdf_url', string $url ): string
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `$url` | string | The raw PDF URL from shortcode content, after basic `trim()` |

### Returns

`string` — The (optionally rewritten) PDF URL. MUST remain a valid URL.

### Called from

`BWS_PDF_Viewer::shortcode_handler()`, after empty-check and before `esc_url()` sanitisation
and JSON encoding into the page's `data-config` attribute.

### Usage

```php
// BWS Portal System registers:
add_filter( 'bws_pdf_viewer_pdf_url', 'bws_portal_modify_url' );

// Custom rewriter (example):
add_filter( 'bws_pdf_viewer_pdf_url', function( string $url ): string {
    return str_replace( 'https://cdn.example.com/', 'https://portal.example.com/', $url );
} );
```

---

## `bws_pdf_viewer_plugin_url`

Filters the plugin base URL used when registering all plugin scripts and stylesheets.

### Signature

```php
apply_filters( 'bws_pdf_viewer_plugin_url', string $url ): string
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `$url` | string | `plugin_dir_url( __FILE__ )` — trailing slash included |

### Returns

`string` — The (optionally rewritten) base URL. MUST end with a trailing slash.

### Called from

`BWS_PDF_Viewer::register_assets()`, applied once per page request before any
`wp_register_script()` / `wp_register_style()` calls.

### Assets using this URL

| Handle | Path appended |
|--------|---------------|
| `bws-pdfjs-lib` | `dist/pdf.js` |
| `bws-pdf-viewer-lib` | `dist/flipbook-viewer.js` |
| `bws-pdf-viewer-wp` | `includes/bws-pdf-viewer.js` |
| `bws-pdf-viewer` (style) | `includes/bws-pdf-viewer.css` |

The rewritten URL is also passed to JavaScript via `bwsPdfViewerData.pluginUrl`, where it
is available as a fallback for worker URL resolution.

### Usage

```php
// BWS Portal System registers:
add_filter( 'bws_pdf_viewer_plugin_url', 'bws_portal_modify_url' );

// Custom base URL (example):
add_filter( 'bws_pdf_viewer_plugin_url', function( string $url ): string {
    return 'https://cdn.example.com/wp-content/plugins/bws-pdf-viewer/';
} );
```

---

## Integration Notes

- Both filters are registered on the `wp_enqueue_scripts` action (`register_assets`) and
  within `shortcode_handler()`. They fire on every page that contains a `[bws_pdf]` shortcode.
- If no filter is registered, the original values are returned unchanged — behaviour is
  identical to v3.0.0 with `enable_portal_integration="false"`.
- Filters MUST be idempotent and MUST NOT throw exceptions. A malformed return value (empty
  string, non-URL) will result in a broken asset or PDF load failure.
