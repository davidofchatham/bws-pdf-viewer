# Viewer Convergence: One Accessible Core, Flip as a Transition Effect

**Status: parked design — direction agreed in discussion (2026-07-09), not scheduled.**
Companion to [IDEAS.md idea #5](../IDEAS.md#two-axis-mode-taxonomy-proposed) (two-axis
taxonomy); this doc goes further and proposes the target architecture that makes the
full matrix buildable. Supersedes the taxonomy section's framing of `flip` as a
*presentation* — flip is reclassified here as a *transition effect*.

## Motivation: accessibility is a property of the render path, not the mode

Image conversion is the accessibility floor. Rasterizing a page turns text into
pixels: no screen-reader text, no selection, no browser find, no reflow, no tag
semantics — regardless of device. Both the image engine (`singlepageviewer.js`)
and the flipbook lib sit on this floor.

The native PDF.js path (canvas + text layer + annotation layer, as in
`nativepageviewer.js`) is better on **every** device, mobile included: real
selectable text for screen readers and Ctrl+F, keyboard-reachable links. It is
the most accessible option we can ship. Two caveats bound that claim:

1. **Tagged source PDFs still gate structural accessibility.** The text layer
   gives reading-order text; true heading/table/alt semantics need the PDF
   itself to be tagged. Untagged PDF → flat text layer: better than images,
   not WCAG-structural.
2. **Device-native PDF rendering** (the browser/OS viewer on a plain link) can
   exceed PDF.js for assistive-tech users because it hooks OS accessibility
   APIs directly — but it gives up the toolbar, flip, portal handling, and
   cross-domain control. Not our path; noted as the true ceiling.

Consequence already identified: the admin help text crediting *Continuous*
mode with accessibility ("more accessible with better screen reader support",
`includes/admin.php` — option label and description in the view-mode field) is
**backwards-ish**: on mobile, Continuous falls back to the image engine (the
floor). Accessibility belongs to the **native render path**, not the mode name.
Fix the wording when convenient (small, independent change).

## The reframe: three orthogonal choices, one engine

Today's three viewers (flip / native / image) weld together decisions that are
independent. Unbundled:

| Axis | Values | Notes |
|------|--------|-------|
| **Containment** | `flow` (grows into page, window scrolls) · `contain` (fixed-height box, internal scroll, pinned toolbar) | IDEAS #1. Layout wrapper, engine-independent. |
| **Arrangement** | `single` · `spread` · `auto` (container width picks, via existing ResizeObserver breakpoint) | Must work everywhere — including with flip. |
| **Transition** | `none` (instant/scroll) · `flip` (page-curl) · (future: slide, fade) | **Flip is a decoration on page change, not a viewer.** |

Every cell of containment × arrangement × transition is meaningful. Today's
"flipbook mode" is just `contain + spread + flip`; today's desktop "document
mode" is `flow + single + none`. Two hard requirements drove the reframe:

- **Responsive collapse to single page WITH flip.** Narrow container → 1-up,
  page-curl still animates. The current lib can't (spread-locked; the
  single/double layout string never reaches its renderer).
- **Responsive spread in native mode.** Wide container → 2-up native rendering
  with text layers, no animation required.

Both are impossible while flip is a separate raster engine; both are ordinary
parameter combinations under this model.

## Target architecture: persistent accessible core + transient animation overlay

Two candidate architectures were compared:

- **(A) Persistent text, transient animation** — the resting state is always
  the native render (canvas + text + annotation layers), for 1-up or 2-up.
  On page change, a raster **animation overlay** is spawned on top, plays the
  curl using canvas snapshots of the outgoing/incoming pages, and is discarded
  when settled. The accessible DOM underneath persists and is re-pointed to
  the new page(s).
- **(B) Persistent animation, transient text** — the flip lib owns the surface;
  text layers mount only at rest and unmount on every flip start.

**(A) wins.** Rationale:

- The text layer is the expensive, fragile part (`getTextContent()` + span
  layout per page). (A) builds it once per page arrival; (B) rebuilds every
  flip and flickers the accessible DOM in and out.
