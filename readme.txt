=== Flipbook Viewer ===
Contributors: charles.lobo@gmail.com
Tags: pdf, flipbook, page-flip, pdf-viewer, animation, accessibility
Requires at least: 6.0
Tested up to: 6.4
Stable tag: 2.0.0
Requires PHP: 7.4
License: MIT
License URI: https://opensource.org/licenses/MIT

Amazing flip book component with animated pages. Embed PDFs using shortcode with support for responsive layouts and accessibility features.

== Description ==

Flipbook Viewer is a powerful yet lightweight WordPress plugin that allows you to embed PDFs as beautiful, animated flipbooks directly into your posts and pages.

**Key Features:**

* 📱 **Truly Responsive** - Adapts to container width, not just device size. Perfect for narrow columns and sidebars.
* ♿ **Accessibility First** - Respects user's `prefers-reduced-motion` setting, full keyboard navigation support.
* 🎨 **Highly Customizable** - Control colors, dimensions, layout modes, and more via shortcode parameters.
* ⚡ **Lightweight** - Only 18 KB core library (vs 10 MB for similar solutions).
* 📖 **Traditional Book Layout** - Page 1 as cover, then two-page spreads (2-3, 4-5, etc.).
* 👀 **Multiple View Modes** - Choose between animated flipbook or simple scrollable single-page view.
* 🔄 **Multiple Instances** - Embed multiple flipbooks on the same page.
* ⌨️ **Keyboard Navigation** - Arrow keys, Page Up/Down, Home/End all work.
* 🎯 **Container Queries** - Layout switches based on actual container width, not viewport.

**Usage:**

Simply use the shortcode with your PDF URL:

`[flipbook pdf="https://example.com/document.pdf"]`

**With Custom Parameters:**

`[flipbook pdf="https://example.com/document.pdf" width="800px" height="600px" layout="double" view_mode="flipbook"]`

**Available Parameters:**

* `pdf` - PDF URL (required)
* `width` - Width (default: 100%)
* `height` - Height (default: auto)
* `background_color` - Background color hex code
* `box_color` - Box color hex code
* `layout` - auto, single, or double page layout
* `book_layout` - traditional (page 1 alone) or spread (pages 1-2)
* `view_mode` - flipbook (animated) or singlepage (scrollable)
* `breakpoint` - Container width in pixels for responsive switching
* `enable_animations` - true or false

All parameters can be configured with default values in Settings > Flipbook Viewer.

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/flipbook-viewer` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Use Settings > Flipbook Viewer to configure default options.
4. Add the `[flipbook pdf="URL"]` shortcode to any post or page.

== Frequently Asked Questions ==

= Does this work with any PDF? =

Yes! The plugin uses Mozilla's PDF.js library to render any standard PDF document.

= Can I embed multiple flipbooks on one page? =

Yes! Each flipbook instance is independent. Just use multiple shortcodes with different PDF URLs.

= Does it work on mobile devices? =

Absolutely. The responsive layout automatically adapts to container width. On narrow containers, it switches to single-page view for better readability.

= What about accessibility? =

The plugin is built with accessibility in mind:
- Respects `prefers-reduced-motion` system setting
- Full keyboard navigation support
- Focus indicators for keyboard users
- Semantic HTML structure

= Can I use it in a narrow sidebar? =

Yes! Unlike most responsive solutions that only check viewport width, this plugin uses container-based detection. It will automatically switch to single-page layout when embedded in narrow containers.

= How do I customize the appearance? =

You can set default styles in Settings > Flipbook Viewer, or override them per-instance using shortcode parameters.

== Screenshots ==

1. Flipbook viewer showing a PDF with animated page turns
2. Admin settings panel for configuring defaults
3. Single-page scrollable view mode
4. Responsive layout adapting to narrow containers

== Changelog ==

= 2.0.0 =
* Complete WordPress plugin transformation
* Added admin settings panel for default configurations
* Implemented container-based responsive layouts (not just viewport-based)
* Added `prefers-reduced-motion` accessibility support
* Implemented traditional book layout (page 1 as cover)
* Added comprehensive keyboard navigation
* Added single-page scrollable view mode
* Support for multiple instances on same page
* Enhanced shortcode with all library parameters

= 1.6.1 =
* Original standalone library release

== Upgrade Notice ==

= 2.0.0 =
Major update transforming the library into a full WordPress plugin with admin interface, accessibility features, and container-based responsive layouts.

== Technical Details ==

**Browser Support:**
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Uses ResizeObserver API for container queries (graceful degradation for older browsers)

**Performance:**
- Lazy loads PDF pages
- Caches rendered pages for smooth navigation
- Optimized for HiDPI/Retina displays

**Dependencies:**
- PDF.js (bundled)
- No jQuery required
- No external CDN dependencies

**Credits:**
Built on the amazing [flipbook-viewer](https://github.com/theproductiveprogrammer/flipbook-viewer) library and [PDF.js](https://mozilla.github.io/pdf.js/) from Mozilla.
