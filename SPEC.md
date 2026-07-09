# SPEC — BWS PDF Viewer (0.4.6, pre-release / in-flight)

Living ledger. 001-pdf-viewer (viewer core) + 002-integrated-viewer-toolbar (shared toolbar +
PDF.js component adoption) both coded, tested, merged to master.
Distilled from SpecKit tree now archived at `docs/history/speckit/`. `check` diffs code vs §V;
`backprop` appends §B+§V on new bugs. Full rationale/user-stories live in archived SpecKit
artifacts; this file holds durable goals, invariants, debt, bug ledger.
§T is scoped to THIS spec's shipped/in-flight work; future & deferred items (zoom, in-viewer
search, Gutenberg block, PDF.js double-bundle dedup, true single-page flipbook) live in
`docs/IDEAS.md`, resumed individually as their own efforts.

## §G — goal
WordPress plugin embed PDF inline. 3 render modes (flipbook animate / native PDF.js / image
fallback), device-adaptive, one shared integrated toolbar both modes, WCAG 2.2 AA, multi-domain.

## §C — constraints
- **C1.** Reuse-first: evolve working controls logic, no rewrite of proven behavior; own controls
  forbidden where functionality already exists (V9, [[reuse-first-constraint]]).
- **C2.** No full prebuilt PDF.js web viewer (viewer.html / iframe); use maintained *components*
  only (TextLayerBuilder / AnnotationLayerBuilder / link service) (V7, V15).
- **C3.** Container-width responsive via ResizeObserver, NOT viewport — multiple viewers per page
  adapt independently (V3).
- **C4.** PDF source URL through plugin URL-rewriting integration point; no hardcoded domain;
  `plugin_dir_url()` for assets (multi-domain / BWS Portal).
- **C5.** Config precedence 3-tier: `$default_options` → `get_option('bws_pdf_viewer_options')`
  → shortcode atts; merged in `shortcode_handler()` (V5).
- **C6.** PDF.js zero-config webpack: import `pdfjs-dist/webpack.mjs`, worker auto-chunked as
  `pdf.worker.js`, no fake-worker warning.
- **C7.** Shortcode atts change DELIBERATELY, not never (revised 2026-07-09 — supersedes the old
  "frozen for live-site back-compat" rule, which cargo-culted a public-v1.0 discipline onto a
  pre-1.0 internal tool: version <1.0, not on wordpress.org, sole consumer is the BWS portal whose
  shortcodes we generate — no unknown third-party embeds to protect). Rename/remove/repurpose an
  att when it earns its keep; on any change, sweep the portal's own shortcodes first, fix usages,
  note it in the changelog. Additionally: EVERY existing att is up for revision — the current set is
  NOT cemented; review the whole surface before a 1.0 freeze (V8). Cites I.php,I.admin.
