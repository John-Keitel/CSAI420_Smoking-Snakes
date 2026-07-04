---
name: sdd-apply-pr-comments
description: PracticeFront SDD PR comment remediation skill that applies human-endorsed unresolved PR review threads. Use when the user says "apply the PR review comments", "address review comments on PR #123", "implement the review feedback", "fix the PR comments", or "apply thumbs-up PR comments". Only acts on unresolved review threads with a thumbs-up reaction. Do NOT use to run a PR review (use sdd-pr-review), execute a slice from scratch (use sdd-execute-jira), or plan new feature work.
license: CC-BY-4.0
metadata:
  author: Daniel Teleginski Camargo
  version: 1.0.0
---

# SDD Apply PR Comments

Apply human-endorsed unresolved PR review comments on an existing open slice PR. The workflow treats GitHub review threads as the unit of work, fixes approved comments on the PR branch, routes oversized scope gaps back to planning, and records model/token usage on the slice issue.

## Non-Negotiables

1. Require an explicit PR number or URL, or resolve the current PR unambiguously with `gh pr view`. If neither works, ask for the PR number.
2. Use GitHub CLI for PR, issue, project, thread, reaction, reply, and resolution operations.
3. Act only on unresolved review threads that have a `THUMBS_UP` reaction. Never modify or reply to threads without thumbs-up endorsement unless reporting that they were skipped.
4. Never approve, close, merge, or force-push the PR. Push only normal commits to the PR head branch after gates pass.
5. Never include PHI, secrets, tokens, connection strings, real patient data, or sensitive payloads in code, commits, comments, thread replies, logs, or issue bodies.
6. Preserve SDD traceability: commits use `Refs:` and `Parent:` footers, gates derive from the slice/task plan, and usage trails are written only inside this skill's markers.
7. Do not weaken, skip, delete, or rewrite tests to satisfy review feedback. If a gate cannot pass, stop and report the failing command and evidence.
8. If a thumbs-up finding is a real scope gap larger than a small PR-fix commit, create or update a task issue under the slice instead of patching it inline.

## Workflow

### Step 1: Preflight

Resolve the PR context and branch before changing anything.

1. Identify the repository: `gh repo view --json nameWithOwner --jq .nameWithOwner`.
2. Resolve `PR_NUMBER` from the user's request. If absent, try `gh pr view --json number --jq .number`; if that fails or is ambiguous, ask the user.
3. Fetch PR metadata: `gh pr view "$PR_NUMBER" --json number,title,body,headRefName,baseRefName,author,closingIssuesReferences,url`.
4. Verify `gh auth status` succeeds. If project board updates may be needed for scope-gap tasks, ensure the token has the `project` scope.
5. Fetch `docs/work-tracking.md` when it exists and export its repo/project/status variables before any issue or board operation. Never hard-code project IDs.
6. Require a clean working tree before checking out the PR head branch. If the working tree is dirty, stop and ask the user how to proceed.
7. Fetch and check out the PR head branch, then pull fast-forward only:

```bash
git fetch origin "$HEAD_REF"
git checkout "$HEAD_REF"
git pull --ff-only
```

Never create a new slice branch. This skill works on the existing open PR branch.

### Step 2: Load SDD Context

Load only the documents needed for this PR.

Always load:

- `docs/ai-dev-flow.md`
- `.cursor/rules/security-hipaa.mdc`
- `docs/work-tracking.md` when issue or board changes may be needed
- `.specs/codebase/CONVENTIONS.md` when the PR touches source code
- `.specs/codebase/INTEGRATIONS.md` and `.specs/codebase/CONCERNS.md` when comments involve data movement, integrations, auth, webhooks, logs, or PHI-sensitive flows

Resolve the slice issue and feature folder by preferring, in order:

1. The PR's `closingIssuesReferences`.
2. Explicit `.specs/features/...` paths in the PR body, linked issue body, or review comments.
3. The branch name, especially `gh-issue-N`.
4. Changed `.specs/features/[slice]/` paths in the PR diff.

When found, read `.specs/features/[slice]/spec.md`, `tasks.md`, `validation.md` when present, and `design.md` when present. If the slice issue cannot be resolved, continue only for small code fixes and skip slice issue enrichment; include the limitation in the final report.

### Step 3: Fetch Endorsed Unresolved Threads

Fetch review threads through GraphQL so thread resolution state and reactions are available.

```graphql
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          path
          line
          comments(first: 20) {
            nodes {
              id
              body
              author { login }
              createdAt
              reactions(first: 20, content: THUMBS_UP) {
                totalCount
                nodes { user { login } }
              }
            }
          }
        }
      }
    }
  }
}
```

Keep a thread only when:

1. `isResolved` is false.
2. At least one comment in the thread has a `THUMBS_UP` reaction.
3. The thread is still relevant to the current PR diff or represents a PR-level SDD gap that can be tied to the slice.

Skip all other threads. Report skipped counts, but do not reply to skipped threads.

### Step 4: Triage the Endorsed Threads

Classify each endorsed thread before editing.

