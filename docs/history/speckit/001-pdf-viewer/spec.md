# Feature Specification: BWS PDF Viewer

**Feature Branch**: `001-pdf-viewer`
**Created**: 2026-03-02
**Status**: Draft
**Input**: User description: "We are in the process of developing a WordPress plugin that will
allow us to display PDFs inline on websites. PDFs may be viewed in either document-style
scrolling views or book-style flipping views. Editors should be able to easily specify the mode
and controls available. Admins should be able to set global defaults and global overrides.
Users should receive a device-appropriate view, with mobile fallback to page preview images."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitor Reads a PDF in Document Mode (Priority: P1)

A site visitor opens a WordPress page that contains an embedded PDF. The viewer displays the
document as a continuous vertical scroll, similar to reading a standard document online. The
visitor can scroll through pages, navigate with keyboard shortcuts, and use whichever toolbar
controls the editor has enabled (such as fullscreen or print).

**Why this priority**: Document/scrolling mode is the baseline reading experience. It is the
simplest, most universally accessible mode and must work reliably for all visitors on all devices
before any other mode is considered complete.

**Independent Test**: Load any page containing a PDF shortcode configured for document mode.
Verify the first page appears within 2 seconds, scrolling reveals subsequent pages, keyboard
navigation works, and enabled toolbar controls are visible and functional.

**Acceptance Scenarios**:

1. **Given** a visitor opens a page with an embedded PDF in document mode,
   **When** the page loads,
   **Then** the first PDF page is visible within 2 seconds and subsequent pages become visible
   as the visitor scrolls down.

2. **Given** the viewer is showing a multi-page PDF,
   **When** the visitor presses the arrow key, Page Down, or Space bar,
   **Then** the view advances to the next page.

3. **Given** the editor has enabled the fullscreen control,
   **When** the visitor clicks the fullscreen button,
   **Then** the viewer expands to fill the browser window and a button to exit fullscreen
   is available.

4. **Given** the editor has enabled the print control,
   **When** the visitor clicks the print button,
   **Then** the browser's print dialog opens with the PDF ready to print.

5. **Given** a visitor is using a screen reader,
   **When** they navigate the viewer,
   **Then** each page change is announced (e.g., "Page 3 of 24"), all controls have accessible
   labels, and the viewer is fully operable without a mouse.

---

### User Story 2 - Visitor Reads a PDF in Flipbook Mode (Priority: P1)

A site visitor opens a page with a PDF in flipbook mode. On a desktop or wide-screen device, two
pages are shown side-by-side as a book spread, with a page-turn animation when navigating. On a
mobile device (container width ≤767px), only a single page is shown at a time. The experience
adapts to the actual container width, not the viewport, so it works correctly in sidebars and
multi-column layouts.

**Why this priority**: Flipbook mode is a primary feature of the plugin and a key differentiator.
It must deliver a polished, device-appropriate reading experience.

**Independent Test**: Load a page with a PDF shortcode in flipbook mode on both a desktop browser
and a mobile device/emulator. Verify two-page spread on wide containers, single-page on narrow,
and that navigation and animation work correctly.

**Acceptance Scenarios**:

1. **Given** a visitor on a desktop browser with a container wider than 767px,
   **When** the flipbook loads,
   **Then** two pages are displayed side-by-side as a book spread.

2. **Given** the visitor is viewing a two-page spread,
   **When** they click the right edge of the book or a "next page" button,
   **Then** the pages animate (page-turn) to reveal the next spread.

3. **Given** a visitor on a mobile device or narrow container (≤767px),
   **When** the flipbook loads,
   **Then** only one page is shown at a time (no side-by-side spread).

4. **Given** the visitor's operating system has "reduce motion" enabled,
   **When** they navigate the flipbook,
   **Then** page transitions occur without a flip animation; a fade or instant transition
   is used instead.

5. **Given** the same PDF is embedded twice on one page in different-width containers,
   **When** the page loads,
   **Then** each viewer independently selects single or double-page layout based on its own
   container width.