- **C8.** PDF.js internals bundled twice (pdf.js + bws-viewer-engines.js, +182KB) — known debt,
  dedup deferred (issue #4, IDEAS #6a, [[pdfjs-bundle-dedup]]).

## §I — surfaces
- **I.index** = `src/index.js` — router: nativeMode→nativePageViewer, singlepage→singlePageViewer, else flipbookViewer.
- **I.flip** = `src/flipbookviewer.js` — animated flipbook; spread layout; `goToPage`; HiDPI outputScale.
- **I.native** = `src/nativepageviewer.js` — PDF.js 3-layer render; IntersectionObserver lazy; memory cleanup ~5-7 pages.
- **I.single** = `src/singlepageviewer.js` — image-based mobile/fallback viewer.
- **I.controls** = `includes/bws-pdf-viewer.js` (`addNavigationControls`/`setupToolbarRovingFocus`/`getStrings`) + `includes/bws-pdf-viewer.css` — shared toolbar, single impl, both modes. (Planned `src/controls.js` never built; toolbar shipped in WP layer.)
- **I.wp** = `includes/bws-pdf-viewer.js` — device detect, mode select, `createBookWrapper`, responsive, keyboard nav.
- **I.php** = `bws-pdf-viewer.php` — shortcode `[bws_pdf]`, `register_assets()`, config merge/precedence.
- **I.admin** = `includes/admin.php` — Settings > BWS PDF Viewer; defaults + mode restrictions + sanitize.
- **I.css** = `includes/bws-pdf-viewer.css` — toolbar overlay, text/annotation layer positioning.

## §V — invariants
- **V1. Three modes, one router.** `src/index.js` selects nativePageViewer (opts.singlepage &&
  opts.nativeMode) / singlePageViewer (opts.singlepage) / flipbookViewer (else). Cites I.index.
- **V2. Hybrid device detection is not tautological.** image ⇐ (touch AND width ≤1024) OR
  width ≤767; native otherwise. `isMobile` MUST combine touch AND width — not restate itself
  (see B1). `force_native` att overrides. Cites I.wp.
- **V3. Container-width layout, not viewport.** ResizeObserver drives single-vs-double; ≥breakpoint
  (768) → spread, < → single. Each instance independent. Cites I.wp.
- **V4. Reduced-motion kills flip/slide.** `prefers-reduced-motion: reduce` ⇒ shouldAnimate=false;
  fade/instant only. Cites I.wp, I.flip.
- **V5. Config precedence honored 3-tier.** defaults→admin option→shortcode; att wins per-key;
  admin default applies only when att absent. `show_controls` MUST follow this (see B6). Cites I.php.
- **V6. Page nav context-dependent; optional controls togglable.** page-nav group (prev/next +
  page-input + "of N" counter) rendered ONLY when navigation is meaningful = flipbook multi-page.
  HIDDEN when meaningless: continuous/document mode (`config.singlepage` true — all pages stacked/
  scrolled) OR single-page file (`numPages()===1`, any mode). When shown, prev/next MAY disable at
  first/last page (edge state). Toolbar bar still renders for fullscreen/print unless `show_controls`
  false; fullscreen/print gated by `show_fullscreen`/`show_print`/`show_controls`. (Amended 2026-07-08,
  issue #8 — reverses old "nav always rendered" rule; toolbar docks at bottom, not floated, so
  scroll-tracking count adds no value.) Cites I.controls,I.php.
- **V7. Native mode uses maintained PDF.js layer builders.** canvas + TextLayerBuilder (selection +
  browser find) + AnnotationLayerBuilder (links) + shared link service; internal links navigate,
  external new-tab. No hand-rolled layer positioning. Cites I.native.
- **V8. Shortcode atts revisable, not frozen (pre-1.0).** Current set: `view_mode`,`layout`,
  `book_layout`,`force_native`,`show_controls`,`show_fullscreen`,`show_print`,`width`,`height`
  (`singlepage` legacy alias for `document`). NONE is cemented — any may be renamed/removed/
  repurposed before 1.0 when justified. On change: sweep the portal's shortcodes, fix usages,
  changelog it (C7). Before a 1.0 freeze, review the WHOLE att surface for vestigial/misleading
  controls. Known vestigial: `layout` (auto/single/double) does nothing in the flipbook renderer
  (which only draws spreads — V24/B17) and is dead in document mode; KEPT for now as the anchor for
  the planned true single-page-flipbook feature (issue #1, IDEAS #5), NOT because it currently works. Cites
  I.php,I.admin,C7.
- **V9. One control-set impl, all modes.** Exactly one toolbar component (I.controls, in WP layer)
  serves flipbook + native; no duplicate control code. Cites I.controls, C1.
- **V10. Toolbar integrated + accessible.** Rendered inside viewer container (overlay bar, not
  detached row); role=toolbar, labelled; every control keyboard-operable; visible focus; ≥24×24px
  targets; AA contrast all states. Cites I.controls,I.css.
- **V11. Page-field commit clamps/restores.** valid num → navigate (flipbook: spread containing
  page); invalid/out-of-range → no nav, restore field (may clamp nearest). Field+count stay synced
  regardless of nav source (button/kbd/field/edge-click). Cites I.controls.
- **V12. Spread page-jump mapping correct.** flipbook `goToPage` maps page# → correct spread display
  index; `onSeen` maps display-index → page# consistently (see B7,B8). Cites I.flip.
- **V13. Native lazy-load + memory cap.** IntersectionObserver ~200px buffer renders on approach;
  keep ~5-7 pages, tear down distant; no unbounded growth on 100+ page docs. Cites I.native.
- **V14. Single concurrent render per page.** in-flight guard: no duplicate concurrent render of
  same page; loading flag set before await, cleared after (see B4,B5). Cites I.native.
- **V15. No full PDF.js viewer / iframe.** components only. Cites I.native, C2.
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
  name overlap. UMD global still `flipbook` (legacy; rename = separate churn, IDEAS #6). On any
  future asset rename: sweep PHP enqueue + test harnesses + `scripts/package.mjs` + docs, rebuild
  (webpack `clean:true` drops old file), changelog. Cites I.index,I.php,C8.

- **V27. Toolbar roving-focus never strands focus.** The toolbar is ONE Tab stop (WAI-ARIA
  toolbar / roving tabindex): exactly one control has `tabindex=0`, the rest `-1`; arrows move
  focus within, Tab exits to the next page element. Three anti-stranding rules the naive roving
  impl broke: (a) the `tabindex=0` anchor MUST sit on the first ENABLED control, not the first DOM
  control — a disabled control (Prev on page 1) with `tabindex=0` is skipped by the browser,
  making the WHOLE toolbar unreachable by Tab until arrow nav moved the index (B19); re-anchor when
  disabled state changes (`updateCounter`), but ONLY while focus is outside the toolbar so a
  keyboard user mid-nav is never yanked. (b) The container's click→`container.focus()` (for viewer
  keyboard paging) MUST skip clicks originating inside `.bws-pdf-viewer-controls`, else clicking the
  page-input instantly steals its focus and it can't be typed into (B20). (c) The page-input's
  Left/Right/Home/End exemption MUST be caret-aware — the input owns an arrow only while the caret
  can still move that way; at the text boundary the arrow falls through to toolbar nav, so the input
  never traps keyboard navigation (B21). `focusAt` also skips disabled controls when arrowing. Cites
  I.controls,I.wp,V10 (see B19,B20,B21).

- **V20. [deferred] Site-wide mode disable not built.** `disabled_modes` default exists in
  `bws-pdf-viewer.php` but no admin UI renders/sanitizes it; `view_mode` is single-select (pick
  one — neither document nor flipbook is individually disableable). If per-mode enable/disable
  ships (T-future), admin MUST keep ≥1 of document/flipbook enabled. Cites I.admin.

## §T — tasks
| id  | st | task | cites |
|-----|----|------|-------|
| T1  | x  | 3-mode router + hybrid device detect | V1,V2,I.index,I.wp |
| T2  | x  | flipbook spread + reduced-motion + HiDPI | V3,V4,I.flip |
| T3  | x  | native PDF.js 3-layer + lazy + memory cap | V7,V13,I.native |
| T4  | x  | image fallback viewer | V1,I.single |
| T5  | x  | shortcode + 3-tier config precedence + admin settings | V5,V8,V20,I.php,I.admin |
| T6  | x  | integrated shared toolbar both modes (002) | V9,V10,I.controls |
| T7  | x  | page-field jump/clamp + sync + spread mapping | V11,V12,I.controls,I.flip |
| T8  | x  | fullscreen hidden-not-disabled + state label | V16,I.controls |
| T9  | x  | keyboard nav (arrows/PgUp-Dn/Space) + focus mgmt | V10,I.wp |
| T10 | x  | URL-fail inline error + link | V19,I.wp |
| T11 | x  | verification harness (test/verify-toolbar.js, harness-toolbar.html) — automated | V9,V11,V12,V27 |
| T12 | x  | ESLint flat config + lint script | . |
| T17 | x  | manual test pass 002 branch (real WP + browser): both modes, a11y/SR, back-compat atts | V9,V10,V11,V13 |
| T18 | x  | PR 002-integrated-viewer-toolbar → master | . |
| T19 | x  | context-aware page-nav hide (continuous mode / 1-page file) + toolbar restyle (#7,#8) — coded 75590fc, headless-verified; final sign-off rides T17 | V6,V10,I.controls,I.css |
| T20 | x  | center lone flipbook page (cover/trailing-odd) — fix show_pgs_1 (#5) — coded 7ca2a31, verified centered; final sign-off rides T17 | V21,I.flip |
| T21 | x  | relayout flipbook on fullscreenchange, document exempt (#6) — coded 760c384/cc54c8c, verified 4K; final sign-off rides T17 | V22,I.wp,I.controls |
| T22 | x  | empty-width viewer collapse fix + aspect-derived height + admin unset-preserving/placeholder all free-value fields (B16,B17) | V24,V25,I.wp,I.php,I.css,I.admin |
| T24 | x  | rename delivered bundle `flipbook-viewer.js`→`bws-viewer-engines.js` (name reflects all-3-engines, not flip-only) (B18) | V26,I.php,C8 |

## §B — bugs
| id | date       | cause | fix |
|----|------------|-------|-----|
| B1 | 2026-07-07 | `isMobile` detection tautology — restated itself, broke hybrid touch+width logic | V2 |
| B2 | 2026-07-07 | fullscreen event listener leaked on responsive reinit (added, never removed) | V17 |
| B3 | 2026-07-07 | responsive reinit fired in document mode (flipbook-only path) | V18 |
| B4 | 2026-07-07 | duplicate concurrent page renders — no in-flight guard | V14 |
| B5 | 2026-07-07 | in-flight guard incomplete — loading flag lifecycle not closed | V14 |
| B6 | 2026-07-07 | `show_controls` precedence broke documented 3-tier model; unchecked state not persisted | V5 |
| B7 | 2026-07-07 | next-button string concat instead of numeric add (page-jump math) | V12 |
| B8 | 2026-07-07 | spread-layout goToPage + onSeen display-index↔page# mapping mismatch | V12 |
| B9 | 2026-07-08 | flipbook lone page (cover/last-odd) drawn in its half-slot, off-center dead space — `show_pgs_1` always pins present page to page_l/page_r; regression vs 001 FR-002 | V21 |
| B10 | 2026-07-08 | fullscreen expands container but canvas keeps pre-fullscreen px size, stuck top-left — layout computed once at init, `fullscreenchange` never relayouts | V22 |
| B11 | 2026-07-08 | B9 fix incomplete — centered on `!pg` but traditional wrapper fills empty half with a blank page object (`num:0`), not null; cover still left-pinned. Fixed via `isRealPage` (`num!==0`) | V21 |
| B12 | 2026-07-08 | B10 fix incomplete — fullscreen relayout used only width; `calculateDimensions` kept auto height (600) so canvas filled width but not height, black void below. Fixed: fullscreen height = offsetHeight − toolbarHeight | V22 |
| B13 | 2026-07-08 | fullscreen canvas undersized on 4K — single rAF read offsetWidth before the fullscreen relayout committed (pre-fs width); no `:fullscreen` CSS so container didn't fill screen → black right of canvas + below toolbar. Fixed: `:fullscreen` CSS (100vw/vh, canvas margin:auto) + double-rAF measure | V22 |
| B14 | 2026-07-08 | fullscreen button label stuck on "Fullscreen" in fullscreen — relayout rebuilds the toolbar mid-fs and no fresh `fullscreenchange` fires for the new button; hardcoded default persisted. Fixed: init label from current fs state | V22 |
| B15 | 2026-07-09 | cleared admin color field stored as "" (old `sanitize_hex_color`), overrode the transparent default via merge, then read as a falsy grey fallback in index.js — page grey despite blank fields + transparent default. Fixed: sanitize omits empty (unset); `normalizeColor`; `color.bx` set; transparent-aware fills | V23 |
| B16 | 2026-07-09 | empty admin width (field cleared → stored "" → overrode PHP `100%` default via merge) collapsed the viewer: PHP emitted broken `style="width: ;"` (flex container shrank to content) AND `calculateDimensions` did `parseInt("")===NaN` → library 800px fallback → narrow, left-pinned; auto height stuck at 600 further capped the spread below full width. Fixed 4-file: JS empty/auto/100%→container width + page-aspect-derived height (edge-to-edge) + fullscreen clamp; PHP omits inline style when width empty; CSS container `width:100%`+`align-items:center`; admin sanitize omits empty width/height/border/margin/breakpoint + renders blank+placeholder (no materialized default) | V24,V25 |
| B18 | 2026-07-09 | delivered viewer bundle named `flipbook-viewer.js` but bundles all 3 engines (flip+native+image via `src/index.js`) — misleading: reader greps "why is native in the flipbook file?", wastes time; native/image invisible in DevTools (no standalone file, all inside the one bundle). Hygiene rename, not runtime bug. Fixed: `dist/bws-viewer-engines.js` (webpack entry key + PHP enqueue + index.html + 3 test harnesses + 3 test JS imports + `scripts/package.mjs` + CLAUDE/README/MEMORY docs); UMD global left `flipbook` (IDEAS #6) | V26 | — `calculateDimensions` keyed `pagesAcross` off the `layout` string (auto→'single' below breakpoint → tall one-page canvas), but the flipbook library ALWAYS renders a 2-page spread (no single-page mode; layout string never reaches the renderer). Wide spread drawn into tall canvas → dead space. Diagnosed from live HTML: `canvas 1440×1851 style 720×925` at 720px container (< 768). Fixed: `pagesAcross` keys off `bookObj.numPages()===1`, so a multi-page book always gets a spread-aspect canvas. Surfaced that `layout` (auto/single/double) is vestigial in flipbook + dead in document mode → C7/V8 revised, T23 (#1) filed | V24,V8 |
| B19 | 2026-07-09 | toolbar unreachable by Tab on load — roving init put `tabindex=0` on the first DOM control (Prev), which is disabled on page 1; a disabled control with `tabindex=0` is skipped by the browser and every sibling was `-1`, so Tab never entered the toolbar until arrow/space nav moved the roving index onto an enabled control. Fixed: anchor `tabindex=0` on first ENABLED control; re-anchor in `updateCounter` on disabled-state change (only while focus outside toolbar); `focusAt` skips disabled. Guard: inv4b | V27 |
| B20 | 2026-07-09 | clicking the page-jump input lost focus instantly (couldn't click-and-type) — container's click handler called `container.focus()` on EVERY click incl. toolbar clicks, which bubbled up and stole focus off the just-clicked input. Fixed: skip the container refocus when the click originates inside `.bws-pdf-viewer-controls`. Guard: inv4c | V27 |
| B21 | 2026-07-09 | page-input trapped arrow keys — roving handler exempted the input from Left/Right/Home/End UNCONDITIONALLY, so once focus reached it those keys could never move back to Prev/Next. Fixed: caret-aware exemption — input owns an arrow only while the caret can still move that way; at the text boundary it falls through to toolbar nav. Guard: inv4d | V27 |
