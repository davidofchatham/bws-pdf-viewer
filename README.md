# BWS PDF Viewer

Amazing flip book component with animated pages - now available as a WordPress plugin!

![demo](./test/demo.gif)

This is a tiny library that can show flip books from any source (including PDF's, images, etc).

## 🎉 WordPress Plugin

This library is now available as a full-featured WordPress plugin! Simply use the shortcode to embed beautiful, accessible PDF flipbooks in your posts and pages.

**Quick Start:**
```
[bws_pdf]https://example.com/document.pdf[/bws_pdf]
```

See [WordPress Plugin Usage](#wordpress-plugin) below for full documentation.

## Advantages

1. Tiny (18 ***Kb***). For comparison, the amazing [page-flip](./https://www.npmjs.com/package/page-flip) is 10 **Mb** (x1000 times bigger!).
2. Can use any input as a book simply by plugging in a “book provider”. An example PDF book using the amazing [pdfjs](./https://www.npmjs.com/package/pdfjs-dist) from Mozilla can be found in the test folder—[book-pdf.js](./test/book-pdf.js) (referenced usage: [test-pdf.js](./test/test-pdf.js))
3. Supports **Panning**, **Zooming**, **Liking**, **Sharing**, along with page turning effects.
4. Raises events to track which pages are being viewed by user.

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

This will generate a series of canvases with `class="flipbook__page"` and `id="flipbook__pgnum_<n>"` that you can style using CSS. The single page view will raise the same `seen` event that the flipbook viewer does for tracking which pages the user actually flips through.

The single page viewer is currently experimental and very simple. It should work for many PDF's but is not optimized for handling PDF's with a large number of pages.


Enjoy!

---

## WordPress Plugin

### Overview

The Flipbook Viewer WordPress plugin transforms this library into a powerful, accessible PDF viewer for WordPress sites with the following features:

- 🔄 **Hybrid Rendering** - Intelligent switching between native PDF.js (desktop) and image-based (mobile) rendering
- 🔗 **Interactive PDFs** - Text selection, clickable links, and search support in native mode
- 📱 **Container-Based Responsive Design** - Adapts to actual container width (not just viewport), perfect for sidebars and narrow columns
- ♿ **Accessibility First** - Respects `prefers-reduced-motion`, full keyboard navigation, WCAG 2.1 AA compliant
- 🎨 **Highly Customizable** - Admin panel for defaults, per-instance shortcode overrides
- 📖 **Traditional Book Layout** - Page 1 as cover, then two-page spreads (2-3, 4-5, etc.)
- 👀 **Multiple View Modes** - Animated flipbook or scrollable single-page with navigation controls
- 🔄 **Multi-Instance Support** - Multiple flipbooks per page
- 🌐 **Cross-Domain Compatible** - Works with multi-domain WordPress setups

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

The PDF URL is placed between the shortcode tags. All parameters are optional and can be set as attributes in the opening tag. You can set defaults in the admin panel.

| Parameter | Description | Default | Options |
|-----------|-------------|---------|---------|
| `width` | Viewer width | `100%` | Any CSS value (100%, 800px, etc.) |
| `height` | Viewer height | `auto` | Any CSS value or `auto` |
| `background_color` | Background color | `#353535` | Hex color code |
| `box_color` | Box color | `#353535` | Hex color code |
| `box_border` | Border width | `0` | Number (pixels) |
| `margin` | Margin percentage | `1` | Number |
| `margin_top` | Top margin | `null` | Number or leave empty |
| `margin_left` | Left margin | `null` | Number or leave empty |
| `layout` | Page layout | `auto` | `auto`, `single`, `double` |
| `book_layout` | Book layout style | `traditional` | `traditional`, `spread` |
| `view_mode` | Viewer mode | `singlepage` | `flipbook`, `singlepage` |
| `breakpoint` | Container breakpoint | `768` | Number (pixels) |
| `enable_animations` | Enable animations | `true` | `true`, `false` |
| `force_native` | Force native/image mode | auto-detect | `true`, `false`, or leave empty |
| `show_controls` | Show navigation controls | `true` | `true`, `false` |
| `enable_search` | Enable search UI | `false` | `true`, `false` (future feature) |

### Layout Options Explained

**`layout`** - How pages are displayed:
- `auto` - Automatically switches between single/double based on container width
- `single` - Always show one page at a time
- `double` - Always show two-page spread

**`book_layout`** - How pages are arranged:
- `traditional` - Page 1 alone (cover), then 2-3, 4-5, etc.
- `spread` - Start with pages 1-2, then 3-4, 5-6, etc.

**`view_mode`** - Display style:
- `flipbook` - Animated page turning with 3D flip effect
- `singlepage` - Simple scrollable pages with hybrid rendering (default):
  - **Desktop/Wide Screens**: Native PDF.js rendering with text selection, clickable links, and search support
  - **Mobile/Touch Devices**: Lightweight image-based rendering for better performance
  - Automatically switches based on device capabilities

**`force_native`** - Override automatic hybrid detection:
- `true` - Force native PDF.js rendering (text selection, links) regardless of device
- `false` - Force image-based rendering regardless of device
- Leave empty or omit - Automatic detection (recommended)

**`show_controls`** - Show navigation controls:
- `true` - Display previous/next buttons and page counter (default)
- `false` - Hide navigation controls

**`breakpoint`** - Container width (in pixels) below which `auto` layout switches to single page. Only used when `layout="auto"`.

### Advanced Examples

#### Narrow Column with Single Page View
```
[bws_pdf width="400px" layout="single"]https://example.com/doc.pdf[/bws_pdf]
```

#### Custom Styled Flipbook
```
[bws_pdf width="900px" height="700px" background_color="#f5f5f5" box_color="#ffffff" box_border="1"]https://example.com/doc.pdf[/bws_pdf]
```

#### Traditional Book Starting with Cover
```
[bws_pdf book_layout="traditional" layout="double"]https://example.com/book.pdf[/bws_pdf]
```

#### Accessible Flipbook (No Animations)
```
[bws_pdf enable_animations="false" view_mode="singlepage"]https://example.com/doc.pdf[/bws_pdf]
```

#### Responsive with Custom Breakpoint
```
[bws_pdf layout="auto" breakpoint="1024"]https://example.com/doc.pdf[/bws_pdf]
```

#### Native Mode with Text Selection and Links (Desktop Experience)
```
[bws_pdf view_mode="singlepage" force_native="true"]https://example.com/doc.pdf[/bws_pdf]
```

#### Lightweight Mobile-Optimized View
```
[bws_pdf view_mode="singlepage" force_native="false"]https://example.com/doc.pdf[/bws_pdf]
```

#### Simple Viewer Without Controls
```
[bws_pdf show_controls="false"]https://example.com/doc.pdf[/bws_pdf]
```

### Keyboard Navigation

When a flipbook is focused (click on it or tab to it):

- **Arrow Right / Page Down / Space** - Next page(s)
- **Arrow Left / Page Up** - Previous page(s)
- **Home** - First page (planned)
- **End** - Last page (planned)

Navigation respects the current layout - if viewing a two-page spread, arrow keys advance by two pages.

### Accessibility Features

1. **Reduced Motion Support** - Automatically detects `prefers-reduced-motion` system setting and disables animations
2. **Keyboard Navigation** - Full keyboard support for all interactions
3. **Focus Indicators** - Clear focus outlines for keyboard users
4. **Semantic HTML** - Proper structure for screen readers

### Container-Based Responsiveness

Unlike typical responsive designs that only check viewport width, this plugin uses **ResizeObserver** to detect the actual container width. This means:

- ✅ Flipbook in a 300px sidebar will show single pages
- ✅ Flipbook in a 1000px main content area will show double pages
- ✅ Both can be on the same page, each with appropriate layout
- ✅ Works with any WordPress theme or page builder

### Admin Settings

Configure default values in **Settings > Flipbook Viewer**:

1. **Display Settings** - Colors, dimensions, borders
2. **Layout Settings** - Default layout modes, breakpoints, animations

All settings can be overridden per-instance via shortcode parameters.

### Multi-Domain Support

The plugin is fully compatible with WordPress sites accessible via multiple domains. All asset URLs are dynamically generated based on the current domain being accessed.

### Browser Support

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ⚠️ Requires JavaScript enabled
- ⚠️ ResizeObserver for container queries (graceful degradation)

### Performance

- **Hybrid Rendering** - Automatic switching between native and image modes based on device
  - **Desktop**: Native PDF.js with lazy loading (IntersectionObserver)
  - **Mobile**: Lightweight image-based rendering
  - **Memory Management**: Automatically cleans up off-screen pages (keeps only 5-7 pages in memory)
- **Lazy Loading** - PDF pages are rendered on-demand with 200px buffer
- **Caching** - Rendered pages are cached for smooth navigation
- **HiDPI Optimized** - Looks sharp on Retina displays (devicePixelRatio support)
- **Zero-Config PDF.js** - Uses webpack.mjs for automatic worker setup (no "fake worker" warnings)
- **No External Dependencies** - All assets bundled (no CDN)

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

## Accessibility Compliance

### WCAG 2.1 AA Compliance

BWS PDF Viewer is designed to meet WCAG 2.1 Level AA accessibility standards:

- **Keyboard Navigation**: Full keyboard support without requiring a mouse
- **Screen Reader Support**: Compatible with NVDA, JAWS, and VoiceOver
- **ARIA Labels**: Proper semantic HTML and ARIA attributes for assistive technologies
- **Reduced Motion**: Respects `prefers-reduced-motion` system setting
- **High Contrast**: Supports high contrast mode for better visibility
- **Focus Indicators**: Clear, visible focus indicators for keyboard navigation

### Keyboard Navigation

When a PDF viewer is focused (click on it or tab to it):

- **Arrow Right / Page Down / Space** - Next page(s)
- **Arrow Left / Page Up** - Previous page(s)
- **Home** - First page
- **End** - Last page

Navigation respects the current layout - in two-page spread mode, arrow keys advance by two pages.

### View Modes for Accessibility

**Single Page Mode (Default):**
- Most accessible option
- Better screen reader support
- Simpler navigation
- Recommended for users with assistive technologies

**Flipbook Mode:**
- Animated page flip effects
- Automatically disabled when user has `prefers-reduced-motion` enabled
- Best for visual presentations

### Screen Reader Compatibility

The plugin announces page changes to screen readers, providing context about:
- Current page number
- Total number of pages
- Navigation state

Tested with:
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (Mac/iOS)

---

## Portal System Integration

### Overview

BWS PDF Viewer integrates seamlessly with [BWS Portal System](https://github.com/davidofchatham/bws-portal-system) for multi-domain WordPress setups. When enabled, PDF URLs are automatically rewritten to match the current portal domain.

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

### Per-Instance Override

You can disable portal integration for specific instances:

```
[bws_pdf enable_portal_integration="false"]https://example.com/document.pdf[/bws_pdf]
```

### Troubleshooting

**PDF not loading on portal domain:**
1. Verify Cloudflare CORS headers are configured
2. Check browser console for CORS errors
3. Ensure PDF URL is internal (same WordPress installation)
4. Verify portal integration is enabled in settings

**External PDFs:**
External PDF URLs (from different domains) are not rewritten. Only internal PDFs (from wp-content/uploads) are modified.

---

## Migration from 2.x to 3.0

### Breaking Changes

**Default View Mode Changed:**
- **Before (2.x)**: Default was `flipbook`
- **After (3.0)**: Default is `singlepage`

**Impact**: New shortcodes without `view_mode` attribute will use single-page view.

**Migration**: Your existing settings are automatically preserved during upgrade.

### New Features in 3.0

1. **Accessibility First**: WCAG 2.1 AA compliance with enhanced screen reader support
2. **Portal Integration**: Automatic PDF URL rewriting for multi-domain sites
3. **Better Keyboard Nav**: Home/End keys for first/last page navigation
4. **Screen Reader Announcements**: Page change announcements for assistive technologies
5. **Enhanced Focus Indicators**: Better visibility for keyboard users
6. **High Contrast Support**: Improved appearance in high contrast mode

### New Features in 3.1 (Hybrid Viewer)

1. **Hybrid Rendering**: Intelligent switching between native PDF.js and image-based rendering
2. **Interactive PDFs**: Text selection, clickable links, and search support in native mode
3. **Navigation Controls**: Previous/next buttons and page counter for single-page mode
4. **Device Detection**: Automatic mode selection based on touch capability and screen size
5. **Manual Override**: `force_native` attribute to override automatic detection
6. **Memory Management**: Lazy loading with automatic cleanup of off-screen pages
7. **Zero-Config PDF.js**: Webpack.mjs integration eliminates worker setup warnings

### Upgrade Process

**Automatic Upgrade:**
1. Backup your site (recommended)
2. Update plugin via WordPress admin
3. Existing settings are automatically preserved
4. No action needed - everything continues working

**Keep Flipbook as Default:**
If you want to keep flipbook as the default for new shortcodes:
1. Go to **Settings > BWS PDF Viewer**
2. Under **Layout Settings**, set **View Mode** to "Flipbook"
3. Save settings

### Compatibility

- **WordPress**: 6.0 or higher
- **PHP**: 7.4 or higher
- **Browsers**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Backward Compatible**: All 2.x shortcodes continue working without changes

---

