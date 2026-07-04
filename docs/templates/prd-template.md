# PRD Template

Use this template to document **what** to build and **why**, before technical design begins. Focus
on users, outcomes, scope, and measurable success — not architecture or implementation.

|                     |                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **When to use**     | Product-visible work larger than a single slice                                                |
| **When not to use** | A one-slice change, or purely technical work with no user-visible outcome                      |
| **Skill**           | `docs/ai-dev-flow.md` (source of truth); pairs with `technical-design-doc-creator` for TDD     |
| **Save to**         | `docs/product/prd/YYYY-MM-short-kebab-title.md`                                                |
| **Review**          | Product owns outcomes and scope; Tech Lead follows up with a TDD before slicing                |
| **Scope hint**      | Delete optional sections for small efforts; always keep Goals, Success Metrics, Open Questions |

Document **desired outcomes and scope**. Avoid architecture, schemas, and framework details — those
belong in the TDD.

---

# Dashboard PRD - [Feature Name]

**Last Updated:** YYYY-MM-DD  
**Status:** Draft / In Review / Accepted  
**Owner:** [Name (role)]  
**Parent PRD:** [Link if this refines a broader PRD]  
**Target Release:** [Milestone or scope]

---

## 1. Summary

[2–4 sentences on what this delivers and for whom. If it refines a parent PRD, state what this
repository owns versus what other systems own.]

---

## 2. Problem & Why Now

[What pain exists, who feels it, and why this is worth doing now. List the concrete outcomes of
delivering this work.]

---

## 3. Users

| User           | Role in this PRD             |
| -------------- | ---------------------------- |
| [User/persona] | [What they do in this scope] |

---

## 4. Goals & Non-Goals

### Goals

- **G1 - [Short name]:** [Outcome, phrased as user-visible value.]

### Non-Goals

- [Explicitly out of scope so reviewers can trust the boundary.]

---

## 5. Success Metrics

| Metric    | Target   |
| --------- | -------- |
| [Measure] | [Target] |

**Definition of done:** [The observable end state that means this PRD is delivered.]

---

## 6. Functional Requirements

Priority: **P0** = required for launch. **P1** = strongly desired but not blocking.

**[ID] (P0) - [Requirement name]**

- AC1: [Acceptance criterion — observable and testable.]
- AC2: [Acceptance criterion.]

---

## 7. Data Requirements

[Inputs, outputs, and records this work reads or produces, at the field level where known. Confirm
exact fields and PHI handling with stakeholders before implementation.]

---

## 8. Candidate Slices

Slices are ordered by dependency, risk reduction, and user value. They are candidates for
`sdd-slicer-gh`; they are not implementation tasks.

### Slice 1 - [User-visible behavior]

**Statement:** [What the user can do after this slice.]

**Source traceability:** [Requirement IDs.]

**Why now:** [Sequencing rationale.]

**Dependencies:** [What must exist first.]

**Out of scope:** [What this slice does not include.]

**Readiness:** [Ready, or what must be clarified first.]

---

## 9. Dependencies & Assumptions

- [External systems, contracts, or assumptions this PRD relies on.]

---

## 10. Risks

| Risk   | Impact                   | Mitigation   |
| ------ | ------------------------ | ------------ |
| [Risk] | Critical / High / Medium | [Mitigation] |

---

## 11. Open Questions

Track every open decision as a numbered row. Resolve in place by setting Status to ✅ Resolved and
recording the decision — do not delete answered questions.

**Status legend:** 🔴 Open · 🟡 In discussion · ✅ Resolved

| #   | Topic   | Question        | Status  | Decision / Notes |
| --- | ------- | --------------- | ------- | ---------------- |
| 1   | [Topic] | [Open question] | 🔴 Open | TBD              |

---

## 12. Required Follow-Up

[What must happen after PRD acceptance — e.g. a TDD for external integrations or security-sensitive
work, then `sdd-slicer-gh` and `tlc-spec-driven` per slice.]
