# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BWS PDF Viewer is a WordPress plugin that embeds a PDF inline with three render
modes (animated flipbook / native PDF.js / image fallback), device-adaptive,
one shared toolbar, WCAG 2.2 AA, multi-domain. It wraps a tiny flipbook library
(18KB) plus PDF.js components in a full WordPress integration.

## Where the docs live (read the owner, don't restate it)

This file is **how-to + onboarding only**. The durable facts live elsewhere,
each with ONE owner — read the owner, link to it, never copy its content here:

| You need… | Owner | Never duplicate it in… |
|-----------|-------|------------------------|
| Goal, file/surface map (`I.*`), glossary | [CONTEXT.md](CONTEXT.md) | CLAUDE.md, SPEC.md |
| Behavioral contract the code MUST hold (`V*`) | [SPEC.md](SPEC.md) §V | CLAUDE.md, CONTEXT.md |
| Cross-cutting decisions + rationale (`ADR-*`) | [docs/adr/](docs/adr/) | CLAUDE.md, SPEC.md |
| Current cycle's tasks / bug ledger | [SPEC.md](SPEC.md) §T/§B | anywhere |
| Public usage: install, shortcode examples, filter-hook cookbook, requirements | [README.md](README.md) | CLAUDE.md |
| Non-bug work index (enhancements, open questions, wayfinder efforts) | [docs/future-work.md](docs/future-work.md) | GitHub Issues |
| The tracker split (GitHub vs `.scratch/` vs `future-work.md`), id forms, publication | [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) | other docs (CLAUDE.md keeps only the spec-lifecycle pointer) |

The **authoritative shortcode att list** (names, defaults, sanitizers) is
`$default_options` / `shortcode_atts()` in `bws-pdf-viewer.php` — SPEC V8 tracks
the live surface, README documents the not-obvious-from-name behavior; neither
re-lists the defaults.

