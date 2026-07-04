---
name: sdd-pr-review
description: PracticeFront SDD pull request reviewer that posts GitHub inline comments and a PR review summary. Use when explicitly asked to review a pull request with phrases like "sdd review PR #123", "review PR #123", "review this PR", "code review this pull request", or "run SDD PR review". Do NOT use during feature implementation, branch pre-review without a PR, generic code questions, or non-SDD planning.
license: CC-BY-4.0
metadata:
  author: Daniel Teleginski Camargo
  version: 1.1.0
---

# SDD PR Review

Review a PracticeFront GitHub pull request against both code quality and the spec-driven delivery contract. The workflow posts review comments and records per-track model/token usage; it never approves, requests changes, modifies files, or pushes commits.

## Non-Negotiables

1. Require an explicit PR number or URL. If the user does not provide one and GitHub cannot identify the current PR unambiguously, ask for the PR number.
2. Use GitHub CLI for PR, issue, diff, and comment operations.
3. Post inline comments only on added diff lines. Never comment on context lines, deleted lines, or files outside the PR diff.
4. Do not duplicate existing review comments. Skip a new finding when an existing comment within three lines already covers it.
5. Only report findings with high confidence and clear evidence from the diff or SDD artifacts.
6. Never include PHI, secrets, tokens, connection strings, or real patient data in review comments.
7. Never approve, request changes, edit source files, commit, push, or change issue state. The only allowed issue write is appending this skill's model/token usage block to the resolved slice issue body.

## Workflow

### Step 1: Initialize

Resolve the PR context before launching reviewers.

1. Identify the repository: `gh repo view --json nameWithOwner --jq .nameWithOwner`.
2. Resolve `PR_NUMBER` from the user's request. If absent, try `gh pr view --json number --jq .number`; if that fails or is ambiguous, ask the user.
3. Fetch PR metadata: `gh pr view "$PR_NUMBER" --json number,title,body,headRefName,baseRefName,author,closingIssuesReferences,url`.
4. Fetch the diff: `gh pr diff "$PR_NUMBER"`.
5. Fetch changed paths: `gh pr diff "$PR_NUMBER" --name-only`.
6. Fetch existing inline comments: `gh api "repos/$REPO/pulls/$PR_NUMBER/comments"`.
7. Fetch existing PR-level comments: `gh api "repos/$REPO/issues/$PR_NUMBER/comments"`.
8. Resolve linked issues from `closingIssuesReferences`, PR body closing keywords, and the `gh-issue-N` branch pattern.
9. Build a skip set from existing comments keyed by path and line, including all comments from this skill's markers.
10. Record the review run date and PR number for usage reporting.

If any GitHub command fails because authentication is missing, stop and tell the user to authenticate `gh`. Do not attempt browser-based workarounds.

### Step 2: Load Shared SDD Evidence

Load only the documents needed for this PR. Do not read the entire `.specs` tree.

Always load:

- `docs/ai-dev-flow.md`
- `docs/work-tracking.md` when it exists
- `.specs/codebase/CONVENTIONS.md` when the PR touches source code
- `.specs/codebase/INTEGRATIONS.md` and `.specs/codebase/CONCERNS.md` when the PR touches data movement, integrations, auth, webhooks, logs, or PHI-sensitive flows

Load these when referenced or discoverable:

- `.specs/features/[slice]/spec.md`, `design.md`, `tasks.md`, and `validation.md` for the linked slice
- `docs/product/prd/*`, `docs/engineering/tdd/*`, and `docs/engineering/rfc/*` when the PR body, linked issue, spec, or branch mentions them
- `docs/engineering/adr/README.md` when present, then only the ADR files whose scope or title matches changed paths or explicit references

Resolve the slice by preferring, in order:

1. A linked parent slice issue from `closingIssuesReferences`.
2. Explicit `.specs/features/...` paths in the PR body or linked issue body.
3. The branch name, especially `gh-issue-N` or a slice slug.
4. Fuzzy matching changed `.specs/features/[slice]/` paths.

When a slice issue is resolved, capture its issue number as `SLICE_NUM` for the usage enrichment step.

If no SDD artifacts are found, continue the code review but post an SDD Traceability finding that the PR cannot be verified against the delivery contract.

### Step 3: Launch Review Tracks in Parallel

Launch the review tracks concurrently using the available subagent/task tool. In Cursor, use the Subagent tool. Pass each reviewer the PR metadata, full diff, changed paths, linked issues, loaded SDD evidence, existing comment skip set, and the universal rules above.

Each reviewer returns:

