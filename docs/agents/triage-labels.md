# Triage Labels

The active Matt Pocock skill subset does not currently include the issue-triage/publishing skills. This file exists so future skill use has an explicit, safe label policy instead of guessing.

## Current tracker labels checked during setup

`gh label list` was available during setup. The repository had labels such as `analysis`, `bug`, `documentation`, `enhancement`, `kilo-triaged`, `pipeline-task`, priority labels, and `wontfix`. It did **not** have these canonical Matt Pocock triage labels at setup time:

- `needs-triage`
- `needs-info`
- `ready-for-agent`
- `ready-for-human`

## Canonical mapping policy

Do not map canonical triage roles onto unrelated existing labels. If a quarantined triage skill is re-enabled later, create or confirm the intended labels first.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  | Setup status |
| -------------------------- | -------------------- | ---------------------------------------- | ------------ |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  | Not present  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information | Not present  |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  | Not present  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            | Not present  |
| `wontfix`                  | `wontfix`            | Will not be actioned                     | Present      |

When a skill mentions a role, use the corresponding label string from this table only after confirming the label exists in GitHub. Do not substitute labels like `analysis`, `kilo-triaged`, or `pipeline-task` unless a human explicitly changes this file.