- In (A) the accessible document is the *default* state and animation the
  exception — screen readers see a stable document with decorative motion on
  top. In (B) accessibility is intermittent.
- (A) matches how native mode already works: reuse, not reinvent. Flipbook
  stops being a separate viewer and becomes *native mode + an optional flip
  transition*.

**The hard 20% of (A): the handoff seam.** The overlay must align pixel-perfect
with the static render at the first and last animation frames or the swap
shows a jump/flash. Choreography: overlay appears over the old spread → static
layer swaps to the new page(s) underneath → overlay completes and is removed,
revealing a matched frame. The overlay needs its own transient canvas
snapshots (cheap; no text layer involvement).

Tiers considered and rejected/deferred:
- *PDF.js canvas as flip-lib texture only* (Tier 1): sharper rendering, no
  a11y gain — subsumed by (A).
- *Live text layer warped during the curl* (Tier 3): per-glyph 3D transforms,
  enormous effort, nobody reads mid-flip. Rejected.

## Animation implementation candidates

The overlay engine (the thing that plays the fold) has five candidate
implementations, ranked. The transition is decorative by definition, so
**progressive enhancement is legitimate**: feature-detect the fancy path and
fall back to `none` (instant swap) — which also gives `prefers-reduced-motion`
its behavior for free (reduced motion forces the `none` transition).

1. **View Transitions API (browser-native overlay) — spike first.** The
   browser primitive does exactly what Architecture (A) prescribes: it
   snapshots the old state, lets the DOM swap underneath, animates the
   `::view-transition-old`/`::view-transition-new` pseudo-elements, and
   discards the overlay. The handoff seam — snapshot alignment, z-order,
   cleanup — becomes the **browser's job, not ours**. Per-page
   `view-transition-name` gives each page its own snapshot pair, so a rigid
   fold-at-the-spine (`rotateY` keyframes on the snapshot pseudos) is
   achievable. The resulting animations are Web Animations API objects
   (`document.getAnimations()`), so tests can pause and scrub `currentTime`
   deterministically — progress-parameterization comes free. Limits: the
   snapshots are flat images, so **rigid fold yes, soft deformable curl no**;
   support is broad (Chrome/Edge, Safari 18+, Firefox 139+) but not
   universal — hence the instant-swap fallback.
2. **Adopt a maintained flip library (e.g. StPageFlip) fed PDF.js canvases —
   buy over build.** Soft-curl imitation, a built-in portrait (single-page)
   mode, and built-in responsive single↔spread switching — directly answers
   the flip+single requirement. Would be mounted as the transient animation
   layer per (A), keeping our persistent text layers. Risks: dependency
   maintenance cadence, and its DOM behavior must be vetted against our
   accessibility layer.
3. **Hand-rolled CSS 3D halves.** Two half-page elements, `rotateY`,
   GPU-composited. Full control, moderate effort, rigid fold only. The
   fallback position if 1 is too limited and 2 is unsuitable.
4. **Canvas 2D warp** (port the existing lib's strip-skew approach). Most
   code, CPU raster; only worth it if soft curl is mandatory *and* StPageFlip
   fails vetting.
5. **WebGL curl shader.** Prettiest (cloth-like curl), heaviest: bundle
   weight, context limits, worst testability. **Rejected.**

Open aesthetic question that decides between 1 and 2/4: is a rigid
fold-at-the-spine acceptable, or is the soft page curl part of the product's
identity? Spike 1 first regardless — it is the least code and may be good
enough.

## Testability requirements

The existing verification suite (playwright-core + system Chrome + harness
HTML pages + `getImageData` pixel probes, e.g. `test/verify-b24.js`) is the
right substrate for seam testing — same technique, new assertions. What the
seam tests assert:

1. **t=0 match** — the overlay's first frame is pixel-identical (within
   tolerance) to the pre-flip static composite.
2. **t=1 match** — the overlay's final frame matches the post-flip static
   render.
3. **Cleanup** — the overlay element is gone after settle; no orphan canvases.
4. **A11y continuity** — the text layer exists before/during/after the flip
   and its spans match the new page's `getTextContent()` after re-pointing.
