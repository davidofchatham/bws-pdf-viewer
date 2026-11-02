# Issue tracker: hybrid, local specs and GitHub bugs

Two homes, split by ONE question: **must the record outlive the change?**

| Work | Home | Why |
|---|---|---|
| Bugs (a claim that is wrong, behavior that regressed); anything someone outside waits on; a defect class on its 2nd instance | GitHub Issues (`gh` CLI) | Durable, externally visible. |
| A spec (PRD) for one in-flight piece of work | `.scratch/<feature-slug>/spec.md` | Rewritable in place; readable during a GitHub outage; dies at merge |
| The build tickets it breaks into | `.scratch/<feature-slug>/issues/<NN>-<slug>.md` | Numbered per feature from `01`, so they never collide with `#N` |
| A wayfinder effort | `.scratch/<effort>/map.md` + `issues/NN-<slug>.md` | Local only; never against GitHub |
| Non-bug future work (enhancements, open questions) | `docs/future-work.md` (committed) over a `.scratch/` detail home | The visible index; see its own intro |
| PUBLICATION of in-flight work | the pull request body, or the commit body when there is no PR | One durable record, at the moment it is reviewable |

`.scratch/` is gitignored. Nothing under it is ever committed. Two things live there and they are not the same shape: `.scratch/<feature-slug>/` is one piece of in-flight work and dies at merge, while `.scratch/plans/` holds long-lived design plans that can outlast many features.

**Every local item also gets a `docs/future-work.md` item.** Work tracked only in a hidden file is work nobody can see.

## The local half

- One feature per directory: `.scratch/<feature-slug>/`
- Spec at `.scratch/<feature-slug>/spec.md`
- Tickets one file each at `issues/<NN>-<slug>.md`, `01` up, dependency order, never one combined file
- Triage state is a `Status:` line near the top (role strings in `triage-labels.md`)
- Blocking is a `Blocked by: NN, NN` line near the top
- Conversation appends under a `## Comments` heading
- **Cite a local ticket as `<feature-slug>/NN`, never a bare integer**

## The GitHub half

- Create: `gh issue create --title "..." --body "..."` (heredoc for multi-line)
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

This repo is a fork (`origin` = `davidofchatham/bws-pdf-viewer`, `upstream` = `theproductiveprogrammer/flipbook-viewer`). `gh` default repo is pinned to `origin` so issue commands target our fork, not upstream. If `gh` ever starts targeting upstream, re-run `gh repo set-default davidofchatham/bws-pdf-viewer`.

## IDs never appear bare

Three sequences coexist. Every citation carries its marker, always:

- `FW-14`: a `docs/future-work.md` tracker item
- `#14`: a GitHub issue
- `<feature-slug>/03`: a local ticket

A bare integer is ambiguous between all three. A citation of another repo's id names the repo too, since every project here has its own `FW-N` sequence.

## Committed files never cite a private path

`.scratch/` and `.claude/` resolve for one person and fail silently for everyone else. A committed file cites a live plan through its `FW-N` id and a finished spec through its lifted `docs/design-history/` path. `docs/future-work.md` is the one exempt file. A path containing a `<placeholder>` or a `*` is a pattern, not a citation. `scripts/check-private-citations.sh` enforces this in CI.

## Publication

- A finished spec lifts into `docs/design-history/` at merge, as the normal path. The file moves; no copy stays in `.scratch/`. A partial lift leaves the remainder and says it is an extract. Sanitize while lifting: this repo is public and `scripts/check-tracked-pii.sh` scans what lands.
- A lifted file is frozen, except that an INCORRECT identifier (a renamed version, a wrong SHA, a dead issue number, a moved path) is repaired in place. A STALE claim is not: a design the code has since moved past was true when written.
- Never lift an unbuilt plan.
- The PR body is the second record, not a substitute: it holds the review conversation and what changed under challenge. Where there is a PR, write both.
- Load-bearing parts migrate out at ship: invariants → SPEC §V, decisions → `docs/adr/`, delta → `readme.txt` changelog, cause → commit body.
- Code cites anchors (`V*`, `ADR-*`), never spec coordinates.

## PRs as a request surface

Not a request surface. `/triage` works GitHub Issues only; pull requests are code review.

## When a skill says "publish to the issue tracker"

- A **spec** → write `.scratch/<feature-slug>/spec.md`.
- **Build tickets** → write one file each under `.scratch/<feature-slug>/issues/`.
- A **bug**, or anything whose record must outlive the change → `gh issue create`.
- Unsure → ask. Do not default to GitHub.

**Text that will be POSTED is not hard-wrapped.** GitHub renders issue comments, issue bodies, PR bodies and review comments with GFM's line-break extension, where a single newline becomes a `<br>`. One paragraph, one line; blank lines separate blocks; tables and list items keep their own lines.

## When a skill says "fetch the relevant ticket"

A path → read the file. A bare `#42` → `gh issue view 42 --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** per ticket. Local only; wayfinding never runs against GitHub Issues here.

- **Map**: `.scratch/<effort>/map.md`, with Notes / Decisions-so-far / Fog.
- **Child**: `.scratch/<effort>/issues/NN-<slug>.md`, from `01`, question in the body. `Type:` records `research`/`prototype`/`grilling`/`task`; `Status:` records `open`/`claimed`/`resolved`.
- **Blocking**: `Blocked by: NN, NN`. Unblocked when every listed file is `resolved`.
- **Frontier**: open, unblocked, unclaimed; lowest number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under `## Answer`, set `Status: resolved`, then append a context pointer to Decisions-so-far in `map.md`.
