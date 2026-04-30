# Issue tracker: GitHub

Issues and PRDs for this repo live in GitHub Issues for `Pastorsimon1798/liminal`. Use the `gh` CLI from inside this clone so the repo is inferred from `git remote -v`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments --json number,title,body,labels,comments,state,url`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`.
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <number> --comment "..."`.

## Active skill scope

Only this Matt Pocock skill subset is active in Codex right now:

- `setup-matt-pocock-skills`
- `diagnose`
- `grill-with-docs`
- `improve-codebase-architecture`
- `zoom-out`

Do not use quarantined Matt Pocock skills such as `triage`, `to-issues`, `to-prd`, or `tdd` unless they are explicitly re-enabled.

## When a skill says "publish to the issue tracker"

Create a GitHub issue only if the active skill explicitly asks for one and the user has requested issue creation. Otherwise, keep findings in the response or in the requested docs artifact.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments --json number,title,body,labels,comments,state,url`.