- Findings with marker, severity, path, line, title, evidence, and recommendation
- PR-level notes, if the track produces a summary
- Files or requirements inspected
- Explicit "no findings" when clean
- Model name and approximate token usage in the same convention as `sdd-execute-jira` workers, e.g. `Model: Sonnet 4.6`, `Token usage: 30% (60k/200k)`

Use these severities exactly:

- `Security` for security, HIPAA, privacy, tenant isolation, auth, or secret exposure
- `Critical` for defects likely to break behavior, data integrity, validation, or delivery gates
- `Performance` for clear performance regressions visible in the diff
- `Warning` for maintainability, architecture, reliability, or test risks
- `Suggestion` for optional improvements with low risk

### Track 1: Security and HIPAA

Marker: `<!-- sdd-pr-review:security -->`

Apply the PHI/HIPAA baseline and PracticeFront integration boundaries. Review for missing PHI audit paths, tenant isolation bypasses, PHI or PII in logs/errors/telemetry, committed secrets or connection strings, raw query concatenation, missing auth/authorization, missing webhook signature validation, overly broad CORS, sensitive response payloads, broadened partner credentials, and weakened encryption or least privilege.

For every file that reads, writes, displays, exports, logs, transmits, or transforms patient data, explicitly check:

- Who, what, when, and where audit coverage exists for PHI read/write paths
- Tenant/practice scoping is enforced through RLS context or an equivalent authenticated tenant constraint
- Logs, errors, analytics, telemetry, traces, and comments do not contain PHI or secrets
- External partner data movement is allowed by documented integration boundaries

Comment format:

```markdown
<!-- sdd-pr-review:security -->
Security - [Short title]
[What the issue is and why it matters]
Recommendation: [Specific fix]
```

### Track 2: SDD Traceability

Marker: `<!-- sdd-pr-review:traceability -->`

Verify the PR preserves the spec-driven execution trail from `docs/ai-dev-flow.md` and `sdd-execute-jira`.

Check:

- PR closes the parent slice issue and every task sub-issue when sub-issues exist
- Branch naming matches the slice issue convention when applicable
- Linked issue body includes planning artifacts from `sdd-tasks-jira`
- `.specs/features/[slice]/spec.md` exists and contains traceable requirements or acceptance criteria
- `.specs/features/[slice]/tasks.md` exists for the selected slice
- Task issues map back to `tasks.md`
- Commits are atomic by task and include traceability footers such as `Refs: #SUBTASK` and `Parent: #SLICE`
- The PR body links or names the relevant spec, task plan, validation evidence, and closing issues
- The diff scope stays inside the selected slice and does not mix unrelated user-visible behavior

Post inline comments for traceability defects tied to added lines. Also return PR-level notes for missing issue/spec/commit evidence that has no valid inline location.

### Track 3: Requirements and Definition of Done

Marker: `<!-- sdd-pr-review:requirements -->`

This track posts one PR-level summary comment and may return inline findings for concrete missing implementation evidence.

Gather requirements from:

1. Linked GitHub issues and sub-issues, especially Acceptance Criteria, Scope, Gates, Tests, Done when, and out-of-scope sections.
2. `.specs/features/[slice]/spec.md` acceptance criteria and requirement IDs.
3. `.specs/features/[slice]/tasks.md` task deliverables, dependencies, tests, gates, and done criteria.
4. Linked PRD, TDD, RFC, or ADR constraints when referenced by the slice docs.

For each requirement or done criterion, classify it as:

- `Implemented` when the diff clearly satisfies it
- `Missing or incomplete` when the diff clearly fails it
- `Not verifiable from diff` when evidence is absent or depends on runtime validation
- `Out of scope` only when the spec or task plan explicitly excludes it

PR-level summary format:

```markdown
<!-- sdd-pr-review:requirements -->
## SDD Requirements Review

Sources: [issues/spec/tasks/docs used]

### Implemented
- [Requirement ID or criterion] - evidence

### Missing or Incomplete
- [Requirement ID or criterion] - gap

### Not Verifiable From Diff
- [Requirement ID or criterion] - needed evidence

### Definition of Done
- [x] [done criterion]
- [ ] [done criterion]
```

### Track 4: Tests and Validation Evidence

Marker: `<!-- sdd-pr-review:validation -->`

Review whether the PR proves the slice works according to the spec, not just according to implementation details.

Check:

- Tests are included with the task that changes behavior; tests are not deferred to a separate task
- Tests derive from acceptance criteria and assert user-visible or contract-visible outcomes
- New routes, server actions, workflows, integrations, and PHI-affecting paths have appropriate unit, integration, or e2e coverage
- Gate commands from `tasks.md` or task issues are represented in PR evidence
- `.specs/features/[slice]/validation.md` exists after the final task and contains Verifier PASS/FAIL evidence
- Validation includes per-acceptance-criterion evidence and does not rely on self-assessment
- Tests are not weakened, skipped, deleted, or rewritten to mirror the implementation

Load `.agents/skills/create-e2e-tests/SKILL.md` only when the PR adds or changes routes, pages, user workflows, server actions, or e2e tests.

### Track 5: Architecture and Coding Patterns

Marker: `<!-- sdd-pr-review:architecture -->`

Review architectural fit against PracticeFront's documented boundaries and loaded SDD design constraints.

Load when relevant:

- `.agents/skills/modular-design-principles/SKILL.md` for boundary, dependency, persistence, and operational checks
- `.agents/skills/react-best-practices/SKILL.md` and `.agents/skills/web-design-guidelines/SKILL.md` when the PR touches React UI
- `.agents/skills/react-composition-patterns/SKILL.md` when component API or composition structure changes
- `.specs/features/[slice]/design.md` when present
- Relevant ADR files from `docs/engineering/adr/`

Check that implementation follows the slice design, keeps behavior in the correct domain/module boundary, avoids shared-kernel leakage, preserves existing conventions, and does not introduce feature-local decisions that should have been captured in `design.md`, TDD, RFC, or ADR.

### Track 6: Regression and Hallucination Detection

Marker: `<!-- sdd-pr-review:regression -->`

Review the diff for changes unrelated to the PR's stated purpose or signs of AI-generated artifacts.

Look for unrelated deletions, phantom imports, calls to non-existent APIs, wrong signatures, type assertions hiding errors, broad rewrites outside the slice, duplicated logic that already exists nearby, weakened validation or error handling, swallowed async errors, TODOs in production paths, dead code, or tests that assert less than before.

Use `Critical` for defects that will break compilation, runtime behavior, data integrity, or validation gates. Use `Warning` for maintainability risks.

### Track 7: Performance

Marker: `<!-- sdd-pr-review:performance -->`

Only flag performance issues clearly visible in the diff.

For React and Next.js changes, load `.agents/skills/react-best-practices/SKILL.md` and focus on waterfalls, bundle size, server-side performance, re-render behavior, RSC/client serialization, unnecessary client components, static imports of heavy code, and missing Suspense opportunities.

For backend or integration code, look for N+1 queries, sequential awaits for independent operations, unbounded loops over external calls, repeated expensive parsing, missing pagination, inefficient queries, and blocking work in request paths.

## Posting Comments

Before posting any inline comment, verify:

1. The target path is in `gh pr diff "$PR_NUMBER" --name-only`.
2. The target line is an added line in the diff.
3. No existing comment within three lines already covers the issue.
4. The comment body starts with the track marker.
5. The comment does not contain PHI, secrets, or sensitive values.

Use the available GitHub comment mechanism for inline comments. If the environment cannot safely post an inline comment for a valid finding, include it in the consolidated PR review body under "Findings Without Inline Location".

## Step 4: Consolidate

After all tracks return, deduplicate and post one PR review summary with `gh pr review "$PR_NUMBER" --comment --body-file`.

Consolidation order:

1. Security
2. Critical
3. Performance
4. Warning
5. Suggestion

Summary format:

```markdown
<!-- sdd-pr-review:summary -->
## SDD PR Review Summary

PR: #[number] - [title]
Slice: [issue/spec path or "not resolved"]
Review tracks: Security, SDD Traceability, Requirements, Tests and Validation, Architecture, Regression, Performance

### SDD Gate Status
- Slice issue linked: PASS/FAIL/UNKNOWN
- Spec present: PASS/FAIL/UNKNOWN
- Tasks present: PASS/FAIL/UNKNOWN
- Validation evidence present: PASS/FAIL/UNKNOWN
- Closing issue traceability: PASS/FAIL/UNKNOWN
- Atomic commit traceability: PASS/FAIL/UNKNOWN
- Required gates evidenced: PASS/FAIL/UNKNOWN

### Findings
- Security: [count]
- Critical: [count]
- Performance: [count]
- Warning: [count]
- Suggestion: [count]

### Findings Without Inline Location
- [Track] [Severity] - [title]: [short evidence and recommendation]

### Requirements Review
[Include or link to the requirements track summary]

### Review Token Usage
[If a slice issue was resolved, state: "Recorded on slice issue #[SLICE_NUM] inside `sdd-pr-review:usage`." If no slice issue was resolved, include the full per-track usage table here.]

### Manual Follow-Up
- [Only include items that genuinely require a human reviewer or missing evidence]
```

