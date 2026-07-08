=== BWS PDF Viewer ===
Contributors: charles.lobo@gmail.com
Tags: pdf, flipbook, page-flip, pdf-viewer, animation, accessibility, wcag, screen-reader
Requires at least: 6.0
Tested up to: 6.4
Stable tag: 0.4.2
Requires PHP: 7.4
License: MIT
License URI: https://opensource.org/licenses/MIT

Accessibility-compliant PDF viewer with animated page flip effects. WCAG 2.1 AA compliant with full keyboard navigation and screen reader support.

== Description ==

BWS PDF Viewer is a WCAG 2.1 AA compliant, accessibility-first WordPress plugin that allows you to embed PDFs as beautiful, animated flipbooks or accessible single-page viewers directly into your posts and pages.

**Key Features:**

* ♿ **WCAG 2.1 AA Compliant** - Full accessibility support with screen reader announcements, ARIA labels, and semantic HTML.
* 🎯 **Accessibility First** - Default single-page view mode for maximum accessibility. Flipbook mode available as optional enhancement.
* ⌨️ **Complete Keyboard Navigation** - Arrow keys, Page Up/Down, Space, Home/End all work. Perfect for keyboard-only users.
* 🔊 **Screen Reader Support** - Tested with NVDA, JAWS, and VoiceOver. Page change announcements for assistive technologies.
* 🎨 **Reduced Motion Support** - Automatically respects user's `prefers-reduced-motion` system setting.
* 🌐 **Multi-Domain Support** - Integrates with BWS Portal System for automatic PDF URL rewriting on custom domains.
* 📱 **Truly Responsive** - Adapts to container width, not just device size. Perfect for narrow columns and sidebars.
* ⚡ **Lightweight** - Only 18 KB core library (vs 10 MB for similar solutions).
* 📖 **Traditional Book Layout** - Page 1 as cover, then two-page spreads (2-3, 4-5, etc.).
* 👀 **Multiple View Modes** - Single-page (accessible default) or animated flipbook.
* 🔄 **Multiple Instances** - Embed multiple viewers on the same page.
* 🎯 **Container Queries** - Layout switches based on actual container width, not viewport.

**Usage:**

Simply use the shortcode with your PDF URL:

`[bws_pdf]https://example.com/document.pdf[/bws_pdf]`

**With Custom Parameters:**

`[bws_pdf width="800px" height="600px" layout="double" view_mode="flipbook"]https://example.com/document.pdf[/bws_pdf]`

**Available Parameters:**

* `width` - Width (default: 100%)
* `height` - Height (default: auto)
* `background_color` - Background color hex code
* `box_color` - Box color hex code
* `layout` - auto, single, or double page layout
* `book_layout` - traditional (page 1 alone) or spread (pages 1-2)
* `view_mode` - singlepage (accessible default) or flipbook (animated)
* `breakpoint` - Container width in pixels for responsive switching
* `enable_animations` - true or false
* `enable_portal_integration` - true or false (for multi-domain setups)

The PDF URL is placed between the opening and closing shortcode tags. Parameters are added as attributes in the opening tag.

