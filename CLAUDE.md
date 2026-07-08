# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BWS PDF Viewer is a WordPress plugin that embeds an animated flipbook PDF viewer using a tiny JavaScript library (18KB). The plugin transforms a standalone flipbook viewer library into a fully-featured WordPress integration with responsive layouts, accessibility features, and container-based responsiveness.

## Build Commands

```bash
# Production build (builds to /dist)
npm run start

# Development server with live reload
npm run test

# Clean dist directory
npm run clean
```

## Architecture

### Core Components

**JavaScript Library** (`src/`)
- `index.js` - Main entry point that exports `init()` function and routes to appropriate viewer
- `flipbookviewer.js` - Animated flipbook viewer with page-flip animation
- `singlepageviewer.js` - Image-based single-page viewer (mobile/fallback)
- `nativepageviewer.js` - Native PDF.js viewer with text/annotation layers (desktop)
- Uses `@tpp/htm-x` for DOM manipulation
- Builds to `dist/flipbook-viewer.js` as UMD module

**WordPress Integration** (`bws-pdf-viewer.php` and `includes/`)
- Main plugin file registers shortcode `[bws_pdf]` and handles WordPress hooks
- `includes/admin.php` - Settings page under Settings > BWS PDF Viewer
- `includes/bws-pdf-viewer.js` - WordPress-specific initialization layer that bridges shortcode to library; also hosts the shared navigation toolbar (`addNavigationControls`), used by both flipbook and native modes
- `includes/bws-pdf-viewer.css` - Styling for WordPress integration (incl. toolbar overlay + text/annotation layers)

**PDF.js Dependencies** (`dist/`)
- `pdf.js` - Main PDF.js library bundled from `pdfjs-dist/webpack.mjs`
- `pdf.worker.js` - PDF.js worker thread (automatically loaded as chunk)
- Both files bundled by webpack using zero-config approach

#### PDF.js Webpack Integration (Zero-Config)

The plugin uses the **zero-configuration webpack approach** recommended by PDF.js:

```javascript
// webpack.config.js
'pdf': {
  import: 'pdfjs-dist/webpack.mjs',  // Zero-config approach
  library: {
    name: 'pdfjsLib',
    type: 'umd',
    umdNamedDefine: true,
  },
}
```

**Key Points:**
- Use `pdfjs-dist/webpack.mjs` (NOT `pdfjs-dist/build/pdf.mjs`)
- Worker is automatically configured via `GlobalWorkerOptions.workerPort`
- Worker bundled as separate chunk (`pdf.worker.js`) via webpack's dynamic import
- No manual worker registration needed in WordPress
- Eliminates "Setting up fake worker" warnings

**Webpack Configuration:**
- Entry: `pdfjs-dist/webpack.mjs` handles worker setup automatically
- Chunk naming: Set `chunkFilename: 'pdf.worker.js'` for descriptive worker filename
- Module rules: Handle `.mjs` files with `type: 'javascript/auto'`

Reference: https://github.com/mozilla/pdf.js/blob/master/examples/webpack/

### Hybrid Viewer Architecture

The plugin supports three viewer modes:

1. **Flipbook Mode** (`view_mode="flipbook"`)
   - Animated page-flip effect
   - Uses `flipbookviewer.js`
   - Always uses image-based rendering

2. **Document Mode - Native** (Desktop, `view_mode="document"`)
   - Uses `nativepageviewer.js`
   - Direct PDF.js rendering with three layers:
     - **Canvas layer**: Visual rendering of PDF content
     - **Text layer**: Enables text selection and browser find (Ctrl+F); positioned over canvas
     - **Annotation layer**: Enables clickable links and form interactions
   - Lazy loading with IntersectionObserver (200px rootMargin buffer)
   - Memory management: Cleans up pages >5 away from current view
   - Auto-enabled on: desktop (screen ≥1024px OR !touch)

3. **Document Mode - Image** (Mobile, `view_mode="document"`)
   - Uses `singlepageviewer.js`
   - Converts PDF pages to images
   - Lightweight for mobile devices
   - Auto-enabled on: mobile (touch + small screen OR screen <1024px)

**Mode Selection:**
- Automatic: Hybrid detection based on touch capability + screen width
- Override: `force_native="true"` or `force_native="false"` shortcode attribute

