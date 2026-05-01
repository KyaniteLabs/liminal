# Triage Labels

The active Matt Pocock skill subset now includes the issue-triage and publishing skills (`triage`, `to-prd`, and `to-issues`). This file records the exact GitHub labels those skills should use.

## Current tracker labels checked during setup

`gh label list` was available during setup. The repository had labels such as `analysis`, `bug`, `documentation`, `enhancement`, `kilo-triaged`, `pipeline-task`, priority labels, and `wontfix`. It originally did **not** have these canonical Matt Pocock triage labels at setup time, but they have now been created in GitHub:

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
