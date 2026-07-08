# Quickstart: Verifying the Integrated Viewer Toolbar

**Feature**: 002-integrated-viewer-toolbar

## 1. Automated harness (fast loop, no WordPress)

```bash
npm run start                      # production build to /dist
npx http-server -p 8123 -c-1 &     # serve repo root
node test/verify-toolbar.js        # toolbar + regression assertions
node test/verify-t028-t029.js      # feature-001 regression gate (must still pass)
```

`test/harness-toolbar.html` renders: (a) document-mode embed, (b) flipbook embed, (c) flipbook
in a 300px column, (d) `show_controls="false"` embed. Assertions follow
`contracts/toolbar-dom.md` invariants 1–10 plus page-jump commit/clamp/restore, counter sync,
reinit page preservation, and text-layer span presence after the component swap.

## 2. Manual — dev server (constitution §V)

`npm run test` → http://localhost:8080, test pages in `/test/`.

| # | Check | Pass condition |
|---|-------|----------------|
| 2.1 | Toolbar parity | Document + flipbook toolbars visually identical, docked inside frame |
| 2.2 | Page jump valid | Type page number, Enter → lands on page/spread ≤2s, field shows landed page |
| 2.3 | Page jump invalid | "abc", "", "0", "999" → no navigation or clamp to bounds; field restored |
| 2.4 | Roving focus | One Tab stop into toolbar; ←/→ move between controls; Home/End first/last; arrows inside toolbar do NOT flip pages |
| 2.5 | Input editing | Arrows edit value while input focused; Escape restores |
| 2.6 | Fullscreen | Toolbar visible IN fullscreen; label toggles enter/exit |
| 2.7 | Narrow container | 300px column: all controls reachable, none clipped |
| 2.8 | Reinit survival | Resize across 768px: toolbar present, current page preserved |
| 2.9 | Reduced motion | OS reduce-motion on: page jump instant, no flip animation |
| 2.10 | Text selection | Document mode: select + copy text on pages 1, 50, 100 of a long PDF |
| 2.11 | Ctrl+F | Browser find locates phrase on a rendered page |
| 2.12 | Links | External PDF link opens new tab (noopener); internal destination navigates |
| 2.13 | Memory | Scroll 100+ page PDF; DevTools memory stable; far pages release |
| 2.14 | Single-page PDF | Prev/next disabled; input rejects values ≠ 1 |

## 3. Manual — screen reader

NVDA (Windows) or VoiceOver (iOS):
- Toolbar announced as "PDF viewer controls, toolbar"; each control announces its label.
- Page changes announce "Page N of M" — identical wording to previous release.
- Page input announces "Page number" and current value; commit announces resulting page.

## 4. Manual — WordPress install

- Existing pages (unedited) with: no attributes; `show_controls="false"`;
  `show_fullscreen="false"`; `show_print="false"` → each renders per its attributes (US3).
- Two embeds on one page, different column widths → independent layouts, both toolbars work.
- iOS Safari 18+ (PDF.js 6 floor): fullscreen button ABSENT (not disabled); numeric keyboard
  raised by page input; touch targets comfortable.

## 5. Release gate

- ESLint zero errors; webpack zero errors.
- Feature-001 harness still green (SC-006).
- Version bumped in `bws-pdf-viewer.php`; changelog entry added.
