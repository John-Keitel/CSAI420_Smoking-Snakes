# RFC Template

Use this template to **propose and decide** between meaningful alternatives before committing to a
direction. The RFC is the discussion history; once accepted, create an ADR for the durable decision
record.

|                     |                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **When to use**     | Multiple viable options, cross-team impact, vendor/platform choice, migration strategy, durable engineering standard               |
| **When not to use** | Decision fits in a single feature TDD; trivial or easily reversible choice                                                         |
| **Skill**           | `create-rfc`                                                                                                                       |
| **Save to**         | `docs/engineering/rfc/YYYY-MM-short-kebab-title.md`                                                                                |
| **After decision**  | Create an ADR in `docs/engineering/adr/`; add a row to [`docs/engineering/rfc/README.md`](../engineering/rfc/README.md) if present |

---

# RFC: [Clear, Action-Oriented Title]

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| **Impact**       | HIGH / MEDIUM / LOW                              |
| **Status**       | NOT STARTED / IN PROGRESS / COMPLETE             |
| **Driver**       | @Name — responsible for the proposal             |
| **Approver**     | @Name1, @Name2 — must approve before action      |
| **Contributors** | @Name3, @Name4 — provide input                   |
| **Informed**     | @Team, @Stakeholder — kept in the loop           |
| **Due Date**     | YYYY-MM-DD (or TBD)                              |
| **Resources**    | [Link to issue], [Link to design], [Related RFC] |
| **Created**      | YYYY-MM-DD                                       |
| **Last Updated** | YYYY-MM-DD                                       |

## Background

[2–4 paragraphs describing the current state and why a decision is needed.]

**Current State**: [What exists today? What system, process, or situation does this RFC address?]

**Problem or Opportunity**: [Specific pain point, risk, or opportunity. Include data where possible
— e.g., "10h/week on X" or "3 incidents last quarter".]

**Why Now**:

- [Business driver — deadline, market change, regulatory requirement]
- [Technical driver — scaling limit, security risk, accumulating debt]
- [Team driver — onboarding friction, process inefficiency]

**What Happens If We Don't Decide**:

- [Consequence 1 — continued cost, growing risk]
- [Consequence 2 — missed opportunity]

## Assumptions

[Explicit statements taken as true for this proposal. If any assumption proves false, revisit this
RFC.]

| #   | Assumption                                               | Owner | Confidence          | Invalidation Trigger         |
| --- | -------------------------------------------------------- | ----- | ------------------- | ---------------------------- |
| 1   | [e.g., "Traffic will not exceed 10k req/s in 12 months"] | @Name | High / Medium / Low | [What would invalidate this] |
| 2   | [e.g., "Team has capacity in Q2"]                        | @Name | High / Medium / Low | [What would invalidate this] |
| 3   | [e.g., "Vendor pricing remains stable"]                  | @Name | High / Medium / Low | [What would invalidate this] |

## Decision Criteria

[State how the decision will be made _before_ listing options.]

The option chosen must best satisfy the following criteria, listed in order of priority:

| Priority | Criterion              | Description                           | Weight    |
| -------- | ---------------------- | ------------------------------------- | --------- |
| 1        | [e.g., Security]       | [Must meet HIPAA / SOC 2 / …]         | Must-have |
| 2        | [e.g., Time to value]  | [Delivery within Q2]                  | High      |
| 3        | [e.g., Total cost]     | [Prefer lower long-term TCO]          | High      |
| 4        | [e.g., Team expertise] | [Prefer known stack]                  | Medium    |
| 5        | [e.g., Reversibility]  | [Prefer options easier to undo]       | Medium    |
| 6        | [e.g., Vendor lock-in] | [Avoid deep single-vendor dependence] | Low       |

**Decision rule**: Satisfy all Must-haves; score highest across High and Medium criteria. Call out
trade-offs when no option wins on all criteria.

## Relevant Data

[Optional but recommended — evidence that informs the decision.]

**Quantitative Data**:

- Current cost/time: [e.g., "$X/month", "Y hours/week"]
- Usage/adoption: [e.g., "Z% of users affected"]
- Frequency: [e.g., "N incidents per quarter"]

