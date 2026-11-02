# Architecture — BWS PDF Viewer

The architecture home: the goal, the file map, and the invariants the code must hold, each with the alternatives that lost (`Rejected:`) under the invariant they justify. Cite an invariant by id (`V28`) in code and docs; cite a surface by its `I.*` label. Terms live in [GLOSSARY.md](../GLOSSARY.md); non-bug work lives in [future-work.md](future-work.md); where every other kind of decision lives is in [agents/domain.md](agents/domain.md).

> **This file OWNS the goal, the file map and the invariants.** Other docs link here; they must not restate these. Anti-drift rules: [CLAUDE.md](../CLAUDE.md) § Doc discipline.

## Goal

WordPress plugin that embeds a PDF inline. Three render modes — flipbook
(animated page-turn) / native (PDF.js) / image (fallback) — device-adaptive,
one shared integrated toolbar across modes, WCAG 2.2 AA, multi-domain
(BWS portal).

## File map

The delivered/edited files and what each owns. Invariants cite these
by short name (`I.native`, `I.wp`, …).

| ref | file | owns |
|-----|------|------|
| **I.index**    | `src/index.js` | router: `nativeMode`→nativePageViewer, `singlepage`→singlePageViewer, else flipbookViewer |
| **I.flip**     | `src/flipbookviewer.js` | animated flipbook; spread layout; `goToPage`; HiDPI outputScale |
| **I.native**   | `src/nativepageviewer.js` | PDF.js 3-layer render; IntersectionObserver lazy-load; memory cleanup ~5–7 pages |
| **I.single**   | `src/singlepageviewer.js` | image-based mobile / fallback viewer |
| **I.controls** | `includes/bws-pdf-viewer.js` (`addNavigationControls` / `setupToolbarRovingFocus` / `getStrings`) + `includes/bws-pdf-viewer.css` | shared toolbar, single impl, both modes. (Planned `src/controls.js` never built; toolbar shipped in the WP layer.) |
| **I.wp**       | `includes/bws-pdf-viewer.js` | device detect, mode select, `createBookWrapper`, responsive, keyboard nav |
| **I.php**      | `bws-pdf-viewer.php` | shortcode `[bws_pdf]`, `register_assets()`, config merge / precedence |
| **I.admin**    | `includes/admin.php` | Settings > BWS PDF Viewer; defaults + mode restrictions + sanitize |
| **I.css**      | `includes/bws-pdf-viewer.css` | toolbar overlay, text/annotation layer positioning |

## Invariants

- **V1. Three modes, one router.** `src/index.js` selects nativePageViewer (opts.singlepage &&
  opts.nativeMode) / singlePageViewer (opts.singlepage) / flipbookViewer (else). Cites I.index.
- **V2. Hybrid device detection is not tautological.** image ⇐ (touch AND width ≤1024) OR
  width ≤767; native otherwise. `isMobile` MUST combine touch AND width — not restate itself
  (see B1). `force_native` att overrides. Cites I.wp.
- **V3. Container-width layout, not viewport.** ResizeObserver drives single-vs-double; ≥breakpoint
  (768) → spread, < → single. Each instance independent. Cites I.wp, ADR-0003.
- **V4. Reduced-motion kills flip/slide.** `prefers-reduced-motion: reduce` ⇒ shouldAnimate=false;
  fade/instant only. Cites I.wp, I.flip.
- **V5. Config precedence honored 3-tier.** defaults→admin option→shortcode; att wins per-key;
  admin default applies only when att absent. `show_controls` MUST follow this (see B6). Merged in `shortcode_handler()`. Cites I.php.
- **V6. Page nav context-dependent; optional controls togglable.** page-nav group (prev/next +
  page-input + "of N" counter + first/last-page buttons) rendered ONLY when navigation is meaningful = flipbook multi-page.
  HIDDEN when meaningless: continuous/document mode (`config.singlepage` true — all pages stacked/
  scrolled) OR single-page file (`numPages()===1`, any mode). When shown, prev/next MAY disable at
  first/last page (edge state). Toolbar bar still renders for fullscreen/print unless `show_controls`
  false; fullscreen/print gated by `show_fullscreen`/`show_print`/`show_controls`. (Amended 2026-07-08,
  issue #8 — reverses old "nav always rendered" rule; toolbar docks at bottom, not floated, so
  scroll-tracking count adds no value.) Cites I.controls,I.php.
