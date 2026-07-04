# Rules

**Important:** When I say commit, I am referring to commit and push.

## tlc-spec-driven extension — NON-NEGOTIABLE

This repo uses a custom spec-driven delivery flow. `docs/ai-dev-flow.md` is the source of truth;
follow `.opencode/rules/spec-driven-flow.md` for the required gates.

Planning and execution are two separate sessions. Never write or edit source code during a planning
session — see the "STOP - Planning and execution are two separate sessions" protocol in
`.opencode/rules/spec-driven-flow.md`.

## UX/UI Skills — NON-NEGOTIABLE (on-demand)

See `.opencode/rules/react-ui-on-demand.md` for the required skills and loading order.

## Key Principles

For module/service boundary design (bounded contexts, composability, state isolation, failure
containment), see `.agents/skills/modular-design-principles/SKILL.md`.

## Progressive Documentation Loading

**CRITICAL**: Load only what you need when you need it.

| Task Type                    | Primary Doc / Skill                                               | Notes                                                           |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Understand the delivery flow | `docs/ai-dev-flow.md`                                             | Source of truth for PRD/TDD/RFC/ADR, slicing, and execution     |
| Product alignment            | `docs/product/prd/` and `docs/templates/prd-template.md`          | Product-owned outcomes, scope, success measures, and slices     |
| Technical direction          | `technical-design-doc-creator` skill and `docs/engineering/tdd/`  | Architecture, contracts, risks, boundaries, and slice strategy  |
| Proposal or tradeoff         | `create-rfc` skill and `docs/engineering/rfc/`                    | Use only when meaningful alternatives need team decision        |
| Accepted decision            | `create-adr` skill and `docs/engineering/adr/`                    | Durable decisions; ADRs are numbered and superseded, not edited |
| Create slice backlog         | `sdd-slicer-jira` skill                                           | Slice user-visible behavior and create or reuse parent issues   |
| Specify one slice            | `tlc-spec-driven` skill and `.specs/features/[slice]/spec.md`     | Required execution contract and acceptance criteria             |
| Design one slice             | `tlc-spec-driven` skill and `.specs/features/[slice]/design.md`   | Required when technical choices are not already settled         |
| Plan slice tasks             | `tlc-spec-driven` skill and `.specs/features/[slice]/tasks.md`    | Required for every slice; tasks include their own tests         |
| Publish task issues          | `sdd-tasks-jira` skill                                            | Link task issues under the parent slice issue                   |
| Execute a planned slice      | `sdd-execute-jira` skill                                          | Work one task at a time, verify gates, open PR, record trail    |
| Writing any code             | `.specs/codebase/CONVENTIONS.md`                                  | Naming, logging, error handling, imports                        |
| React Components             | `react-best-practices`, `web-design-guidelines`, and `shadcn` MCP | Required for new or existing UX/UI components                   |
