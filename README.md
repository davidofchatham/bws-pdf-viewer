# BWS PDF Viewer

> ## ⚠️ PRE-RELEASE — NOT SAFE TO USE
>
> **This plugin is pre-1.0 and has never shipped a publicly usable release.**
> It is under active development, may break without notice, and is **not
> intended for production sites**. No support, no stability guarantee, no
> backward-compatibility promise between versions. Use at your own risk.

A WordPress plugin that embeds PDFs as an animated flipbook or a scrollable vertical-flow viewer. Built on [flipbook-viewer](https://github.com/theproductiveprogrammer/flipbook-viewer) and [PDF.js](https://github.com/mozilla/pdf.js).

## Overview

Features:

- **Hybrid rendering** - Switches between native PDF.js (desktop) and image-based (mobile) rendering
- **Interactive PDFs** - Text selection and clickable links in native mode
- **Container-based responsive design** - Adapts to container width, not just viewport
- **Accessibility** - Respects `prefers-reduced-motion`, keyboard navigation, targets WCAG 2.1 AA
- **Customizable** - Admin panel defaults, per-instance shortcode overrides
- **Traditional book layout** - Page 1 as cover, then two-page spreads (2-3, 4-5, etc.)
- **View modes** - Animated flipbook or scrollable single-page with navigation controls
- **Multi-instance** - Multiple viewers per page
- **Multi-domain** - Works with multi-domain WordPress setups

## Installation

1. Install the plugin:
   - Upload to `/wp-content/plugins/flipbook-viewer`
   - Or install via WordPress plugin directory
2. Activate through WordPress admin
3. Configure defaults in Settings > BWS PDF Viewer (optional)
4. Use shortcode in any post or page

## Basic Usage

Embed a PDF with default settings:
```
[bws_pdf]https://example.com/document.pdf[/bws_pdf]
```

## Shortcode Parameters

The PDF URL goes between the tags; all attributes are optional and can be defaulted
in the admin panel. **The authoritative attribute list — names, defaults, and their
sanitizers — is `$default_options` / `shortcode_atts()` in `bws-pdf-viewer.php`**, with
a user-facing summary in `readme.txt`. This section only covers the behavior an
attribute name alone won't tell you:

- **`view_mode`** — `document` (default) or `flipbook`. `document` renders scrollable
  pages and picks native PDF.js (desktop: text selection + links) vs image rendering
  (mobile) automatically. `singlepage` is a legacy alias for `document`.
- **`force_native`** — overrides that automatic pick: `true` forces native, `false`
  forces image, empty = auto (recommended).
- **`layout`** — `auto` switches single/double by container width; `single`/`double`
  pin it. `breakpoint` (px) is the `auto` switch point and is ignored otherwise.
- **`book_layout`** — `traditional` shows page 1 alone as a cover (then 2-3, 4-5, …);
  `spread` starts at 1-2.
- **`show_controls`** gates the whole toolbar; **`show_fullscreen`** / **`show_print`**
  gate individual buttons and are ignored when `show_controls="false"`.

## Examples

```
# Narrow column, always single page
[bws_pdf width="400px" layout="single"]https://example.com/doc.pdf[/bws_pdf]

# Animated flipbook, custom styling
[bws_pdf view_mode="flipbook" width="900px" height="700px" box_color="#ffffff" box_border="1"]https://example.com/doc.pdf[/bws_pdf]

# Traditional book starting with a cover
[bws_pdf book_layout="traditional" layout="double"]https://example.com/book.pdf[/bws_pdf]

# Force native desktop rendering (text selection + links)
[bws_pdf force_native="true"]https://example.com/doc.pdf[/bws_pdf]

# No toolbar
[bws_pdf show_controls="false"]https://example.com/doc.pdf[/bws_pdf]
```

## Keyboard Navigation

When the viewer is focused (click on it or tab to it):

- **Arrow Right / Page Down / Space** - Next page(s)
- **Arrow Left / Page Up** - Previous page(s)
- **Home** - First page
- **End** - Last page

Navigation respects the current layout - in a two-page spread, arrow keys advance by two pages.

Within the toolbar, arrow keys move focus between buttons (roving tabindex), and Home/End jump to the first/last button.

The viewer also respects `prefers-reduced-motion` (disables animations), uses the
WAI-ARIA toolbar pattern with a single Tab stop, and announces "Page N of M" to
screen readers on navigation.

## Container-Based Responsiveness

This plugin uses **ResizeObserver** to detect actual container width, not viewport width:

- Flipbook in a 300px sidebar shows single pages
- Flipbook in a 1000px main content area shows double pages
- Both can be on the same page, each with its own layout
- Works with any WordPress theme or page builder

## Admin Settings

Set default values in **Settings > BWS PDF Viewer**; shortcode attributes override
them per instance. Asset URLs are generated per current domain (multi-domain safe).

## Performance Notes

- Document mode lazy-loads pages (IntersectionObserver) and keeps only a small window
  of pages in memory, tearing down distant ones.
- All assets are bundled — no CDN. PDF.js uses the zero-config `webpack.mjs` worker
  setup (no "fake worker" warnings).
- Canvas renders at `devicePixelRatio` for HiDPI/Retina.

## Troubleshooting

**PDF not loading:**
- Verify PDF URL is accessible
- Check browser console for errors
- Ensure PDF is not blocked by CORS (must be same-origin or allow cross-origin)

**Layout not responsive:**
- Verify container has explicit width
- Check if ResizeObserver is supported in browser
- Try setting explicit `layout` parameter instead of `auto`

**Animations not working:**
- Check if `enable_animations="true"`
- Verify user hasn't enabled `prefers-reduced-motion`
- Try `view_mode="flipbook"` (not `singlepage`)

## Filter Hooks

The viewer exposes two WordPress filter hooks for rewriting URLs at runtime. They exist for multi-domain setups (one WordPress install serving several domains), CDNs, or any case where the assets and PDF must resolve to a different origin than `plugin_dir_url()` returns. Both are no-ops unless something registers them, so single-domain installs are unaffected.

- **`bws_pdf_viewer_plugin_url`** — the asset base URL (`plugin_dir_url()`), used for `pdf.js`, `bws-viewer-engines.js`, `bws-pdf-viewer.js`, the CSS, **and `pdf.worker.js`**. The returned value must end with a trailing slash; it also feeds the `bwsPdfViewerData.pluginUrl` value passed to JS.
- **`bws_pdf_viewer_pdf_url`** — the PDF source URL from the shortcode content, filtered before sanitisation.

### Example: serve assets from the current host

The assets **must** be same-origin with the page: a `new Worker()` script (used for `pdf.worker.js`) cannot be loaded cross-origin — the browser throws a `SecurityError`. (Plain `<script src>` tags tolerate cross-origin; the Worker does not.) If your install is reachable under more than one hostname, rewrite the asset base URL to whichever host the visitor is on:

```php
add_filter('bws_pdf_viewer_plugin_url', function ($url) {
    if (empty($_SERVER['HTTP_HOST'])) return $url;
    $parts = wp_parse_url($url);
    if (empty($parts['host'])) return $url;
    $host = strtolower($_SERVER['HTTP_HOST']);
    if (strtolower($parts['host']) === $host) return $url; // already same-origin
    $scheme = is_ssl() ? 'https' : ($parts['scheme'] ?? 'https');
    return $scheme . '://' . $host . ($parts['path'] ?? '') .
        (isset($parts['query']) ? '?' . $parts['query'] : '');
});
```

### PDF fetch and CORS

The PDF is a separate concern from the assets. If the page references a PDF on a **different origin** than the page itself, PDF.js's fetch is subject to CORS on the PDF host. Rewrite the source to a same-origin URL with `bws_pdf_viewer_pdf_url` where the file is reachable there; genuinely cross-origin PDFs need an `Access-Control-Allow-Origin` header on the PDF host or a same-origin proxy.

---

## Requirements

- **WordPress**: 6.0 or higher
- **PHP**: 7.4 or higher
- **Browsers**: Chrome 125+, Safari 18+ / iOS 18+, current Firefox (floor set by bundled PDF.js 6)

> Pre-1.0: shortcode attributes and defaults may change between versions without a
> migration path. Pin a version and re-test before updating.

---

## Underlying Library

The plugin wraps a small `flipbook-viewer` JavaScript library (the original
engine `src/` builds on). Its raw JS API — the `numPages`/`getPage` book
contract, `opts`, the `seen` event, and the `singlepage` path — is documented
separately and is **not** needed to use the WordPress plugin:

See [docs/reference/flipbook-viewer-library.md](docs/reference/flipbook-viewer-library.md).

## Development

To build from source:

```bash
npm install
npm run start  # Production build
npm run test   # Development server
```

Files are built to `/dist` directory.

## Acknowledgements

This project is a fork of [flipbook-viewer](https://github.com/theproductiveprogrammer/flipbook-viewer) by [Charles Lobo / The Productive Programmer](https://github.com/theproductiveprogrammer) (MIT-licensed). The animated page-flip engine and the "book provider" interface originate there; this plugin wraps it in a WordPress integration and adds the native PDF.js and image document viewers.

### Libraries

- PDF rendering is powered by [PDF.js](https://github.com/mozilla/pdf.js) by [Mozilla](https://mozilla.github.io/pdf.js/) (Apache-2.0), bundled at [`dist/pdf.js`](dist/pdf.js).
- DOM helpers are provided by [@tpp/htm-x](https://github.com/theproductiveprogrammer/htm-x) by [The Productive Programmer](https://github.com/theproductiveprogrammer) (MIT-licensed).
- In-WordPress update notices and one-click updates are powered by [Plugin Update Checker](https://github.com/YahnisElsts/plugin-update-checker) by [Yahnis Elsts](https://github.com/YahnisElsts) (MIT-licensed), bundled at [`libs/plugin-update-checker/`](libs/plugin-update-checker/).