**Qualitative Data**:

- User/team feedback: [summary of pain points or requests]
- Prior attempts: [what was tried before and why it didn't work]

**External References**:

- [Industry benchmarks, vendor docs, case studies, articles]

## Options Considered

Evaluate each option against the **Decision Criteria** above. Include at least two options; for
significant changes, include **Do Nothing**.

### Option 1: [Option Name] ⭐ (Recommended)

**Description**: [1–3 paragraphs describing this approach.]

**How It Works**:

1. [Step or component A]
2. [Step or component B]
3. [Step or component C]

**Pros**:

- [Advantage 1 — specific]
- [Advantage 2]

**Cons**:

- [Disadvantage 1 — honest]
- [Disadvantage 2]

**Estimated Cost**: LARGE / MEDIUM / SMALL

- Effort: [X weeks / person-days]
- Financial: [$X/month] (if applicable)
- Risk: HIGH / MEDIUM / LOW

---

### Option 2: [Option Name]

**Description**: [1–3 paragraphs.]

**How It Works**:

1. [Step or component A]
2. [Step or component B]

**Pros**:

- [Advantage 1]
- [Advantage 2]

**Cons**:

- [Disadvantage 1]
- [Disadvantage 2]

**Estimated Cost**: LARGE / MEDIUM / SMALL

- Effort: [X weeks / person-days]
- Financial: [$X/month] (if applicable)
- Risk: HIGH / MEDIUM / LOW

---

### Option 3: Do Nothing

**Description**: Maintain the status quo and accept the current situation.

**Pros**:

- No immediate cost or disruption
- No migration risk

**Cons**:

- [Consequence of inaction 1]
- [Consequence of inaction 2]

**Estimated Cost**: SMALL (upfront) / potentially LARGE (long-term)

## Options Comparison

[Optional matrix when comparing 3+ options.]

| Criterion              | Option 1 | Option 2 | Option 3 |
| ---------------------- | -------- | -------- | -------- |
| [Criterion from above] | [score]  | [score]  | [score]  |
| Implementation effort  | Medium   | Low      | None     |
| Cost                   | $X/mo    | $Y/mo    | $Z/mo    |
| Time to value          | 4 weeks  | 1 week   | N/A      |
| Risk                   | Low      | Medium   | High     |
| Reversibility          | Easy     | Hard     | N/A      |

**Recommended**: Option 1 because [brief rationale tied to decision criteria].

## Action Items

[Tasks required after the decision — including follow-up documentation.]

| Action                                           | Owner | Due Date   | Status      |
| ------------------------------------------------ | ----- | ---------- | ----------- |
| [e.g., "Run PoC with vendor X"]                  | @Name | YYYY-MM-DD | NOT STARTED |
| [e.g., "Communicate decision to affected teams"] | @Name | YYYY-MM-DD | NOT STARTED |
| [e.g., "Create ADR for accepted direction"]      | @Name | YYYY-MM-DD | NOT STARTED |
| [e.g., "Create TDD for implementation"]          | @Name | YYYY-MM-DD | NOT STARTED |

## Outcome

_Fill this section after the decision is made._

**Decision**: [Option X was chosen / RFC rejected / deferred]

**Decision Date**: YYYY-MM-DD

**Decided By**: @Approver1, @Approver2

**Rationale**: [Why this option over the alternatives. Future readers need the reasoning if
circumstances change.]

**Key Factors**:

- [Factor 1 that drove the decision]
- [Factor 2]
- [Factor 3]

**Conditions / Caveats** (if any):

- [e.g., "Approved for Q1 only — revisit in Q2"]
- [e.g., "Requires security review before implementation"]

**Follow-up**:

- [ ] Create ADR: `docs/engineering/adr/NNN-short-kebab-decision.md`
- [ ] Create TDD (if applicable): `docs/engineering/tdd/YYYY-MM-short-kebab-title.md`
- [ ] Update affected documentation
- [ ] Notify informed stakeholders
- [ ] Schedule retrospective in [X months] to evaluate outcome
