# Mitigation Plan

Status: final release guardrails after verified remediation.

No material findings remain open in the 2026-05-06 final-QA ledger. These guardrails remain in force for release tags and future material changes.

## Immediate Launch Guardrails

- Do not publish or tag a release after material code changes unless the relevant proof receipts are refreshed on the exact release commit and the saturation status remains achieved.
- Treat integration/slow CI as red if any future FQA-033-class generator/integration proof regresses, even when fast CI is green.
- Treat live creative-domain readiness as limited to the all-domain receipt that FQA-034/FQA-035/FQA-037 verifies; refresh that receipt on the exact release commit before any release tag.
- Treat the browser/e2e PR job as proved for PR #497 head `bfd6d963a62215caf335f70b8640c74165cd5cff`; rerun the check after any CI/workflow or browser-surface change.
- Keep Factory personas and RAG folders explicitly docs-only in audit prompts until or unless they are installed as real runtime skills.

## Operator Guardrails

- During manual demos, keep provider failure logs visible and do not treat empty assistant output as success.
- Avoid claiming visual correctness from screenshot byte size or dimensions alone; decoded-pixel checks are now required for screenshot-backed proof.
- When testing cancel/stop, the verified paths now abort draft timeout controllers and retry sleeps; still watch process lifetime and late events during manual live-provider demos.
- For provider setup, rely on the provider-aware diagnostics before starting a run and keep the exact chosen-provider env key visible in manual demo notes.

## Docs Guardrails

- Any doc change using words like `ready`, `complete`, `production`, `GA`, `launch`, `proof`, or `verified` must cite a current command or receipt.
- Public launch docs must not retain stale resolved-blocker phrases such as `FQA-003 remains open`, five-domain live proof wording, or `Integration and slow CI remain red` after their matching findings are verified.
- Public docs indexes must pass `pnpm check:doc-links`; a missing local docs link is launch-trust debt, not a harmless typo.
- Public security docs must distinguish PreviewServer response headers from Studio GUI/API/SSE and Studio `/preview`; do not claim universal CSP or `X-Frame-Options: DENY` while Studio preview remains an iframe product surface.
- Public docs must not mention nonexistent runtime behavior such as a live `HarnessUpdater` unless the implementation and tests exist.
- First-time user docs must use Studio/workbench-facing language, not internal harness commands.
