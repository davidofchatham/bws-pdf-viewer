# ADR-0002 — No prebuilt PDF.js web viewer; components only

**Status:** accepted
**Cites:** I.native · relates to invariants V7, V15

## Context

PDF.js ships a full `viewer.html` web app. Embedding it (directly or via
iframe) would drag in its entire chrome, styling, and update surface — fighting
the plugin's own toolbar, theming, and container-responsive layout, and coupling
us to a UI we don't control.

## Decision

Do **not** use the full prebuilt PDF.js web viewer (`viewer.html` / iframe).
Use the maintained PDF.js **components** only: `TextLayerBuilder`,
`AnnotationLayerBuilder`, and the shared link service. No hand-rolled layer
positioning either — the official builders own that.

## Consequences

- Native mode composes canvas + text layer (selection, browser find) +
  annotation layer (links) from PDF.js builders (V7).
- Internal links navigate; external links open in a new tab.
- We own the toolbar and layout; PDF.js owns only the per-page layer rendering.
