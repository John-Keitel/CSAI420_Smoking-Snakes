---
name: sdd-slicer-jira
description: Creates parent Jira slice epics from a PRD, TDD, existing feature description, or standalone slice request by extracting user-visible implementation slices, previewing the ordered backlog for confirmation, then creating or reconciling confirmed slice epics in the configured Jira project through the Atlassian MCP. Use when the user says "slice this PRD into Jira issues", "create slices from this TDD", "create a standalone slice", "turn this feature into slice issues", "create slice issues", or "build a slice backlog". Do NOT use for creating task issues from tasks.md, executing a slice, writing a PRD/TDD, or creating one-off Jira issues unrelated to SDD slicing.
license: CC-BY-4.0
metadata:
  author: Daniel Teleginski Camargo
  version: 1.0.0
---

# SDD Slicer to Jira Issues

Turn product and technical intent into small parent slice epics in Jira. A slice is one user-visible behavior, independently specifiable, buildable, testable, reviewable, and traceable to its source context; it is never a standalone architecture layer such as "create tables", "build APIs", or "implement UI".

## Instructions

### Step 1: Preflight gate

The user may provide source document references (PRD, TDD, design note, or existing slice list) or a standalone slice request in natural language. If no source document is provided, do not stop automatically; instead, determine whether the request contains enough standalone slice intent to proceed. At minimum, capture the actor, user-visible behavior, intended value, and rough scope. If those are missing, ask focused follow-up questions before proposing slices. Do not infer source documents by scanning the repository.

Before creating or editing Jira issues, verify all of the following:

1. `docs/work-tracking.md` exists in the workspace root and defines the Jira configuration: `JIRA_CLOUD_ID`, `JIRA_SITE`, `JIRA_PROJECT_KEY`, `SLICE_ISSUE_TYPE`, `TASK_ISSUE_TYPE`, `STORY_ISSUE_TYPE`, and `STORY_POINTS_FIELD`.
2. The Atlassian MCP server is available. Before each MCP tool family is used, read its descriptor file and follow the schema exactly.
3. Any provided source documents are readable.

If any check fails, stop before side effects. Report every failure in one consolidated list and ask the user to fix or provide the missing input.

### Step 2: Load Jira configuration

Read `docs/work-tracking.md` before making MCP calls. Use its Jira values as the source of truth:

- `JIRA_CLOUD_ID` is the `cloudId` argument for Atlassian MCP Jira tools.
- `JIRA_PROJECT_KEY` is the Jira project key for searches and issue creation.
- `SLICE_ISSUE_TYPE` is the parent slice issue type, normally `Epic`.
- `STORY_POINTS_FIELD` is reserved for executable task/story issues. Do not set it on slice epics unless the user explicitly asks.

Components are not part of this repo's Jira workflow.

### Step 3: Gather source context

Read any provided PRD and/or TDD in full. Extract only information relevant to slicing:

- PRD goals, users, outcomes, scope, out of scope, user stories, success criteria, and candidate capabilities.
- TDD boundaries, APIs, events, data models, dependencies, risks, reusable patterns, rollback concerns, and slice strategy.
- Any explicit sequencing constraints, external approvals, migrations, or unknowns that affect what can be shipped independently.

If no source document is provided, run a standalone slice intake. Ask only for missing essentials; do not force the user to produce a PRD/TDD. Useful follow-up questions include:

- Who is the actor or user?
- What should they be able to do when the slice is complete?
- What value or outcome does this unlock?
- What is explicitly out of scope?
- Are there known dependencies, constraints, or technical boundaries?
- What visible signal would prove the slice works?

If only a PRD is provided, create product-visible slices and clearly mark technical assumptions or questions that need design follow-up. If only a TDD is provided, create slices from the implementation strategy and trace them to the nearest stated user-visible outcomes; if the user-visible value is missing, ask for the product context before creating issues. If the context is standalone, trace the slice to the user's request and captured answers.

### Step 4: Derive the slice backlog

Create slices from user-visible behavior, not architecture layers. Use this order:

