# Future work tracker

**Not a roadmap.** No committed timeline on anything here. This is a single *visible* index of non-bug work: the tracked, reviewable surface over detail homes that are mostly private (`.scratch/` is gitignored). It duplicates no detail; open the linked home for the full design and rationale. One heading block per **`FW-N` id**.

- **Bugs do NOT go here** → GitHub Issues. See `docs/agents/issue-tracker.md` for the split and why.
- **Detail lives in its home**: a `.scratch/plans/*.md` file, a wayfinder `map.md`, or a committed design doc. An item states only *that the work exists, what gates it, what it touches, where it stands, and where to read more*.
- **Cross-refs use ids, never prose**, so a reworded item never orphans a reference. `FW-7` is an item here · `#7` is a GitHub issue · `<effort>/03` is a local ticket. A bare integer is ambiguous between all three.
- **Ids are permanent.** A shipped or cut item's id retires to the Closed / retired ledger, never reused or reassigned. `FW-1` to `FW-12` kept the numbers they had as `docs/IDEAS.md` rows (retired 2026-11-02), so an old "IDEAS #N" is `FW-N`.

## Index

- [Item shape](#item-shape)
- [Progress, not status](#progress-not-status)
- [Trackers](#trackers)
  - [Viewer modes and architecture](#viewer-modes-and-architecture)
  - [Naming and packaging](#naming-and-packaging)
  - [Controls and accessibility](#controls-and-accessibility)
  - [Authoring](#authoring)
- [Closed / retired](#closed--retired)
- [Maintenance](#maintenance)

## Item shape

Each item is a `#### FW-N — <title>` heading followed by a fixed set of labeled lines:

- A **description** paragraph (1-3 sentences): what the item IS. Stable, rarely re-edited; not current state, not history.
- **Detail home:** where the design/rationale and the implicit certainty (concept vs planned) live. Never duplicated here.
- **Progress:** where the work actually stands. Always present, even if just "Not started." Rules below.
- **Open:** what's still undecided or unbuilt, when there's a real done/open split. Omitted when there's nothing beyond Progress worth stating separately.
- **Blocked by:** hard prerequisite, typed (below). **Interacts with:** soft coupling (reshapes, or is reshaped by) as `FW-N` ids, never a gate. Both on one line; `—` means unblocked.

### Typed blockers

A blocker is written as `<type>:<referent>`, because this field is agent-maintained and the type is what tells an agent whether it may act on the cell:

| Type | Means | Clears when |
|---|---|---|
| `row:FW-N` | Another item must land first | That item reaches Closed / retired; **an agent may clear it unasked** |
| `ship:X.Y.Z` | A version must ship first | That version is released; **an agent may clear it unasked** |
| `decision:<what>` | An open human choice | A human makes it. **Never auto-cleared, never auto-started** |
| `code:<condition>` | A state elsewhere that does not hold yet | The condition holds. Re-derivable by grep, so an agent may clear it, but must state the check in Progress |
| `—` | Unblocked | — |

**A blocker states a CODE FACT, never a scheduling preference**: "this cannot land until X", not "do this after X". If the ordering is a preference, it belongs in the description, not here.

> **Agent pickup:** an item is startable when `Blocked by:` is `—` or every `row:`/`ship:`/`code:` gate it names is satisfied. **A `decision:` gate is human-resolved. Do not auto-start it**, and do not resolve the decision yourself to unblock it. `Interacts with:` never blocks. An item whose Progress says a build is live is already being worked; read its Detail home for real state before touching it.

## Progress, not status

A `Progress:` line is allowed, but only for statements that stay true FOREVER once true: a half shipped, a measurement taken, a condition met. "Phase 2 of 3, ~60% done" is stale the moment work continues, so live estimates, phase names, percent-done and remaining-task counts belong in the branch, the plan, or the commit that owns the real state. **Progress is a few lines, never a build log.**

**There is no In-flight section.** Lifecycle is two-valued: an item is in a tracker section, or it is in **Closed / retired**. Progress carries the "someone is building this" bit by naming the branch or commit that holds the real state.

## Trackers

### Viewer modes and architecture

#### FW-1 — Contained Continuous viewer

The Continuous page stack bounded in a fixed-height box that scrolls internally, toolbar pinned to the box edge (PDF.js-style), instead of growing into page flow. A layout wrapper on existing Continuous, not a new render mode. The convergence design carries it as the `contain` value of the containment axis.

Detail home: `.scratch/plans/ideas.md` §FW-1; `docs/design/viewer-convergence.md` (containment axis)

Progress: Not started.

Blocked by: decision:whether FW-1 is built standalone or left to the FW-14 containment axis  •  Interacts with: FW-5, FW-14

#### FW-5 — Two-axis viewer-mode taxonomy

Reframe the flat mode list (`document` / `flipbook`) as orthogonal axes, subsuming FW-1 to FW-3. Refined into three axes (containment, arrangement, transition) by `docs/design/viewer-convergence.md`.

Detail home: `.scratch/plans/two-axis-taxonomy.md`; `docs/design/viewer-convergence.md`

Progress: Refined 2026-07-09 (flip moved off presentation onto a transition axis). Not ratified; ratification is the first ticket of FW-14.

Blocked by: decision:axis vocabulary ratified (`viewer-convergence/01`)  •  Interacts with: FW-1, FW-2, FW-3, FW-14

#### FW-11 — Thumbnail → modal-overlay launch mode

A compact thumbnail surface (first page, click-to-expand) that opens the full viewer in a modal overlay, in whatever mode and axes are configured. A launch surface orthogonal to the render axes, so the converged core must not assume it mounts inline.

Detail home: `.scratch/plans/ideas.md` §FW-11

Progress: Not started.

Open: which page(s) the thumbnail shows; focus trap, ESC and scroll lock for WCAG 2.2 AA; the shortcode attr that opts in.

Blocked by: code:convergence spec ratified (`viewer-convergence/01` resolved)  •  Interacts with: FW-14

#### FW-14 — Viewer convergence: one accessible core, flip as transition effect

Converge the three engines onto a persistent native core with a transient flip-animation overlay, with a progressive-enhancement escape hatch to instant swap. Local wayfinder effort; the destination is a ratified ADR plus SPEC V-invariants, then implementation.

Detail home: `.scratch/viewer-convergence/map.md`; committed design docs `docs/design/viewer-convergence.md`, `docs/design/responsive-model.md`, `docs/reference/pdfjs-reuse-menu.md`

Progress: Engine pick (own Canvas-2D warp), native-core rung (builders plus `PDFPageView`) and responsive model decided in GitHub tickets #10 to #15 and #18, all closed. Open local tickets: `viewer-convergence/01` (ratify the spec), `viewer-convergence/02` (seam test suite spec).

Open: the ADRs and V-invariants; N-up arrangement; image-fallback fate; toolbar dock side.

Blocked by: —  •  Interacts with: FW-1, FW-2, FW-5, FW-6, FW-7, FW-8, FW-11, FW-12, FW-13

### Naming and packaging

#### FW-2 — Rename "document" → "Continuous"?

The admin dropdown label already says "Continuous", but the stored `view_mode` value and shortcode attr are still `document`. Decide whether the value and attr are renamed to `continuous`; if yes, FW-3 rides along.

Detail home: `.scratch/plans/ideas.md` §FW-2

Progress: Not started. Naming should land in the FW-5 vocabulary, not the old one.

Blocked by: decision:whether the stored value and attr become `continuous`  •  Interacts with: FW-3, FW-5, FW-14

#### FW-3 — Deeper internal rename (`singlepage` → continuous)

Rename the internal JS `singlepage` config key, `singlePageViewer` function and `singlepageviewer.js` file across src, build and tests. Large churn for consistency only.

Detail home: `.scratch/plans/ideas.md` §FW-3

Progress: Not started.

Blocked by: row:FW-2  •  Interacts with: FW-2, FW-5

#### FW-6 — Split engine bundle + rename UMD global

Two follow-ons to the `bws-viewer-engines.js` rename: (a) split the single bundle into per-engine chunks lazy-loaded by mode, so mobile never ships code it will not use; (b) rename the UMD global `flipbook`, which still misnames the multi-engine entry.

Detail home: `.scratch/plans/ideas.md` §FW-6

Progress: The bundle rename (SPEC V26) shipped. Split and UMD rename not started.

Blocked by: decision:whether per-engine chunking survives convergence (one core, one bundle)  •  Interacts with: FW-12, FW-13, FW-14

#### FW-12 — Formalize the flipbook-viewer fork

Make the embedded `src/flipbookviewer.js` a public, standalone fork of the library, separate from the plugin, consumed as a git dependency pinned to a tag. Extract after the convergence implementation lands, because the seam is still moving; that is an ordering preference, not a gate.

Detail home: `.scratch/flipbook-lib-extraction/plan.md`

Progress: Plan settled 2026-11-02; not started.

Open: library package name and versioning.

Blocked by: —  •  Interacts with: FW-6, FW-14

#### FW-13 — Dedup PDF.js internals bundled twice

`dist/bws-viewer-engines.js` bundles a second copy of PDF.js display internals alongside `dist/pdf.js` (about +182KB). Functional, wasted wire bytes only. ADR-0008 accepts it for now; the convergence design resolves it as a side effect.

Detail home: `docs/adr/0008-pdfjs-double-bundle-debt.md`; `.scratch/plans/pdfjs-double-bundle.md` (the three dedup options)

Progress: Not started. Migrated here from GitHub #4 on 2026-11-02.

Blocked by: —  •  Interacts with: FW-6, FW-14

### Controls and accessibility

#### FW-7 — Zoom controls

Pinch and ± zoom for the viewer. Held back from the toolbar-icons effort. Flipbook `viewer.zoom(level)` exists but is unwired to the toolbar; native and image engines have a `scale` multiplier but no exposed `zoom()`.

Detail home: `.scratch/plans/ideas.md` §FW-7

Progress: Not started.

Open: whether ± zoom applies to Continuous mode at all.

Blocked by: decision:whether ± zoom applies to Continuous mode  •  Interacts with: FW-14

#### FW-8 — In-viewer search

Full-text find across the PDF with highlight and prev/next hits. Native mode already has the text layer; this is enabled by, not part of, the PDF.js component adoption. Not a shortcode attr.

Detail home: `.scratch/plans/ideas.md` §FW-8

Progress: Not started.

Blocked by: —  •  Interacts with: FW-14

#### FW-10 — Screen-reader announcer vs range counter mismatch

The visible counter shows a spread's page range (`5–6 of 12`) but `announcePageChange` still announces only the rightmost real page. Teach the announcer to speak the range ("Pages 5 to 6 of 12", collapsing to "Page N of 12" for a lone page).

Detail home: `.scratch/plans/ideas.md` §FW-10

Progress: Not started. Deliberately out of scope for SPEC V33, which covers the visible counter only.

Blocked by: —  •  Interacts with: —

### Authoring

#### FW-9 — Gutenberg block authoring

A block-editor UI to insert and configure the viewer instead of hand-writing the `[bws_pdf]` shortcode. Shortcode-only so far.

Detail home: `.scratch/plans/ideas.md` §FW-9

Progress: Not started.

Blocked by: decision:when the SPEC V8 shortcode attr surface is frozen  •  Interacts with: —

## Closed / retired

Append-only ledger. Ids are **permanent**: a retired `FW-N` is never reused or reassigned, and this ledger is the only record of the high-water mark.

| ID | Item | Outcome | Landed / detail home |
|---|---|---|---|
| FW-4 | First / last page jump buttons | Shipped in the toolbar-icons effort (SPEC T30, 2026-07-09); no separate GitHub issue. | `SPEC.md` V6 |

## Maintenance

- **Order by id.** Items within a tracker section, and rows in Closed / retired, sit in ascending `FW-N` order. A new item goes at the end of its section; a closing row slots in by number.
- **New non-bug idea** → add a `#### FW-N` heading block under the right tracker section, using **(highest live id ∪ highest retired id) + 1**; never reuse a retired id. Put the detail in a home, not here. Don't let work exist *only* in a hidden file with no item here.
- **Build starts** → say so in `Progress:`, naming the branch or commit that owns the real state. Do not record phase, commit or remaining-task counts in the item.
- **Ships** → move the item to **Closed / retired** as a row, collapsing description + progress into one Outcome cell, and point Landed at the commit or file that holds the result. Then append ` (closed)` to its id wherever a live item's `Interacts with:` names it.
- **`Interacts with:` is recorded on both sides.** A one-sided link is invisible from the item that needed to see it.
- **An item may carry a COUNT only when the count IS the deliverable.** An argument count, cited as evidence for a claim, decays into a false statement that still reads as current.
- **Cut work retires too.** A withdrawn item moves to the ledger with its outcome; a deleted item reads as an id that never existed.

<!--
Detail-home paths under `.scratch/` are gitignored and unreadable to anyone but
the author -- that is the point of this file, not a defect in it. A committed
file elsewhere in the repo must cite the FW id, never the path.
-->
