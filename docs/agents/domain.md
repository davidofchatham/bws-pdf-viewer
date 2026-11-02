# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root: the project's vocabulary, with a `Rejected:` line where a name lost.
- **`docs/architecture.md`**: the architecture home. The goal, the file map (`I.*`) and the invariants (`V*`), each with a `Rejected:` list for the alternatives that lost. Read the invariants that touch the area you are about to work in.
- **`docs/adr/README.md`**: the redirect map for retired ADRs, and the bar a new one must clear. Read an ADR file only if the map lists it as a survivor (today `0003`, pending retirement).

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront.

## Who owns what

| Concern | Owner |
|---|---|
| Vocabulary | `GLOSSARY.md` |
| Goal, file map, invariants, rejected alternatives | `docs/architecture.md` |
| Per-class enforced invariants | PHPDoc on the enforcing class |
| Non-bug work (enhancements, open questions) | `docs/future-work.md` |
| Bugs | GitHub Issues |
| Tracker split, spec lifecycle | `docs/agents/issue-tracker.md` |
| Public usage, install, shortcode examples | `README.md` |
| Version history | the `readme.txt` changelog |
| Finished specs | `docs/design-history/` |

## Where a decision lives

Cite the anchor, never a spec coordinate: an invariant by its id (`V28`), a term by its glossary entry. The decision and its rejected alternative sit there too.

- A naming decision is a glossary entry with a `Rejected:` line.
- An invariant's rationale and the alternatives that lost go in a `Rejected:` list under that `V*`.
- A per-class invariant goes in PHPDoc on the enforcing class.
- A process decision goes in `CLAUDE.md` or `docs/agents/`.
- A proposal not yet accepted is an `FW-N` item in `docs/future-work.md`.
- A removal or behavior change goes in the changelog.

## ADRs are rare: do not mint one in ordinary work

An ADR is written only when all six hold: hard to reverse, surprising without context, a real trade-off, not decided this session, already shipped, and not vocabulary. Process decisions never qualify. The full bar is in `docs/adr/README.md`. Do not offer an ADR for a rejected candidate or a settled choice; add a `Rejected:` entry on the anchor instead.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to a synonym the glossary rejects. If the concept isn't in the glossary yet, either you are inventing language the project doesn't use (reconsider) or there is a real gap (note it).

## Flag conflicts with a Rejected entry

If your output proposes an alternative that an invariant's `Rejected:` list or a glossary `Rejected:` line already names, surface it explicitly and argue against the recorded reason rather than restating the proposal:

> _Proposes the full PDF.js viewer, rejected under V15 (fights our toolbar and theming), but worth reopening because…_
