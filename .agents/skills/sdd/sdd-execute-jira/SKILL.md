---
name: sdd-execute-jira
description: Executes a planned slice from its Jira epic - moves the slice to In Progress, fans Jira task issues out to parallel worker sub-agents in isolated git worktrees forked from the slice branch, integrates each finished task linearly (rebase + fast-forward, no merge commits), runs the always-on Verifier, opens the single slice PR last, rolls every Jira issue to In Review, and leaves an execution trace (commits with Refs footers, token usage, skills/docs consumed) on the slice epic and task issues. Use when the user says "execute the slice", "execute slice SCRUM-N", "implement issue SCRUM-N", "start the work on the slice", "run the slice", or "work the slice issue". Do NOT use for creating tasks.md or breaking a feature into tasks (use tlc-spec-driven), or for publishing tasks as Jira issues and closing the planning session (use sdd-tasks-jira).
license: CC-BY-4.0
metadata:
  author: Daniel Teleginski Camargo
  version: 1.1.0
---

# SDD Execute

Execute a planned slice end to end from its Jira epic. The invoking agent is the **orchestrator**: it reads the spec from the slice branch, builds the dependency graph, spawns one worker sub-agent per Jira task issue in isolated git worktrees, integrates results linearly into the slice branch, dispatches the Verifier, opens the single slice PR last, and leaves a full execution trace on Jira. The orchestrator never edits source files itself when there are child task issues.

Two invariants shape everything below:

- **The slice branch carries the value.** Task branches are local-only scaffolding — each carries one atomic change, gets rebased onto the slice branch, and is deleted. The slice branch becomes the one PR into the default branch.
- **Git history is context — keep it linear and polished.** No merge commits. Every commit carries `Refs:`/`Parent:` footers so future builders can trace which files changed for which task.

`docs/work-tracking.md` is the source of truth for Jira project, issue hierarchy, workflow status names, and story point field IDs. Never hard-code IDs beyond values read from that document. GitHub is still used for source control and the final pull request, but Jira is the source of truth for work tracking.

## Model Routing

Use the model guidance from `README.md`:

| Activity | Model |
| -------- | ----- |
| Planning and orchestration decisions | GLM-5.2 |
| Implementation workers | Kimi K2.7 Code |
| Quick fix loops after verifier or gate failures | DeepSeek V4 Flash |

Story points control wave planning and under-planning gates, not model selection. All implementation task workers use Kimi K2.7 Code. Small fix loops use DeepSeek V4 Flash.

## Instructions

### Step 1: Preflight gate — fail fast, before any side effects

The user provides a slice Jira issue key or URL. If absent, stop and ask — never guess or search for it.

Verify ALL of the following before changing anything:

1. `docs/work-tracking.md` exists and defines `JIRA_CLOUD_ID`, `JIRA_SITE`, `JIRA_PROJECT_KEY`, `SLICE_ISSUE_TYPE`, `TASK_ISSUE_TYPE`, and `STORY_POINTS_FIELD`.
2. The Atlassian MCP server is available. Before each MCP tool family is used, read its descriptor file and follow the schema exactly.
3. `gh auth status` succeeds for repository and pull request operations.
4. The working tree has no uncommitted changes. If it does, STOP and ask the user before switching branches.
5. The slice branch exists (locally or on the remote):

```bash
SLICE_BRANCH="jira-$(printf '%s' "$SLICE_KEY" | tr '[:upper:]' '[:lower:]')"
git fetch origin "$SLICE_BRANCH"
```

If the branch does not exist, STOP — planning has not been published. Point the user at `sdd-tasks-jira`. Never fork a slice branch from the default branch here; it would lack the spec files.

Then gather the work context:

- Fetch the slice epic description with `getJiraIssue`.
- Fetch child task issues with `searchJiraIssuesUsingJql`, scoped to `project = SCRUM`, `parent = SCRUM-N`, and `issuetype = Task`.
- Fetch each child task's story point estimate from `STORY_POINTS_FIELD`. Fall back to `tasks.md` only if Jira temporarily fails to expose it.
- Check out `$SLICE_BRANCH` in the repo root and pull `--ff-only`.
- Read `.specs/features/[feature]/spec.md` and `tasks.md` from the branch. Cross-check: every child Jira task should match a task entry (Jira issue URLs were written back into `tasks.md` by `sdd-tasks-jira`). Report mismatches before proceeding.

