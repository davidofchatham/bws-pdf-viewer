# CONTEXT — BWS PDF Viewer

Domain map + glossary for the plugin. Read this before exploring the code.
The durable behavioral contract lives in [SPEC.md](SPEC.md) (§V invariants);
the *why* behind cross-cutting decisions lives in [docs/adr/](docs/adr/).

> **This file OWNS the goal, surface map, and glossary.** Other docs link here;
> they must not restate these. Anti-drift rules: CLAUDE.md § Doc discipline.

## Goal

WordPress plugin that embeds a PDF inline. Three render modes — flipbook
(animated page-turn) / native (PDF.js) / image (fallback) — device-adaptive,
one shared integrated toolbar across modes, WCAG 2.2 AA, multi-domain
(BWS portal).

## Surfaces

The delivered/edited files and what each owns. Invariants in SPEC.md cite these
by short name (`I.native`, `I.wp`, …).

| ref | file | owns |
|-----|------|------|
| **I.index**    | `src/index.js` | router: `nativeMode`→nativePageViewer, `singlepage`→singlePageViewer, else flipbookViewer |
| **I.flip**     | `src/flipbookviewer.js` | animated flipbook; spread layout; `goToPage`; HiDPI outputScale |
| **I.native**   | `src/nativepageviewer.js` | PDF.js 3-layer render; IntersectionObserver lazy-load; memory cleanup ~5–7 pages |
| **I.single**   | `src/singlepageviewer.js` | image-based mobile / fallback viewer |
| **I.controls** | `includes/bws-pdf-viewer.js` (`addNavigationControls` / `setupToolbarRovingFocus` / `getStrings`) + `includes/bws-pdf-viewer.css` | shared toolbar, single impl, both modes. (Planned `src/controls.js` never built; toolbar shipped in the WP layer.) |
| **I.wp**       | `includes/bws-pdf-viewer.js` | device detect, mode select, `createBookWrapper`, responsive, keyboard nav |
| **I.php**      | `bws-pdf-viewer.php` | shortcode `[bws_pdf]`, `register_assets()`, config merge / precedence |
| **I.admin**    | `includes/admin.php` | Settings > BWS PDF Viewer; defaults + mode restrictions + sanitize |
| **I.css**      | `includes/bws-pdf-viewer.css` | toolbar overlay, text/annotation layer positioning |

## Vocabulary

Terms this project uses deliberately — do not drift to synonyms.

- **flipbook mode** — animated page-turn viewer; the flipbook library ALWAYS
  renders a 2-page spread (no one-page-at-a-time mode). `view_mode="flipbook"`.
- **document mode** — continuous vertical page stack. Stored/attr value is
  `document` (legacy alias `singlepage`); the admin dropdown labels it
  **Continuous**. Grows unbounded into page flow — NOT one-page-at-a-time
  despite the `singlepage` internal name. See [docs/IDEAS.md](docs/IDEAS.md) #2.
- **native engine** — `nativepageviewer.js`; real PDF.js with canvas + text +
  annotation layers (text-select, browser find, links). Desktop default for
  document mode.
- **image engine** — `singlepageviewer.js`; PDF pages rasterized to images.
  Mobile default for document mode; no text layer.
- **spread** — two pages side-by-side. A flipbook view = one spread of two
  display slots; slot↔page packing (traditional vs plain) is owned solely by
  `createBookWrapper`.
- **traditional layout** — cover (page 1) alone in spread 0, then 2–3, 4–5, …
  (`book_layout="traditional"`, default). **spread layout** — 1–2, 3–4, …
- **presentation / arrangement / transition** — proposed axis vocabulary for a
  future mode taxonomy; NOT yet in the code. See docs/IDEAS.md #5 and
  [docs/design/viewer-convergence.md](docs/design/viewer-convergence.md).

## Where things live

- **[SPEC.md](SPEC.md)** — durable §V invariants (behavioral contract the code
  must hold) + the current cycle's task/bug ledger.
- **[docs/adr/](docs/adr/)** — cross-cutting decisions and their rationale
  (reuse-first, no-full-PDF.js-viewer, config precedence, att-revisability, …).
- **[docs/IDEAS.md](docs/IDEAS.md)** — parking lot for enhancements not yet
  promoted to work.
- **[docs/history/speckit/](docs/history/speckit/)** — archived SpecKit
  artifacts (full user stories / rationale) for the 001 + 002 cycles.
- **[docs/design/](docs/design/)** — parked design docs (viewer convergence).
