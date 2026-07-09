=== BWS PDF Viewer ===
Contributors: charles.lobo@gmail.com
Tags: pdf, flipbook, page-flip, pdf-viewer, animation, accessibility, wcag, screen-reader
Requires at least: 6.0
Tested up to: 6.4
Stable tag: 0.4.5
Requires PHP: 7.4
License: MIT
License URI: https://opensource.org/licenses/MIT

PRE-RELEASE (pre-1.0) — NOT for production use. May break; no support or stability guarantee. PDF viewer with animated flipbook and single-page modes.

== Description ==

**⚠️ PRE-RELEASE — NOT SAFE TO USE.** This plugin is pre-1.0 and has never
shipped a publicly usable release. It is under active development, may break
without notice, and is not intended for production sites. No support, no
stability guarantee, and no backward-compatibility promise between versions.
Shortcode attributes and defaults may change without a migration path. Use at
your own risk.

BWS PDF Viewer embeds PDFs as animated flipbooks or scrollable single-page
viewers in WordPress posts and pages.

**Features:**

* **Accessibility** - Screen reader announcements, ARIA labels, semantic HTML; targets WCAG 2.1 AA.
* **Single-page default** - Accessible single-page view is the default; flipbook mode is opt-in.
* **Keyboard navigation** - Arrow keys, Page Up/Down, Space, Home/End.
* **Screen readers** - Tested with NVDA, JAWS, and VoiceOver.
* **Reduced motion** - Respects `prefers-reduced-motion`.
* **Multi-domain** - Filter hooks for rewriting asset and PDF URLs on multi-domain installs and CDNs.
* **Container-based responsive** - Adapts to container width, not just device size.
* **Lightweight** - 18 KB core library (vs ~10 MB for comparable solutions).
* **Traditional book layout** - Page 1 as cover, then two-page spreads (2-3, 4-5, etc.).
* **View modes** - Single-page (default) or animated flipbook.
* **Multiple instances** - Multiple viewers per page.
* **Container queries** - Layout switches on actual container width, not viewport.

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
* `view_mode` - document (default) or flipbook (animated); singlepage is a legacy alias for document
* `breakpoint` - Container width in pixels for responsive switching
* `enable_animations` - true or false
* `force_native` - true, false, or empty (auto-detect native PDF.js vs image rendering)
* `show_controls` - true or false (navigation toolbar)
* `show_fullscreen` - true or false (fullscreen button)
* `show_print` - true or false (print button)

Multi-domain URL rewriting (assets and PDF source) is handled via the `bws_pdf_viewer_plugin_url` and `bws_pdf_viewer_pdf_url` filter hooks, not a shortcode attribute or admin setting. See README.md.

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

Yes. The responsive layout adapts to container width; on narrow containers it switches to single-page view.

= What about accessibility? =

The plugin targets WCAG 2.1 AA (not independently audited) and includes:
- Default single-page (document) view mode (most accessible)
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

= 0.4.5 =
* FIX: Flipbook no longer leaves large empty bands above and below the pages at
  narrower widths. The canvas is now sized to the two-page spread the viewer actually
  draws, at every width, so the spread fills its box edge-to-edge with no letterbox.
  (The layout previously sized a tall single-page canvas just below the responsive
  breakpoint, while the viewer still rendered a wide spread into it.)
* FIX: A blank Width in Settings no longer collapses the viewer to a narrow, left-pinned
  box. Blank now means "fill the container" (its documented default) instead of an
  invalid size. Height, likewise, is derived from the page aspect ratio so the pages
  fit exactly.
* CHANGE: The Settings fields for Width, Height, Border, Margin, Background/Box Color,
  and Responsive Breakpoint now show their default as placeholder text and store
  nothing when left blank — so the plugin default always applies and a future default
  change reaches sites that never set a value. (Previously a blank or pre-filled field
  could silently freeze the current default into your saved settings.)
* NOTE: The "Layout Mode" option (Auto / Single Page / Double Page Spread) currently has
  no visible effect in flipbook mode — the flipbook always renders a two-page spread.
  It is retained pending a future single-page-on-narrow reading mode.

= 0.4.4 =
* CHANGE: Flipbook background and box colors now default to transparent, so the host
  page/theme shows through around and behind the pages. Set a hex code (or the word
  "transparent") in Settings or via the background_color/box_color shortcode
  attributes to override; leave the admin field blank to use the default. Fullscreen
  keeps a solid dark backdrop. (Fixes cleared color fields that previously fell back
  to grey.)
* FIX: Flipbook cover/lone page now centers and fills the spread width instead of
  drawing in its left half with blank dead space beside it (traditional cover and
  trailing odd page). Restores the original single-page centering rule. (#5)
* FIX: Entering/exiting fullscreen now relayouts the flipbook so the canvas rescales
  to fill the fullscreen area in BOTH width and height (previously it kept its
  pre-fullscreen size, then only its width, leaving a black void below). The canvas
  reserves room for the docked toolbar. Document mode is unaffected (CSS reflow). (#6)
* CHANGE: The page-nav controls (prev/next + page-jump field + counter) are now hidden
  in Continuous/document mode and for single-page files, where paging is meaningless —
  all pages are already visible. Fullscreen and print stay. Flipbook multi-page still
  shows full nav. (#8)
* STYLE: Restyled the toolbar to a neutral flat PDF.js-like aesthetic (dark slate bar,
  monochrome buttons, subtle borders/hover) instead of the three bright WordPress-admin
  hues. Exposed `--bws-*` CSS variables so a theme or admin can override the palette. (#7)

= 0.4.3 =
* REMOVE: Dead "Enable Portal Integration" admin setting. It was read by no
  runtime code (an orphan left after multi-domain URL rewriting moved to filter
  hooks) and misled admins into thinking it handled portal asset rewriting.
* DOCS: Rewrote the multi-domain section around the `bws_pdf_viewer_plugin_url`
  and `bws_pdf_viewer_pdf_url` filter hooks; removed the stale checkbox and
  Cloudflare-CORS configuration steps.
* CHANGE: Relabeled the admin view-mode option "Single Page" to "Continuous"
  (it scrolls through all pages; the old name misread as one-page-at-a-time).
  Stored value now defaults to `document`; the legacy `singlepage` value is
  still accepted. No runtime behavior change.

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

= 0.4.2 =
Pre-release (pre-1.0). Not for production. Shortcode attributes and defaults may change between versions without a migration path — re-test before updating.

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