Finally, make the worktree container self-ignoring so worktree checkouts never show up as untracked code in the main tree:

```bash
mkdir -p .specs/worktrees
[ -f .specs/worktrees/.gitignore ] || {
  echo '*' > .specs/worktrees/.gitignore
  git add -f .specs/worktrees/.gitignore
  git commit -m "chore: ignore worktree checkouts under .specs/worktrees"
}
```

(`*` ignores the `.gitignore` itself too, hence `git add -f` for that one file.)

### Step 2: Move the slice to In Progress

Assign the Jira slice epic to yourself when appropriate and transition it to **In Progress** using Atlassian MCP:

1. Use `getJiraIssue` to inspect current assignee and status.
2. If assignment is needed, use `editJiraIssue` without removing any existing assignee unless the user explicitly asks.
3. If the status is not `In Progress`, use `getTransitionsForJiraIssue` first, then `transitionJiraIssue` with the matching transition ID. Never guess transition IDs.

### Step 3: Build the wave plan

Build the dependency graph from the `Depends on` fields in `tasks.md` (cross-checked against the `Depends on: SCRUM-N` lines in the Jira task descriptions and Jira issue links). Tasks with no unmet dependency form a parallel wave; dependents wait for the wave that produces their inputs. Two tasks touching the same files are a dependency even if none is declared — when in doubt, serialize. Correctness over parallelism.

State the wave plan explicitly before launching anything, e.g.:

```text
Wave 1 (parallel): T1 (SCRUM-18), T2 (SCRUM-19)
Wave 2 (after T1): T3 (SCRUM-20)
```

**No child tasks?** The slice epic is a work list of one: skip the fan-out entirely. Implement directly on `$SLICE_BRANCH` in the repo root following the `tlc-spec-driven` Execute cycle (its `references/implement.md`), with commit footers `Refs: <SLICE_KEY>` only, then continue at Step 6.

### Step 4: Execute waves — orchestrator never edits source

Use story points only as a planning quality gate:

| Story points | Execution handling                                                                  |
| ------------ | ----------------------------------------------------------------------------------- |
| 1–2          | Normal implementation worker                                                        |
| 3            | Normal implementation worker; serialize if file overlap risk exists                 |
| 5            | Normal implementation worker only if dependencies and acceptance criteria are clear |
| 8+           | STOP — under-planned; send back to planning                                         |

Every implementation worker uses **Kimi K2.7 Code**. Quick correction loops caused by verifier or gate failures use **DeepSeek V4 Flash**. Orchestration and wave planning use **GLM-5.2**.

For each task in the current wave:

**4a. Move its Jira task to In Progress** with `getTransitionsForJiraIssue` and `transitionJiraIssue` when a transition is available.

**4b. Create the branch and worktree atomically**, forked from the current slice branch tip — never from the default branch, never via `git checkout` in the shared root:

```bash
TASK_BRANCH="jira-$(printf '%s' "$TASK_KEY" | tr '[:upper:]' '[:lower:]')"
TASK_WORKTREE=".specs/worktrees/$TASK_BRANCH"
git worktree add -b "$TASK_BRANCH" "$TASK_WORKTREE" "$SLICE_BRANCH" 2>/dev/null \
  || git worktree add "$TASK_WORKTREE" "$TASK_BRANCH"   # resume: branch already exists
```

> ⚠️ **Parallel-safety — non-negotiable in any fan-out.** Never run `git checkout` / `git checkout -b` in the shared repo root while workers run: N agents sharing one checkout clobber each other's HEAD and commits land on the wrong branch. The command above creates branch + worktree in one step without touching the shared HEAD.

**4c. Launch the worker sub-agent** using **Kimi K2.7 Code** with a prompt containing all of:

- **Worktree path** (absolute) and branch name.
- **Isolation rules, verbatim**: "All your work happens inside `.specs/worktrees/jira-<task-key>/`. Reference every file by its absolute path under that directory. Do NOT `cd` to the repo root. Do NOT run `git checkout` / `git checkout -b` anywhere — your branch already exists in your worktree. Do NOT run `git reset --hard`. Do NOT push your branch. If your worktree is missing, stop and report; never fall back to the shared checkout."
- **Issue context**: the Jira task's What / Done when / Tests / Gate sections, plus the paths to `spec.md` and `tasks.md` inside its worktree (the branch carries them).
- **Execution contract** (from `tlc-spec-driven`): tests derive from the spec's acceptance criteria, never from the implementation; the gate command must pass before done — the test runner decides, not self-assessment; never weaken, skip, or delete tests; one atomic commit per task; touch ONLY the files this task requires — no "while I'm here" edits.
- **Gate command**: from the issue's Tests/Gate fields or the Gate Check Commands section of `tasks.md`. If none exists, apply the fallback: logic change → build + relevant unit tests; config/infra only → build; docs only → no gate. A skipped gate must be reported with the exact command and reason — never silently.
- **Commit format** (Conventional Commits, dual-key footer — this is the troubleshooting trace):

```text
<type>(<scope>): <description>

Refs: <TASK_KEY>
Parent: <SLICE_KEY>
```

Use Jira keys in the footer values, e.g. `Refs: SCRUM-18` and `Parent: SCRUM-17`.

- **Return contract** — the worker must report back: branch, commit SHA(s), gate command + result, files touched, per-Done-when-criterion pass/fail, approximate tokens used vs. context window (e.g. `80k/200k`), the list of skills/docs/spec files it read, and any skipped gates with reasons.

Launch all workers of a wave in a single message so they run in parallel.

**4d. Post-launch assertion**: `git worktree list` shows one worktree per launched item. A missing worktree means a worker fell back to the shared checkout — stop and fix before continuing.

While workers run, the orchestrator must never run `git checkout`, `git reset --hard`, or edits in the shared root.

### Step 5: Linear integration — per completed task

The orchestrator owns the slice branch; workers never touch it. As each worker reports success, integrate its branch keeping history linear:

```bash
# 1. Replay the task commits onto the current slice tip (inside the worktree)
git -C "$TASK_WORKTREE" rebase "$SLICE_BRANCH"

# 2. Fast-forward the slice branch (in the repo root, on $SLICE_BRANCH)
git merge --ff-only "$TASK_BRANCH"
```

- Record the **post-rebase** commit SHAs — those are the ones that land on the slice branch and go into the traces (Step 8).
- Run the task's gate on the integrated tree. A red gate or a rebase conflict STOPS the flow — fix (or route back to a worker) before integrating the next branch. Never force.
- After a green integrated gate, delete the scaffolding:

```bash
git worktree remove "$TASK_WORKTREE"
git branch -d "$TASK_BRANCH"
```

The commits with their `Refs:`/`Parent:` footers are the permanent trace; the branch and worktree are not.

Launch the next wave only when every branch of the current wave is integrated and the integrated gate is green. The next wave forks from the new slice tip, so dependents automatically see prior work — no merge chains needed.

### Step 6: Verifier — always-on, after the last task

After the final task is integrated (or the single-item implementation is committed), dispatch a fresh **Verifier** sub-agent automatically — never prompted, never optional. Follow the Verifier role in `tlc-spec-driven` (`references/sub-agents.md` and `references/validate.md`): author != verifier, evidence-or-zero coverage re-derivation, spec-anchored outcome check, discrimination sensor in scratch state.

Provide it: `spec.md`, the slice branch diff range (first task commit to HEAD), and the test files in scope. It writes `.specs/features/[feature]/validation.md` — commit that file on the slice branch (`docs([feature]): add validation report`).

If the Verifier returns FAIL, route the ranked gaps back as quick fix tasks using **DeepSeek V4 Flash** — mini implement→gate→commit cycles executed directly on the slice branch (footer `Refs: <SLICE_KEY>`, or the relevant Jira task key if the gap belongs to one) — then re-dispatch the Verifier. Maximum 3 fix→re-verify iterations before escalating to the user.

