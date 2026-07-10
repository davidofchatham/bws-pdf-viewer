# ADR-0005 — Three-tier config precedence

**Status:** accepted
**Cites:** I.php · relates to invariant V5 (see bug B6)

## Context

Config comes from three places: plugin defaults, site-wide admin settings, and
per-embed shortcode attributes. Without a defined order, options collide
unpredictably — a bug (B6) shipped when `show_controls` broke the model and an
unchecked state failed to persist.

## Decision

Merge config in exactly this order, later wins per key:

1. `$default_options` (hardcoded plugin defaults)
2. `get_option('bws_pdf_viewer_options')` (admin settings)
3. shortcode attributes

Merged in `shortcode_handler()`. A shortcode att wins for its key; an admin
default applies only when the att is absent.

## Consequences

- Every new option follows the same three-tier path
  (`$default_options` → `shortcode_atts` → `$config` → `initViewer` → gate),
  e.g. `show_controls`, `show_fullscreen`, `show_print`, `show_download`.
- Empty free-value admin fields must be *unset-preserving* (omit the key) so the
  default still reaches them via `array_merge` — see V25 and ADR-0007.