- **V7. Native mode uses maintained PDF.js layer builders.** canvas + TextLayerBuilder (selection +
  browser find) + AnnotationLayerBuilder (links) + shared link service; internal links navigate,
  external new-tab. No hand-rolled layer positioning. Cites I.native, V15.
- **V8. Shortcode atts revisable, not frozen (pre-1.0).** Current set: `view_mode`,`layout`,
  `book_layout`,`force_native`,`show_controls`,`show_fullscreen`,`show_print`,`show_download`,`width`,`height`
  (`singlepage` legacy alias for `document`). NONE is cemented — any may be renamed/removed/
  repurposed before 1.0 when justified. On change: sweep the portal's shortcodes, fix usages,
  changelog it. Before a 1.0 freeze, review the WHOLE att surface for vestigial/misleading
  controls. Known vestigial: `layout` (auto/single/double) does nothing in the flipbook renderer
  (which only draws spreads — V24/B17) and is dead in document mode; KEPT for now as the anchor for
  the planned true single-page-flipbook feature (issue #1, FW-5), NOT because it currently works. Cites
  I.php,I.admin.
  _Rejected:_ freezing atts for back-compat. That carried a public-1.0 discipline onto a pre-1.0
  internal tool with no unknown third-party embeds; the one consumer's shortcodes are generated by us.
- **V9. One control-set impl, all modes.** Exactly one toolbar component (I.controls, in WP layer)
  serves flipbook + native; no duplicate control code. Cites I.controls.
  _Rejected:_ rewriting working control logic, or building our own control where the library or
  PDF.js already provides one. It burns effort and reintroduces solved bugs; extend the existing
  seam (`createBookWrapper`, `addNavigationControls`) instead.
- **V10a. Toolbar controls sit in wrap-together subgroups.** Controls are grouped into three
  `.bws-pdf-controls-group` blocks — page-info (the standalone range counter), nav (first | prev |
  Jump-to input | next | last, input in the MIDDLE), utility (fullscreen | print | download) — each
  `flex-wrap:nowrap` internally while the toolbar wraps BETWEEN groups (T34). A narrow bar therefore
  never tears a group apart (e.g. prev/next split across two rows). Groups follow DOM order = reading
  order (V27); the counter is a display span (not a roving item), the input and buttons remain
  roving-focusable in nav-group order. Cites I.controls,I.css,V27.
- **V10. Toolbar integrated + accessible.** Rendered inside viewer container (overlay bar, not
  detached row); role=toolbar, labelled; every control keyboard-operable; visible focus; ≥24×24px
  targets; AA contrast all states. Cites I.controls,I.css.
- **V11. Jump-to field is write-only; commit clamps.** The page field is a WRITE-ONLY "Jump to"
  control (empty by default, `Jump to…` placeholder, "Jump to page" aria-label) — it does NOT mirror
  the current page (superseded 2026-07-10, T33: mirroring produced a "type 5, land on the [5|6]
  spread, field shows 6" contradiction — V33). Commit: valid num → navigate (flipbook: spread
  containing page — V12/V28); invalid/empty/out-of-range → no navigation. After ANY commit (valid or
  not) the field CLEARS back to empty — there is nothing to restore-to-current because it never
  mirrored. Clamp-on-jump semantics (a value past page_count clamps to the last page before
  navigating) stay. The visible page position is carried by the range counter (V33), not this field.
  Cites I.controls,V33.
- **V12. Spread page-jump mapping correct.** flipbook `goToPage` maps page# → correct spread display
  index; `onSeen` maps display-index → page# consistently (see B7,B8). Cites I.flip.
- **V13. Native lazy-load + memory cap.** IntersectionObserver ~200px buffer renders on approach;
  keep ~5-7 pages, tear down distant; no unbounded growth on 100+ page docs. Cites I.native.
- **V14. Single concurrent render per page.** in-flight guard: no duplicate concurrent render of
  same page; loading flag set before await, cleared after (see B4,B5). Cites I.native.
- **V15. No full PDF.js viewer / iframe.** components only. Cites I.native.
  _Rejected:_ embedding PDF.js's prebuilt `viewer.html` (directly or in an iframe). It drags in the
  whole chrome, styling and update surface, fights our own toolbar, theming and container-responsive
  layout, and couples us to a UI we don't control. Reassessed against the convergence work in
  [reference/pdfjs-reuse-menu.md](reference/pdfjs-reuse-menu.md); not a fixed decision.
- **V16. Fullscreen hidden not disabled where unsupported.** e.g. iPhone Safari → button absent,
  not inert. Toggle updates announced label (enter/exit). Cites I.controls.
- **V17. Event listeners cleaned on reinit.** responsive rebuild MUST NOT leak fullscreen/other
  listeners; remove before re-adding (see B2). Toolbar survives rebuild, current page preserved. Cites I.wp,I.controls.
- **V18. Document mode does not reinit on responsive resize.** native/document mode skips the
  single↔double rebuild path (that's flipbook-only) (see B3). Cites I.wp.
- **V19. URL-load failure shows inline error + link.** network/404/timeout → inline message +
  direct new-tab link; container MUST NOT collapse. Cites I.wp.
- **V21. Lone flipbook page centers, fills width.** when exactly one of {left,right} is a REAL page
  in a spread (traditional cover, or trailing odd page), draw it CENTERED on the canvas (offset
  `layout.left + layout.width/4`, width `layout.width/2`), box drawn to match — never pinned to its
  half with blank adjacent slot. "Absent" is `!pg || pg.num===0`, NOT just `!pg`: the traditional
  wrapper fills the empty half with a BLANK page object (`num:0`), not null, so a `!pg`-only check
  fails to center the cover (see B9, B11). 1-page book already forced `single` layout in I.wp; this
  covers the multi-page spread edges (001 FR-002). Cites I.flip.
- **V22. Fullscreen relayouts flipbook, not document.** `fullscreenchange` MUST recompute flipbook
  canvas dimensions against the (enter/exit) container size and relayout so the page scales to fill —
  reuse the responsive reinit path, preserve current page (V17). Fullscreen sizing uses BOTH axes:
  canvas height = `container.offsetHeight - toolbarHeight` (not the width-derived auto height, which
  leaves a black void below — B12); reserve the docked toolbar's height (captured before reinit
  removes it) so the bar never clips. On exit, revert to normal auto/config height. Document/native
  mode is exempt (V18): reflows via CSS `max-width:100%`, MUST NOT reinit. A `:fullscreen` CSS rule
  (I.css) forces the container to `100vw/100vh` and centers the canvas (`margin:auto`) so a portrait
  page letterboxes in the bg color, not black; dimensions are measured after a DOUBLE rAF so the
  fullscreen relayout has committed on high-DPI displays (B13). Because the relayout REBUILDS the
  toolbar mid-fullscreen (no fresh `fullscreenchange` for the new button), the fullscreen button's
  label MUST be initialised from the current fs state, not a fixed default (B14). Cites
  I.wp,I.controls,I.css (see B10,B12,B13,B14).
- **V23. Color options: transparent-capable, unset-preserving.** flipbook `background_color` (fill
  around pages) + `box_color` (fill behind each page) accept a hex OR the literal `transparent`;
  default is `transparent` (host page shows through). Admin sanitize MUST leave an empty field UNSET
  (omit the key) so the plugin default applies via `array_merge` and a future default change still
  reaches those rows — MUST NOT materialize empty→a concrete color. The library MUST NOT paint a
  transparent fill: `show_bg_1` clears the canvas (no smear), `show_bx_1`/`show_empty_1` skip when the
  color is `''`/`transparent`. `normalizeColor` maps undefined/null/`''` → fallback `#353535` (bare-lib
  / legacy empty-string rows read grey until re-saved), any other value used as-is (see B15). Fullscreen
  bg is exempt — the `:fullscreen` CSS forces `#353535` regardless (V22). Cites I.php,I.admin,I.index,I.flip.
- **V24. Canvas dimensions derive from container + page aspect; empty means fill.**
  `calculateDimensions` (I.wp): width of `''`/`'auto'`/`'100%'`/any non-numeric → `container.offsetWidth`
  (fill), NOT `parseInt('')===NaN` → the library's 800px fallback (B16). Height of `''`/`'auto'`/non-
  numeric → derived from page-1 aspect so the canvas exactly wraps the content — `height = width ×
  (pageH / (pageW × pagesAcross))` — giving edge-to-edge, no letterbox, centered; NOT a fixed 600
  that caps the spread width on wide containers. CRITICAL (B17): `pagesAcross` keys off
  `bookObj.numPages()===1` (genuine single-page book → 1), NOT the `single`/`double` `layout` string.
  The flipbook LIBRARY always renders a 2-page spread — it has no one-page-at-a-time mode; the layout
  string drives only this calc + the ResizeObserver, never the renderer. Keying `pagesAcross` off
  `layout` sized a TALL single-page canvas for the wide spread the library actually draws whenever the
  container fell just under the breakpoint (auto→'single'), letterboxing the spread with large vertical
  dead space. So a multi-page book is ALWAYS a spread box (pagesAcross=2, matches `calcLayoutParameters`
  `pg.width*2`); only a 1-page book is one page wide. Page-1 aspect is fetched ONCE after load (getPage
  caches → reused by first render), stored on `viewerData.pageAspect`, threaded into reinit. In
  fullscreen both axes clamp to the screen box (`width ≤ innerWidth`; height = `offsetHeight −
  toolbarHeight`) so neither overflows (V22). No aspect (fetch failed) → 600 fallback. The container
  CSS defaults to `width:100%` + `align-items:center` so it fills its parent and centers a narrower
  canvas even with no inline width. Cites I.wp,I.css.
- **V25. Admin free-value fields are unset-preserving (blank → default, never materialized).**
  Every non-enumerated admin option (`width`,`height`,`background_color`,`box_color`,`box_border`,
  `margin`,`breakpoint`) MUST: (a) sanitize an empty/whitespace field by OMITTING the key so the
  plugin default applies via `array_merge` and a future default change reaches unset rows — MUST NOT
  store `''`/`0`/a concrete default (B15 color, B16 width); (b) render an EMPTY input when the key is
  unset (never pre-fill the default value, which would be saved and freeze it) with a `placeholder`
  showing the resolved default. `margin_top`/`margin_left` (shortcode-only, no UI) already store
  `null` on empty. Enumerated selects + booleans (`layout`,`book_layout`,`view_mode`,
  `enable_animations`,`default_show_controls`) are exempt. Generalizes V23's color-specific rule to
  all free-value fields. Cites I.admin,I.php.
- **V26. Delivered asset names reflect concern, not one entry point.** The viewer bundle =
  ALL 3 render engines (flip + native + image, routed by `src/index.js`), NOT flip-only →
  built artifact named `dist/bws-viewer-engines.js` (was `flipbook-viewer.js`, misleading: name
  said flip, held 3 engines → reader greps "why native in flipbook file?", B18). ⊥ name a
  multi-engine bundle after one engine. Distinct from WP-layer `includes/bws-pdf-viewer.js`
  (integration glue) & Mozilla `dist/pdf.js` (PDF.js lib) — 3 delivered JS, 3 concerns, no
  name overlap. UMD global still `flipbook` (legacy; rename = separate churn, FW-6). On any
  future asset rename: sweep PHP enqueue + test harnesses + `scripts/package.mjs` + docs, rebuild
  (webpack `clean:true` drops old file), changelog. Cites I.index,I.php (the PDF.js double-bundle is tracked as FW-13).

- **V27. Toolbar roving-focus never strands focus.** The toolbar is ONE Tab stop (WAI-ARIA
  toolbar / roving tabindex): exactly one control has `tabindex=0`, the rest `-1`; arrows move
  focus within, Tab exits to the next page element. Three anti-stranding rules the naive roving
  impl broke: (a) the `tabindex=0` anchor MUST sit on the first ENABLED control, not the first DOM
  control — a disabled control (Prev on page 1) with `tabindex=0` is skipped by the browser,
  making the WHOLE toolbar unreachable by Tab until arrow nav moved the index (B19); re-anchor when
  disabled state changes (`updateCounter`), but ONLY while focus is outside the toolbar so a
  keyboard user mid-nav is never yanked. First/last-page buttons (V30, when shown per V6) join this
  roving order in DOM sequence (first ⇤ | prev | page-nav | next | last ⇥) and obey the same
  skip-disabled rule — First disables at page 1, Last at page_count. (b) The container's
  click→`container.focus()` (for viewer
  keyboard paging) MUST skip clicks originating inside `.bws-pdf-viewer-controls`, else clicking the
  page-input instantly steals its focus and it can't be typed into (B20). (c) The page-input's
  Left/Right/Home/End exemption MUST be caret-aware — the input owns an arrow only while the caret
  can still move that way; at the text boundary the arrow falls through to toolbar nav, so the input
  never traps keyboard navigation (B21). `focusAt` also skips disabled controls when arrowing. Cites
  I.controls,I.wp,V10 (see B19,B20,B21).

- **V28. Flipbook paginates by SPREADS; slot↔page mapping lives in ONE place.** The flipbook
  library renders spread `s` from display slots `2s`,`2s+1` and has NO one-page mode (V24/B17); how
  those slots pack into real PDF pages depends on layout, and that packing is owned solely by the
  book wrapper (`createBookWrapper`, I.wp), which MUST expose: `numPages()` (real pages, for the
  counter), `numSpreads()` (view count), `slotToPage(slot)` (→ 0 for a blank/filler), and
  `pageToSpread(page)`. Two packings: TRADITIONAL (≥3 pages) — slots `[p1,blank,p2,p3,…]`, cover p1
  alone in spread 0, `ceil((N+1)/2)` spreads; PLAIN — slots `[p1,p2,p3,…]` two-up, `ceil(N/2)`
  spreads. The cover offset applies ONLY at `numPages()>=3` (a 2-page traditional book is a single
  `[p1|p2]` plain spread, NOT `[p1|blank]`+`[p2|filler]` — B22). Every consumer of navigability MUST
  derive from spreads, never raw page count: the library's `flip_forward` guard blocks at
  `showNdx >= numSpreads()-1`, `goToPage` clamps to `numSpreads()-1` and maps via `pageToSpread`, the
  WP nav-visibility gate shows prev/next only when `numSpreads()>1` (so a 2-page book has NO
  navigation — B23), and `slotToPage` for the counter delegates to the wrapper. A genuine 1-page book
  forces `pagesAcross=1` so the box, `calcLayoutParameters`, and `centeredHalf` all draw it full-width
  (⊥ half-width lone page — B22). ⊥ any code path that infers spread count or slot identity from
  `numPages()` alone. Cites I.flip,I.wp,I.controls,V24 (see B22,B23).

- **V29. Flipbook auto-height fits inside an ancestor's ceiling.** When a flipbook's height is
  auto-derived (V24: container width × page aspect), the resulting canvas MUST NOT overflow a
  vertical ceiling imposed by an ancestor (`max-height`, or a fixed inline `height`). `calculateDimensions`
  reads the ceiling via `availableHeight(container)` — walk container→ancestors (stop before `<body>`),
  take the smallest resolved computed `max-height` / inline `style.height` (px/vh/% → px; a `%` needs a
  determinate parent height else skip); NEVER trust computed `height`, which is always a resolved px
  value and so cannot distinguish an author cap from a laid-out auto box. If the derived height exceeds
  the ceiling (minus a toolbar reserve when controls show), cap the height AND scale the width by the
  same ratio so the spread aspect holds — the page keeps filling the canvas width (⊥ side whitespace,
  B22) and the narrower canvas centers via `align-items:center` (I.css). Applies to flipbook + non-fullscreen
  only: document (native/image) modes scroll all pages (a height cap would clip content), and fullscreen
  already sizes to the screen box (V22). Cites I.wp,I.css,V22,V24 (see B24).

- **V30. Toolbar buttons carry PDF.js icons; icon-only buttons stay named.** Toolbar controls
  render an inline SVG glyph adopted from PDF.js (`pdfjs-dist/web/images/*`, Apache-2.0 — reuse, ⊥
  hand-draw, V9/V15 spirit): prev/next, first/last, download, print, presentationMode(=fullscreen).
  SVG inlined into the WP layer as a `currentColor`-filled string (⊥ enqueue as separate asset /
  cross-origin fetch — V35; ⊥ hardcoded `fill` — glyph MUST inherit
  toolbar text color so it themes + meets AA contrast, V10). Each icon SVG MUST be
  `aria-hidden="true"` + `focusable="false"` so the SR reads the button, not the glyph. Button text
  policy: Prev/Next = icon **+ text** (primary, most-used); Fullscreen/Print/Download/First/Last =
  **icon-only** and THEREFORE MUST carry BOTH an `aria-label` (SR name) AND a `title` (mouse tooltip)
  — an icon-only control with no accessible name is a WCAG name-role-value fail. ≥24×24px target
  (V10) holds: 16px glyph + padding. Cites I.controls,I.css,V9,V10.
- **V31. Toolbar docks by presentation mode, via real DOM order.** Document/flow mode
  (`config.singlepage===true` — continuous stack) docks the toolbar
  ABOVE the pages (`insertBefore(container.firstChild)`); flip/book/spread mode
  (`singlepage===false`) docks it BELOW (`appendChild`, prior behavior). Position MUST move the real
  DOM node, ⊥ CSS `order`/`column-reverse` — DOM order IS reading + Tab order (V27); a CSS-only flip
  desyncs visual from SR/keyboard traversal. The V22 fullscreen relayout rebuilds the toolbar; the
  rebuild MUST re-apply the mode-correct dock. Cites I.controls,I.css,V27.
- **V32. Download control emits the source PDF; gated by its own flag.** Download button (icon-only,
  V30) present in ALL modes (unlike page-nav — V6 — download is meaningful even for a 1-page/continuous
  doc), triggers a download of `config.pdf` (URL already resolved by the shortcode handler; ⊥ re-fetch
  cross-origin — reuse the loaded source). New shortcode att `show_download` (default true) follows
  the full 3-tier precedence + admin plumbing of `show_print`/`show_fullscreen` (V5,V8): `$default_options`
  → `shortcode_atts` → `$config` → `initViewer` → `addNavigationControls` gate, + an admin field
  (I.admin). Adds `show_download` to the V8 att surface. Cites I.controls,I.php,I.admin,V5,V8,V30.

- **V33. Counter shows the spread's visible page RANGE, independent of the gating number.** The
  read-only page counter reports the real pages VISIBLE in the current spread: `N–M of T` (en-dash)
  when both halves are real pages, collapsing to a single `N of T` when only one half is real (a
  traditional cover, a trailing-odd final page, a genuine 1-page book, or any spread with one blank
  half). T = `page_count` (real pages). The displayed range is derived from the current spread's two
  display slots via the wrapper's `slotToPage` (V28) — `onSeen` emits left slot then right slot per
  spread, so BOTH are captured to form `[N,M]`, not just the rightmost. CRITICAL: this range is a
  DISPLAY concern ONLY and is computed separately from the internal `currentPage`, which STAYS equal
  to the rightmost real page of the spread so the edge-disable gating (`currentPage >= page_count`
  disables Next/Last; `<= 1` disables Prev/First) is unchanged — the counter never lies about what is
  on screen, and the gating never under-reads on the final spread (the reason rightmost exists — see
  V28 note, old B23 rationale). Distinct from PDF.js's own viewer, which shows the leftmost page and
  lets the counter lag the spread — deliberately NOT followed. Document/continuous mode has no
  page-nav (V6) so no range. Cites I.controls,I.wp,V6,V11,V28.

- **V34. Print emits the PDF, never the host page.** The Print button (V30) MUST print the document
  itself, ⊥ `window.print()` — that prints the whole theme page around a canvas-only viewer (B25, 2026-10-30: the dialog printed the host page, the PDF squeezed onto page 1).
  Source = `wrapper.pdf.getData()`, the bytes PDF.js already fetched: wrapped in a `blob:` URL it is
  same-origin with the page even when the PDF host is not (the portal case), so a hidden `aria-hidden`
  iframe on that URL is scriptable and `contentWindow.print()` hands off to the browser's native PDF
  viewer (vector, all pages, real paper size). ⊥ iframe on the raw `config.pdf` (cross-origin →
  `SecurityError`), ⊥ server proxy (open-proxy/SSRF surface), ⊥ canvas re-render. Fallback ladder, each
  rung only if the one above throws: iframe print → open the blob in a new tab → open `config.pdf` in
  a new tab (`getData` unavailable/rejected). The blob + iframe are freed after a long delay (Chrome's
  PDF plugin fires no dependable `afterprint`), except when the blob went to a tab. Known gap: a
  browser whose `print()` silently no-ops without throwing (mobile Safari) gets no fallback. Cites
  I.controls,I.wp,V30,B25.

- **V35. Source and asset URLs track the current domain.** The plugin runs on several domains, and a
  host may rewrite `the_content` to another origin. The PDF source goes through the plugin's
  URL-rewriting integration point; every enqueued asset URL is built with `plugin_dir_url()`. Where a
  host rewrites content but not enqueued assets, the `bws_pdf_viewer_plugin_url` filter lets it align
  the asset origin. Cites I.php.
  _Rejected:_ hardcoding any domain. The failure it prevents is a cross-origin `SecurityError`
  loading `pdf.worker.js` when content was rewritten to another origin and assets were not.

- **V20. [deferred] Site-wide mode disable not built.** `disabled_modes` default exists in
  `bws-pdf-viewer.php` but no admin UI renders/sanitizes it; `view_mode` is single-select (pick
  one — neither document nor flipbook is individually disableable). If per-mode enable/disable
  ships (T-future), admin MUST keep ≥1 of document/flipbook enabled. Cites I.admin.
