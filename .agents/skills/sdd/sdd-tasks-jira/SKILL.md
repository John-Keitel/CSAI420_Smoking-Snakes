---
name: sdd-tasks-jira
description: Closes the planning session for a slice in Jira - publishes every task in a spec-driven tasks.md as a Jira issue under the slice epic, sets the story point estimate, reconciles already-published tasks to the same end state, and enriches the slice epic with spec links and a task rollup through the Atlassian MCP. Use when the user says "create issues for tasks", "create a Jira issue for each task", "publish tasks to Jira", "sync tasks to Jira", "enrich the slice issue", "close the planning session", "publish the slice", or "link tasks to the slice". Do NOT use for creating or breaking a feature into tasks.md itself (use tlc-spec-driven), or for creating one-off Jira issues unrelated to a tasks.md file.
license: CC-BY-4.0
metadata:
  author: Daniel Teleginski Camargo
  version: 1.2.0
---

# SDD Tasks to Jira Issues

Close the planning session for a slice. Turn each task in the feature's `tasks.md` (produced by the `tlc-spec-driven` Tasks phase) into a Jira issue under the slice epic, set the story point estimate, publish the planning artifacts on a slice branch named after the Jira key (`jira-scrum-####`), and enrich the slice epic with spec links and a task rollup. The result: humans can trace the slice's full lifecycle — spec, tasks, and later decisions, commits, and PRs — from the slice epic alone. Execution (`sdd-execute-jira`) appends its own execution trail to Jira later, inside its own managed markers — this skill never writes execution content.

## Instructions

### Step 1: Preflight gate — fail fast, before any side effects

First locate the feature: the user always provides the exact spec as a file reference (e.g. `@.specs/features/[feature]/tasks.md` or the feature folder). Derive the feature folder `.specs/features/[feature]/` from that reference. If no file reference was provided, stop and ask for it — never scan for or guess the feature.

Then verify ALL of the following before creating anything:

1. `docs/work-tracking.md` exists in the workspace root and defines the Jira configuration: `JIRA_CLOUD_ID`, `JIRA_SITE`, `JIRA_PROJECT_KEY`, `SLICE_ISSUE_TYPE`, `TASK_ISSUE_TYPE`, `STORY_ISSUE_TYPE`, and `STORY_POINTS_FIELD`.
2. `.specs/features/[feature]/` contains `tasks.md` AND `spec.md` (`design.md` is optional — note whether it is present).
3. `tasks.md` is well-formed: it has a Task Breakdown section where every task has at least a Task ID and a title. If the structure is malformed, do not guess — the fix is regenerating it with `tlc-spec-driven`.
4. The Atlassian MCP server is available. Before each MCP tool family is used, read its descriptor file and follow the schema exactly.

If any check fails: STOP. Report every failure in a single consolidated list and ask the user to provide or fix the missing pieces. Never publish a subset — a failed preflight with zero issues created is recoverable; a half-published slice is not.

When preflight passes, read `tasks.md` in full. Note the feature name (folder name) — it prefixes every issue title.

### Step 2: Load Jira configuration

Read `docs/work-tracking.md` before making MCP calls. Never hard-code Jira project keys, issue types, or field IDs from memory — the doc is the source of truth and may have changed.

Use these values:

- `JIRA_CLOUD_ID` as the Atlassian MCP `cloudId`.
- `JIRA_PROJECT_KEY` when creating or searching issues.
- `SLICE_ISSUE_TYPE` for the parent slice issue, normally `Epic`.
- `TASK_ISSUE_TYPE` for executable task issues, normally `Task`.
- `STORY_POINTS_FIELD` for story point estimates, currently `customfield_10016`.

Components are not part of this repo's Jira workflow. Do not read, set, or require them.

### Step 3: Identify or create the slice issue

The slice statement is the user-visible behavior the feature delivers (e.g. "User can reset their password") — take it from the user's request, or from the feature's `spec.md` title/summary if the user did not state it. Every task issue will be parented to the slice epic, so resolve it before creating anything:

- If the user provided a Jira issue key or URL, use it.
- Otherwise, use `searchJiraIssuesUsingJql` to search project issues for a summary matching the slice statement and `issuetype = Epic`. If exactly one matches, use it; if several match, ask the user which one.
- If none exists, create it with `createJiraIssue`: summary `[feature] Slice: [slice statement]`, issue type `SLICE_ISSUE_TYPE`, and a description containing the slice statement. Do not set story points on the slice epic.

