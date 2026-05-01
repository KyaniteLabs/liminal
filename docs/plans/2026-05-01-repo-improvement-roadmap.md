# Liminal Repository Improvement Roadmap

**Date:** 2026-05-01  
**Parent PRD:** [#444](https://github.com/KyaniteLabs/liminal/issues/444)  
**Method:** Matt Pocock skill loop: `zoom-out` -> `improve-codebase-architecture` -> `to-prd` -> `to-issues`, with implementation issues expected to use `tdd` or `diagnose` as appropriate.

## Purpose

This is the durable execution map for improving the whole Liminal repository without random next steps. It starts from current user-surface truth, provider/runtime truth, existing architecture docs, largest modules, stale-doc evidence, and the launch-candidate proof contract.

## Current accepted architecture constraint

ADR-0001 is accepted: provider/runtime truth belongs in `ProviderRuntime`. Future provider work must deepen around that seam rather than reintroducing duplicated provider defaults, labels, key ordering, or fallback policy.

## ROI-ordered execution sequence

| Order | Issue | Type | ROI / leverage reason | Blocked by |
| --- | --- | --- | --- | --- |
| 0 | [#445 Roadmap baseline](https://github.com/KyaniteLabs/liminal/issues/445) | AFK | Prevents future agents from redoing discovery or trusting stale docs. | None |
| 1 | [#446 Studio run receipts](https://github.com/KyaniteLabs/liminal/issues/446) | AFK | Highest product trust return: one prompt-to-preview path with real receipts. | #445 |
| 2 | [#447 Run truth continuity](https://github.com/KyaniteLabs/liminal/issues/447) | AFK | Makes cancellation, failure, and revision honest across surfaces. | #446 |
| 3 | [#448 Cognitive loop receipts](https://github.com/KyaniteLabs/liminal/issues/448) | AFK | Proves Liminal's memory/compost/dream organism claim after a real generation. | #446 |
| 4 | [#449 TUI bridge event seam](https://github.com/KyaniteLabs/liminal/issues/449) | AFK | Deepens the biggest user-surface coordinator around replayable run events. | #447 |
| 5 | [#450 TUI bridge endpoint seams](https://github.com/KyaniteLabs/liminal/issues/450) | AFK | Converts endpoint families into testable modules instead of one giant bridge file. | #449 |
| 6 | [#451 RalphLoop deepening](https://github.com/KyaniteLabs/liminal/issues/451) | AFK | Makes the core creative iteration loop stage-testable before deeper changes. | #445 |
| 7 | [#452 Evaluator deepening](https://github.com/KyaniteLabs/liminal/issues/452) | AFK | Lets creative-domain quality evolve independently behind one evaluator registry tracer. | #451 |
| 8 | [#453 LLM provenance seam](https://github.com/KyaniteLabs/liminal/issues/453) | AFK | Preserves request/retry/fallback/provider truth behind a smaller LLM seam. | #445 |
| 9 | [#454 Test and CI truth](https://github.com/KyaniteLabs/liminal/issues/454) | AFK | Defines what each suite proves and turns skips/gates into intentional policy. | #445 |
| 10 | [#455 Repo archaeology](https://github.com/KyaniteLabs/liminal/issues/455) | HITL-light | Classifies stale docs, orphan modules, and dormant organs without deleting product scope by accident. | #445 |
| 11 | [#456 Launch hardening](https://github.com/KyaniteLabs/liminal/issues/456) | AFK | Attaches security/performance proof to the user-facing routes that matter for launch. | #454 |
| 12 | [#457 Launch polish proof](https://github.com/KyaniteLabs/liminal/issues/457) | HITL-light | Ends the improvement program in a shareable full creative-session proof. | #448, #456, #455 |

## Expected duration

- **Minimum credible pass:** 3-4 weeks.
- **Strong architecture/product hardening pass:** 6-8 weeks.
- **Full public-grade repository cleanup:** 8-12 weeks.

The wide range exists because the highest-risk work is not writing code; it is proving behavior through real Studio/TUI routes, provider/runtime paths, and creative-loop receipts without shrinking Liminal's product scope.

## Operating rules for each issue

When assigning any issue from this roadmap to an agent, use this handoff contract. Agents should not treat an issue number as enough context by itself.

1. Read the GitHub issue body and comments.
2. Read `docs/plans/2026-05-01-repo-improvement-roadmap.md`.
3. Read relevant repo docs and ADRs before changing code. At minimum, check `docs/agents/domain.md`; for provider/runtime work, check `docs/adr/0001-provider-runtime-truth.md`.
4. Create an isolated worktree before implementation.
5. Implement only that issue; do not opportunistically broaden scope.
6. Verify through execution before claiming completion.
7. Open a PR with evidence and link the issue.
8. Report the next high-leverage step after the PR lands or if blocked.

Additional skill-routing rules:

- Use `zoom-out` before modifying unfamiliar areas.
- Use `tdd` for feature/refactor issues: one behavior test, one implementation, repeat.
- Use `diagnose` for failures, flakes, regressions, or performance issues.
- Use `grill-with-docs` when a domain term, product contract, or ADR decision becomes ambiguous.
- Keep artist-facing wording creative; keep proof/harness/provider detail in receipts, Details, and Operator TUI diagnostics.
