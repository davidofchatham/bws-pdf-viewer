# Contract: Internal Viewer Interface

**Feature**: 002-integrated-viewer-toolbar
**Consumers**: `includes/bws-pdf-viewer.js` (toolbar, keyboard nav, responsive reinit).

The three viewers (`flipbookviewer`, `nativepageviewer`, `singlepageviewer`) expose one
interface to the integration layer. This feature adds `goToPage` to the two viewers lacking it;
everything else is the existing contract, restated here as frozen.

## Interface

| Member | Type | Semantics |
|--------|------|-----------|
| `page_count` | number | Total pages, set at init |
| `currentPage` | number | 1-based; maintained by the integration layer's `seen` handler |
| `flip_forward()` | fn | Next page/spread (animated where applicable) — unchanged |
| `flip_back()` | fn | Previous page/spread — unchanged |
| `goToPage(n)` | fn | **Uniform across all three viewers after this feature.** Navigate directly to 1-based page n. Out-of-range n is ignored (caller clamps). No flip animation for multi-step jumps. Emits `seen` on arrival. |
| `on('seen', cb)` | event | Page/spread became visible. Payload UNCHANGED per mode: flipbook = 0-based display index; native/image = 1-based page number. The integration layer's existing conversion (`onSeen`) remains the single normalisation point. |
| `on('page-loaded', cb)` | event | Page finished rendering — unchanged |
| `zoom()` | fn (flipbook only) | Out of scope; untouched |

## goToPage — per-viewer implementation constraints

- **flipbookviewer** (NEW): compute target spread index from the page number under the existing
  traditional-layout convention (page 1 alone on first spread); set `ctx.showNdx`, redraw via
  `showPages(ctx, viewer)`, emit `seen` with the display index (payload convention preserved).
  Must respect the in-flight-flip guard (`ctx.flipNdx`) the same way `flip_forward` does.
- **singlepageviewer** (NEW): show page n through the existing page-display path; emit `seen`
  with the 1-based page number.
- **nativepageviewer** (existing, unchanged): already scrolls page into view and emits `seen`
  (src/nativepageviewer.js:23).

## Compatibility rules

1. Additive only: no existing member renamed, removed, or re-typed (FR-016).
2. Event payload conventions are frozen — the flipbook 0-based/1-based asymmetry is knowingly
   retained; normalisation stays in the integration layer (changing the payload would rewrite
   verified conversion logic for zero user value).
3. The toolbar calls `goToPage` only after clamping to [1, page_count]; viewers may treat
   out-of-range input as a no-op without erroring.
4. Responsive reinit contract: after a rebuild, the integration layer calls
   `goToPage(savedPage)` on the new viewer instance to restore position (plan D8).

## Shortcode / PHP contract

Unchanged. See `specs/001-pdf-viewer/contracts/shortcode-api.md` — `show_controls`,
`show_fullscreen`, `show_print` keep names, values, defaults, and meanings (FR-009). No new
attributes in this feature.