- `Fix inline`: a contained defect, validation issue, traceability miss, or test gap that can be resolved by a small PR-branch commit.
- `Route to planning`: a missing requirement, under-planned behavior, new user-visible scope, unclear design decision, or task that would honestly size above 3 points.
- `Decline with rationale`: a `Warning` or `Suggestion` where the current implementation is correct by spec, the recommendation conflicts with an ADR/design, or the requested change is out of scope. Security and Critical findings are not declined without asking the user.

Parse severity from `sdd-pr-review` comment bodies when present:

- `<!-- sdd-pr-review:security -->` defaults to `Security`.
- `<!-- sdd-pr-review:traceability -->`, `<!-- sdd-pr-review:requirements -->`, `<!-- sdd-pr-review:validation -->`, `<!-- sdd-pr-review:architecture -->`, and `<!-- sdd-pr-review:regression -->` use the severity label in the comment body when present, otherwise `Warning`.
- `<!-- sdd-pr-review:performance -->` defaults to `Performance`.
- Human comments without markers default to `Warning` unless the body clearly identifies a breaking defect or security issue.

State the remediation plan before changing files:

```text
Fix inline:
- Thread [id] path:line - [severity] [summary] - gate [command]

Route to planning:
- Thread [id] - [reason] - proposed task title

Decline:
- Thread [id] - [rationale]
```

### Step 5: Apply Inline Fixes

Implement inline fixes directly on the PR head branch. Group closely related findings only when they concern the same file and same behavioral cause; otherwise use one commit per thread.

For every fix group:

1. Make the smallest code/test change that satisfies the review comment and the slice spec.
2. Run the gate from the related task issue or `tasks.md`. If no explicit gate exists, use the fallback: logic change to build plus relevant unit/integration tests; UI workflow change to build plus relevant component/e2e test if present; docs-only change to no gate, with reason reported.
3. Re-read changed files for PHI/logging/tenant isolation risks when the fix touches sensitive paths.
4. Commit atomically using Conventional Commits and traceability footers:

```text
<type>(<scope>): <description>

Refs: #<SUBTASK_OR_SLICE>
Parent: #<SLICE>
```

Use the subtask number when the thread clearly maps to a subtask issue; otherwise use the slice issue number for both `Refs:` and `Parent:`. Record the final commit SHA.

### Step 6: Route Scope Gaps to Planning

For each endorsed thread that is too large or ambiguous for a PR-fix commit, create or reconcile a task issue under the slice.

1. Require a resolved slice issue. If absent, stop and report the scope gap instead of creating an orphan issue.
2. Size the task using `docs/work-tracking.md`. If it sizes at 8+, stop and ask for planning; do not create an under-planned issue.
3. Create the issue with title `[feature] Review Fix: [short title]` and body:

```markdown
## What

[Specific follow-up needed]

**Where**: `[paths or PR thread location]`
**Source PR**: #[PR_NUMBER]
**Source thread**: [thread URL or ID]
**Requirement**: [requirement ID when known]
**Depends on**: [related task issue or "None"]

## Done when

- [ ] [review finding satisfied]
- [ ] Required tests or validation evidence added

**Tests**: [test type or gate] | **Gate**: [gate command]

---
Source: PR review thread on #[PR_NUMBER]
```

4. Add the issue to the project board, set Status=Todo, Size, and Component using IDs from `docs/work-tracking.md`.
5. Link it as a native sub-issue of the slice issue with `addSubIssue`.
6. Append the issue URL to `.specs/features/[slice]/tasks.md` under a new "Review Follow-up Tasks" section, commit that documentation change, and push it with the rest of the PR branch.

After creating the follow-up issue, the original PR thread can be resolved because the endorsed feedback has been captured as traceable planned work.

### Step 7: Re-Verify When Behavior Changes

If any inline fix changes acceptance-criteria behavior, validation logic, tests, data movement, PHI-sensitive paths, or user-visible flows, dispatch a fresh Verifier using the `tlc-spec-driven` verifier role from `sdd-execute-jira` Step 6.

Provide the Verifier:

- `spec.md`, `tasks.md`, and `validation.md` when present
- The diff from the pre-remediation commit to `HEAD`
- The relevant tests and gates that ran
- The list of review threads addressed

Commit an updated `.specs/features/[slice]/validation.md` when the Verifier writes one. If the Verifier fails, run at most three fix, gate, and verify cycles, then stop and report the ranked gaps.

### Step 8: Push, Reply, and Resolve Threads

After every inline fix and planning-route task is committed and gates are green:

1. Push the PR branch normally: `git push origin "$HEAD_REF"`.
2. Reply to each fixed thread with a PHI-safe summary and commit SHA:

```markdown
<!-- sdd-apply-pr-comments:reply -->
Fixed in `[commit]`. Gate: `[command]` PASS.
```

3. Reply to each planned thread with the follow-up issue:

```markdown
<!-- sdd-apply-pr-comments:reply -->
Routed to follow-up task #[issue] because this is larger than a PR-fix commit. The task is linked under slice #[slice].
```

