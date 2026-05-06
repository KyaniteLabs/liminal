# Mitigation Plan

Status: active interim guardrails for first-pass findings.

Mitigations are temporary. They do not make Liminal launch-ready while material findings remain open.

## Immediate Launch Guardrails

- Do not publish or tag a release until the post-remediation saturation passes complete with no new material findings.
- Treat integration/slow CI as red if any future FQA-033-class generator/integration proof regresses, even when fast CI is green.
- Treat live creative-domain readiness as limited to the all-domain receipt that FQA-034 verifies; refresh that receipt before any release tag.
- Treat the browser/e2e PR job as proved for PR #497 head `bfd6d963a62215caf335f70b8640c74165cd5cff`; rerun the check after any CI/workflow or browser-surface change.
- Keep Factory personas and RAG folders explicitly docs-only in audit prompts until or unless they are installed as real runtime skills.

## Operator Guardrails

- During manual demos, keep provider failure logs visible and do not treat empty assistant output as success.
- Avoid claiming visual correctness from screenshot byte size or dimensions alone; decoded-pixel checks are now required for screenshot-backed proof.
- When testing cancel/stop, the verified paths now abort draft timeout controllers and retry sleeps; still watch process lifetime and late events during manual live-provider demos.
- For provider setup, rely on the provider-aware diagnostics before starting a run and keep the exact chosen-provider env key visible in manual demo notes.

## Docs Guardrails

- Any doc change using words like `ready`, `complete`, `production`, `GA`, `launch`, `proof`, or `verified` must cite a current command or receipt.
- Public docs must not mention nonexistent runtime behavior such as a live `HarnessUpdater` unless the implementation and tests exist.
- First-time user docs must use Studio/workbench-facing language, not internal harness commands.