All parameters can be configured with default values in Settings > BWS PDF Viewer.

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/bws-pdf-viewer` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Use Settings > BWS PDF Viewer to configure default options.
4. Add the `[bws_pdf]URL[/bws_pdf]` shortcode to any post or page.

== Frequently Asked Questions ==

= Does this work with any PDF? =

Yes! The plugin uses Mozilla's PDF.js library to render any standard PDF document.

= Can I embed multiple flipbooks on one page? =

Yes! Each flipbook instance is independent. Just use multiple shortcodes with different PDF URLs.

= Does it work on mobile devices? =

Absolutely. The responsive layout automatically adapts to container width. On narrow containers, it switches to single-page view for better readability.

= What about accessibility? =

The plugin is WCAG 2.1 AA compliant with comprehensive accessibility features:
- Default single-page view mode (most accessible)
- Screen reader announcements for page changes (NVDA, JAWS, VoiceOver)
- Complete keyboard navigation (Arrow keys, Page Up/Down, Home/End, Space)
- Proper ARIA labels and semantic HTML
- Respects `prefers-reduced-motion` system setting
- Enhanced focus indicators for keyboard users
- High contrast mode support

= Can I use it in a narrow sidebar? =

Yes! Unlike most responsive solutions that only check viewport width, this plugin uses container-based detection. It will automatically switch to single-page layout when embedded in narrow containers.

= How do I customize the appearance? =

You can set default styles in Settings > BWS PDF Viewer, or override them per-instance using shortcode parameters.

== Screenshots ==

1. Flipbook viewer showing a PDF with animated page turns
2. Admin settings panel for configuring defaults
3. Single-page scrollable view mode
4. Responsive layout adapting to narrow containers

== Changelog ==

= 0.4.2 =
* FIX: Page-jump, Home/End, and reinit page-restore now land on the correct
  spread in flipbook mode with book_layout="spread". The mapping was traditional-
  layout-only and put spread-layout jumps one spread off. Both layouts now share
  a single floor(page/2) spread calculation.

= 0.4.1 =
* FIX: Document (native + image) mode no longer re-initialises on container resize.
  Reinit was a flipbook-only path; running it in document mode duplicated rendered
  pages and leaked IntersectionObservers. Document mode reflows via CSS instead.
* FIX: Fullscreen state listeners are now detached when the toolbar is rebuilt,
  preventing listener accumulation across responsive re-inits.
* FIX: Mobile/desktop auto-detection now correctly factors touch capability again
  (previously collapsed to a screen-width-only check).
* FIX: Prev/next buttons coerce the current page to a number, avoiding a stray
  string-concatenation jump when the page value arrives as a string.
* FIX: Native-mode pages guard against double-rendering when the lazy-load observer
  re-fires mid-render during fast scrolling.
* FIX: The show_controls default now flows through plugin defaults and a new admin
  setting (Settings > BWS PDF Viewer > Show Navigation Controls), restoring the
  documented default -> admin -> shortcode precedence.

= 0.4.0 =
* NEW: Integrated viewer toolbar — a single docked overlay bar shared by both
  flipbook and document modes (prev/next, editable page-number jump field with
  "of N" count, fullscreen, print), replacing the previous detached control bar.
* NEW: Type a page number and press Enter to jump directly to it; out-of-range
  input clamps, invalid input restores the current page.
* ACCESSIBILITY: Toolbar now uses the WAI-ARIA toolbar pattern (role="toolbar",
  roving arrow-key focus, one Tab stop), labelled controls, retained "Page N of M"
  screen-reader announcements, visible focus indicators, and >=24x24px targets.
* CHANGED: Document (native) mode now renders its text and annotation layers with
  the official PDF.js viewer components (TextLayerBuilder / AnnotationLayerBuilder
  + a shared link service), replacing hand-rolled positioning. Internal-destination
  links now navigate; external links open in a new tab with a safe rel. This lays
  groundwork for in-document search.
* CHANGED: Upgraded bundled PDF.js to 6.1.200. Browser floor is now Chrome 125+,
  Safari 18+ / iOS 18+, and current Firefox (inherited from PDF.js 6).
* NOTE: The control bar moved from below the viewer to inside the viewer container.
  Sites that styled the old bar's outer margin may see minor spacing changes.
* Existing shortcode attributes (show_controls, show_fullscreen, show_print) are
  unchanged.

= 0.3.1 =
* VERSIONING RESET: Switched to a 0.x.x scheme to reflect pre-1.0 status — no
  publicly usable release has shipped. This is the same codebase previously
  numbered 3.1.0; the reset acknowledges the viewer is still pre-release.
* Entries below (3.0.0 and earlier) are retained as historical development
  record from before the reset.

= 3.0.0 =
* MAJOR UPDATE: Rebranded as general-purpose accessible PDF viewer
* BREAKING CHANGE: Default view mode changed to 'singlepage' (more accessible)
* NEW: Portal System integration for multi-domain WordPress setups
* NEW: Enhanced WCAG 2.1 AA accessibility compliance
* NEW: Screen reader announcements for page changes
* NEW: Complete keyboard navigation (Home/End keys)
* IMPROVED: Better ARIA labels and semantic structure
* IMPROVED: Enhanced focus indicators for keyboard users
* IMPROVED: High contrast mode support
* NOTE: Existing users' settings are preserved during upgrade

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

= 3.0.0 =
Major accessibility update! Default view mode is now 'singlepage' for better WCAG compliance. Existing settings are preserved. New Portal System integration for multi-domain sites. Enhanced screen reader support and keyboard navigation.

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