1. Extract the major user outcomes and stories.
2. Use the TDD to understand boundaries, dependencies, risks, and reusable patterns.
3. Identify the walking skeleton: the thinnest end-to-end behavior that proves the architecture and delivers observable user value.
4. Split remaining work into independently demoable behaviors.
5. Check each candidate against the slice-quality gate.
6. Order the backlog by dependency, risk reduction, and user value.

Every proposed slice must include:

- `Feature key`: kebab-case feature or product area, used in issue titles.
- `Title`: `[feature] Slice: [user-visible behavior]`.
- `Slice statement`: one sentence starting with the user or actor, e.g. "A user can connect one YouTube channel and see it listed."
- `Source traceability`: PRD goal/story IDs, TDD section names, file references, or `Standalone request` with captured user answers.
- `Why now`: value, risk reduction, or dependency rationale.
- `Dependencies`: prior slice titles or `None`.
- `Out of scope`: related behavior intentionally deferred.
- `Readiness`: `Ready`, `Needs user clarification`, `Needs TDD clarification`, or `Needs product clarification`.

Reject or reshape invalid candidates:

- Layer-based candidates become implementation work inside a slice, not slice issues.
- Oversized candidates become multiple user-visible slices.
- Pure research, infrastructure, schema, API, UI, or test work is not a slice unless packaged with user-visible behavior.
- A slice that cannot be tested or demoed independently needs to be narrowed.

### Step 5: Preview and confirm

Before creating or editing any Jira issue, present the proposed ordered backlog and ask for confirmation. The preview should be compact and include each slice's title, statement, dependencies, readiness, and out-of-scope notes.

Do not create issues for slices marked `Needs user clarification`, `Needs product clarification`, or `Needs TDD clarification` unless the user explicitly confirms that they still want placeholder issues. Prefer asking the user to resolve the missing context first.

If the user requests changes, revise the slice backlog and preview again. Proceed only after explicit confirmation.

### Step 6: Reconcile existing slice epics

After confirmation, search for existing slice issues before creating new ones:

1. Read the Atlassian MCP descriptor for `searchJiraIssuesUsingJql`.
2. Search with JQL scoped to the project and slice issue type, for example:

```text
project = SCRUM AND issuetype = Epic AND summary ~ "\"[feature] Slice:\""
```

For each confirmed slice:

- If a Jira issue with the same summary already exists, reuse it.
- If an issue has the same slice statement but a slightly different title, report the match and ask before editing the title.
- If no match exists, create a new issue.

Reused issues must still end in the desired state: status `Backlog` where Jira workflow allows it, and description containing or preserving the `sdd-slicer-jira` managed block.

### Step 7: Create or update slice epics

Jira summary:

```text
[feature] Slice: [user-visible behavior]
```

Issue body template:

```markdown
## Slice

[Slice statement]

<!-- sdd-slicer-jira:begin -->
## Source

- PRD: [file or section]
- TDD: [file or section]
- Standalone request: [summary of user-provided context]

## Intent

- Why now: [value, risk reduction, or dependency rationale]
- Readiness: [Ready / Needs user clarification / Needs TDD clarification / Needs product clarification]
- Dependencies: [None or slice issue/title references]

## Out of scope

- [Deferred behavior]

## Notes

- [Assumptions, constraints, or open questions]
<!-- sdd-slicer-jira:end -->
```

Omit the PRD, TDD, or standalone request line when that source was not provided. Preserve all human-written issue content outside the managed markers. If the markers already exist, replace only the block between them.

Create new epics with the Atlassian MCP `createJiraIssue` tool:

```json
{
  "cloudId": "csai420.atlassian.net",
  "projectKey": "SCRUM",
  "issueTypeName": "Epic",
  "summary": "[feature] Slice: User can connect one YouTube channel",
  "description": "## Slice\n\nA user can connect one YouTube channel and see it listed.\n\n<!-- sdd-slicer-jira:begin -->\n...\n<!-- sdd-slicer-jira:end -->",
  "contentFormat": "markdown",
  "responseContentFormat": "markdown"
}
```