---

### User Story 3 - Editor Embeds a PDF with Mode and Controls (Priority: P1)

A content editor adds a PDF viewer to a WordPress page or post using the `[bws_pdf]` shortcode.
Without writing custom code beyond the shortcode syntax, the editor selects the view mode
(document or flipbook) and chooses which controls (e.g., fullscreen, print) visitors will see.
The published page reflects those choices exactly. A Gutenberg block interface is out of scope
for this release and will be addressed as a separate feature.

**Why this priority**: This is the primary content authoring workflow. Without it, no PDF can
be published with the correct viewing experience.

**Independent Test**: An editor creates a page using the `[bws_pdf]` shortcode with explicit
`view_mode` and control attributes, publishes the page, and a visitor confirms the correct mode
and exact control set are shown.

**Acceptance Scenarios**:

1. **Given** an editor sets `view_mode="document"` in the shortcode,
   **When** a visitor loads the page,
   **Then** the scrolling document viewer is shown.

2. **Given** an editor sets `view_mode="flipbook"` in the shortcode,
   **When** a visitor loads the page,
   **Then** the flipbook viewer is shown.

3. **Given** an editor enables fullscreen but disables print in the shortcode attributes,
   **When** a visitor views the PDF,
   **Then** the fullscreen button is visible and the print button is absent.

4. **Given** an editor does not specify a view mode in the shortcode,
   **When** a visitor loads the page,
   **Then** the admin's configured default mode is used.

5. **Given** an admin has disabled flipbook mode site-wide,
   **When** an editor sets `view_mode="flipbook"` in the shortcode,
   **Then** the viewer renders in document mode instead, and an admin notice or documentation
   informs editors that flipbook mode has been disabled.

---

### User Story 4 - Admin Configures Global Defaults and Restrictions (Priority: P3)

A site administrator opens the plugin settings page in the WordPress admin area. The admin sets
a default view mode for all new PDF embeds and optionally disables one or both modes site-wide.
The admin can also set default control visibility that applies whenever an editor has not
explicitly configured controls.

**Why this priority**: Admin governance ensures consistent site-wide presentation and prevents
editors from using modes or controls that conflict with site policy or design standards.

**Independent Test**: Admin sets default mode to "flipbook" and disables document mode in plugin
settings. A new shortcode with no mode specified uses flipbook; a shortcode with
`view_mode="document"` also uses flipbook.

**Acceptance Scenarios**:

1. **Given** an admin has set the default view mode to "flipbook",
   **When** an editor embeds a PDF without specifying a mode,
   **Then** the flipbook viewer is displayed to visitors.

2. **Given** an admin has disabled document mode,
   **When** any PDF is displayed on the site,
   **Then** all viewers render in flipbook mode regardless of shortcode or block settings.

3. **Given** an admin has disabled flipbook mode,
   **When** any PDF is displayed on the site,
   **Then** all viewers render in document mode regardless of shortcode or block settings.

4. **Given** an admin has set a default control set (e.g., print hidden by default),
   **When** an editor embeds a PDF without specifying control options,
   **Then** the visitor sees the admin-configured control set.

5. **Given** an editor explicitly overrides a control option in the shortcode,
   **When** the page is viewed,
   **Then** the editor's override takes precedence over the admin default for that control.

---

### User Story 5 - Mobile Visitor Sees Page Previews When Viewer Cannot Load (Priority: P2)

A visitor on a mobile device encounters an embedded PDF. If the full interactive viewer cannot
initialize (due to device constraints, browser limitations, or a rendering failure), rather than
seeing a blank space or error, the visitor sees static image previews of the PDF pages. They can
scroll through the images to read the content.

**Why this priority**: This is a graceful degradation goal ("hope to allow") rather than a core
requirement. It ensures content remains accessible even on constrained mobile environments,
but does not block the primary viewer release.

**Independent Test**: Simulate a viewer initialization failure on a mobile device (or via
feature flag). Verify that page images are displayed, all pages are accessible, and the
fallback experience is screen-reader accessible.