### Step 7: Open the slice PR — created last

Push the slice branch and open ONE PR into the repo's default branch. Resolve the default branch live — never hard-code `main`. The PR body must reference the Jira slice epic and every Jira task, but it must not use GitHub closing keywords for Jira issues.

```bash
git push -u origin "$SLICE_BRANCH"

DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)
{
  echo "[PR summary here]"
  echo
  echo "Jira slice: $SLICE_KEY"
  echo "Jira tasks: $TASK_KEYS"
} > /tmp/pr-body.md

gh pr create --base "$DEFAULT_BRANCH" --head "$SLICE_BRANCH" --title "[summary]" --body-file /tmp/pr-body.md
```

Done when `gh pr view --json url,title,body` shows the PR exists and references the Jira slice/task keys.

### Step 8: Status roll-up + execution traces

Once the PR exists:

**8a. Jira status:** move every Jira task issue AND the slice epic to **In Review** using `getTransitionsForJiraIssue` and `transitionJiraIssue`. If Jira does not expose a direct transition, report the blocker and leave a Jira comment instead of guessing.

**8b. Slice epic — execution trail + token usage.** Append at the end of the Jira description, inside this skill's OWN managed markers (replace the whole block if the markers already exist — never duplicate). Never write inside the `sdd-tasks-jira:begin/end` block — that block belongs to planning; this one belongs to execution:

```markdown
<!-- sdd-execute-jira:begin -->
## Execution Trail

| Task | Issue | Landed commits |
| ---- | ----- | -------------- |
| T1: Create X interface | SCRUM-18 | abc1234 |
| T2: Implement Y service | SCRUM-19 | def5678, 0a1b2c3 |

**PR**: [PR URL]
**Verifier**: PASS (4/4 ACs, 2/2 mutations killed)

## Token Usage

| Task | Title | Model | Token usage |
| ---- | ----- | ----- | ----------- |
| T1 | Create X interface | Kimi K2.7 Code | 22% (44k/200k) |
| T2 | Implement Y service | Kimi K2.7 Code | 40% (80k/200k) |
<!-- sdd-execute-jira:end -->
```

Landed commits are the post-rebase SHAs on the slice branch. Friendly model names, `k` suffix, percentage rounded; token values come from each worker's return contract and are approximate. Fetch the current Jira description first and preserve all other content (including the `sdd-tasks-jira` block untouched); apply with `editJiraIssue`.

**8c. Each Jira task issue — execution trace.** Append at the end of each Jira task description, inside the same marker convention — this is the harness-improvement record for that atomic change:

```markdown
<!-- sdd-execute-jira:begin -->
## Execution Trace

**Model**: Kimi K2.7 Code
**Token usage**: 40% (80k/200k)
**Commits**: abc1234, def5678

**Skills & docs consumed**:

- `.cursor/skills/tlc-spec-driven/references/implement.md`
- `.specs/features/user-auth/spec.md`
- `docs/work-tracking.md`
<!-- sdd-execute-jira:end -->
```

List the post-rebase SHAs (the ones on the slice branch). The skills/docs list is exactly what the worker reported reading.

**8d. Closing comment** on the Jira slice epic: `Execution complete — [N] tasks integrated, Verifier [PASS/FAIL summary], PR [URL]`. Use `addCommentToJiraIssue`.

### Step 9: Report to the user

Output a summary table:

| Task | Issue | Commits | Gate | Status |
| ---- | ----- | ------- | ---- | ------ |
| T1: Create X interface | SCRUM-18 | abc1234 | quick passed | Integrated, In Review |
| T2: Implement Y service | SCRUM-19 | def5678, 0a1b2c3 | full passed | Integrated, In Review |

End with: the PR URL, the Jira slice epic URL, the Verifier verdict, and the Jira project URL from `docs/work-tracking.md`.

## Example

User says: "Execute slice SCRUM-17"

