# PDF.js Reuse Menu for the Native Core

> **Reference only — a menu, not a decision.**
>
> Wayfinder ticket **#18**: what does `pdfjs-dist` actually offer for our native
> core, and how does our own Canvas-2D flip overlay mesh with each reuse option?
> This charts the options with costs/benefits so the engine pick (**#14**) is
> answerable. It decides nothing — see [What this does NOT decide](#what-this-does-not-decide).
>
> Version-stamped against **pdfjs-dist 6.1.200**
> (`node_modules/pdfjs-dist/package.json`). All `pdf_viewer.mjs` /
> `pdf_viewer.css` line numbers are into that installed version.
>
> Prior art this reassesses: [ADR-0002](../adr/0002-no-full-pdfjs-viewer.md)
> rejected the full prebuilt `viewer.html` app (chrome/toolbar/theming clash,
> update-surface coupling) and fixed us at "components only". **ADR-0002 is not
> a fixed decision** — like ADR-0003 it predates the convergence reframe and is
> open to reassessment under this map; every rung here, including the full app,
> is weighed on current evidence, not by ADR fiat. Everything between
> "builders" and "full app" was never evaluated — that dial is exactly what
> this doc charts, under the reuse-first rule of
> [ADR-0001](../adr/0001-reuse-first.md). Target architecture the menu
> must serve: [viewer-convergence.md](../design/viewer-convergence.md)
> (persistent accessible native core + transient flip overlay, Architecture A).

## What `pdfjs-dist/web/pdf_viewer.mjs` exports

The single components bundle exports (line 9793): `AnnotationLayerBuilder`,
`DownloadManager`, `EventBus`, `FindState`, `GenericL10n`, `LinkTarget`,
`PDFFindController`, `PDFHistory`, `PDFLinkService`, `PDFPageView`,
`PDFScriptingManager`, `PDFSinglePageViewer`, `PDFViewer`, `ProgressBar`,
`RenderingStates`, `ScrollMode`, `SimpleLinkService`, `SpreadMode`,
`StructTreeLayerBuilder`, `TextLayerBuilder`, `XfaLayerBuilder`,
`parseQueryString`. Raw ESM sizes: `pdf_viewer.mjs` 313 KB,
`pdf_viewer.css` 163 KB (webpack tree-shakes the mjs; the css does not shrink
itself). For comparison, our entire shipped engines bundle —
flip + native + image + the four builders we already use — is 188 KB minified
(`dist/bws-viewer-engines.js`).

---

## 1. The reuse dial

Reuse is a dial, not a switch. Rungs, lowest to highest:

### (a) Today: raw canvases + builders (shipping)

`src/nativepageviewer.js:4-9` imports only `TextLayerBuilder`,
`AnnotationLayerBuilder`, `PDFLinkService`, `EventBus`. We own the page `div`s,
the `<canvas>` (`renderCanvas`, `nativepageviewer.js:293-320`), the scale
(`setupContainer`, lines 148-158), lazy load/teardown (two
`IntersectionObserver`s, lines 192-243, plus `cleanupDistantPages`, lines
356-387), and we hand `PDFLinkService` a minimal `viewerShim`
(`createLinkService`, lines 85-111). We set `--scale-factor` per page container
ourselves (line 259) because the v6 text layer positions spans off it.

- **Buys:** correct text-layer/annotation-layer internals (the fragile part)
  with zero DOM/CSS impositions; smallest bundle slice; total layout control.
- **Costs:** we maintain scale math, HiDPI transform, render/cancel lifecycle,
  zoom (none today), canvas-size limits (none today — see rung (b)), and the
  link-service shim by hand.
- **Responsive reflow:** not native — one scale computed once from container
  width; no re-render on resize (document mode reflows only via CSS
  `max-width:100%`, `includes/bws-pdf-viewer.js:868-873`).

### (b) + `PDFPageView` per page

Standalone per-page component, officially supported this way — Mozilla's
"pageviewer" components example constructs
`new PDFPageView({ container, id, scale, defaultViewport, eventBus })`, then
`setPdfPage(pdfPage)` + `draw()`
(<https://github.com/mozilla/pdf.js/blob/master/examples/components/pageviewer.mjs>).
What it manages (types: `node_modules/pdfjs-dist/types/web/pdf_page_view.d.ts`):

- Its own `div.page` (`pdf_viewer.mjs:6563`) exposing `.div`, `.viewport`,
  `.scale`, `.width`/`.height`, `getPagePoint(x,y)`.
- All layers in fixed z-order — `canvasWrapper` 0, `textLayer` 1,
  `annotationLayer` 2, `annotationEditorLayer`/`xfaLayer` 3
  (`pdf_viewer.mjs:6502`) — replacing our hand-appended builder divs.
- Lifecycle: `reset({keep*Layer})`, `update({scale, rotation, drawingDelay})`,
  `cancelRendering()`, `destroy()`, and `cssTransform()` — cheap CSS-only
  re-zoom with deferred re-raster (`drawingDelay`), which we have no equivalent
  of today.
- Standalone mode sets `--scale-factor` on its container itself
  (`pdf_viewer.mjs:6979`), retiring our manual line 259.
- Canvas-limit machinery we currently lack entirely: `maxCanvasPixels`
  (default 4096×8192 = 32 MP), `maxCanvasDim` (32767), `capCanvasAreaFactor`
  (200% of viewport) with a `detailView` overlay canvas when zoom exceeds the
  cap (`types/web/pdf_viewer.d.ts:88-112`; detail canvas insertion
  `pdf_viewer.mjs:5491-5504`). PDF.js also force-caps to ~5 MP on iOS/Android
  (`pdf_viewer.mjs:4459-4462`) — silent blank-canvas failures on mobile Safari
  are a real bug class our raw canvases can hit.
- HiDPI via `OutputScale` (reads `globalThis.devicePixelRatio`,
  `build/pdf.mjs:1484-1519`, with `limitCanvas` clamping) — replaces our manual
  `outputScale` transform (`nativepageviewer.js:294-304`).

- **Buys:** zoom/update lifecycle, canvas-size safety, layer wiring, struct-tree
  (a11y) layer plumbing, upstream bug-fix surface for all of it.
- **Costs:** must ship the `pdf_viewer.css` rules for `.page`, `.canvasWrapper`,
  `.textLayer`, `.annotationLayer` (subset extraction from 163 KB, or the whole
  file); moderate bundle growth (PDFPageView + BasePDFPageView + detail-view +
  OutputScale graph — order tens of KB minified, vs the builders we already
  pull); our two IntersectionObservers and page containers remain ours.
- **Responsive reflow:** not native, but `update({scale})` per view makes our
  reflow loop a one-liner per page instead of teardown/re-render.
- **Toolbar clash:** none. No UI at this rung.

### (c) `PDFSinglePageViewer`

A thin subclass of `PDFViewer` that hard-forces one-page-at-a-time: it overrides
the `scrollMode`/`spreadMode` setters to no-ops
(`types/web/pdf_single_page_viewer.d.ts:1-7`). Everything under rung (d)
applies (container contract, buffer, queue) but with spreads *unavailable* —
which kills the convergence requirement of responsive 2-up
(`viewer-convergence.md` "Responsive spread in native mode"). Listed for
completeness; it is dominated by (d) with `scrollMode: PAGE`.

### (d) `PDFViewer` with scrollMode/spreadMode

The whole document-level machine (`types/web/pdf_viewer.d.ts`). Enum values
(`pdf_viewer.mjs:235-247`, also `types/web/ui_utils.d.ts:220-244`):

- `ScrollMode`: `UNKNOWN:-1, VERTICAL:0, HORIZONTAL:1, WRAPPED:2, PAGE:3`
- `SpreadMode`: `UNKNOWN:-1, NONE:0, ODD:1, EVEN:2`

What it buys:

- **Rendering queue + page buffer.** `setDocument` creates a `PDFPageView` per
  page up front (`pdf_viewer.mjs:8519-8546`; lazy init only past
  `PagesCountLimit` = 250/5000/10000 pages, lines 7915-7919), but *renders*
  only visible pages: `update()` resizes a `PDFPageViewBuffer` to
  `max(10, 2*visible+1)` and evicted views are destroyed
  (`DEFAULT_CACHE_SIZE=10`, lines 7914, 9126-9134); the queue renders visible
  pages first, then holes, then pre-renders one page in the scroll direction
  (`getHighestPriority`, from line 7784). This is the official answer to the
  FAQ's many-canvas memory ceiling — "The demo viewer creates, renders, and
  holds canvases only for visible pages… Our recommendation is to create and
  render only visible pages"
  (<https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions>).
  Functionally equivalent to our IntersectionObserver + distance-5 teardown —
  theirs is scroll-driven `getVisibleElements` geometry, ours is observer
  callbacks; neither is a capability gap, both are a maintenance transfer.
- **Zoom machinery.** `currentScaleValue` accepts numeric or preset
  `"auto" | "page-width" | "page-fit" | "page-actual"`; presets compute from
  `container.clientWidth/Height` (`#setScale`, `pdf_viewer.mjs:8928-8968`),
  halving per-page width when a spread is active (`#pageWidthScaleFactor`
  returns 2, lines 8922-8927). Plus `updateScale/increase/decreaseScale` with
  pinch-zoom support and scale-anchored scrolling.
- **Spread DOM.** In `ScrollMode.PAGE`, `#ensurePageViewVisible`
  (lines 8768-8812) rebuilds the viewer with either one `pageView.div` or a
  `div.spread` holding the pair — parity from `SpreadMode.ODD/EVEN`. That is a
  ready-made 2-up "book" resting state.
- Free riders: `PDFFindController` (in-viewer search), `PDFHistory`,
  struct-tree a11y, full link-service integration (no shim).

What it costs:

- **Hard DOM/CSS contract.** Constructor *throws* unless the container is
  absolutely positioned (`"The container must be absolutely positioned."`,
  `pdf_viewer.mjs:8019`) and demands `container > viewer` div nesting
  (lines 8013-8020). It owns scrolling, `--scale-factor` on the viewer element
  (lines 8511, 8878), `--viewer-container-height`, and expects
  `pdf_viewer.css` (`--scale-factor:1` default at css:6186;
  `--total-scale-factor` calc at css:6239; absolutely-positioned text layer,
  css:615-660). This collides with our container-responsive, shortcode-embedded
  layout (ADR-0003): a WordPress content column is not an absolutely-positioned
  scroll host, so we'd wrap every instance in a positioned frame — workable in
  `contain` mode, awkward in `flow` mode (viewer-convergence containment axis).
- **Loss of control.** It owns current-page tracking, scroll position, and page
  DOM order; our toolbar becomes a client of its EventBus rather than of our
  viewer object; `createBookWrapper`'s slot/spread mapping
  (`includes/bws-pdf-viewer.js:1245`, SPEC V28) duplicates its spread logic.
- **Bundle.** Most of the 313 KB module graph survives tree-shaking once
  `PDFViewer` is imported (viewer + page view + queue + find + l10n; the
  embedded English l10n blob alone, `pdf_viewer.mjs:3873`, is ~25 KB).
- **Toolbar clash:** none at this rung — `PDFViewer` itself ships no toolbar;
  the clash begins at (e).
- **Responsive reflow:** partial — see §2.

### (e) Full generic viewer app (`viewer.html`)

The whole Mozilla app: toolbar, sidebar, dialogs, keyboard map, l10n. On
current evidence it stays unattractive on its own merits — direct clash with
our WCAG-2.2-AA shared toolbar (SPEC V9, ADR-0001 "exactly one toolbar") and
our theming; iframe/asset coupling breaks the portal cross-origin setup
([[portal-asset-origin-mismatch]]); everything the app adds beyond rung (d) is
UI we currently own by contract. ADR-0002 recorded the same call, but that ADR
is reassessable, not binding — if #14 finds the toolbar/portal constraints have
moved, this rung is choosable and ADR-0002 gets superseded. Listed with full
costs so that call is on evidence, not fiat.

---

## 2. Responsive reflow

**No rung reflows scale natively.** Verified in source: `PDFViewer` *does* own
a `ResizeObserver` (`pdf_viewer.mjs:7997`, observes the container at 8021), but
its callback only refreshes the `--viewer-container-height` CSS var and cached
`containerTopLeft` (`#resizeObserverCallback`, lines 9613-9621) — it never
touches scale. Re-scaling on resize is the *application's* job: the official
app's `onResize` reassigns `currentScaleValue` when it is
`"auto" | "page-fit" | "page-width"` and calls `pdfViewer.update()`
(<https://github.com/mozilla/pdf.js/blob/master/web/app.js>, `onResize`); the
components "simpleviewer" example likewise sets
`currentScaleValue = "page-width"` once on `pagesinit`
(<https://github.com/mozilla/pdf.js/blob/master/examples/components/simpleviewer.mjs>).

So at rung (d), reflow = our existing per-container `ResizeObserver`
(ADR-0003; `setupResponsiveBehavior`, `includes/bws-pdf-viewer.js:865-947`)
firing `viewer.currentScaleValue = "page-width"` — two lines, and the viewer
does the per-page `update({scale})` + debounced re-raster (`drawingDelay`)
itself.

In today's thin core, reflow costs more: `setupContainer` computes exactly one
scale from `container.getBoundingClientRect().width` at init
(`(containerWidth - 40) / viewport.width`, `nativepageviewer.js:148-158`) and
nothing ever recomputes it — rendered pages keep their pixels and only shrink
via CSS. True reflow at rung (a) means re-running the scale, walking loaded
containers, cancelling builders, re-rendering canvas + layers. At rung (b) it
is the same walk but each step is `pageView.update({scale, drawingDelay})`.

**Spread↔single auto-switch: none, at any rung — verified.** `spreadMode` only
changes when its setter is assigned (`pdf_viewer.mjs`, `_updateSpreadMode`);
nothing reads container width to pick a spread mode. The `page-width` preset
merely *accounts* for an active spread (factor 2, lines 8922-8927). The
breakpoint decision (`width >= config.breakpoint ? 'double' : 'single'`,
`includes/bws-pdf-viewer.js:312, 932`) stays ours on every rung — with
`PDFViewer` it becomes `spreadMode = width >= bp ? SpreadMode.ODD :
SpreadMode.NONE` from our observer.

---

## 3. Continuous AND flipbook as distinct modes

Both are required products (SPEC V1 modes; convergence keeps both as
containment/arrangement/transition combinations). Can one native core serve
both?

- **Rung (a)/(b) — yes, ours already half-does.** Continuous scroll is the
  shipping native mode (`goToPage` = `scrollIntoView`,
  `nativepageviewer.js:53-62`; lazy render via IntersectionObserver). A
  contained book arrangement is the same page substrate laid out as 1-2
  absolutely-placed pages in a fixed box — at rung (b), literally two
  `PDFPageView.div`s side by side. One core, two layout wrappers.
- **Rung (d) — yes, natively, via mode flip:** `scrollMode: VERTICAL` +
  `spreadMode: NONE` is continuous; `scrollMode: PAGE` + `spreadMode: ODD` is a
  contained 2-up book resting state (`#ensurePageViewVisible` builds the
  `div.spread` pair, `pdf_viewer.mjs:8768-8812`), and `nextPage()/previousPage()`
  already honor spreads (`types/web/pdf_viewer.d.ts:509-514`). The substrates
  do not diverge — it is one `PDFViewer` with two property settings.
- **Perf ceiling.** Continuous many-canvas memory is the known PDF.js hazard
  (FAQ: a letter page is ~3.4 MB of canvas at 96 DPI before DPR², so "render
  only visible pages" —
  <https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions>). Both
  candidate mechanisms respect it: `PDFViewer`'s buffer holds
  `max(10, 2*visible+1)` views and destroys evictions (`pdf_viewer.mjs:9133`);
  ours holds ~11 (distance > 5 teardown, `nativepageviewer.js:357`). Neither
  side wins on capability; `PDFViewer` wins on not-maintaining-it, plus the
  per-canvas pixel caps of rung (b) which our version lacks.

**Where mode selection lives — unchanged by any rung.** The router owns it:
`src/index.js:42-79` picks native/image/flip off `opts.singlepage` +
`opts.nativeMode`; WP computes those from config + device
(`initViewer`, `includes/bws-pdf-viewer.js:261-313`). Under convergence the
router still picks, just along the containment/arrangement/transition axes;
a rung-(d) core would map arrangement → `spreadMode` and containment →
`scrollMode` inside one engine instead of swapping engines.

---

## 4. Flipbook interactivity — clickable page edges/corners

We own the warp (`src/flipbookviewer.js`), so hit-testing is our canvas
geometry, not a library feature. What exists and what's needed:

- **Geometry is already explicit.** `ctx.layout = {top, left, mid, width,
  height}` (`calcLayoutParameters`, `flipbookviewer.js:217-223`);
  `calcLayout()` applies zoom/pan (lines 340-360); page rects derive as
  left-half `[left, mid)` / right-half `[mid, right)` (`showPages`,
  lines 406-412). Mouse plumbing exists: `setupMouseHandler` fans events to
  handler objects (lines 233-255), `mousePt` converts client→app coords
  (lines 316-322), `inBox`/`currBox` do rect tests (lines 307-335). Note
  `mousePt` returns CSS pixels while `layout` is in device pixels
  (`outputScale` multiplied, lines 181-196) — edge hit-tests must divide by
  `outputScale` (or multiply the point), a classic off-by-DPR trap.
- **Click-to-turn:** add a `setupFlipZones` handler beside `setupPanning`:
  vertical strips at the outer edges of the current spread box
  (e.g. outer 10-15% of each page's width, full height — StPageFlip
  demonstrates the same model with `disableFlipByClick`, which restricts
  turning to *corner* clicks only: <https://github.com/Nodlik/StPageFlip>).
  Right strip → `viewer.flip_forward()`, left → `flip_back()` (already public,
  lines 126-140). Must not fire during zoom-pan (`ctx.zoom > 0` gates panning
  today, line 270) or mid-flip (`ctx.flipNdx` guard, line 127).
- **Corner drag/scrub:** feasible *because* the warp is progress-parameterized
  — the flip frame is a pure function of `flipFrac` (`showFlip`,
  `flipbookviewer.js:469-668`; production drives it with `animate()` from an
  rAF loop, lines 150-165; the #17 spike drove the same draw fn directly per
  frac, `test/spike-singleflip.js:40-47`). Drag = replace the time-driven
  `animate()` with a pointer-driven one: on pointerdown in a corner zone
  (corner = edge strip ∩ top/bottom band, like StPageFlip's
  `flipNext(corner: 'top'|'bottom')`), set `ctx.flipNdx`, then map pointer x →
  `flipFrac` as `clamp((edgeX - x) / pageWidth, 0, 1)` relative to `layout.mid`
  and the gripped page's rect, calling the draw per pointermove; on release,
  animate from current frac to 0 or 1 by velocity/threshold. The overlay must
  therefore expose: `beginFlip(direction)`, `renderFrame(t)`, and
  `settle(toEnd, cb)` — exactly the progress-parameterization the convergence
  doc already mandates for testability (`viewer-convergence.md`
  "progress-parameterized animation"). This was the decisive StPageFlip spike
  finding: its curl is un-scrubbable ([[flip-overlay-spike-results]]); ours is
  scrubbable by construction.

None of this depends on the PDF.js rung — the zones live on the overlay/flip
surface. The rung only decides *what geometry feeds the zones* (§5).

---

## 5. Overlay mesh — pixel-accurate seam per rung

Convergence Architecture (A) needs a transient flip canvas positioned exactly
over the resting native page(s), matching at t=0 and t=1
(`viewer-convergence.md`, "the hard 20%").

- **Rung (a) — easiest.** All geometry is ours: page containers we created,
  one scale we computed (`ctx.scale`), canvas CSS size we set to
  `floor(viewport.width) px` (`nativepageviewer.js:297-300`). Overlay = one
  absolutely-positioned canvas over `getBoundingClientRect()` of the target
  container(s); snapshot via `drawImage(existingCanvas, …)`. Risks are only
  the ones we make ourselves (the flooring above already drops fractional
  pixels — overlay must copy the same rounding).
- **Rung (b) — nearly as easy, slightly more formal.** `PDFPageView` exposes
  `.div`, `.viewport`, `.scale`, `.width/.height`, and `getPagePoint()`
  (`types/web/pdf_page_view.d.ts:135-158, 224-226`); rect = `div.getBoundingClientRect()`.
  One new caution: during `update({scale, drawingDelay})` the view CSS-zooms
  the *old* canvas first and re-rasters later (`cssTransform`,
  `pdf_viewer.mjs:6982-7000`), and past the pixel caps a `detailView` canvas
  overlays the base canvas — a snapshot taken mid-update or of a capped page
  can be blurrier than the settled state. Rule: snapshot only at
  `RenderingStates.FINISHED`, from the composited `div`, not a specific canvas.
- **Rung (d) — hardest seam.** The viewer owns the scroll box (absolute
  container, its own scrollTop), sets `--scale-factor` globally
  (`pdf_viewer.mjs:8511, 8878`), may swap page DOM under you
  (`#ensurePageViewVisible` does `viewer.textContent = ""` and re-appends,
  lines 8775-8809 — the *entire resting DOM is rebuilt on every page change*
  in PAGE mode, which is precisely the moment the overlay must hold steady),
  and debounces re-raster after zoom. The overlay must sit in the scroll
  frame, track `scalechanging` events, and treat page rects as volatile.
  Doable — rects are still just `getBoundingClientRect()` — but the seam
  invariants (t=0/t=1 pixel match, `viewer-convergence.md` testability list)
  now depend on PDF.js's internal timing instead of our explicit state.
- **HiDPI alignment.** Both cores rasterize at `devicePixelRatio`: flip core
  `outputScale` (`flipbookviewer.js:7`), native mode
  (`nativepageviewer.js:294`), and PDF.js `OutputScale.pixelRatio`
  (`build/pdf.mjs:1517-1519`). Same DPR source, so backing stores agree —
  *except* rung (b)+ clamps DPR when a page exceeds
  `maxCanvasPixels/maxCanvasDim` (`OutputScale.limitCanvas`,
  `build/pdf.mjs:1497-1513`; forced ~5 MP cap on iOS/Android,
  `pdf_viewer.mjs:4459-4462`). An overlay that naively renders at full DPR over
  a capped page will be *sharper* than the resting state and visibly pop at
  settle. Overlay must snapshot the settled canvas pixels (inheriting its
  effective resolution) rather than re-render at its own DPR. Test harnesses
  already pin `deviceScaleFactor: 1` for this reason
  (`viewer-convergence.md` tolerance notes; `test/spike-singleflip.js:32`).

---

## Menu summary

| Rung | Buys | Costs | Reflow | Overlay seam |
|------|------|-------|--------|--------------|
| (a) builders-only (today) | Correct text/annotation layers; total control; smallest bundle | We own scale, HiDPI, lifecycle, canvas caps (currently absent), link shim | Manual (rebuild pages ourselves) | **Easiest** — all geometry explicit |
| (b) + `PDFPageView` | Zoom `update()` lifecycle, CSS-zoom w/ deferred raster, canvas pixel caps + detailView, layer z-order, struct-tree, `--scale-factor` handled | `pdf_viewer.css` subset; tens of KB; page-level only — doc orchestration stays ours | Manual loop, but per page = one `update({scale})` | Easy — `.div`/`.viewport`/`.scale` exposed; snapshot only at FINISHED |
| (c) `PDFSinglePageViewer` | Rung-(d) internals, 1-up forced | scroll/spread setters are no-ops → **no spreads ever** | As (d) | As (d) |
| (d) `PDFViewer` + scroll/spreadMode | Rendering queue + eviction buffer, preset zoom (`page-width` etc.), spread DOM, find controller, full link service | Absolutely-positioned container contract (throws otherwise), owns scroll/DOM/CSS vars, ~most of 313 KB graph, wrapper logic (V28) duplicated | 2 lines from our ResizeObserver (`currentScaleValue` reassign + `update()`); **no auto spread↔single anywhere** | **Hardest** — DOM rebuilt on page change, global `--scale-factor`, debounced re-raster |
| (e) full `viewer.html` app | Everything, incl. UI | Toolbar/theming clash (V9), portal coupling — weakest on current evidence (ADR-0002 agrees but is revisable) | App-level (its own resize handler) | Volatile — app owns all chrome/scroll |

## What this does NOT decide

This is the menu, not the meal. Ticket **#14** (engine pick) still has to
choose: which rung the converged native core sits on, whether the flip overlay
is fed by our warp or a View-Transitions fold (spikes #10/#11/#17 inform that
half), and how the containment/arrangement axes map onto whichever rung wins.
ADR-0002 is not a constraint on that choice — it is a prior decision #14 may
reaffirm, refine, or supersede; any rung above (a) gets a new ADR recording
the pick when #14 decides.