**Drift rule:** if a fact already has an owner above, this file (and any other)
POINTS to it — one sentence + link — instead of restating it. On any conflict,
the owner wins; fix the owner, not the copy. See [§ Doc discipline](#doc-discipline)
below.

## Build Commands

`npm run start` (production build → `/dist`) · `npm run test` (dev server, live
reload) · `npm run clean` (wipe `/dist`). Public build/install steps: README
§ Development / § Installation.

## Architecture at a glance

Full surface map + what each file owns: [CONTEXT.md](CONTEXT.md) § Surfaces.
The three render modes, device detection, PDF.js layers, book layouts,
container-responsiveness, and accessibility are all specified as invariants in
[SPEC.md](SPEC.md) §V (V1–V4, V7, V13, V21, V28, …) — read those for the
contract, not a prose paraphrase.

Delivered JS artifacts (3 files, 3 concerns — SPEC V26):
- `dist/bws-viewer-engines.js` — UMD bundle of all 3 render engines (flip +
  native + image), routed by `src/index.js`. Name says `-engines`, NOT flip,
  because it is not flip-only. UMD global is still `flipbook` (legacy).
- `dist/pdf.js` + `dist/pdf.worker.js` — Mozilla PDF.js lib + auto-chunked
  worker (webpack zero-config — ADR-0006).
- `includes/bws-pdf-viewer.js` — WordPress integration glue (device detect,
  mode select, `createBookWrapper`, responsive, keyboard nav, shared toolbar).

### Data Flow

1. User adds shortcode: `[bws_pdf]https://example.com/doc.pdf[/bws_pdf]`
2. PHP `BWS_PDF_Viewer::shortcode_handler` outputs a container div with a
   `data-config` attribute (config merged 3-tier — ADR-0005).
3. `includes/bws-pdf-viewer.js` reads config, detects device, picks native vs
   image, calls `loadPDF()`.
4. PDF.js loads the document; `createBookWrapper()` exposes the book interface
   (`numPages()`/`numSpreads()`/`slotToPage()`/`getPage()` — SPEC V28).
5. Router in `src/index.js` selects the viewer (SPEC V1); the viewer renders to
   the container.

## Important Notes

### Script Load Order

WordPress enqueues in this order (`BWS_PDF_Viewer::register_assets()`):
1. `bws-pdfjs-lib` (`pdf.js` — main lib, worker auto-loaded)
2. `bws-pdf-viewer-lib` (`bws-viewer-engines.js`)
3. `bws-pdf-viewer-wp` (WordPress integration)

The worker (`pdf.worker.js`) is auto-loaded by `pdf.js` via webpack's dynamic
import — no separate registration (ADR-0006).

### @tpp/htm-x Import Usage

```javascript
import { h } from '@tpp/htm-x';     // Element CREATION (use this everywhere)
import { getH } from '@tpp/htm-x';  // DOM lookup by ID (ONLY in src/index.js)
```

- `h('div.classname')` creates DOM elements.
- `getH('element-id')` gets an existing element. It is NOT a factory —
  `const h = getH()` fails with "getH is not a function".

### HiDPI Support

Both the core library and the WP integration read `window.devicePixelRatio` and
render the canvas at higher resolution for Retina. See `outputScale` in
`src/flipbookviewer.js` and `includes/bws-pdf-viewer.js`.

## Development Workflow

`dist/` is generated and untracked — a fresh clone has none. Run `npm ci &&
npm run start` before the plugin will render (local dev installs symlink the
repo root, so they read `dist/` off disk). Releases build their own via CI.

1. Edit `src/` files.
2. `npm run test` → dev server at http://localhost:8080; test with pages in `/test`.
3. `npm run start` for a production build.
4. Upload changed built files to the WordPress plugin dir:
   `dist/bws-viewer-engines.js`, `dist/pdf.js`, `dist/pdf.worker.js` (if changed),
   `includes/bws-pdf-viewer.js`, `includes/bws-pdf-viewer.css`,
   `bws-pdf-viewer.php` (each if changed).
5. Hard refresh (Ctrl+F5) — browser/WordPress cache old scripts otherwise; bump
   the version in `bws-pdf-viewer.php` for cache busting.
6. Test the WordPress integration.

## Troubleshooting

- **"Setting up fake worker" warning** → webpack not on the zero-config path;
  see ADR-0006 ([docs/adr/0006-pdfjs-zero-config-webpack.md](docs/adr/0006-pdfjs-zero-config-webpack.md)).
- **"getH is not a function"** → wrong `@tpp/htm-x` import; use `h` to create,
  `getH` only to look up (above).
- **Browser shows old JS after upload** → hard refresh (Ctrl+F5), DevTools →
  Network → Disable cache, and bump the plugin version for cache busting.

## Extending the Plugin

Shortcode attributes: SPEC V8 is the live surface (revisable pre-1.0 — ADR-0007);
README has usage examples; `$default_options` / `shortcode_atts()` in
`bws-pdf-viewer.php` is authoritative for names/defaults/sanitizers.

### Adding a new shortcode parameter

Thread it through all five layers (matches the 3-tier precedence — ADR-0005):
1. `$default_options` in `BWS_PDF_Viewer`
2. `shortcode_atts()` in `shortcode_handler()`
3. the `$config` array in the handler
4. `initViewer()` in `includes/bws-pdf-viewer.js`
5. an admin field in `includes/admin.php`

Then update the SPEC V8 att surface.

### Supporting Non-PDF Sources

The core library takes any book source via the book interface:

```javascript
{ numPages: () => number, getPage: (num, cb) => CanvasImageSource }
```

See `test/book-imgs.js` for an image-based example.

## Doc discipline

Keep the doc set from drifting. When you touch code or docs:

1. **One fact, one owner.** Every durable fact belongs to exactly one file (the
   table under [§ Where the docs live](#where-the-docs-live-read-the-owner-dont-restate-it)).
   Everyone else links to the owner. If you catch yourself pasting a config
   block, an att list, or an invariant into a second file — stop, link instead.
2. **Change the owner, sweep the pointers.** When a fact changes, edit its owner
   file, then grep for stale pointers/copies and update or delete them. A
   pointer may name a term (`ADR-0006`, `V28`) but MUST NOT restate its body.
3. **New durable fact → route it.** Decision/rationale → new ADR (bump the
   `docs/adr/README.md` index). Behavioral guarantee → new `V*` in SPEC §V.
   Domain term / surface → CONTEXT.md. How-to → here. Enhancement or open question → a new `FW-N` item in `docs/future-work.md`.
4. **On any conflict, the owner wins.** This file is narrative and may lag;
   CONTEXT/ADR/SPEC are the source of truth. Reconcile toward the owner.
5. **Recalled memory can be stale.** A `[[memory-slug]]` or MEMORY.md line
   reflects what was true when written; verify the named file/flag/att still
   exists before acting on it.

## Spec lifecycle and tracked prose

Specs and tickets are private working files (`.scratch/<slug>/`); they die at merge. At merge a finished spec is lifted into `docs/design-history/` (moved, not copied; the PR body is the second record), and its load-bearing parts migrate out: invariants → SPEC §V, decisions → ADRs, delta → `readme.txt` changelog, cause → commit body. An unbuilt plan is never lifted. Full rules: `docs/agents/issue-tracker.md` § Publication.

Tracked prose is scanned. `scripts/check-private-citations.sh` fails any committed file other than `docs/future-work.md` that cites a literal `.scratch/` or `.claude/` path (cite the `FW-N` id instead); `scripts/check-tracked-pii.sh` fails local paths, emails and unlisted domains. Both run in CI (`.github/workflows/committed-content-guards.yml`) and are proven by `scripts/self-test-guards.sh`. The repo is public.

## Agent skills

### Issue tracker

Hybrid, split on one question: must the record outlive the change? Bugs and anything an outsider waits on live in GitHub Issues in `davidofchatham/bws-pdf-viewer` (fork; `gh` default pinned to origin) via the `gh` CLI. Specs, build tickets and wayfinder efforts live in gitignored `.scratch/`, indexed by the committed `docs/future-work.md`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five-role vocabulary (`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