5. **Mid-flip resize rule** — dispatch a resize crossing the arrangement
   breakpoint during an animation; assert cancel → settle → relayout.

**Hard design requirement — progress-parameterized animation.** The overlay
engine must expose its rendering as a pure function of progress
(`renderFrame(t)`, `t ∈ [0,1]`), with rAF driving `t` only in production.
Tests then call `renderFrame(0)`/`renderFrame(1)` directly and pixel-diff
against the static layer — deterministic, no rAF mocking, no timing flake.
The seam invariant ("t=0 and t=1 frames are pixel-identical to the static
layer") becomes testable by construction instead of hoped-for. The same hook
makes the mid-flip cancel rule trivial (jump to t=1). With the View
Transitions candidate this comes free via WAAPI `currentTime` scrubbing; any
hand-rolled engine must provide it explicitly.

Tolerance realities: compare in canvas space via `getImageData` (as the suite
already does) to avoid screenshot-compositor noise; pin
`deviceScaleFactor: 1` in harnesses (HiDPI multiplies subpixel diffs); allow a
small per-channel epsilon plus a <0.5% differing-pixel budget for antialiased
edges — exact-zero diffs are unrealistic across GPU/headless variance.

Suite shape: `harness-flip-seam.html` + `verify-flip-seam.js` following the
existing harness/verify pattern, with baseline PNG artifacts as today.

## What convergence buys

- **Unblocks flip+single and responsive flip** — the animation overlay curls
  whatever the layout shows; a 1-up curl has no facing page but is the same
  snapshot-and-fold mechanic.
- **Retires the flipbook lib** (eventually) — resolves the engine-convergence
  open question in IDEAS #5 in favor of convergence.
- **Kills the double-bundled PDF.js debt** (~+182KB, issue #4) — one engine,
  one bundle; also advances IDEAS #6 (per-engine chunking becomes moot or
  trivial).
- **Accessibility everywhere** — text/annotation layers present in every mode
  on capable devices; the image engine remains only as a low-memory fallback,
  justified by performance, never by accessibility.
- **Vocabulary cleanup** — the `document`/`singlepage`/`flipbook` renames
  (IDEAS #2/#3) should land in *this* vocabulary (containment/arrangement/
  transition), not the old mode names.

## Open questions / risks

1. **Single-page curl engine.** See [Animation implementation
   candidates](#animation-implementation-candidates) — ranked; spike View
   Transitions first. Remaining unknown is aesthetic (rigid fold vs soft
   curl), not feasibility. The existing lib assumes 2-up throughout and is
   not on the candidate list except as a porting source (option 4).
2. **Mid-flip resize.** Container crosses the arrangement breakpoint during an
   animation. Proposed rule: cancel the flip, settle instantly, relayout.
3. **Cover/lone-page logic.** `book_layout` traditional (cover alone) interacts
   with arrangement: in 1-up every page is alone; in `auto` the pairing shifts
   at the breakpoint. `createBookWrapper()`'s position-1-null trick needs
   rethinking under responsive arrangement.
4. **Text-layer cost.** Build only for the resting page(s) ±1 preloaded;
   keep the existing lazy-load + teardown discipline from native mode.
5. **Mobile image fallback.** Does the converged core keep an image-engine
   fallback for low-memory devices, and does flip apply there too (snapshots
   are rasters anyway, so plausibly yes)?
6. **Portal context.** All of this must hold in the portal-system cross-origin
   asset setup (`bws_pdf_viewer_plugin_url` filter) — no new origin-bound
   assumptions in the overlay.

## Relationship to existing docs

- **IDEAS #5 (two-axis taxonomy):** refined here — `flip` moves from the
  presentation axis to a new transition axis; presentation reduces to
  containment (`flow`/`contain`). IDEAS #5's engine-as-third-axis discussion
  collapses: target is one engine (native) + image fallback.
- **IDEAS #1 (contained continuous):** unchanged; `contain` is the same
  wrapper, and is the natural home for flip (an unbounded flowing flip makes
  little sense).
- **Issue #4 (double bundle):** resolved as a side effect of convergence.
- **Admin help text fix:** independent small change; do not wait for this
  design.