Implementation: `initViewer()` in `includes/bws-pdf-viewer.js`.

#### Native Viewer Layer Architecture

Native document mode renders each page as three stacked layers — canvas (visual),
text (selection + browser find), annotation (links). Text and annotation layers are
built with the official PDF.js `TextLayerBuilder` and `AnnotationLayerBuilder` plus a
shared link service; internal links navigate, external links open in a new tab.

Structural details (element classes, positioning, cleanup thresholds) live in the
code and its CSS — read `nativepageviewer.js` and the layer styles in
`includes/bws-pdf-viewer.css`. Behavioral facts worth knowing up front:
- Lazy-loads pages via IntersectionObserver (~200px buffer).
- Keeps only ~5–7 pages in memory; distant pages are torn down.

### Data Flow

1. User adds shortcode: `[bws_pdf]https://example.com/doc.pdf[/bws_pdf]`
2. PHP shortcode handler (`BWS_PDF_Viewer::shortcode_handler`) outputs container div with `data-config` attribute
3. `includes/bws-pdf-viewer.js` reads config from `data-config`:
   - Detects device capabilities (touch, screen width)
   - Determines native vs image mode
   - Calls `loadPDF()`
4. PDF.js loads PDF document
5. `createBookWrapper()` creates book object with `numPages()` and `getPage()` interface
6. Book object passed to `flipbook.init()` from the core library
7. Router in `src/index.js` selects appropriate viewer:
   - If `opts.singlepage && opts.nativeMode` → `nativePageViewer()`
   - If `opts.singlepage` → `singlePageViewer()`
   - Otherwise → `flipbookViewer()`
8. Viewer renders to the container

### Traditional Book Layout

The plugin supports two book layouts controlled by `book_layout` parameter:
- **traditional** (default): Page 1 displayed alone as cover, then pages 2-3, 4-5, etc.
- **spread**: Start with pages 1-2, then 3-4, 5-6, etc.

Traditional layout is implemented via `createBookWrapper()` in `includes/bws-pdf-viewer.js`, which intercepts `getPage()` calls and returns `null` for display position 1 (right side of first spread).

### Container-Based Responsiveness

Unlike viewport-based responsive design, this plugin uses **ResizeObserver** to detect actual container width (not viewport width). This allows multiple flipbooks on the same page to each adapt to their specific container size.

Implementation: `setupResponsiveBehavior()` in `includes/bws-pdf-viewer.js`.

When `layout="auto"`:
- Container width >= `breakpoint` (default 768px) → double-page spread
- Container width < `breakpoint` → single page

### Accessibility

- **Reduced Motion**: Checks `prefers-reduced-motion` media query and sets `shouldAnimate: false`
- **Keyboard Navigation**: Arrow keys, Page Up/Down, Space for navigation (container must be focused)
- **Focus Management**: Containers made focusable with `tabindex="0"`

Implementation: `setupKeyboardNavigation()` in `includes/bws-pdf-viewer.js`.

## Important Notes

### Script Load Order

WordPress scripts are loaded in this order:
1. `bws-pdfjs-lib` (pdf.js - main library with automatic worker)
2. `bws-pdf-viewer-lib` (flipbook-viewer.js)
3. `bws-pdf-viewer-wp` (WordPress integration)

**Note:** The worker (`pdf.worker.js`) is automatically loaded by `pdf.js` via webpack's dynamic import. No separate script registration needed.

Defined in `BWS_PDF_Viewer::register_assets()`.

### @tpp/htm-x Import Usage

The `@tpp/htm-x` library provides two exports:

```javascript
import { h } from '@tpp/htm-x';        // Element creation function (USE THIS)
import { getH } from '@tpp/htm-x';    // DOM element lookup by ID (NOT for element creation)
```

**Correct Usage:**
- `h('div.classname')` - Creates DOM elements (used in all viewer files)
- `getH('element-id')` - Gets existing DOM element by ID (used ONLY in src/index.js)

**Common Mistake:**
```javascript
// WRONG - Don't do this
import { getH } from '@tpp/htm-x';
const h = getH();  // This will fail - getH is not a factory function

// CORRECT - Do this
import { h } from '@tpp/htm-x';
const div = h('div.classname');
```

### Multi-Domain WordPress

All asset URLs use `plugin_dir_url()` which dynamically generates URLs based on the current domain. No hardcoded domains.

