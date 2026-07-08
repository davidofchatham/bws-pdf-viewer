# Feature Specification: Integrated Viewer Toolbar

**Feature Branch**: `002-integrated-viewer-toolbar`
**Created**: 2026-07-07
**Status**: Draft
**Input**: User description: "Integrated viewer toolbar and PDF.js component adoption. Replace the
current detached, generic-looking navigation bar with a single integrated toolbar component shared
by both flipbook and document modes, styled as an overlay bar inside the viewer container
(PDF.js-style: prev/next, page-number jump input, page count, fullscreen, print; zoom deferred
unless trivial). Reuse-first constraint: evolve the existing working controls logic rather than
rewriting it; consolidate the duplicate implementations into one shared component. In document
(native) mode, replace the hand-rolled text and annotation layer positioning with the official
maintained viewer components, preserving lazy loading and memory cleanup behavior. Accessibility
must not regress and should improve. Existing shortcode attributes keep working unchanged. Do not
adopt the full prebuilt PDF.js web viewer (viewer.html/iframe)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitor Navigates with the Integrated Toolbar (Priority: P1)

A site visitor opens a page containing an embedded PDF in either document or flipbook mode. A
toolbar appears as part of the viewer itself — visually attached inside the viewer frame rather
than as a detached row of generic buttons below it. The toolbar offers previous/next navigation,
an editable page-number field showing the current page alongside the total page count, and —
when enabled by the editor — fullscreen and print buttons. The toolbar looks and behaves
identically in both viewing modes.

**Why this priority**: The toolbar is the visitor's primary interface to every embedded PDF. Its
current detached, inconsistent presentation undermines the polish of both viewing modes, and it
is the core of this feature.

**Independent Test**: Load one page with a document-mode embed and one with a flipbook-mode
embed. Verify both show the same toolbar inside the viewer frame with prev/next, page field,
page count, fullscreen, and print; verify every control works in both modes.

**Acceptance Scenarios**:

1. **Given** a PDF embedded in document mode, **When** the page loads, **Then** the toolbar is
   rendered inside the viewer container, visually part of the viewer, showing previous/next
   controls, a page-number field, total page count, and any enabled optional controls.

2. **Given** a PDF embedded in flipbook mode, **When** the page loads, **Then** the identical
   toolbar (same controls, same appearance, same placement) is rendered.

3. **Given** the visitor types a valid page number into the page field and confirms (e.g.,
   presses Enter), **When** the entry is committed, **Then** the viewer navigates directly to
   that page (in flipbook mode, to the spread containing that page) and the field reflects the
   new current page.

4. **Given** the visitor enters an out-of-range or non-numeric value in the page field,
   **When** the entry is committed, **Then** the viewer does not navigate, and the field is
   restored to the current page (out-of-range values may be clamped to the nearest valid page).

5. **Given** the visitor navigates by any means (toolbar buttons, keyboard, page field, or
   clicking the flipbook page edge), **When** the current page changes, **Then** the page field
   and page count update to match.

6. **Given** the viewer container is narrow (e.g., a sidebar), **When** the toolbar renders,
   **Then** all enabled controls remain reachable and usable — the toolbar adapts (e.g., wraps
   or compacts) rather than overflowing or clipping controls.

---

### User Story 2 - Keyboard and Screen Reader User Operates the Toolbar (Priority: P1)

A visitor who relies on a keyboard and/or screen reader interacts with the embedded PDF. The
toolbar is exposed as a labelled toolbar landmark; every control has an accessible name; focus
is always visible; page changes are announced. Nothing that worked before this feature stops
working.

**Why this priority**: Accessibility is a constitutional requirement (WCAG 2.2 AA) and the user
explicitly requires no regression. A toolbar redesign is exactly the kind of change that can
silently break assistive-technology support, so it carries P1 verification weight.

**Independent Test**: Using only a keyboard plus a screen reader (e.g., NVDA or VoiceOver),
reach the toolbar, identify it by its announced name, operate every control, jump to a specific
page via the page field, and hear each page change announced.

**Acceptance Scenarios**:

1. **Given** a keyboard-only visitor, **When** they Tab to the viewer, **Then** they can reach
   and activate every enabled toolbar control without a mouse, and each focused control shows a
   clearly visible focus indicator.

2. **Given** a screen reader user, **When** they encounter the toolbar, **Then** it is announced
   as a toolbar with a descriptive name, and each control announces a meaningful label (e.g.,
   "Previous page", "Page number", "Enter fullscreen", "Print").

3. **Given** any navigation action, **When** the current page changes, **Then** the screen
   reader announces the new position (e.g., "Page 3 of 24") exactly as it did before this
   feature.