For reused epics, read the current description with `getJiraIssue`, preserve human-written content outside the managed markers, and write the updated description with `editJiraIssue`.

If the issue is not in `Backlog`, use `getTransitionsForJiraIssue` and `transitionJiraIssue` to move it only when Jira offers a valid transition. Never guess transition IDs. Do not set story points on parent slice epics; story points are reserved for executable task/story issues.

### Step 8: Report results

Return a concise summary with:

- Each confirmed slice title, issue number or URL, and status (`Created`, `Reused`, or `Updated`).
- Any slices not created and why.
- The Jira project URL from `docs/work-tracking.md`.
- Any remaining product or technical questions that block later planning.

## Examples

### Example 1: PRD and TDD to slice issues

User says: "Create slices from `@diagrams/ideas/PRD-Nuxeo-YouTube-Integration.md` and `@diagrams/ideas/TDD-Nuxeo-YouTube-Integration.md`."

Actions:

1. Read both source documents and `docs/work-tracking.md`.
2. Derive the walking skeleton first: a user connects one YouTube channel and sees it listed.
3. Propose the ordered backlog for confirmation.
4. After confirmation, create or reuse parent Jira slice epics in Backlog and report the issue URLs.

Result: Jira has parent slice epics such as `[youtube-integration] Slice: User can connect one YouTube channel and see it listed`, each traceable to PRD/TDD source context.

### Example 2: PRD only

User says: "Slice this PRD into Jira issues: `@docs/new-reporting-prd.md`."

Actions:

1. Read the PRD and identify user-visible outcomes.
2. Propose slices with `Needs TDD clarification` where architecture, dependencies, or persistence boundaries are unknown.
3. Ask for confirmation before issue creation.

Result: Ready slices can become Jira epics; unclear slices are held back or created as placeholders only if the user explicitly confirms.

### Example 3: Invalid layer-based slice list

User says: "Create slices for database schema, REST endpoints, frontend pages, and tests."

Actions:

1. Explain that these are layers, not slices.
2. Reshape them into user-visible behaviors that include the necessary schema, API, UI, and tests inside each slice.
3. Preview the reshaped backlog before creating issues.

Result: Jira gets value-based parent slice epics instead of layer-based work items.

### Example 4: Standalone slice

User says: "Create a standalone slice for letting admins invite a teammate by email."

Actions:

1. Ask only for missing essentials, such as whether invited teammates need a role on invite and what visible confirmation proves success.
2. Draft a single slice such as `[team-management] Slice: Admin can invite one teammate by email and see the pending invite`.
3. Preview the slice with standalone traceability and ask for confirmation before issue creation.

Result: A parent Jira epic is created from the captured standalone context without requiring a PRD or TDD.

## Troubleshooting

### Preflight failed: missing inputs

Cause: `docs/work-tracking.md` is missing or incomplete, provided source files are unreadable, Atlassian MCP access is unavailable, or a standalone request lacks the actor, behavior, value, or scope needed to create a meaningful slice.
Solution: Stop before side effects, report every missing input, and ask the user to fix the preflight failures or answer focused standalone intake questions.

### Slice candidates are too broad

Cause: A proposed slice contains multiple user-visible behaviors, several unrelated outcomes, or too many unresolved dependencies.
Solution: Split it into smaller independently demoable slices. Prefer the walking skeleton first, then add slices that widen or deepen behavior.

### Candidate is layer-based

Cause: The candidate describes technical construction rather than user-visible value.
Solution: Reframe it as a user behavior that requires that technical work. For example, replace "Build OAuth tables and API" with "A user can connect one external account and see the connection status."

### Existing issue found

Cause: A slice issue already exists from an earlier run or manual planning.
Solution: Reuse it. Preserve human-written content, update only the managed block, and reconcile Jira status when a valid transition exists.

### Jira field or transition command fails

Cause: `docs/work-tracking.md` contains stale Jira field names, the Atlassian MCP user lacks access, or Jira does not offer the requested transition.
Solution: Stop, report the failed field or transition, and ask the user to refresh Atlassian access or update `docs/work-tracking.md`. Do not silently substitute field IDs or transition IDs.
