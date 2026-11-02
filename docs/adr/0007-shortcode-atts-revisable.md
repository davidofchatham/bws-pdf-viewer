# ADR-0007 — Shortcode attrs revisable pre-1.0, not frozen

**Status:** accepted — 2026-07-09, **supersedes** the old "frozen for live-site
back-compat" rule
**Cites:** I.php, I.admin · relates to invariant V8

## Context

An earlier rule froze shortcode attributes for back-compat. That cargo-culted a
public-v1.0 discipline onto a pre-1.0 internal tool: version < 1.0, not on
wordpress.org, and the sole consumer is the BWS portal whose shortcodes *we*
generate. There are no unknown third-party embeds to protect.

## Decision

Shortcode attributes change **deliberately, not never**. Any att may be renamed,
removed, or repurposed when it earns its keep. On any change:

1. Sweep the portal's own generated shortcodes first.
2. Fix the usages.
3. Note it in the changelog.

Every existing att is up for revision — the current set is NOT cemented. Before a
1.0 freeze, review the whole att surface for vestigial/misleading controls.

Known vestigial: `layout` (auto/single/double) does nothing in the flipbook
renderer (which only draws spreads — V24/B17) and is dead in document mode; kept
for now as the anchor for the planned true single-page flipbook (FW-5), NOT because it currently works.

## Consequences

- Renames/removals are a normal maintenance move, gated on the portal sweep.
- Invariant V8 tracks the current att surface and marks vestigial ones.
- Blank free-value admin fields stay unset-preserving (ADR-0005, V25).
