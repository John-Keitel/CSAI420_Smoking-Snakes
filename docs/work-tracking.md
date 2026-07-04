# Work Tracking

## Project Configuration

Jira is the source of truth for slice and task tracking. Use the Atlassian MCP server to read,
create, update, and transition issues; do not use GitHub Projects for work tracking.

```text
JIRA_CLOUD_ID=csai420.atlassian.net
JIRA_SITE=https://csai420.atlassian.net
JIRA_PROJECT_KEY=SCRUM
JIRA_PROJECT_NAME=CSAI420_Smoking-Snakes

# Issue hierarchy
SLICE_ISSUE_TYPE=Epic
TASK_ISSUE_TYPE=Task
STORY_ISSUE_TYPE=Story

# Estimation field
STORY_POINTS_FIELD=customfield_10016
STORY_POINTS_FIELD_NAME=Story point estimate
```

Project URL: `https://csai420.atlassian.net/jira/software/projects/SCRUM`

Example issue: `https://csai420.atlassian.net/browse/SCRUM-18`

---

## Statuses

The Jira workflow uses these statuses. **Planning always ends with every created or reconciled issue
in `Backlog`**. Execution moves issues onward.

| Status      | Meaning                          | Set by    |
| ----------- | -------------------------------- | --------- |
| Backlog     | Groomed, sized, ready to pick up | planning  |
| To Do       | Selected for implementation      | execution |
| In Progress | Active development               | execution |
| Done        | Merged and verified              | execution |

If a Jira transition is required to reach one of these statuses, use `getTransitionsForJiraIssue`
first, then call `transitionJiraIssue` with the matching transition ID. Never guess transition IDs.

---

## Story Points

Size by **scope, complexity, and unknowns** — not by hours of effort. Store estimates in Jira's
`Story point estimate` field (`customfield_10016`). Components are not part of this repo's work
tracking workflow.

| Points | Size           | Description                                                                                  |
| ------ | -------------- | -------------------------------------------------------------------------------------------- |
| 1      | Trivial        | Single contained change, fully understood, no unknowns                                       |
| 2      | Small          | A few touch-points, scope is clear, minimal design choices                                   |
| 3      | Medium         | Multiple touch-points involved, some design choices to resolve                               |
| 5      | Large          | Cross-cutting scope with meaningful unknowns or coordination                                 |
| 8      | Under-planned  | Not a valid issue size. Unknowns too high to execute — resolve them in design, then re-size. |
| 13     | Wrong altitude | Not a task. This is an objective; promote it to a slice epic.                                |

Parent slice epics are usually left unestimated. Estimate executable task/story issues.