Capture the slice Jira key for task parenting and reporting:

```text
SLICE_KEY=SCRUM-17
```

Then derive the slice branch from the Jira key and switch to it, so every artifact of the slice (planning commit now, implementation later) lives on one branch:

```bash
SLICE_BRANCH="jira-$(printf '%s' "$SLICE_KEY" | tr '[:upper:]' '[:lower:]')"
```

- If the branch already exists locally or on the remote, check it out — planning may be resuming.
- Otherwise create it from the repo's default branch. Resolve the default branch from git; never guess or hard-code it.
- If the working tree has uncommitted changes outside `.specs/`, STOP and ask the user before switching branches.

### Step 4: Check for already-published tasks — skip creation, reconcile everything else

Issue titles follow the convention `[feature] T[N]: [task title]` (e.g. `[user-auth] T2: Add email validation function`).

Search for existing issues before creating anything:

```text
project = SCRUM AND summary ~ "\"[feature]\"" ORDER BY created ASC
```

Use `searchJiraIssuesUsingJql` for the search. Any task whose `T[N]:` prefix already appears in an existing issue summary, or that already has a Jira issue URL written into its `tasks.md` entry (see Step 8), is skipped for **issue creation only** (Step 7a). A skipped task must still end in the same published state as a newly created one — `sdd-execute-jira` assumes every task is parented to the slice epic, story-pointed, and URL-tracked. For each skipped task, verify and repair whatever is missing:

1. **Parent epic** — the issue has `parent.key = $SLICE_KEY`. If missing or wrong, repair it with `editJiraIssue`.
2. **Story points** — the issue has `STORY_POINTS_FIELD` set to the estimated points. If missing or wrong, repair it with `editJiraIssue`.
3. **Status** — the issue is in `Backlog` where Jira workflow allows it. Use `getTransitionsForJiraIssue` and `transitionJiraIssue`; never guess transition IDs.
4. **tasks.md write-back** — the Jira issue URL is recorded under the task heading (Step 8).

Include skipped tasks in the dependency map (Step 7) so newly created tasks can reference their real Jira keys. Report each skipped task in the final summary along with any repairs applied (e.g. "parent set", "story points set").

### Step 5: Parse each task

For every remaining task in the Task Breakdown section, extract:

- Task ID and title (e.g. `T1: Create X Interface`)
- **What** — one-sentence deliverable
- **Where** — file path(s)
- **Depends on** — task IDs or `None`
- **Requirement** — traceability ID (e.g. `FEAT-01`), if present
- **Done when** — the checklist items
- **Tests** and **Gate** — from the task fields

If a field is absent in the task body, omit it from the issue body rather than inventing content.

### Step 6: Estimate each task

Estimate story points for every task using the sizing table in `docs/work-tracking.md`. Size by scope, complexity, and unknowns — not hours:

| Points | When |
| ------ | ---- |
| 1 | Single contained change, fully understood, no unknowns |
| 2 | A few touch-points, clear scope, minimal design choices |
| 3 | Multiple touch-points involved, some design choices to resolve |
| 5 | Cross-cutting scope with meaningful unknowns or coordination |