4. Reply to each declined thread with a concise rationale and leave it unresolved:

```markdown
<!-- sdd-apply-pr-comments:reply -->
Not applying this suggestion because [spec/design/ADR reason]. Leaving the thread unresolved for human confirmation.
```

5. Resolve only fixed and planned threads using GraphQL:

```graphql
mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread { id isResolved }
  }
}
```

If thread resolution fails after the branch is pushed, do not retry indefinitely. Report the failed thread IDs and the fix commits.

### Step 9: Enrich the Slice Issue

When the slice issue is resolved, append or update this skill's managed block in the slice issue body. Preserve all other content, including `sdd-tasks-jira`, `sdd-execute-jira`, and `sdd-pr-review` blocks.

If the block exists, append a new run section inside it; never delete previous runs.

```markdown
<!-- sdd-apply-pr-comments:begin -->
## PR Comment Remediation

### Run 2026-07-03 - PR #45
| Thread | Action | Commit / Issue |
| ------ | ------ | -------------- |
| `src/foo.ts:42` (Security) | Fixed | abc1234 |
| Requirements summary | Planned | #52 |
| `src/bar.ts:18` (Suggestion) | Declined | Left unresolved |

**Model**: Fable 5 | **Token usage**: 35% (70k/200k)
**Verifier**: re-run, PASS
<!-- sdd-apply-pr-comments:end -->
```

Use the actual model name and approximate token usage for this remediation run. If a Verifier ran, include its model/token usage as a separate line:

```markdown
**Verifier model**: Sonnet 4.6 | **Verifier token usage**: 22% (44k/200k)
```

If no slice issue is available, put the remediation trail and usage summary in a PR comment instead.

### Step 10: Report

Report:

- PR URL and branch
- Fixed threads with commit SHAs and gates
- Planned threads with issue URLs
- Declined threads with rationale
- Resolved thread count and any unresolved/failure IDs
- Slice issue enrichment status
- Model/token usage for the remediation run and Verifier, if used

## Examples

### Example 1: Apply Endorsed Security Finding

User says: "Apply thumbs-up PR comments on PR #45"

Actions: resolve PR #45, fetch unresolved threads, keep the security thread with a thumbs-up reaction, load the slice spec and PHI rules, patch the missing audit path, run the task gate, commit with `Refs: #41` and `Parent: #40`, push, reply with the commit SHA, resolve the thread, and append the remediation usage trail to slice #40.

Result: the endorsed thread is resolved on GitHub, the PR branch contains one traceable fix commit, and slice #40 records the cost of the remediation run.

### Example 2: Decline an Endorsed Suggestion

User says: "Fix the PR comments on PR #46"

Actions: keep an endorsed suggestion thread, load `design.md`, verify the suggestion conflicts with the accepted design, reply with a concise rationale, leave the thread unresolved, and include it in the final report as declined.

Result: no code changes are made for that thread, and a human reviewer can decide whether to resolve or continue the discussion.

### Example 3: Route a Missing Requirement

User says: "Implement review feedback for PR #47"

Actions: detect an endorsed `sdd-pr-review:requirements` thread that requires new user-visible behavior, create `[feature] Review Fix: Add missing export validation` as a Todo sub-issue under the slice, write it back to `tasks.md`, commit and push the planning update, reply with the issue link, resolve the thread, and report the planned follow-up.

Result: the PR review feedback is not lost, but the oversized work stays traceable through the SDD task flow instead of being hidden in a broad PR fix commit.

## Troubleshooting

### No PR Number

Cause: The user did not provide a PR and `gh pr view` cannot resolve one.

Solution: Ask for the PR number or URL. Do not apply comments from an arbitrary branch.

### No Thumbs-Up Threads

Cause: There are no unresolved review threads with a thumbs-up reaction.

Solution: Report that there is nothing endorsed to apply. Do not act on unendorsed comments.

### GitHub Authentication Fails

Cause: `gh` is not authenticated or lacks `project` scope for scope-gap task creation.

Solution: Stop and ask the user to authenticate `gh` or refresh scopes with `gh auth refresh -s project`.

### PR Branch Diverged

Cause: The PR head branch changed while remediation was in progress.

Solution: Pull with `--ff-only` before pushing. If fast-forward is not possible, stop and report the divergence. Never force-push.

### Gate Fails After Fix

Cause: The fix introduced a regression or the existing branch is red.

Solution: Fix the regression if it is clearly caused by the remediation. If unrelated, stop and report the failing command and evidence before replying to or resolving threads.

### Scope Gap Cannot Be Published

Cause: The slice issue is missing, project IDs are stale, sub-issues are unavailable, or the task sizes at 8+.

Solution: Do not create a partial task. Report the exact blocker and leave the thread unresolved unless the user explicitly chooses another path.

### Thread Resolution Fails

Cause: GraphQL rejected the `resolveReviewThread` mutation or the thread changed state.

Solution: Report the thread ID and fix commit or follow-up issue. Do not hide the failure in the final summary.
