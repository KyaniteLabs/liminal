# Mitigation Plan

Status: active interim guardrails for first-pass findings.

Mitigations are temporary. They do not make Liminal launch-ready while material findings remain open.

## Immediate Launch Guardrails

- Do not publish or tag a release while FQA-006, FQA-009, FQA-033, or FQA-034 remain open or fixed-but-unverified.
- Treat integration/slow CI as red until FQA-033 is fixed, even when fast CI is green.
- Treat live creative-domain readiness as limited to the five default live-proof domains until FQA-034 is fixed or the launch scope is narrowed.
- Treat the browser/e2e PR job as unproved until FQA-009 has a real GitHub PR run under branch protection.
- Keep Factory personas and RAG folders explicitly docs-only in audit prompts until or unless they are installed as real runtime skills.

## Operator Guardrails

- During manual demos, keep provider failure logs visible and do not treat empty assistant output as success.
- Avoid claiming visual correctness from screenshot byte size or dimensions alone; decoded-pixel checks are now required for screenshot-backed proof.
- When testing cancel/stop, watch process lifetime and late events after the UI reports timeout.
- For provider setup, validate the exact documented env keys for the chosen provider before starting a run.

## Docs Guardrails

- Any doc change using words like `ready`, `complete`, `production`, `GA`, `launch`, `proof`, or `verified` must cite a current command or receipt.
- Public docs must not mention nonexistent runtime behavior such as a live `HarnessUpdater` unless the implementation and tests exist.
- First-time user docs must use Studio/workbench-facing language, not internal harness commands.