If no findings are found, still post the summary with gate status and state: `No code findings were found by the SDD PR review tracks.` Do not claim the PR is approved.

### Slice Issue Usage Enrichment

When Step 2 resolves a slice issue, also append the per-track usage table to the slice issue body inside this skill's managed usage block. Preserve all other issue body content, including `sdd-tasks-jira`, `sdd-execute-jira`, and `sdd-apply-pr-comments` blocks. If the usage block exists, append a new run section inside it; never delete previous review runs.

```markdown
<!-- sdd-pr-review:usage:begin -->
## Review Token Usage

### Review Run 2026-07-03 - PR #45
| Track | Model | Token usage |
| ----- | ----- | ----------- |
| Security and HIPAA | Sonnet 4.6 | 30% (60k/200k) |
| SDD Traceability | Composer 2.5 | 15% (30k/200k) |
| Requirements and Definition of Done | Sonnet 4.6 | 28% (56k/200k) |
| Tests and Validation Evidence | Sonnet 4.6 | 24% (48k/200k) |
| Architecture and Coding Patterns | Sonnet 4.6 | 27% (54k/200k) |
| Regression and Hallucination Detection | Composer 2.5 | 18% (36k/200k) |
| Performance | Composer 2.5 | 14% (28k/200k) |
<!-- sdd-pr-review:usage:end -->
```

Fetch the current issue body first, append the new run section inside the content between `sdd-pr-review:usage:begin/end`, and write the updated body with `gh issue edit "$SLICE_NUM" --repo "$REPO" --body-file`. If no slice issue can be resolved, keep the usage table in the PR review summary only so the metric is not lost.

## Examples

### Example 1: Explicit PR Review

User says: "Run sdd-pr-review on PR #45"

Actions: resolve repo and PR #45, fetch diff/comments/issues, load the linked slice spec/tasks/validation, launch all seven tracks, collect each track's model/token usage, post non-duplicate inline comments on added lines, post the SDD PR Review Summary, then append the review usage table to the slice issue.

Result: GitHub PR #45 has inline findings and one review summary containing SDD gate status, requirements coverage, and per-track usage; the slice issue records the review cost history.

### Example 2: Missing SDD Evidence

User says: "Review this PR"

Actions: resolve the current PR, find no linked slice issue and no `.specs/features/...` references, continue code review, collect track usage, then post a traceability finding and summary gate failures for missing slice/spec/tasks/validation evidence.

Result: The PR review explains that the code could be reviewed, but the SDD delivery contract could not be verified. Because no slice issue was resolved, the per-track usage table stays in the PR review summary.

### Example 3: Security-Sensitive Slice

User says: "sdd review PR #88"

Actions: detect changed webhook and patient-data paths, load integration and concern docs, run the security track against PHI audit, tenant isolation, webhook signature validation, and no-PHI-logs requirements.

Result: Security findings are posted only where the diff provides evidence, with PHI-safe recommendations.

## Troubleshooting

### No PR Number

Cause: The user did not provide a PR and `gh pr view` cannot resolve one.

Solution: Ask for the PR number or URL. Do not review the current branch as a substitute.

### GitHub Authentication Fails

Cause: `gh` is not authenticated or lacks repository access.

Solution: Stop and ask the user to authenticate `gh`. Do not post partial reviews through another channel unless the user asks for a chat-only fallback.

### Inline Comment Cannot Be Posted

Cause: The target line is not an added line, the GitHub API rejects the location, or the finding is PR-level evidence.

Solution: Put the finding in the consolidated summary under "Findings Without Inline Location". Do not force a comment onto an unrelated line.

### SDD Artifacts Are Missing

Cause: The PR was opened outside the spec-driven flow or planning was not published.

Solution: Continue the code review, mark the affected SDD gates as FAIL or UNKNOWN, and recommend linking the slice issue plus adding the required spec, tasks, and validation evidence.

### Existing Comment Already Covers The Issue

Cause: A prior review comment within three lines already reports the same defect.

Solution: Skip the duplicate. If the issue appears resolved by the current diff, reply to the old comment only when you can verify the fix from the diff.

### Slice Issue Usage Enrichment Fails

Cause: The slice issue body could not be fetched or edited, or the resolved issue is no longer accessible.

Solution: Do not retry with broad issue edits. Keep the per-track usage table in the PR review summary, report that slice issue enrichment failed, and leave all other review comments intact.
