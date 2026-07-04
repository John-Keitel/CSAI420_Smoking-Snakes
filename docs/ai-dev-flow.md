# AI Dev Flow

This flow turns product intent into small, verified slices of business value.

A slice is a small, independently shippable unit of business value: one user-visible behavior,
implemented and verified across every layer it touches. It is large enough to matter, but small
enough to specify, build, test, review, and trace as one coherent change.

## 1. Align On The Work

Use long-lived docs for alignment. They should explain why the work matters and what direction the
team agreed to take.

### Permanent Docs Structure

Keep permanent alignment docs under `docs/`.

```text
docs/
├── ai-dev-flow.md
├── work-tracking.md
├── product/
│   └── prd/
│       └── 2026-07-some-feature.md
├── engineering/
│   ├── tdd/
│   │   └── 2026-07-some-tdd.md
│   ├── rfc/
│   │   ├── README.md
│   │   └── 2026-07-some-rfc.md
│   └── adr/
│       ├── README.md
│       └── 001-some-adr.md
└── templates/
    ├── prd-template.md
    ├── tdd-template.md
    ├── rfc-template.md
    └── adr-template.md
```

Use these conventions:

- `docs/product/prd/` stores product-owned PRDs.
- `docs/engineering/tdd/` stores engineer-owned TDDs reviewed by the Architect and Tech Lead.
- `docs/engineering/rfc/` stores proposals and discussion docs before durable decisions are
  accepted.
- `docs/engineering/adr/` stores accepted decision records. ADRs are numbered, immutable, and
  superseded rather than edited.
- `docs/templates/` stores optional starting templates for PRDs, TDDs, RFCs, and ADRs.

Use `YYYY-MM-short-kebab-title.md` for PRD, TDD, and RFC files. Use `NNN-short-kebab-decision.md`
for ADR files.

The `.specs/features/[slice]/` folder is different. Permanent docs explain product intent,
architecture, proposals, and decisions. `.specs` is the execution contract for one selected slice.

### PRD

The Product Manager owns the PRD.

The PRD answers:

- Who is the user?
- What problem are we solving?
- What outcomes matter?
- What is in scope and out of scope?
- What are the major user-visible capabilities?
- How will we know the product work succeeded?

The PRD should identify candidate slices, but it should not become the implementation task list.

### TDD

