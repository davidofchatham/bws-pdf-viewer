# ADR draft — Arrangement axis supersedes ADR-0003

**Status: DRAFT — not placed.** Decided at wayfinder ticket
[#13](https://github.com/davidofchatham/bws-pdf-viewer/issues/13). Awaits the
convergence-spec ticket, which assigns the final ADR number, places it in
`docs/adr/`, and flips [ADR-0003](../adr/0003-container-width-responsive.md)'s
status to `superseded by ADR-00NN`. This file holds the decision and the ADR
body verbatim so nothing is re-derived when the spec ticket lands it.

Companion sources: [responsive-model.md](responsive-model.md) (the mechanism,
#12) · [viewer-convergence.md](viewer-convergence.md) (target architecture,
axis vocabulary) · [ADR-0003](../adr/0003-container-width-responsive.md) (the
superseded decision).

---

## Why supersede, not amend

ADR-0003 made three calls. Under the 3-axis reframe + convergence:

1. **Observe the container, not the viewport** — **reaffirmed verbatim**
   (responsive-model.md §1: the container is the only signal catching
   column-level changes no window event reports).
2. **`≥768px → spread, < → single` fixed-px breakpoint** — **replaced entirely**
   by the readability test (§4 below); the `breakpoint` attr is dropped.
3. **"Flipbook arrangement limited by the library (always spread)"** — **retired**;
   convergence gives flip the same arrangement axis as every other transition.

Two of three decision clauses changed *mechanism*, not just vocabulary, and the
scope widened (arrangement now drives flip, not only native/image). That is a
material change → **supersede**. The load-bearing container-not-viewport
principle survives and is restated below so one coherent ADR stands, rather than
ADR-0003 patched around a dead breakpoint rule.

---

## Proposed ADR body

### Context

Multiple viewers sit on one page, each in a different-width container. Viewport
media queries would force every viewer to one breakpoint regardless of its box.
Post-convergence there is one engine for all transitions (native, flip, image),
so the arrangement decision must serve flip too — the old "the flip library only
draws spreads" escape no longer holds.

### Decision

**1. Observe the container, not the viewport** (ADR-0003's surviving core).
A per-container `ResizeObserver` drives the responsive arrangement decision.
Each instance adapts independently.

**2. Arrangement axis replaces the fixed-px breakpoint.** The
`arrangement` attribute takes `single` / `spread` / `auto`:

- Explicit `single` / `spread` = author override (the real predictability knob).
- `auto` = the **readability test** (responsive-model.md §4): a spread is chosen
  iff post-height-clamp effective zoom `perPageWidth / naturalPageWidth ≥
  MIN_EFFECTIVE_ZOOM` (~50%, page-size-aware — a min-DPI control). Height clamp,
  hysteresis, and re-eval triggers per that doc.
- The **`768px` breakpoint and the `breakpoint` attr are dropped.** The fixed px
  rule was page-size-blind (spread on Letter, crushing on a wallchart); the zoom
  test is page-size-aware. No px fallback retained.
- No PDF.js reuse rung auto-switches arrangement by width
  ([pdfjs-reuse-menu.md](../reference/pdfjs-reuse-menu.md) §2) — this rule is
  ours at every rung.

**3. Arrangement drives every transition uniformly, flip included.**

### Consequences

- `setupResponsiveBehavior()` observes each container (unchanged intent).
- Two viewers on one page can show different arrangements simultaneously
  (unchanged).
- **The "flipbook limited to spread by the library" consequence is retired.**
  Post-convergence the flip overlay is our own `flipbookviewer.js` warp
  (ticket [#14](https://github.com/davidofchatham/bws-pdf-viewer/issues/14));
  single-page flip is a proven edge-pivot re-parameterization
  ([#17](https://github.com/davidofchatham/bws-pdf-viewer/issues/17)). So
  `arrangement=single` pairs with `transition=flip`.
- **Flip's proven arrangements are `single` and `spread` only.** N-up (3+) flip
  has **no strategy yet** — the warp pivots one page-edge; which edge turns and
  what the curl reveals in an N-up grid is unsolved geometry. N-up arrangement
  therefore pairs with `transition=none` until a dedicated flip-geometry spike
  exists (tracked in the map's Not-yet-specified). **Not a convergence blocker.**
- **Downstream sweeps** (the convergence-spec ticket lands these, not this ADR):
  - **V3** ("≥breakpoint(768)→spread") text dies → rewritten to the
    readability test.
  - **V24 / B17** — canvas-dimension `pagesAcross` no longer keys off
    `numPages()===1`; it keys off the resolved arrangement. The vestigial
    `layout` string is fully retired.
  - **V15 / ADR-0002 (now a Rejected line)** already superseded (builders-only → rung b) at #14; unrelated
    to this ADR, listed only to avoid re-questioning it.

### Escape hatch (reaffirmed)

`prefers-reduced-motion: reduce` and low-cap devices fall to `transition=none`
(instant swap) — the arrangement decision is transition-independent, so it holds
under the escape hatch (V4).
