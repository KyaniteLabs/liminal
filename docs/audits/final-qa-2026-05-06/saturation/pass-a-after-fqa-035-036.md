# Saturation Pass A - After FQA-035/FQA-036

Date: 2026-05-06

Lens: Codecraft, AI Systems, Production Flow.

Result: new material finding found.

## Finding

FQA-037: `pnpm final-qa:surface` required current-commit metadata after FQA-035 but still counted a domain as covered when the receipt said `status: pass`, the artifact path existed, and the file had nonzero bytes. A temp-only probe with twelve non-empty `.txt` files could report `Creative domains: 12/12 covered`.

Evidence:
- `scripts/proof/live-creative-domain-execution.ts:138`
- `scripts/ci/final-qa-surface-gate.mjs:269`
- `test/scripts/final-qa-surface-gate.test.ts:194`

## Remediation

Status: verified.

The live proof writer now records per-domain `artifactValidation` evidence, and the final-QA surface gate recomputes domain-specific structural checks before counting a domain covered. It rejects non-empty junk files even if the receipt lies and says validation passed. A real GLM live run produced all 12 domains with `artifactValidation: pass`, and `pnpm final-qa:surface` passed only after that evidence existed.
