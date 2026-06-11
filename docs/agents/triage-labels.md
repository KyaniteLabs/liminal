# Triage Labels

The active Matt Pocock skill subset now includes the issue-triage and publishing skills (`triage`, `to-prd`, and `to-issues`). This file records the canonical label strings those skills should use on the current Forgejo tracker.

## Current tracker label policy

Forgejo is the source of truth for current repo issues and PRs. The earlier `gh label list` / GitHub setup notes are archival only. If label state must be verified or changed, do it in Forgejo with an authenticated API/CLI session or the Forgejo web UI.

Canonical labels:

- `needs-triage`
- `needs-info`
- `ready-for-agent`
- `ready-for-human`

## Canonical mapping policy

Do not map canonical triage roles onto unrelated existing labels. If a quarantined triage skill is re-enabled later, create or confirm the intended labels first.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  | Setup status |
| -------------------------- | -------------------- | ---------------------------------------- | ------------ |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  | Present      |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information | Present      |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  | Present      |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            | Present      |
| `wontfix`                  | `wontfix`            | Will not be actioned                     | Present      |

When a skill mentions a triage role, use the corresponding label string from this table. Do not substitute labels like `analysis`, `kilo-triaged`, or `pipeline-task` unless a human explicitly changes this file.