Preflight: Atlassian MCP access OK, `gh auth status` OK, `docs/work-tracking.md` loaded, working tree clean, `jira-scrum-17` fetched and checked out. Jira tasks: `SCRUM-18` (T1, 1 point), `SCRUM-19` (T2, 1 point, depends on T1). `spec.md` + `tasks.md` read from the branch, cross-check OK. `.specs/worktrees/.gitignore` already present.

Slice `SCRUM-17` → In Progress, assigned. Wave plan: Wave 1 = T1 (`SCRUM-18`); Wave 2 = T2 (`SCRUM-19`).

Wave 1:

```bash
git worktree add -b jira-scrum-18 ".specs/worktrees/jira-scrum-18" jira-scrum-17
```

Issue `SCRUM-18` → In Progress. Worker launched on Kimi K2.7 Code with the isolation rules, `SCRUM-18`'s Done-when list, gate `yarn test:unit`, dual-key commit footer (`Refs: SCRUM-18` / `Parent: SCRUM-17`), and the return contract. Worker reports: commit `abc1234`, gate green (12 passed), 14k/200k tokens, read `implement.md` + `spec.md`.

Integration: rebase onto `jira-scrum-17` (no-op, tip unchanged), `git merge --ff-only jira-scrum-18`, gate green on the integrated tree, worktree + branch deleted. Wave 2 runs the same way forked from the new tip; `SCRUM-19` lands as `def5678`.

Verifier dispatched: PASS (4/4 ACs matched, 2 mutations injected, 2 killed). `validation.md` committed. Branch pushed; PR created with body listing `Jira slice: SCRUM-17` and `Jira tasks: SCRUM-18, SCRUM-19`.

Roll-up: `SCRUM-17`, `SCRUM-18`, `SCRUM-19` → In Review. Slice epic description: one `sdd-execute-jira` block appended with the Execution Trail (T1 → `abc1234`, T2 → `def5678`, PR URL, Verifier PASS) and the Token Usage table — the `sdd-tasks-jira` block left untouched. Each Jira task description: its Execution Trace block. Closing comment posted. Summary table + URLs reported to the user.

## Troubleshooting

### Slice branch does not exist

Cause: planning was never published — `sdd-tasks-jira` creates the branch and pushes the spec files.
Solution: STOP. Do not create the branch here (it would lack `spec.md`/`tasks.md`). Ask the user to run `sdd-tasks-jira` first.

### Worker's worktree is missing after launch

Cause: the worker fell back to the shared checkout, or setup failed silently.
Solution: stop the wave. Re-run the `git worktree add` block, verify with `git worktree list`, and relaunch the worker. Never let a worker run in the repo root during a fan-out.

### Rebase conflict during integration

Cause: two tasks touched the same lines — an undeclared dependency.
Solution: resolve the conflict inside the worktree (favoring the spec's intent), re-run the gate, then fast-forward. Note the undeclared dependency in the final report so planning improves. Never `--force` anything.

### `git merge --ff-only` refuses

Cause: the slice branch moved after the rebase (another task integrated in between).
Solution: re-run the rebase in the worktree against the new tip, then retry the fast-forward. Integrate one branch at a time to avoid this.

### `git branch -d` refuses to delete

Cause: the branch is not fully merged — integration didn't actually land.
Solution: verify the fast-forward happened (`git log` shows the task commits on `$SLICE_BRANCH`). Never use `-D`; an unmerged branch means Step 5 is incomplete.

### Verifier returns FAIL three times

Cause: the gaps are structural (spec-precision gaps, under-planned tasks), not implementation slips.
Solution: stop the fix loop and escalate to the user with the ranked gap list. Do not open the PR while validation fails.

### Jira transition or issue edit fails mid-flow

Cause: stale Jira field IDs in `docs/work-tracking.md`, missing Atlassian MCP access, unavailable transition, or network.
Solution: do not proceed silently. Fix the cause, inspect current fields/transitions with Atlassian MCP, re-apply only the failed transition or edit, and note the recovery in the final report.

### Jira task has 8+ story points

Cause: the task was under-planned at publish time.
Solution: do not launch a worker for it. Report it to the user — it goes back through planning (`tlc-spec-driven` re-breakdown, then `sdd-tasks-jira`).
