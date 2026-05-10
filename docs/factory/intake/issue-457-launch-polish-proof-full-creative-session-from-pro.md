# Factory intake for issue #457: Launch polish proof: full creative session from prompt to shareable proof bundle

Repository: `KyaniteLabs/liminal`
Category: `llm_fix`
Source issue: `#457`

## User request

## Parent

#444

## What to build

Finish the repository-improvement program with a shareable launch proof: a new user can run Liminal, create or revise an artifact, see preview and receipts, inspect provider/model truth, and understand failures or caveats without internal archaeology.

## Acceptance criteria

- [ ] A documented command sequence launches the current Studio/Operator path.
- [ ] A proof bundle captures prompt, generated artifact, preview, receipt, provider/model truth, and caveats.
- [ ] Public/user-facing docs match the actual runtime behavior.
- [ ] Remaining out-of-scope items are listed as follow-up issues rather than hidden caveats.

## Blocked by

- #448
- #456
- #455

## Factory interpretation

This issue was picked up by `issue-closer`, but no safe code edit was
produced by the configured agent providers. The Factory is therefore
converting the issue into an implementation contract instead of silently
skipping it.

## Acceptance contract

- Confirm the desired behavior from the issue title and body.
- Identify the smallest implementation slice that can ship independently.
- Add or update tests/proofs for that slice before merging implementation.
- Keep credentials, local machine paths, and deployment secrets out of the repo.
- Close or update the source issue when the implementation PR lands.

## Next Factory action

Dispatch a repo worker against this contract. If the request is too broad,
split it into smaller `agent-ready` issues with concrete acceptance checks.
