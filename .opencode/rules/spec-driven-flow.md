# Spec-Driven Flow

`docs/ai-dev-flow.md` is the source of truth. Load it when planning, slicing, specifying, tasking, executing, or validating product-visible work.

## STOP - Planning and execution are two separate sessions (NON-NEGOTIABLE)

Planning/spec work and code execution NEVER happen in the same session. The flow is:

1. Plan and create the spec (`spec.md`, `design.md`, `tasks.md`) with `tlc-spec-driven`. Then STOP.
2. The human reviews the spec and edits it as needed. Then STOP.
3. After the human approves, run `/sdd-tasks-jira` to publish the task sub-issues and enrich the slice issue. Then STOP.
4. The human closes the planning session.
5. Execution happens ONLY in a NEW session via `/sdd-execute-jira`.

In a PLANNING session you may create or edit files ONLY under `.specs/` and `docs/`. You MUST NOT
write or edit implementation/source code, run migrations, or create code commits or branches - even
if the user says "implement the plan", "just do it", or "continue". If code work is requested during
planning, STOP and tell the user to approve the spec, run `/sdd-tasks-jira`, and start a separate
`/sdd-execute-jira` session.

- `tlc-spec-driven` in this repo ENDS at `tasks.md`; `sdd-execute-jira` owns execution in its own session.
  Do NOT run the skill's "Execute/implement" phase or its execution Verifier here.
- Plans produced during planning must end at the `/sdd-tasks-jira` handoff and MUST NOT include
  same-session implementation or execution todos.

## Required Gates

- Product-visible work larger than one slice requires a PRD in `docs/product/prd/`.
- Multi-component work, external integrations, migrations, security-sensitive changes, or work needing Tech Lead approval requires a TDD in `docs/engineering/tdd/`.
- Use RFCs only for meaningful alternatives or cross-team decisions. Accepted RFCs that set durable direction must produce an ADR.
- ADRs live in `docs/engineering/adr/`, are numbered, and are superseded rather than edited.
- Slice by user-visible behavior, not architecture layers. Layer work belongs inside slice tasks.
- Use `sdd-slicer-jira` to preview and create or reuse parent slice issues.
- Every selected slice uses `tlc-spec-driven` and gets `.specs/features/[slice]/spec.md`.
- Every selected slice gets `.specs/features/[slice]/tasks.md`; tests are part of the task that changes behavior.
- Add `.specs/features/[slice]/design.md` when technical choices are not already settled by the TDD.
- After `tasks.md` is approved, use `sdd-tasks-jira` to publish task issues and link them under the parent slice issue.
- Execute planned Jira-backed slices with `sdd-execute-jira`, one task at a time.
- Each task must stay scoped, include required tests, pass its gate, produce one atomic commit, and preserve traceability to the slice spec.
- A slice is complete only after gates pass and validation evidence is recorded.

## Loading Discipline

- Load only the PRD, TDD, RFC, ADR, spec, design, or tasks file needed for the current step.
- Before writing code, read `.specs/codebase/CONVENTIONS.md`.
- For React UI, see `.opencode/rules/react-ui-on-demand.md`; use the shadcn MCP when adding components.
