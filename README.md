# BWS PDF Viewer

> ## ⚠️ PRE-RELEASE — NOT SAFE TO USE
>
> **This plugin is pre-1.0 and has never shipped a publicly usable release.**
> It is under active development, may break without notice, and is **not
> intended for production sites**. No support, no stability guarantee, no
> backward-compatibility promise between versions. Use at your own risk.

A WordPress plugin that embeds PDFs as an animated flipbook or a scrollable
single-page viewer. Built on a small flipbook library plus Mozilla PDF.js.

![demo](./test/demo.gif)

## WordPress Plugin

Embed a PDF with the `[bws_pdf]` shortcode:

```
[bws_pdf]https://example.com/document.pdf[/bws_pdf]
```

See [WordPress Plugin Usage](#wordpress-plugin) below for full documentation.

## Advantages

1. Small (18 KB core library vs ~10 MB for [page-flip](https://www.npmjs.com/package/page-flip)).
2. Any input works as a book via a "book provider". Example PDF book using [pdfjs](https://www.npmjs.com/package/pdfjs-dist) from Mozilla is in the test folder—[book-pdf.js](./test/book-pdf.js) (usage: [test-pdf.js](./test/test-pdf.js)).
3. Supports panning, zooming, liking, sharing, and page-turn effects.
4. Raises events to track which pages the user views.

## Usage

Below shows the flip `book` on the given `div` with the id `div-id`:

```js
'use strict'

import { init as flipbook } from 'flipbook-viewer';

...

flipbook(book, 'div-id', (err, viewer) => {
  if(err) console.error(err);

  console.log('Number of pages: ' + viewer.page_count);
  viewer.on('seen', n => console.log('page number: ' + n));

  next.onclick = () => viewer.flip_forward();
  prev.onclick = () => viewer.flip_back();
  zoom.onclick = () => viewer.zoom();

});
```

The viewer can show *any* flip book. All you need to do is provide a book interface:

```js
{
  numPages: () => {
    /* return number of pages */
  },
  getPage: (num, cb) => {
    /* return page number 'num'
     * in the callback 'cb'
     * as any CanvasImageSource:
     * (CSSImageValue, HTMLImageElement, 
     *  SVGImageElement, HTMLVideoElement,
     *  HTMLCanvasElement, ImageBitmap,
     *  OffscreenCanvas)
     */
  }
}
```

## Options

An optional `opts` parameter can be passed in to change the UI:

```js
const opts = {
  backgroundColor: "#353535",
  boxColor: "#353535",
  width: 800,
  height: 600,
}

flipbook(book, 'div-id', opts, (err, viewer) => ...
```

## Events

You can listen on the `viewer` for which pages were seen:

```js
viewer.on('seen', n => ...)
```

## Programmatic API

The returned viewer can be used to programmatically control the viewer:

```js
viewer.flip_forward()
viewer.flip_back()
viewer.zoom()
```

## Single Page View

Finally, sometimes it makes sense to just show the book as a simple, scrollable view. To pass in only a `singlepage:true` option:

```js
flipbook(book, 'div-id', {singlepage:true}, (err, viewer) => ...
```

This generates canvases with `class="flipbook__page"` and `id="flipbook__pgnum_<n>"`
for CSS styling, and raises the same `seen` event as the flipbook viewer.

> This library-level single-page path is the simple, image-based viewer. The
> WordPress plugin's `document` mode adds the native PDF.js path (text/links,
> lazy loading, memory management) on top — see below.

---

## WordPress Plugin

### Overview

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

### Installation

1. Install the plugin:
   - Upload to `/wp-content/plugins/flipbook-viewer`
   - Or install via WordPress plugin directory
2. Activate through WordPress admin
3. Configure defaults in Settings > BWS PDF Viewer (optional)
4. Use shortcode in any post or page

### Basic Usage

Embed a PDF with default settings:
```
[bws_pdf]https://example.com/document.pdf[/bws_pdf]
```

### Shortcode Parameters

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

### Examples

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

### Keyboard Navigation

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

### Container-Based Responsiveness

This plugin uses **ResizeObserver** to detect actual container width, not viewport width:

- Flipbook in a 300px sidebar shows single pages
- Flipbook in a 1000px main content area shows double pages
- Both can be on the same page, each with its own layout
- Works with any WordPress theme or page builder

### Admin Settings

Set default values in **Settings > BWS PDF Viewer**; shortcode attributes override
them per instance. Asset URLs are generated per current domain (multi-domain safe).

### Performance Notes

- Document mode lazy-loads pages (IntersectionObserver) and keeps only a small window
  of pages in memory, tearing down distant ones.
- All assets are bundled — no CDN. PDF.js uses the zero-config `webpack.mjs` worker
  setup (no "fake worker" warnings).
- Canvas renders at `devicePixelRatio` for HiDPI/Retina.

### Troubleshooting

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

### Development

To build from source:

```bash
npm install
npm run start  # Production build
npm run test   # Development server
```

Files are built to `/dist` directory.

---

## Portal System Integration

### Overview

BWS PDF Viewer integrates with [BWS Portal System](https://github.com/davidofchatham/bws-portal-system) for multi-domain WordPress setups. When enabled, PDF URLs are automatically rewritten to match the current portal domain.

### Requirements

- BWS Portal System plugin active
- Cloudflare with CORS Transform Rules configured (for cross-domain asset loading)
- See Portal System documentation: `cors/LITESPEED-CLOUDFLARE-SOLUTION.md`

### How It Works

1. **Plugin Assets**: Served from main domain with Cloudflare CORS headers
2. **PDF Documents**: URLs automatically rewritten to match current portal domain
3. **Detection**: Automatic - no configuration needed when portal system is active
4. **Performance**: No overhead when portal system is not active

### Configuration

Navigate to **Settings > BWS PDF Viewer > Portal System Integration**:

- **Enable Portal Integration**: Automatically rewrite PDF URLs for portal domains (default: enabled)
- **Status**: Shows whether BWS Portal System is detected

### Example

**Main Domain Setup:**
```
Main site: https://main-site.com
Portal 1: https://client1-portal.com
Portal 2: https://client2-portal.com
```

**PDF URL Rewriting:**
- On main-site.com: `https://main-site.com/wp-content/uploads/file.pdf`
- On client1-portal.com: `https://client1-portal.com/wp-content/uploads/file.pdf`
- On client2-portal.com: `https://client2-portal.com/wp-content/uploads/file.pdf`

### Enabling / Disabling

Portal integration is a site-wide admin setting (**Settings > BWS PDF Viewer > Portal System Integration**), not a shortcode attribute. It applies to all instances when the BWS Portal System plugin is active.

### Troubleshooting

**PDF not loading on portal domain:**
1. Verify Cloudflare CORS headers are configured
2. Check browser console for CORS errors
3. Ensure PDF URL is internal (same WordPress installation)
4. Verify portal integration is enabled in settings

**External PDFs:**
External PDF URLs (from different domains) are not rewritten. Only internal PDFs (from wp-content/uploads) are modified.

---

## Requirements

- **WordPress**: 6.0 or higher
- **PHP**: 7.4 or higher
- **Browsers**: Chrome 125+, Safari 18+ / iOS 18+, current Firefox (floor set by bundled PDF.js 6)

> Pre-1.0: shortcode attributes and defaults may change between versions without a
> migration path. Pin a version and re-test before updating.
