# GLOSSARY — BWS PDF Viewer

Terms this project uses deliberately — do not drift to synonyms. A term's rejected names, where there were any, sit on its entry. The goal, file map and invariants live in [docs/architecture.md](docs/architecture.md).

> **This file OWNS the project's vocabulary.** Other docs link here; they must not restate these. Anti-drift rules: CLAUDE.md § Doc discipline.

## Vocabulary

- **flipbook mode** — animated page-turn viewer; the flipbook library ALWAYS
  renders a 2-page spread (no one-page-at-a-time mode). `view_mode="flipbook"`.
- **document mode** — continuous vertical page stack. Stored/attr value is
  `document` (legacy alias `singlepage`); the admin dropdown labels it
  **Continuous**. Grows unbounded into page flow — NOT one-page-at-a-time
  despite the `singlepage` internal name. See FW-2 in [docs/future-work.md](docs/future-work.md).
  _Rejected:_ "single-page" as the name (reads as one page at a time; kept only as the legacy att alias).
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
  future mode taxonomy; NOT yet in the code. See FW-5 and
  [docs/design/viewer-convergence.md](docs/design/viewer-convergence.md).
