# Responsive Model under Convergence

**Status: decided design — grilled and approved 2026-07-10 (wayfinder ticket
[#12](https://github.com/davidofchatham/bws-pdf-viewer/issues/12)); becomes the
responsive section of the convergence spec.**
Companion to [viewer-convergence.md](viewer-convergence.md) (target
architecture; axis vocabulary) — this doc pins down the **containment** and
**arrangement** axes and how they compose under the one converged engine.
Mechanics it builds on: [../reference/pdfjs-reuse-menu.md](../reference/pdfjs-reuse-menu.md)
§2 (no PDF.js rung reflows natively; the breakpoint decision is ours at every
rung) and [ADR-0003](../adr/0003-container-width-responsive.md) (container-not-
viewport observation — reassessed by its own ticket, which this doc unblocks).

## 1. Logic split: authored vs responsive

- **Authored — never auto-changes at runtime:**
  - **Containment** (`flow` / `contain`). Declared by an explicit shortcode
    attribute (attribute *naming* rides the rename tickets, IDEAS #2/#3).
    Flipping an embed between page-flow and a bounded box at runtime would
    yank the host page's layout around; the author owns this choice. Device
    detection may pick an engine *fallback*, never a different containment.
- **Responsive — machine-driven, from the container:**
  - **Arrangement** (single / spread) when the author says `auto`.
  - **Render scale** — the converged engine re-renders at the new scale when
    the container resizes (retiring today's render-once + CSS
    `max-width:100%` shrink).

ADR-0003's core call — observe the **container**, not the viewport — is
reaffirmed: the container is the only signal that catches column-level changes
(sidebar toggles, lazy ads loading above the embed) that no window event
reports.

## 2. Containment model

- **`contain` is the default** for every transition. `flow` is opt-in.
  (Back-compat with today's flow-default document mode carries no weight —
  sole current deployment doesn't use flow.)
- **`transition=flip` forces `contain`.** An unbounded flowing flip is
  meaningless; the box is part of the flip presentation.
- **Containment is perf-neutral.** Canvas memory is governed by lazy render +
  eviction (our IntersectionObservers today; `PDFViewer`'s
  `max(10, 2*visible+1)` buffer at higher rungs — reuse-menu §3), identically
  whether the window or the box scrolls. Keeping flow costs nothing; the
  per-canvas pixel caps that matter for mobile-native are a rung concern
  (reuse-menu rung (b)), not a containment one.
- **`height` attribute is meaningful only in `contain`** — it sets the box
  height, and an explicit value may exceed the viewport cap (§3). In `flow`
  it is ignored (as it effectively is today).

## 3. Height rule: the viewport-fit principle

> A PDF viewer box is never taller than the visible viewport unless the
> author forces it or the user zooms. You don't know where content sits on
> the host page, so a box the viewport can't show whole is unsafe by default.

- **Cap everything contained** — paged *and* continuous boxes:

  ```
  boxHeight = min(contentDerivedHeight, 0.90 × visualViewport.height − toolbarHeight)
  ```

  Explicit `height` attr overrides the cap; user zoom may exceed it; `100vh`
  is reserved for fullscreen (V22 path).
- **`flow` is exempt** — the window itself scrolls; the viewer isn't a box.
- **Scroll-escape rules (the mobile trap):** the sub-100% margin guarantees a
  visible strip of host page to grab-scroll. Additionally:
  - contained-continuous relies on **native scroll chaining** (inner scroll at
    its end → page scrolls); never set `overscroll-behavior: contain`;
  - the flip surface never `preventDefault`s vertical touch moves, so a swipe
    over the canvas still scrolls the page.
- **Ancestor ceilings stay:** the B24 ancestor max-height walk
  (`availableHeight()`, `includes/bws-pdf-viewer.js`) remains a *further*
  ceiling below the viewport cap.
- The cap re-evaluates on `visualViewport` resize and orientation change
  (with a jitter guard for mobile URL-bar collapse — threshold + debounce).

## 4. Arrangement model: the readability test

When `arrangement=auto`, single vs spread is decided by **whether a 2-up
spread would actually be readable** — evaluated as it would really render:

1. Hypothetical spread fills the container width:
   `perPageWidth = (containerWidth − padding) / 2`.
2. Spread height at that scale from the page aspect (already fetched at init
   for the dimension calc): `spreadHeight = perPageWidth × (h/w)`.
3. **Apply the height clamp** (§3): if `spreadHeight` exceeds the box cap,
   the spread scales down to fit and `perPageWidth` shrinks proportionally.
4. **Spread iff post-clamp `perPageWidth ≥ MIN_READABLE_PAGE_WIDTH`.**

`MIN_READABLE_PAGE_WIDTH` is a tuned constant, starting range **350–420 CSS
px**. Calibration: US Letter at 100% zoom ≈ 816 CSS px wide (8.5in × 96dpi),
so 400px ≈ 49% zoom — around the floor where typical body text stays legible
without pinching. Candidate **global admin option** (config fallout, §8).

Worked examples (US Letter, 8.5×11in ≈ 816×1056 CSS px):

| Situation | Raw per-page | Height clamp | Effective | Verdict |
|---|---|---|---|---|
| 1200px content area on an ultrawide, 768px-tall viewport | 600px | spread h ≈ 776px > cap ≈ 642px → ×0.83 | ~497px | **spread** |
| 400px sidebar, any screen | 200px | — | 200px | **single** |
| 16:9 slides, 900px container | 450px | height never binds | 450px | **spread** |
| 800px container, short landscape-phone viewport | 400px | cap crushes portrait spread | ~260px | **single** |

Properties:

- **Height-aware**, which absorbs what orientation and container/viewport
  ratio heuristics were for: a landscape phone fails on height, a sidebar
  fails on width, an ultrawide content area passes both. (A pure
  container-vs-viewport ratio guard was considered and **dropped**: a 1200px
  content area on a 3440px screen is only 35% of the viewport yet is a fine
  spread.)
- **Reserve inputs:** screen orientation and the container/viewport ratio are
  *not ruled out* — they return as explicit inputs if the readability
  heuristic underperforms in validation.
- **Text-density-blind:** the constant is a proxy (a picture book reads at
  250px; dense legal text is marginal at 500px). Per-document refinement
  (e.g. sampling text-layer font sizes) is noted as future work, out of scope.
- **Units:** all CSS px; DPR affects rasterization, never the decision.
- **Stability:** hysteresis (switch up at ≥ threshold, back down only below
  threshold − ~20px) on top of the existing 150ms debounce, so the
  arrangement doesn't flap at the boundary.
- **Re-evaluated on:** init, container ResizeObserver fire, fullscreen
  relayout, orientation / `visualViewport` change (the cap input moves even
  when container width doesn't).
- **`breakpoint` attr, when set, replaces the whole test** with a plain px
  cutoff (spread iff container ≥ breakpoint) — the predictable,
  document-independent author override. No auto-switching logic exists in
  PDF.js at any reuse rung (reuse-menu §2); this rule is ours everywhere.

## 5. The height ↔ arrangement knot

What happens to the contained box when `auto` flips arrangement:

- **Paged (flip) box = content-fit.** On a spread↔single switch the box
  re-derives its height from the new arrangement's aspect, still clamped to
  the viewport cap (a spread→single switch may legitimately grow the box
  toward the cap, then scale-to-fit inside it).
- **Contained-continuous box = arrangement-independent.** It is a scroll
  window: pages re-scale and re-wrap inside; the box itself never moves the
  host page's layout.

## 6. Mid-flip resize

Container resizes while a flip animation plays (causes: window resize/snap,
device rotation, fullscreen toggle, host-page layout shift, browser zoom):

> **Cancel → settle → relayout.** Jump the animation to its end (destination
> page wins), discard the overlay, then re-derive arrangement and box size.

Deterministic and testable by construction — the overlay is
progress-parameterized (`renderFrame(t)`; jump to `t=1`), and this is seam
assertion #5 in [viewer-convergence.md](viewer-convergence.md) § Testability.

## 7. Toolbar

- **`contain`:** bar pinned to the box edge — visible while internal scroll
  moves (IDEAS #1).
- **`flow`:** **sticky** — the bar sticks to the viewport edge while the
  viewer is in view (today's scroll-away top dock is retired with flow's
  demotion to opt-in).
- **Dock side (top vs bottom): deliberately NOT locked.** Lean: bottom feels
  natural for flip; V31's per-mode split is under reconsideration, not yet
  superseded. Direction: a **global per-mode default (admin) + per-embed
  attribute override** (§8). Decision deferred to the convergence spec ticket.

## 8. Config fallout (candidates — V8 revisable, ADR-0007; NOT locked)

| Knob | Kind | Notes |
|---|---|---|
| containment (`flow`/`contain`) | shortcode attr (+ admin default) | naming rides renames #2/#3; default `contain` |
| `height` | existing attr, redefined | contain-only box height; overrides viewport cap |
| `breakpoint` | existing attr, new semantics | when set, replaces the readability test |
| `MIN_READABLE_PAGE_WIDTH` | constant → candidate global admin option | start 350–420px, tune in validation |
| viewport cap % | constant (~90%) | attr only if a real need appears |
| toolbar position | admin per-mode default + attr override | direction only; dock side undecided |

## 9. Validation / open items

- **Validate the readability heuristic** against real documents and
  containers; if it misfires, orientation and container/viewport ratio are
  the queued reserve inputs (§4).
- Dock side decision (§7) — lands with the convergence spec.
- Jitter-guard tuning for `visualViewport` (URL-bar collapse) — mechanism
  detail, settle during implementation.