4. **Given** the fullscreen state changes, **When** the visitor toggles fullscreen, **Then** the
   control's announced label reflects the new state (enter vs exit).

5. **Given** the toolbar in any mode, **When** audited against WCAG 2.2 AA, **Then** all
   controls meet contrast requirements, have minimum 24×24 CSS pixel targets, and follow the
   established keyboard interaction pattern for toolbars.

---

### User Story 3 - Existing Embeds Continue Working Unchanged (Priority: P1)

A site already has published pages using `[bws_pdf]` shortcodes, some with `show_controls`,
`show_fullscreen`, or `show_print` attributes. After the plugin update, every existing embed
renders with the new integrated toolbar honouring the same attributes with the same meanings —
no page edits, no shortcode changes, no behavioural surprises.

**Why this priority**: This feature ships as an update to live sites. Backward compatibility of
the authoring interface is non-negotiable.

**Independent Test**: Publish pages using each attribute combination (`show_controls="false"`,
`show_fullscreen="false"`, `show_print="false"`, and defaults) before the update; after the
update, verify each page honours its attributes without modification.

**Acceptance Scenarios**:

1. **Given** an existing shortcode with `show_controls="false"`, **When** the page renders after
   the update, **Then** no toolbar appears.

2. **Given** an existing shortcode with `show_fullscreen="false"` or `show_print="false"`,
   **When** the page renders, **Then** the corresponding button is absent and all other toolbar
   controls are present.

3. **Given** an existing shortcode with no control attributes, **When** the page renders,
   **Then** the toolbar appears with the same default control set as before the update
   (navigation, page position, fullscreen, print).

---

### User Story 4 - Document-Mode Reading Behaviour Is Preserved by Maintained Components (Priority: P2)

A visitor reading a PDF in document mode selects text, searches the page with the browser's
built-in find, and clicks links inside the PDF. These behaviours — currently provided by
plugin-specific rendering code — continue to work at least as well when the plugin switches to
the officially maintained rendering components, and page loading remains progressive with memory
kept under control on long documents.

**Why this priority**: This is an internal quality change with user-visible guarantees. It must
not regress reading behaviour, but it delivers its main value later (maintainability and a path
to in-viewer search), so it is P2 relative to the toolbar itself.

**Independent Test**: In document mode on a 100+ page PDF: select and copy text on several
pages, use browser find to locate a phrase, click an internal and an external PDF link, scroll
the full document while observing memory in developer tools, and confirm pages far from the
viewport are released.

**Acceptance Scenarios**:

1. **Given** a document-mode embed, **When** the visitor selects text on any rendered page,
   **Then** the selection follows the visible text accurately and can be copied.

2. **Given** a PDF containing links, **When** the visitor clicks a link, **Then** it activates
   correctly (external links open; internal destinations navigate within the document).

3. **Given** a 100+ page PDF, **When** the visitor scrolls through it, **Then** pages render
   progressively as they approach the viewport and distant pages are released, with no unbounded
   memory growth.

4. **Given** the switch to maintained components, **When** the full manual test plan for
   document mode is re-run, **Then** every previously passing check still passes.

---

### Edge Cases

- Page field: non-numeric input, empty input, `0`, negative numbers, values above the page
  count — commit restores or clamps; no navigation on invalid input; no script errors.
- Fullscreen unavailable (e.g., iPhone Safari): the fullscreen button is hidden entirely rather
  than rendered inert.
- Single-page PDF: previous/next are disabled, page field shows "1" and rejects other values.
- Flipbook spread numbering: jumping to a right-hand page displays the spread containing it,
  and the page field shows the convention already used by the counter (left page of spread).
- Container resized across the responsive breakpoint (viewer rebuilds itself): the toolbar
  remains present and functional after the rebuild, with current page preserved.
- Very narrow containers (~280px): toolbar controls wrap or compact; nothing is clipped or
  rendered unreachable.
- Toolbar must not permanently obscure document content: it occupies its own space within the
  viewer frame (no auto-hide behaviour that would harm discoverability or accessibility).
- `prefers-reduced-motion`: any toolbar transitions (e.g., button state changes) remain
  functional with animation removed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The viewer MUST present one toolbar with identical controls, appearance, and
  behaviour in both document and flipbook modes, rendered inside the viewer container as an
  integrated part of the viewer (not a detached element below it).
- **FR-002**: The toolbar MUST provide: previous page, next page, an editable page-number field,
  total page count, and — when enabled — fullscreen and print controls.
