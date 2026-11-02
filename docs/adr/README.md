# Architecture Decision Records

An ADR is the exception here. A decision lives with the thing it justifies:

| Decision about | Home |
|---|---|
| A term, and why it beat the names that lost | the entry in [GLOSSARY.md](../../GLOSSARY.md), as a `Rejected:` line |
| An invariant, and why it is the rule | the `V*` in [docs/architecture.md](../architecture.md), as a `Rejected:` list |
| A per-class enforced invariant | PHPDoc on the enforcing class |
| A proposal not yet accepted | an `FW-N` item in [docs/future-work.md](../future-work.md) |
| A process decision | [CLAUDE.md](../../CLAUDE.md) and `docs/agents/`; `git log` on them is the record |
| A removal or a behavior change | the changelog entry |

An ADR is written only when all six hold:

1. **Hard to reverse.** Changing your mind costs real work (a storage shape, a wire format), not a naming or layout preference.
2. **Surprising without context.** A reader asks "why this way?", not "what is this called?"
3. **A real trade-off.** You can name the alternative that lost and why.
4. **Not same-session.** The decision has survived at least one attempt to reopen it.
5. **Shipped.** No `proposed` ADRs; unbuilt intent is an `FW-N` item.
6. **Never vocabulary.** A naming decision is a glossary entry.

Process decisions never qualify. A repo with no stored data a user cannot be migrated off should expect to write none.

Numbers are permanent: a retired number is never reused, and the gap says it was tried and retired. Code and docs cite the invariant (`V28`), not an ADR number.

## Redirect map

The eight ADRs were extracted from the old spec in one commit and none was ever tested against the bar above. None cleared it.

| ADR | Outcome | Now lives at |
|-----|---------|--------------|
| 0001 Reuse-first | retired | `Rejected:` under V9; the working rule in [CLAUDE.md](../../CLAUDE.md) § Working rules |
| 0002 No full PDF.js viewer | retired | `Rejected:` under V15 |
| [0003](0003-container-width-responsive.md) Container-width responsive | accepted, pending retirement | retires with the arrangement-axis design (FW-15); V3 and V24 meanwhile |
| 0004 Plugin URL rewriting | retired | V35, and PHPDoc on `register_assets()` |
| 0005 Three-tier config precedence | retired | V5, and PHPDoc on `shortcode_handler()` |
| 0006 PDF.js zero-config webpack | retired | the comment at the `pdfjs-dist/webpack.mjs` entry in `webpack.config.js` |
| 0007 Shortcode atts revisable pre-1.0 | retired | `Rejected:` under V8; the working rule in [CLAUDE.md](../../CLAUDE.md) § Working rules |
| 0008 PDF.js double-bundled | retired | accepted debt, tracked as FW-13 |
