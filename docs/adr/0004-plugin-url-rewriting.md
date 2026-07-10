# ADR-0004 — PDF source + assets through plugin URL rewriting (multi-domain)

**Status:** accepted
**Cites:** I.php · relates to [[portal-asset-origin-mismatch]]

## Context

The plugin runs on multiple domains, including the BWS portal, which rewrites
`the_content` to a portal domain. Any hardcoded domain — or an asset URL built
from the wrong origin — breaks: the portal case produced a cross-origin
`SecurityError` loading `pdf.worker.js`.

## Decision

- Resolve the PDF source URL through the plugin's URL-rewriting integration
  point; never hardcode a domain.
- Build every enqueued asset URL with `plugin_dir_url()` so it tracks the
  current domain.
- Where the portal rewrites content but not enqueued assets, expose a filter
  (`bws_pdf_viewer_plugin_url`) the portal can hook to align the asset origin.

## Consequences

- Works unchanged across domains and under the portal's content rewriting.
- The portal fixes its own asset-origin mismatch via the filter, not us
  hardcoding its domain — see [[portal-asset-origin-mismatch]].
