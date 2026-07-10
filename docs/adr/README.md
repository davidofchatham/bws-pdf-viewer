# Architecture Decision Records

Cross-cutting decisions for BWS PDF Viewer and the rationale behind them.
These were extracted from SPEC.md §C (constraints) so the durable *why* has a
stable home independent of the per-cycle task/bug ledger.

Invariants in [../../SPEC.md](../../SPEC.md) cite these as `ADR-000N`; the file
map + glossary live in [../../CONTEXT.md](../../CONTEXT.md).

> **This directory OWNS cross-cutting decisions + their rationale.** SPEC/CLAUDE
> cite an ADR by number; they must not restate its body. New decision → new
> numbered ADR + a row here. Anti-drift rules: CLAUDE.md § Doc discipline.
> An ADR is superseded, never silently edited away — mark status + link the
> successor (see ADR-0007, which supersedes the old frozen-atts rule).

| ADR | title | status |
|-----|-------|--------|
| [0001](0001-reuse-first.md) | Reuse-first: evolve working controls, no rewrite | accepted |
| [0002](0002-no-full-pdfjs-viewer.md) | No prebuilt PDF.js web viewer; components only | accepted |
| [0003](0003-container-width-responsive.md) | Container-width responsive via ResizeObserver, not viewport | accepted |
| [0004](0004-plugin-url-rewriting.md) | PDF source + assets through plugin URL rewriting (multi-domain) | accepted |
| [0005](0005-config-precedence.md) | Three-tier config precedence | accepted |
| [0006](0006-pdfjs-zero-config-webpack.md) | PDF.js zero-config webpack integration | accepted |
| [0007](0007-shortcode-atts-revisable.md) | Shortcode attrs revisable pre-1.0, not frozen | accepted (2026-07-09, supersedes frozen rule) |
| [0008](0008-pdfjs-double-bundle-debt.md) | PDF.js internals double-bundled — accepted debt | accepted (deferred) |