**Acceptance Scenarios**:

1. **Given** a mobile visitor's device or browser cannot load the full interactive viewer,
   **When** the viewer attempts to initialize and fails,
   **Then** static image previews of the PDF pages are displayed in place of the interactive
   viewer.

2. **Given** the fallback image previews are shown,
   **When** the visitor scrolls,
   **Then** all pages of the PDF are accessible (either all loaded upfront or loaded on demand
   as the visitor scrolls).

3. **Given** the fallback is shown,
   **When** a screen reader user navigates the page,
   **Then** each page image has a descriptive accessible label (e.g., "Page 1 of 12").

---

### Edge Cases

- When the PDF URL is inaccessible (network error, 404, timeout): the viewer displays an
  inline error message and a direct link to open the PDF URL in a new tab.
- When a PDF has exactly one page in flipbook mode: the page is centered and fills the full
  viewer width regardless of container size (no split/spread layout).
- An admin cannot disable both view modes simultaneously: the settings UI MUST prevent the
  last remaining enabled mode from being disabled (FR-015).
- How are very large PDFs (100+ pages) handled to prevent excessive memory usage?
- What happens when the same PDF is embedded two or more times on the same page?
- How does the viewer behave when placed in a very narrow container (e.g., a sidebar widget)?
- Cross-origin PDF URLs: in multi-domain deployments, the PDF source URL MUST pass through
  the plugin's URL rewriting integration point (same as script/asset URLs). For standard
  single-domain deployments, cross-origin PDFs are supported if the remote server supplies
  appropriate CORS headers; no special plugin accommodation is made (FR-016).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The viewer MUST support two display modes: document (continuous scroll) and
  flipbook (page-flip animation).
- **FR-002**: In flipbook mode, the viewer MUST display a two-page spread when the viewer
  container is wider than 767px, and a single-page view when the container is ≤767px. When
  the PDF contains only one page, that page MUST be centered and fill the full viewer width
  regardless of container size (no split layout).
- **FR-003**: Layout adaptation MUST be based on the viewer container width, not the
  browser viewport, so multiple viewers on the same page each adapt independently.
- **FR-004**: Editors MUST be able to set the view mode per PDF instance using a shortcode
  attribute. A Gutenberg block interface is out of scope for this release.
- **FR-005**: Editors MUST be able to enable or disable individual toolbar controls per PDF
  instance via shortcode attributes. At minimum, fullscreen and print MUST be individually
  toggleable. The complete set of optional controls will be defined during the planning phase;
  the shortcode interface MUST be designed to accommodate additional controls without breaking
  changes to existing shortcodes.
- **FR-006** *(P3)*: Admins MUST be able to set a global default view mode (document or flipbook)
  that applies when editors do not specify a mode.
- **FR-007** *(P3)*: Admins MUST be able to globally disable a view mode, overriding any editor
  shortcode setting for that mode.
- **FR-008** *(P3)*: Admins MUST be able to set global default control visibility that applies
  when editors have not specified control options.
- **FR-009**: The viewer MUST be fully keyboard-navigable (arrow keys, Page Up/Down, Space)
  without requiring a mouse or touch input.
- **FR-010**: All viewer controls and interactive elements MUST have accessible labels
  and meet WCAG 2.2 AA requirements.
- **FR-011**: The first PDF page MUST begin rendering within 2 seconds on a standard
  broadband connection (10 Mbps).
- **FR-012**: Page-flip and slide transition animations MUST be disabled when
  `prefers-reduced-motion: reduce` is active; fade transitions are permitted.
- **FR-013** *(P2)*: When the full interactive viewer fails to initialize on a mobile device,
  the viewer MUST fall back to displaying static page image previews with accessible labels.
- **FR-014**: When the PDF source URL is inaccessible (network error, 404, or timeout), the
  viewer MUST display an inline error message within the viewer container and a direct link
  to open the PDF URL in a new tab. The viewer container MUST NOT collapse or disappear.
