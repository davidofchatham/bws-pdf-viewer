# Enhancement Ideas

Parking lot for enhancement ideas. Repo GitHub Issues are reserved for
bugs and actionable follow-ups; ideas live here until promoted to an issue.

**Status vocabulary:** `parked` (noted, not started) · `exploring` (spec/design
in progress) · `promoted` (moved to a GitHub Issue — link it) · `dropped`.

| # | Idea | Notes | Status |
|---|------|-------|--------|
| 1 | Contained Continuous viewer | Same **Continuous** page stack, but bounded in a fixed-height box that scrolls *internally* instead of growing into page flow (current behavior grows unbounded, whole page scrolls). Toolbar pinned to the box edge — like PDF.js's own default viewer. Not a new render mode; a layout wrapper on existing Continuous. Impl sketch: wrap page container in a fixed/`height`-attr element with `overflow:auto`; pin toolbar via sticky/absolute. | parked |
| 2 | Rename "document" → "Continuous"? (open question) | Admin dropdown label is already "Continuous", but the stored `view_mode` value and shortcode attr are still `document`. Open question: should the value/attr itself be renamed to `continuous`? If yes, the deeper internal rename below likely rides along. Decide the naming before touching code. | parked |
| 3 | Deeper internal rename (`singlepage` → continuous) | Rename internal JS `singlepage` config key, `singlePageViewer` fn, and `singlepageviewer.js` file across src/build/tests. Large churn (rebuild + retest), no end-user benefit beyond consistency. Depends on #2's outcome. | parked |
| 4 | First / last page jump buttons | Add "⇤ First" / "Last ⇥" buttons to the toolbar page-nav group (flanking prev/next) that jump straight to page 1 / last page. Only where page-nav shows (flipbook multi-page — V6); use `viewer.goToPage(1)` / `goToPage(page_count)`. Fits roving-focus order + disabled-at-edge logic. Optional shortcode/admin gate like the other buttons. | **promoted** → SPEC T30 (2026-07-09), no separate GitHub issue (rides the toolbar-icons effort) |
| 5 | Two-axis viewer-mode taxonomy | **Proposed, not locked.** Reframe the current flat mode list (`document` / `flipbook`) as two orthogonal axes: **presentation** (flow / contain / flip) × **arrangement** (single / spread). Subsumes ideas #1–#3. See [§ Two-axis mode taxonomy](#two-axis-mode-taxonomy-proposed) below. **Refined 2026-07-09** by [design/viewer-convergence.md](design/viewer-convergence.md): flip reclassified as a *transition effect* (third axis), engines converge on native + animation overlay — answers the engine-convergence question in favor of convergence. | exploring |
| 6 | Split engine bundle + rename UMD global | The delivered bundle was renamed `flipbook-viewer.js` → `bws-viewer-engines.js` (SPEC V26 / T24) so the filename stops implying flip-only — done. Two follow-ons remain **parked**: (a) **split** the single bundle into per-engine chunks (flip / native / image) lazy-loaded by mode, so mobile never ships the flipbook + native code it won't use — real payload win, rides the engine-convergence question and the double-bundle debt (issue #4); (b) **rename the UMD global** `flipbook` (still a lie — it's the multi-engine entry) to match, which means updating `library.name` in webpack + every `import * as flipbook` test usage. Both deferred; neither blocks the rename already shipped. | parked |
| 7 | Zoom controls | Pinch/± zoom for the viewer. Was SPEC T14 — deferred out of the 002 toolbar spec. Explicitly held back AGAIN from the 2026-07-09 toolbar-icons effort (T29–T32): open question whether ± zoom even applies to document/continuous mode. Groundwork already present: flipbook `viewer.zoom(level)` EXISTS (`src/flipbookviewer.js:69`, stepped 0→1→3→0, animated pan) — just unwired to our toolbar; native/image have a plain `scale` multiplier but NO exposed `zoom()` method (would need one added, ~re-render at new scale). Resume as its own effort when picked up. | parked |
| 8 | In-viewer search | Full-text find across the PDF (highlight + prev/next hits). Was SPEC T15. Enabled-by, not part-of, the PDF.js component adoption (native mode has the text layer). NOT a shortcode attr (`enable_search` was never wired — CLAUDE.md, and the dead search CSS was removed, B-review). Its own feature spec when built. | parked |
| 9 | Gutenberg block authoring | Block-editor UI to insert/configure the viewer instead of hand-writing the `[bws_pdf]` shortcode. Was SPEC T16. Shortcode-only this release. Rides the shortcode-attr surface review (V8) — freeze the attrs before wrapping a block UI around them. | parked |
| 10 | SR announcer vs range counter mismatch | After T33 (V33), the visible counter shows the spread's page RANGE (`5–6 of 12`) but `announcePageChange` still announces only the internal `currentPage` = the rightmost real page (`Page 6 of 12`). A screen-reader user hears "Page 6" while a sighted user sees "5–6". Deliberately out of T33 scope (V33 covers the visible counter only). Fix: teach `announcePageChange` to speak the range (e.g. "Pages 5 to 6 of 12", collapsing to "Page N of 12" for a lone page) — likely thread the same `spreadRange` into it, or format from it. Small, self-contained. Cross-ref V33, invariant 8 (SR live region). | parked |
| 12 | Formalize the flipbook-viewer fork (embedded copy → clean fork + tracked dep) | This repo is itself a GitHub fork of [theproductiveprogrammer/flipbook-viewer](https://github.com/theproductiveprogrammer/flipbook-viewer) (MIT) that became a WordPress plugin; `src/flipbookviewer.js` is the lib living inside it. Not an orphan: full upstream history is shared (merge-base `0831a77`, `master` 78 ahead / 0 behind, `upstream` remote configured). Our mods (lone-page centering B22/B23, transparent bg, cover sentinel, HiDPI, `numSpreads` seam) differ from upstream by ~+163/−41 lines. Upstream is near-dormant (last push 2025-06, 2 PRs ever, npm 1.6.1 from 2022). **Goal: a public, standalone fork of the lib, separate from the plugin** — not an upstream PR. Plan: leave this repo's fork network (self-serve; frees the one-fork-per-account slot), re-fork upstream as `flipbook-viewer`, replay lib-only history onto it (`git filter-repo` path filter), tag `v2.0.0`; the plugin consumes it as a **git dependency pinned to a tag** (`npm link`/`file:` override for local dev, uncommitted). Lib gets the flip engine, single-page flip (spike #17), centering, transparent bg, HiDPI and the book-interface contract; the plugin keeps `nativepageviewer.js` and all WP glue. Fits ADR-0001 reuse-first. **Sequencing:** NOT a blocker — extract *after* the convergence implementation lands, since the seam is still moving and co-changes would cost a two-repo dance ([map #9 ticket #14](https://github.com/davidofchatham/bws-pdf-viewer/issues/14) locked the engine as our own `flipbook-viewer` warp; warp code is identical either way). **Open:** lib package name/versioning (working: scoped name, `v2.0.0`). Details: `.scratch/flipbook-lib-extraction/plan.md`. | parked |
| 11 | Thumbnail → modal-overlay launch mode | A compact **thumbnail** surface (first page rendered small, click-to-expand affordance) that opens the full viewer in a **modal overlay** — in whatever mode/axes are configured (`contain`/`flip`/`spread`/…). The thumbnail is a *launch surface*, orthogonal to the render axes (containment / arrangement / transition) — not a new mode, a wrapper around the existing viewer. Leaves room in the convergence design: the persistent-core + overlay architecture should not assume the viewer mounts inline; a modal host is another mount target. Open Qs: which page(s) the thumb shows (first only, or a mini-spread); focus-trap + ESC + scroll-lock for the modal (WCAG 2.2 AA — same bar as the inline toolbar); how the shortcode opts in (`display="thumbnail"`-ish attr). Sequence after the convergence spec locks (don't bake mount assumptions in first). | parked |

---

## Two-axis mode taxonomy (proposed)

**Status: proposed, not locked.** A direction to work toward, not a decision to
implement now. Written down so the naming is settled before any rename churn
(ideas #2 / #3) or new-mode work (idea #1) starts.

> **2026-07-09 refinement:** [design/viewer-convergence.md](design/viewer-convergence.md)
> supersedes parts of this section — `flip` moves off the presentation axis to a
> new **transition** axis, and the engine-convergence open question below is
> answered in favor of convergence (one native core + transient flip-animation
> overlay). This section kept for the flow/contain/arrangement definitions,
> which stand.

### The idea

Today's modes are a flat list — `document` (a.k.a. `singlepage`, continuous
scroll) and `flipbook`. That list conflates independent choices. Split them into
axes. Two are user-facing:

- **Presentation** — how pages are framed and moved through:
  - **flow** — unbounded; page stack grows into page flow, whole window scrolls
    (current `document` behavior)
  - **contain** — same page stack, bounded in a fixed-height box that scrolls
    *internally*, toolbar pinned to the box edge (idea #1; PDF.js-style)
  - **flip** — page-turn animation (current `flipbook`)
- **Arrangement** — how many pages sit side-by-side:
  - **single** — one page wide
  - **spread** — two pages side-by-side

A third axis (**engine**) is mostly internal — see below — but leaks into
presentation in ways the taxonomy has to name.

### The matrix

Crossing the axes gives six cells. All six are meaningful:

|            | single                          | spread                                            |
|------------|---------------------------------|---------------------------------------------------|
| **flow**   | current `document` (mobile)     | valid, niche — unbounded 2-up scroll              |
| **contain**| idea #1 (bounded continuous)    | PDF.js-style static 2-up in a box                 |
| **flip**   | mobile flipbook — *wanted, blocked* | current `flipbook`                            |

### Engine is a third axis

Presentation does **not** map cleanly onto a single renderer. There are already
**three** engines, and today's `document` mode alone uses two of them:

- **native** — `nativepageviewer.js`; a real PDF.js viewer with canvas + text +
  annotation layers. Text-select, browser find, clickable links. Desktop-default.
- **image** — `singlepageviewer.js`; PDF pages rasterized to images. Lightweight,
  mobile-default; no text layer.
- **flip** — the flipbook lib; animated page-turn. Always renders 2-up spreads.

So "continuous renderer" (as an earlier draft called it) was a fiction — `flow`
is already served by *either* native or image depending on device. **Engine is
orthogonal to containment:** both native and image can, in principle, drive
either `flow` or `contain` (today they only do `flow` — `contain` is unbuilt).
Containment is a layout wrapper (bounded box + pinned toolbar), engine-independent.

Two constraints keep it from being a clean 3-way free cross:

- **flip fuses engine and presentation.** The flipbook lib *is* the flip
  presentation — you cannot render `flip` without it, and it cannot render
  anything but flip. So `flip` collapses one engine and one presentation into a
  single inseparable choice.
- **`contain` will likely default to native.** The wrinkle driving this section:
  the bounded PDF.js-style contained mode wants the native engine specifically
  (text layer, links, the real-PDF.js-viewer feel). That's a *default*, not a
  hard fusion — image-engine contain is still conceivable (mobile bounded box) —
  but `contain` leans native where `flow` leans image on mobile.

Net: the two user-facing axes (presentation × arrangement) sit on top of an
engine pick that's *usually* implied by the presentation + device, and only
occasionally something to expose. `contain-spread` (native, static) and
`flip-spread` (lib, animated) *look* alike but are different engines — so
"spread" alone is ambiguous; always qualify it with the presentation.

### Known blockers & open questions

- **flip + single is currently impossible.** The flipbook lib always renders a
  2-up spread; the `single`/`double` layout string never reaches the renderer.
  Mobile flipbook (page-turn UI, one page at a time)
  is *wanted as a responsive behavior* but needs either a lib patch or an engine
  swap. Not just unwired — blocked.
- **Responsive arrangement (auto single/spread by container width)** works for
  `flow` / `contain` (native and image engines can honor layout), but is
  **blocked for `flip`** by the same lib limit. `setupResponsiveBehavior()`
  already measures container width via ResizeObserver — wire the arrangement axis
  to it for the native/image engines now; flip waits on the lib.
- **Engine-convergence question (open):** long-term, keep the flipbook lib as a
  separate engine, or migrate `spread` onto the native/image engine with a
  home-grown flip animation and retire the lib? Convergence would unblock
  flip+single *and* kill the double-bundled PDF.js debt (PDF.js internals are
  currently bundled twice, ~+182KB; tracked as issue #4). Big work; decide
  deliberately.
- **Naming precedence:** settle this taxonomy before the `document` → `continuous`
  value/attr rename (#2) and the internal `singlepage` → continuous rename (#3),
  since those renames should land in the new vocabulary, not the old.
