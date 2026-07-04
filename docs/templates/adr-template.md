# ADR Template

Use this template to record an **accepted** architectural decision. ADRs are immutable — supersede
with a new ADR instead of editing an old one.

|                     |                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **When to use**     | The decision is made (or being finalized). You need a durable record of _why_.                                         |
| **When not to use** | The decision is still open — use [`rfc-template.md`](rfc-template.md) first. Implementation planning belongs in a TDD. |
| **Skill**           | `create-adr`                                                                                                           |
| **Save to**         | `docs/engineering/adr/NNN-short-kebab-decision.md`                                                                     |
| **Naming**          | Zero-padded number + kebab-case title (e.g. `003-use-redis-for-session-storage.md`)                                    |
| **After saving**    | Add a row to [`docs/engineering/adr/README.md`](../engineering/adr/README.md)                                          |

**Formats**: This template uses **MADR** (structured options comparison). For minimal decisions, see
the Nygard and Y-Statement variants at the bottom.

---

# ADR-NNN: [Noun Phrase — What Was Decided]

- **Date**: YYYY-MM-DD
- **Status**: Accepted | Proposed | Deprecated | Superseded by
  [ADR-NNN](../engineering/adr/NNN-title.md)
- **Deciders**: @Name — role or area
- **Tags**: architecture, [domain], [concern]

## Context and Problem Statement

[Describe the situation and the problem or question that forced this decision. 2–4 sentences. What
constraints, forces, or risks made a choice necessary? What happens if we don't decide?]

## Decision Drivers

- [Driver 1 — e.g., "Must support multi-tenant PHI isolation"]
- [Driver 2 — e.g., "Team has deep PostgreSQL experience"]
- [Driver 3 — e.g., "Must keep App Router layer thin"]

## Considered Options

- **[Option A — short label]**: [One-line description]
- **[Option B — short label]**: [One-line description]
- **[Option C — short label]**: [One-line description — include "do nothing / status quo" when
  relevant]

## Decision Outcome

Chosen option: **"[Option A — short label]"**, because [concise rationale tied to decision drivers —
why this option and not the others].

[Optional: concrete rules, layout, or constraints that follow from the decision.]

### Positive Consequences

- [Benefit 1]
- [Benefit 2]

### Negative Consequences

- [Trade-off 1 — be honest]
- [Trade-off 2]

## Pros and Cons of the Options

### [Option A — short label] ✅ Chosen

- ✅ [Pro 1]
- ✅ [Pro 2]
- ❌ [Con 1]

### [Option B — short label]

- ✅ [Pro 1]
- ❌ [Con 1]
- ❌ [Con 2]

### [Option C — short label]

- ✅ [Pro 1]
- ❌ [Con 1]

## Links

- RFC: [YYYY-MM-proposal-title](../engineering/rfc/YYYY-MM-proposal-title.md) (if applicable)
- Supersedes: [ADR-NNN: Title](../engineering/adr/NNN-title.md) (if applicable)
- Superseded by: [ADR-NNN: Title](../engineering/adr/NNN-title.md) (if applicable)
- Ticket: [GitHub issue #NNN](https://github.com/org/repo/issues/NNN)
- Implementation: `path/to/relevant/code`

---

## Alternative Formats

Use one format per ADR. Delete the sections you don't need.

### Nygard (minimal)

```markdown
# ADR-NNN: [Title]

## Status

Accepted | Proposed | Deprecated | Superseded by ADR-NNN

## Context

[What situation led to this decision? What forces — technical, business, organizational — are at
play? 2–5 sentences.]

## Decision

We will [state the decision in active voice]. [Brief rationale — why this option over the
alternatives.]

## Consequences

[What becomes easier or better? What becomes harder? What new concerns does this introduce?]
```

### Y-Statement (compact)

```markdown
# ADR-NNN: [Title]

**Date**: YYYY-MM-DD | **Status**: Accepted

In the context of **[situation/use case]**, facing **[concern or constraint]**, we decided **[the
option chosen]**, to achieve **[quality attribute or goal]**, accepting **[the downside or
trade-off]**.

**Deciders**: @Name **Links**: [related ADRs, RFCs, tickets]
```