Set sizes automatically — no confirmation step. But **8 and 13 are not valid issue sizes**: if a task honestly estimates at 8+ points, do NOT create its issue. Stop, report which task is under-planned (8: unknowns too high — resolve in design and re-size; 13: it's an objective, not a task), and let the user decide. Well-formed atomic tasks from `tlc-spec-driven` should land at 1–3.

### Step 7: Create issues, set story points, and parent to the slice

Process tasks in dependency order (a task's dependencies are created before it), so dependency references can use real Jira keys.

For each task, keep a running map of task ID → Jira key. Then:

**7a. Create the issue.** Summary: `[feature] T[N]: [task title]`. Description template (omit sections with no source data):

```markdown
## What

[What field]

**Where**: `[Where field]`
**Requirement**: [Requirement ID]
**Depends on**: [Jira key for each dependency, or "None"]

## Done when

- [ ] [each Done-when item]

**Tests**: [Tests field] | **Gate**: [Gate field]

---
Source: `.specs/features/[feature]/tasks.md` ([Task ID])
```

Use `createJiraIssue` with the story point field and parent epic:

```json
{
  "cloudId": "csai420.atlassian.net",
  "projectKey": "SCRUM",
  "issueTypeName": "Task",
  "summary": "[user-auth] T1: Create validation module scaffold",
  "description": "## What\n\nCreate the validation module scaffold.\n\n---\nSource: `.specs/features/user-auth/tasks.md` (T1)",
  "additional_fields": {
    "parent": { "key": "SCRUM-17" },
    "customfield_10016": 1
  },
  "contentFormat": "markdown",
  "responseContentFormat": "markdown"
}
```

If Jira does not accept `parent` or the story point field at creation time, create the issue first, then immediately repair it with `editJiraIssue`. A task issue is not published until it has the slice epic parent and story point estimate set. Never report a task as `Created` while either field is missing.

**7b. Set status to Backlog when needed.** If Jira creates the issue in another status, use `getTransitionsForJiraIssue` and `transitionJiraIssue` to move it to `Backlog` only when Jira exposes a matching transition.

**7c. Link dependencies.** If the task depends on another task, create a Jira issue link of type `Blocks` after both issues exist. For directional links, the dependency is the inward issue and the dependent task is the outward issue.

### Step 8: Write issue URLs back into tasks.md

After all issues are created, append the issue URL to each task in `tasks.md`, directly under the task heading:

```markdown
### T1: Create X Interface

**Issue**: https://csai420.atlassian.net/browse/SCRUM-18
```

### Step 9: Enrich the slice issue and close the planning session

Planning is not done until the slice issue carries the evidence. Three sub-steps, in order:

**9a. Commit and push the spec files.** On `$SLICE_BRANCH` (checked out in Step 3), commit `.specs/features/[feature]/` (`spec.md`, `design.md` if present, and `tasks.md` with the Jira issue URLs from Step 8) and push with `git push -u origin "$SLICE_BRANCH"`, so the planning artifacts are preserved on the implementation branch. Suggested message: `docs([feature]): publish planning artifacts for slice`. The `[branch]` placeholder below is always `$SLICE_BRANCH`.

**9b. Update the slice epic description.** Fetch the current description with `getJiraIssue`. Preserve all human-written content; only replace the block between the skill-managed markers, or append the block if the markers are absent:

```markdown
<!-- sdd-tasks-jira:begin -->
## Spec

- Branch: `[branch]`
- `spec.md`: `.specs/features/[feature]/spec.md`
- `design.md`: `.specs/features/[feature]/design.md`
- `tasks.md`: `.specs/features/[feature]/tasks.md`

## Tasks

| Task | Jira Issue | Story Points |
| ---- | ----- | ---- |
| T1: Create X Interface | SCRUM-18 | 2 |
| T2: Implement Y Service | SCRUM-19 | 3 |
<!-- sdd-tasks-jira:end -->
```

Omit the `design.md` link when the file does not exist. Apply the updated description with `editJiraIssue`.

**Marker ownership:** this skill owns only the `sdd-tasks-jira:begin/end` block (spec links + subtask rollup). The execution trail and token usage are written later by `sdd-execute-jira` inside its own `sdd-execute-jira:begin/end` markers — never create a placeholder for them, and never touch an existing `sdd-execute-jira` block.

**9c. Close the session.** Comment on the slice issue so the closure itself is on the record:

```text
Planning session closed — [N] Jira task issues created or reconciled. Source: `.specs/features/[feature]/tasks.md` on branch `[branch]`.
```

Use `addCommentToJiraIssue` for the closure comment. The slice epic stays open in `Backlog` — execution moves it onward.

### Step 10: Report

Output a summary table:

| Task | Jira Issue | Story Points | Status |
| ---- | ----- | ---- | ------ |
| T1: Create X Interface | SCRUM-18 | 2 | Created + parented |
| T2: Implement Y Service | SCRUM-19 | 3 | Created + parented |
| T3: Create Z Integration | SCRUM-20 | 2 | Skipped (already existed; story points repaired) |

End the report with: the slice epic URL (confirming enrichment and session closure), and the Jira project URL from `docs/work-tracking.md` so the user can verify placement.

## Example

User says: "Publish the tasks in @.specs/features/user-auth/tasks.md and close the planning session — slice issue is SCRUM-17"

Task in `.specs/features/user-auth/tasks.md`:

```markdown
### T2: Add email validation function [P]

**What**: Pure function validating email format per RFC 5322 subset
**Where**: `src/utils/validate-email.ts`
**Depends on**: T1
**Requirement**: AUTH-03

**Done when**:

- [ ] Valid emails pass, invalid emails fail
- [ ] Gate check passes: `yarn test:unit`

**Tests**: unit
**Gate**: quick
```

Actions (preflight passed, Jira config loaded, slice epic `SCRUM-17` resolved, branch `jira-scrum-17` created and checked out, T1 became `SCRUM-18`):

```json
{
  "tool": "createJiraIssue",
  "arguments": {
    "cloudId": "csai420.atlassian.net",
    "projectKey": "SCRUM",
    "issueTypeName": "Task",
    "summary": "[user-auth] T2: Add email validation function",
    "description": "## What\n\nPure function validating email format per RFC 5322 subset\n\n**Where**: `src/utils/validate-email.ts`\n**Requirement**: AUTH-03\n**Depends on**: SCRUM-18\n\n## Done when\n\n- [ ] Valid emails pass, invalid emails fail\n- [ ] Gate check passes: `yarn test:unit`\n\n**Tests**: unit | **Gate**: quick\n\n---\nSource: `.specs/features/user-auth/tasks.md` (T2)",
    "additional_fields": {
      "parent": { "key": "SCRUM-17" },
      "customfield_10016": 1
    },
    "contentFormat": "markdown",
    "responseContentFormat": "markdown"
  }
}
```

After all tasks: Jira issue URLs written back into `tasks.md`, `.specs/features/user-auth/` committed and pushed on `jira-scrum-17`, and slice epic `SCRUM-17` enriched:

```markdown
<!-- sdd-tasks-jira:begin -->
## Spec

- Branch: `jira-scrum-17`
- `spec.md`: `.specs/features/user-auth/spec.md`
- `tasks.md`: `.specs/features/user-auth/tasks.md`

## Tasks

| Task | Jira Issue | Story Points |
| ---- | ----- | ---- |
| T1: Create validation module scaffold | SCRUM-18 | 1 |
| T2: Add email validation function | SCRUM-19 | 1 |
<!-- sdd-tasks-jira:end -->
```

Result: both Jira task issues are in Backlog, parented to `SCRUM-17`, story-pointed, slice epic enriched, closing comment posted, summary table + slice and Jira project URLs reported.

## Troubleshooting

### Preflight failed: missing inputs

Cause: `docs/work-tracking.md` is missing or lacks expected Jira configuration, `.specs/features/[feature]/` lacks `spec.md` or `tasks.md`, `tasks.md` is malformed, or Atlassian MCP access is unavailable.
Solution: stop before any side effects. Report all failures in one list and ask the user to supply them. Do not guess project or field IDs; do not infer task structure — malformed `tasks.md` is regenerated via `tlc-spec-driven`.

### Error: Atlassian MCP auth or HTTP 401/403

Cause: the Atlassian MCP user is not authenticated or lacks access to the Jira project.
Solution: ask the user to authenticate or grant access for `csai420.atlassian.net`, then retry the failed MCP call. Do not create issues outside Jira as a fallback.

### Error: Jira field rejected

Cause: the field IDs in `docs/work-tracking.md` are stale, or the selected issue type does not expose the story point or parent field.
Solution: use `getJiraProjectIssueTypesMetadata` and `getJiraIssueTypeMetaWithFields` to confirm the current field metadata, report the mismatch to the user, and suggest updating `docs/work-tracking.md`. Do not silently substitute field IDs.

### Slice branch already exists with diverged content

Cause: `jira-scrum-####` was created in an earlier planning session (possibly on another machine) and local/remote histories differ.
Solution: check the branch out and continue on it — never delete or force-recreate a slice branch. If the push in Step 9a is rejected (non-fast-forward), pull with rebase, resolve, and retry; if that fails, report the divergence to the user instead of forcing.

### Slice issue not found or ambiguous

Cause: the user gave no Jira issue reference and the summary search returned zero or multiple candidates.
Solution: on multiple candidates, ask the user which issue is the slice. On zero, confirm the slice statement with the user, then create the slice issue per Step 3.

### Task parent or dependency link rejected

Cause: Jira rejected the parent field or issue link type, or the MCP user lacks permission.
Solution: STOP — do not fall back to a checklist. Jira parent links are how the slice's tasks remain discoverable. Report which task issues were created but not parented or linked, fix the cause, then re-run only the affected `editJiraIssue` or `createIssueLink` calls before closing the session.

### Issue created but story points or status failed

Cause: partial failure mid-loop (network, scope, stale ID).
Solution: do not recreate the issue. Fix the cause, re-run only the `editJiraIssue` or transition step for that issue, and note the recovery in the summary.