- **FR-015** *(P3)*: The admin settings UI MUST prevent an admin from disabling the last remaining
  enabled view mode. At least one mode (document or flipbook) MUST always remain enabled.
- **FR-016**: The PDF source URL MUST be exposed through the plugin's URL rewriting
  integration point so it can be rewritten in multi-domain deployments. The URL MUST NOT
  be hardcoded or rendered in a form that prevents rewriting. For deployments without URL
  rewriting, cross-origin PDFs depend on the remote server providing appropriate CORS headers.

### Key Entities

- **PDF Viewer Instance**: A single embedded viewer on a page, configured with view mode,
  control settings, and PDF source URL. Multiple instances may appear on the same page.
- **View Mode**: Either "document" (continuous scroll) or "flipbook" (animated page turns).
  Configurable per instance and overridable globally by admins.
- **Control Set**: The collection of optional toolbar elements shown in the viewer (fullscreen,
  print, navigation, etc.). Individually enabled or disabled per instance and at admin level.
- **Admin Settings**: Site-wide defaults and mode restrictions, stored as WordPress plugin
  options and applied when per-instance settings are absent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Visitors can begin reading any embedded PDF within 2 seconds of page load on a
  standard broadband connection.
- **SC-002**: Editors can embed a PDF and fully configure its viewing mode and controls without
  writing any custom code (shortcode syntax or block UI only).
- **SC-003** *(P3)*: Admins can enforce a consistent site-wide viewer mode via the settings page
  without editing any individual page, post, or shortcode.
- **SC-004**: The viewer passes a WCAG 2.2 AA audit covering keyboard navigation, focus
  indicators, screen reader announcements, and color contrast for all interactive elements.
- **SC-005**: The viewer operates correctly on all browsers and devices in the project
  compatibility matrix (Chrome, Firefox, Safari 14+, Edge; iOS Safari 14+ on mobile).
- **SC-006**: A visitor using only a keyboard can navigate all pages of any embedded PDF
  without a mouse.
- **SC-007** *(P2)*: On mobile devices where the full viewer fails to load, visitors can
  access all PDF pages via static image previews.

### Assumptions

- The PDF source is provided as a URL; the viewer receives and renders it client-side.
- The PDF source URL MUST be exposed through the plugin's URL rewriting integration point
  (alongside script and asset URLs) to support multi-domain deployments via an external plugin.
  The actual rewriting logic is an infrastructure concern external to this plugin.
- Password-protected PDFs are out of scope for this release.
- Page navigation controls (prev/next buttons and page counter) are always visible and
  cannot be disabled — only optional controls (fullscreen, print, etc.) are togglable.
- The shortcode (`[bws_pdf]`) is the sole authoring interface for this release. A Gutenberg
  block interface is explicitly deferred to a future feature.
- No visual page-builder or drag-and-drop composer integration is required at this stage.

## Clarifications

### Session 2026-03-02

- Q: What should a visitor see when the PDF URL is inaccessible (network error, 404, or
  timeout)? → A: Inline error message + a direct link to open the PDF in a new tab (FR-014).
- Q: Should the Gutenberg block interface be P1 alongside shortcode, or is shortcode-first
  acceptable with block deferred? → A: Shortcode is P1; Gutenberg block deferred to future
  feature (updated FR-004, FR-005, US3, Assumptions).
- Q: When a PDF has exactly one page in flipbook mode, how should it be presented? → A:
  Centered, filling the full viewer width (no split layout) (updated FR-002, Edge Cases).
- Q: If an admin attempts to disable both view modes simultaneously, what should happen? →
  A: UI prevents it — the last enabled mode cannot be disabled (FR-015, Edge Cases).
- Q: Should the viewer support cross-origin PDF URLs? → A: In multi-domain deployments the
  PDF source URL MUST pass through the URL rewriting integration point; for standard
  deployments, cross-origin depends on the remote server's CORS headers (FR-016, Edge Cases,
  Assumptions).
