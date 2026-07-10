# ADR-0001 — Reuse-first: evolve working controls, no rewrite

**Status:** accepted
**Cites:** I.controls · relates to invariant V9, [[reuse-first-constraint]]

## Context

The plugin adopts a proven flipbook library and PDF.js components rather than
building viewer internals from scratch. Rewriting behavior that already works —
control logic, layout math, layer handling — burns effort and reintroduces
solved bugs.

## Decision

Evolve working control logic in place; do not rewrite proven behavior. Building
our own controls is **forbidden where the functionality already exists** — reach
for the existing library/component control first and extend it. Keep upstream
dependencies at their latest before building on them.

## Consequences

- Exactly one toolbar component serves both flipbook and native modes (V9) — no
  duplicate control code.
- PDF.js icons are adopted, not hand-drawn (V30).
- New behavior threads through existing seams (`createBookWrapper`,
  `addNavigationControls`) instead of parallel implementations.