Engineers own the TDD. Use the
[technical-design-doc-creator](https://agent-skills.techleads.club/skills/technical-design-doc-creator/)
skill when creating or reshaping it.

The TDD answers:

- What architecture and system boundaries will we use?
- What APIs, events, data models, and contracts matter?
- What existing patterns should we reuse?
- What are the security, reliability, observability, and rollback concerns?
- What technical risks or dependencies must be resolved?
- What is the slice-based implementation strategy?

For significant architecture, integration, migration, or cross-team decisions, the Architect reviews
the technical direction. The Tech Lead approves the TDD for implementation readiness before the team
starts implementation slices.

### RFC

Use an RFC only when the team needs to decide between meaningful alternatives. Use the
[create-rfc](https://agent-skills.techleads.club/skills/create-rfc/) skill when drafting one.

Good RFC topics include:

- New shared architecture patterns
- Vendor or platform choices
- Cross-team contracts
- Migration strategies
- Durable engineering standards

If the decision only affects one feature and fits naturally inside the TDD, keep it in the TDD
instead of creating a separate RFC.

Accepted RFCs that establish durable technical direction must produce an ADR. The RFC remains the
discussion history; the ADR becomes the concise decision record referenced by future PRDs, TDDs, and
slice specs.

### ADR

Use an ADR to record an accepted technical decision. Use the
[create-adr](https://agent-skills.techleads.club/skills/create-adr/) skill when writing one.

The ADR answers:

- What decision was made?
- What context led to the decision?
- Which alternatives were considered?
- What are the consequences and tradeoffs?
- What is the current status of the decision?

Create an ADR for accepted RFCs that change architecture, engineering standards, cross-team
contracts, dependencies, or long-term technical direction.

Do not create an ADR for every small feature-local decision. Keep those decisions in the TDD, the
slice `design.md`, or `.specs/STATE.md` when they become project-level constraints.

## 2. Create Slices

After the PRD and TDD are aligned, create implementation slices.

Slice from user-visible behavior, not architecture layers. A slice is not "create database schema",
"build backend APIs", or "write tests". A slice is "a user can connect one YouTube channel and see
it listed", with just enough UI, API, persistence, integration, and tests to make that behavior
real.

Use the `sdd-slicer-jira` skill to create the slice backlog from the PRD, TDD, existing feature
description, or a standalone slice request. The skill should preview the ordered backlog first, then
create or reuse confirmed parent slice epics in Jira.

The skill is a planning bridge. It decides what the slices are and records them as parent issues. It
does not replace `tlc-spec-driven`, which specifies, designs, tasks, executes, and verifies one
selected slice.

Use this order when slicing:

1. Extract the PRD goals and user stories.
2. Use the TDD to understand boundaries, dependencies, risks, and reusable patterns.
3. Identify the walking skeleton: the thinnest end-to-end behavior that proves the architecture.
4. Split remaining work into independently demoable user-visible behaviors.
5. Check each slice against the slice definition.
6. Order the backlog by dependency, risk reduction, and user value.
7. Preview the proposed slices for team confirmation.
8. Create or reuse confirmed parent slice epics in Jira with `sdd-slicer-jira`.
9. Pick the next slice epic to implement.

A good slice is:

- Independently specifiable
- Independently buildable
- Independently testable
- Independently reviewable
- Traceable back to PRD goals and TDD decisions
- Small enough to complete without mixing unrelated behavior

Each proposed slice should include:

- A user-visible slice statement
- Source traceability to the PRD, TDD, RFC, ADR, or standalone request
- Why the slice should happen now
- Dependencies on earlier slices
- What is intentionally out of scope
- Readiness status, such as ready or needing product/TDD clarification

Avoid layer-based slices:

- "Create all database tables"
- "Build all REST endpoints"
- "Implement the frontend"
- "Add all tests"
- "Wire all infrastructure"

Layer work belongs inside a slice as implementation tasks, not as the slice itself.

## 3. Run Spec-Driven Development Per Slice

Use the `tlc-spec-driven` skill for each selected slice.

The `.specs/features/[slice]/` folder is the execution contract for that slice. It should be precise
enough for implementation and verification, but scoped only to the selected slice.

### SPECIFY

Create `.specs/features/[slice]/spec.md`.

The spec answers:

- What exact behavior will this slice deliver?
- Which PRD goals, stories, or decisions does it satisfy?
- What is explicitly out of scope for this slice?
- What assumptions or open questions exist?
- What acceptance criteria prove the slice works?
- What requirement IDs will trace into design, tasks, tests, and validation?

Acceptance criteria should use clear `WHEN / THEN / SHALL` language.

### DESIGN

Create `.specs/features/[slice]/design.md` when the slice has non-obvious technical choices, new
patterns, multi-component coordination, or unresolved implementation risk.

Skip a separate slice design only when the TDD already settles the design and the implementation is
straightforward.

When design is needed, consult these skills:

- `domain-analysis`
- `modular-design-principles`
- `coupling-analysis`
- `frontend-design`
- `react-best-practices`
- `react-composition-patterns`
- `web-design-guidelines`

The design should stay slice-scoped. Do not restate the whole TDD.

### TASKS

Create `.specs/features/[slice]/tasks.md` for every slice, even if the slice has only one task.

After `tasks.md` is approved, use the `sdd-tasks-jira` skill to close the planning session: publish
each task as a Jira issue parented to the slice epic, set story point estimates, and enrich the
slice epic with spec and task links.

Tasks are the atomic implementation plan for the selected slice. Each task should have:

- One clear deliverable
- Requirement ID mapping
- Dependencies
- Test expectations
- Gate command
- Done criteria

Tests are not separate tasks. Tests are part of the task that creates or changes the behavior being
tested.

### Two-session protocol (planning vs execution)

Planning and execution are two separate sessions, gated by human review and approval. Never chain
from creating the spec/tasks into writing code in the same session:

1. Plan and create the spec (`spec.md`, `design.md`, `tasks.md`) with `tlc-spec-driven`. Then stop.
2. The human reviews the spec and edits it as needed.
3. After approval, run `sdd-tasks-jira` to publish the Jira task issues and enrich the slice epic.
4. The human closes the planning session.
5. Execution happens only in a new session via `sdd-execute-jira`.

A planning session may create or edit only `.specs/` and `docs/` files. It must not write or edit
implementation code, run migrations, or create code commits or branches — even when asked to
"implement", "just do it", or "continue". In this repo `tlc-spec-driven` ends at `tasks.md`;
`sdd-execute-jira` owns the EXECUTE step below in its own session. See
`.cursor/rules/spec-driven-flow.mdc`.

### EXECUTE

Execute one task at a time.

Use the `sdd-execute-jira` skill when executing a planned slice from its Jira epic. It moves the slice
through execution, coordinates task work, runs verification, opens the slice PR, and records the
execution trail on the Jira issues.

Each task must:

- Implement only its scoped deliverable
- Include its required tests
- Pass the defined gate
- Produce one atomic commit
- Preserve traceability back to the slice spec

After the last task, run the verifier from `tlc-spec-driven`. A slice is not done until the verifier
checks the acceptance criteria and records validation evidence. After the PR is opened, the final
SDD gate is `sdd-pr-review`.

## 4. Review The Pull Request

Use the `sdd-pr-review` skill on every slice PR before merge. This is the final gatekeeper before
code reaches production, and it reviews the PR against both the code and the spec-driven delivery
contract.

The review must run against a real GitHub pull request, not an unmerged local branch. It posts only
review comments and one PR review summary. It never approves, requests changes, edits files, pushes
commits, or changes issue state.

The review checks these tracks:

- Security and HIPAA
- SDD traceability
- Requirements and Definition of Done
- Tests and validation evidence
- Architecture and coding patterns
- Regression and hallucination detection
- Performance

The PR is merge-ready only when:

- The SDD PR review summary is posted.
- Security, Critical, and required gate findings are resolved or explicitly accepted by the human
  owner.
- The summary shows the slice issue, spec, tasks, validation evidence, closing issue traceability,
  atomic commit traceability, and required gates as passing or intentionally accepted.
- Any manual follow-up in the review summary is complete or tracked before merge.

Do not use `sdd-pr-review` as a substitute for implementation validation. The verifier proves the
slice satisfies its acceptance criteria; the PR review proves the change is safe, traceable, scoped,
and ready for production review.

## 5. Example Slice Flow

For a YouTube integration, do not start with "build YouTube backend" or "create YouTube UI".

Start with a walking skeleton:

1. User opens settings.
2. User connects one YouTube channel.
3. System stores the channel connection with label and language.
4. User sees the connected channel listed.
5. Tests prove the happy path and basic failure handling.

That becomes one slice:

```text
.specs/features/youtube-connect-channel/
├── spec.md
├── design.md
├── tasks.md
└── validation.md
```

Later slices widen the behavior:

- Manage channel access grants
- Publish one video to one connected channel
- Receive publication lifecycle events
- Sync YouTube state on demand
- Update an existing publication
- Remove a publication link without touching YouTube
- Import a public YouTube video
- Bulk publish selected videos
- Administer all channel connections

## 6. Team Rules

- PRD is required for product-visible work larger than one slice.
- TDD is required for multi-component work, external integrations, migrations, security-sensitive
  changes, or work needing Tech Lead approval.
- RFC is required only for durable decisions with meaningful alternatives or cross-team impact.
- Accepted RFCs that establish durable technical direction must produce an ADR.
- Planning and execution are separate sessions gated by human review and approval: plan/spec ->
  human approves -> `sdd-tasks-jira` -> human closes planning -> `sdd-execute-jira` in a new session. Never
  write code during a planning session.
- Every implementation slice gets a `spec.md`.
- Every implementation slice gets a `tasks.md`.
- Slice `design.md` is required when the slice has technical choices not already settled by the TDD.
- Tasks must include their own tests.
- A slice is complete only when gates pass and validation evidence is recorded.
- Every slice PR must run `sdd-pr-review` before merge.
