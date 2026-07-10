# ADR-0008 — PDF.js internals double-bundled (accepted debt)

**Status:** accepted (deferred)
**Cites:** issue #4, docs/IDEAS.md #6a, [[pdfjs-bundle-dedup]] · relates to V26

## Context

PDF.js internals are currently bundled twice — once in `dist/pdf.js` and again
inside `dist/bws-viewer-engines.js` — adding ~182KB. The native and flipbook
engines each pull PDF.js through their own entry.

## Decision

Accept the duplication for now; defer dedup. Tracked as GitHub issue #4 and
docs/IDEAS.md #6a. Recorded here so the payload cost is a known, deliberate
trade-off, not an oversight.

## Consequences

- ~182KB of duplicated PDF.js ships until dedup is picked up.
- Dedup rides the engine-convergence question
  ([docs/design/viewer-convergence.md](../design/viewer-convergence.md)) and the
  per-engine chunk-split idea (docs/IDEAS.md #6a).
- Asset-rename hygiene (V26) is independent of and already done ahead of this.