- **FR-003**: Committing a valid page number in the page field MUST navigate directly to that
  page (flipbook: the spread containing it). Invalid entries MUST NOT navigate and MUST restore
  the field to the current page; out-of-range entries MAY be clamped to the nearest valid page.
- **FR-004**: The page field and page count MUST stay synchronised with the current page
  regardless of how navigation occurs (buttons, keyboard, page field, or direct viewer
  interaction).
- **FR-005**: The toolbar MUST be exposed to assistive technology as a labelled toolbar and MUST
  follow the established keyboard interaction pattern for toolbars, with every control
  keyboard-operable.
- **FR-006**: Every toolbar control MUST have an accessible, translatable label; state-changing
  controls (fullscreen) MUST update their label to reflect current state.
- **FR-007**: Page-change announcements to screen readers MUST be preserved with the same
  content and politeness as the current release.
- **FR-008**: Toolbar controls MUST meet WCAG 2.2 AA: visible focus indicators, minimum 24×24
  CSS pixel targets, and AA contrast in all states (default, hover, focus, disabled).
- **FR-009**: The existing shortcode attributes `show_controls`, `show_fullscreen`, and
  `show_print` MUST keep their current names, accepted values, defaults, and meanings.
- **FR-010**: The fullscreen control MUST be hidden (not disabled) in environments that do not
  support fullscreen.
- **FR-011**: The toolbar MUST remain present and fully functional after the viewer rebuilds
  itself on a responsive layout change, preserving the current page.
- **FR-012**: The toolbar MUST adapt to narrow containers so that all enabled controls remain
  visible and operable.
- **FR-013**: In document mode, text selection, browser find-on-page, and PDF link activation
  MUST work at least as well as in the current release after the rendering internals move to the
  officially maintained viewer components.
- **FR-014**: Document mode MUST retain progressive (lazy) page rendering and release of
  far-off-screen pages so long documents do not grow memory without bound.
- **FR-015**: The plugin MUST NOT embed the full prebuilt PDF.js web viewer application or any
  iframe-based viewer.
- **FR-016**: Exactly one control-set implementation MUST serve all viewer modes; the current
  duplicate implementations MUST be consolidated, evolving the proven existing logic rather than
  rewriting behaviour that already works.

### Key Entities

- **Toolbar**: The single control surface of a viewer instance. Owns navigation controls, the
  page field/count display, and optional controls; bound to exactly one viewer instance and
  rebound when that instance is rebuilt.
- **Page Position**: The visitor's current location (current page, total pages) shared by the
  page field, announcements, and navigation state (disabled prev/next at bounds).
- **Optional Control**: A toolbar element (fullscreen, print) whose presence is governed by the
  existing three-tier configuration (defaults → admin settings → shortcode attributes).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a side-by-side check of one document-mode and one flipbook-mode embed, the
  toolbars are visually and functionally indistinguishable (same controls, placement, styling).
- **SC-002**: A keyboard-only user can perform every toolbar operation — navigate, jump to an
  arbitrary page, toggle fullscreen, print — without a mouse, on both modes.
- **SC-003**: The toolbar passes a WCAG 2.2 AA audit (labels, focus visibility, target size,
  contrast, toolbar semantics) with zero violations.
- **SC-004**: 100% of pre-existing shortcode embeds render correctly after the update with no
  content edits (verified against all `show_*` attribute combinations).
- **SC-005**: Jumping to any page via the page field completes within 2 seconds on a standard
  broadband connection.
- **SC-006**: Every document-mode check that passed in the previous release's manual test plan
  (selection, links, scrolling, memory behaviour) still passes after the internals change.
- **SC-007**: Duplicate control code is eliminated: one shared implementation serves both modes
  (verified by code inspection during review).

### Assumptions

- The toolbar is always visible while the viewer is on screen (no auto-hide); it occupies a
  bar anchored within the viewer frame. Auto-hide was rejected as harmful to discoverability
  and accessibility.
- Zoom controls are out of scope for this feature unless they fall out of the component
  adoption at no extra cost; in-viewer search is explicitly a future feature enabled by — but
  not part of — this work.
- The flipbook page-numbering convention shown in the page field follows the existing counter
  behaviour (left page of the current spread).
- Toolbar labels are in English in the plugin source and translatable through the plugin's
  existing localisation mechanism.
- The rendering-internals change (US4) is user-invisible by design; its acceptance is defined
  entirely by non-regression of visitor-facing behaviour.
- Reuse-first constraint applies throughout: existing proven logic (navigation handlers,
  announcements, state synchronisation, fullscreen handling) is evolved and consolidated, not
  reimplemented from scratch.