### Configuration Precedence

1. Hardcoded defaults in `BWS_PDF_Viewer::$default_options`
2. Admin settings from `get_option('bws_pdf_viewer_options')`
3. Shortcode attributes override everything

Merged in `BWS_PDF_Viewer::shortcode_handler()`.

### HiDPI Support

Both the core library and WordPress integration detect `window.devicePixelRatio` and render canvas at higher resolution for Retina displays.

See `outputScale` in `src/flipbookviewer.js` and `includes/bws-pdf-viewer.js`.

## Development Workflow

1. Make changes to `src/` files
2. Run `npm run test` to start dev server at http://localhost:8080
3. Test using test HTML pages in `/test` directory
4. Build production with `npm run start`
5. Upload built files to WordPress plugin directory:
   - `dist/flipbook-viewer.js`
   - `dist/pdf.js`
   - `dist/pdf.worker.js` (if changed)
   - `includes/bws-pdf-viewer.js` (if changed)
   - `includes/bws-pdf-viewer.css` (if changed)
   - `bws-pdf-viewer.php` (if changed)
6. Clear browser cache or do hard refresh (Ctrl+F5)
7. Test WordPress integration

## Troubleshooting

### "Setting up fake worker" Warning

**Cause:** Not using the zero-config webpack approach for PDF.js

**Solution:** Ensure webpack config uses `pdfjs-dist/webpack.mjs`:
```javascript
'pdf': {
  import: 'pdfjs-dist/webpack.mjs',  // NOT 'pdfjs-dist/build/pdf.mjs'
  library: { name: 'pdfjsLib', type: 'umd', umdNamedDefine: true }
}
```

### "getH is not a function" Error

**Cause:** Incorrect import from `@tpp/htm-x`

**Solution:** Use `h` for element creation, `getH` only for DOM lookup:
```javascript
// WRONG
import { getH } from '@tpp/htm-x';
const h = getH();

// CORRECT
import { h } from '@tpp/htm-x';
const div = h('div.class');
```

### Browser Shows Old JavaScript After Upload

**Cause:** Browser or WordPress caching old script versions

**Solution:**
1. Hard refresh: Ctrl+F5 (Chrome/Firefox) or Cmd+Shift+R (Mac)
2. Clear browser cache completely
3. Open DevTools → Network tab → Check "Disable cache"
4. Verify WordPress version number updated in `bws-pdf-viewer.php` (cache busting)

## Extending the Plugin

### Shortcode Attributes

**Basic Attributes:**
- `view_mode` - "document" (default) or "flipbook"; "singlepage" is a legacy alias for "document"
- `width` - Container width (default: "100%")
- `height` - Container height (default: "auto")
- `layout` - "auto", "single", or "double"
- `book_layout` - "traditional" or "spread"

**Hybrid Viewer Attributes:**
- `force_native` - "true", "false", or null (auto-detect)
  - Forces native or image mode regardless of device
- `show_controls` - true/false (default: true)
  - Display the navigation toolbar (prev/next, page-jump field, page counter)
- `show_fullscreen` - true/false (default: true)
  - Show the fullscreen button in the toolbar
- `show_print` - true/false (default: true)
  - Show the print button in the toolbar

Note: in-viewer search (`enable_search`) is not implemented and is not a recognized
shortcode attribute. Portal integration is an admin setting, not a shortcode attribute.

**Example:**
```
[bws_pdf view_mode="document" force_native="true" show_controls="true"]
https://example.com/document.pdf
[/bws_pdf]
```

### Adding New Shortcode Parameters

1. Add to `$default_options` in `BWS_PDF_Viewer`
2. Add to `shortcode_atts()` in `BWS_PDF_Viewer::shortcode_handler()`
3. Add to `$config` array in shortcode handler
4. Handle in `initViewer()` in `includes/bws-pdf-viewer.js`
5. Add admin setting field in `includes/admin.php`

### Supporting Non-PDF Sources

The core library supports any book source via the book interface:
```javascript
{
  numPages: () => number,
  getPage: (num, cb) => CanvasImageSource
}
```

See `test/book-imgs.js` for an image-based book example.

## Agent skills

### Issue tracker

GitHub Issues in `davidofchatham/bws-pdf-viewer` (fork; `gh` default pinned to origin) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five-role vocabulary (`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
