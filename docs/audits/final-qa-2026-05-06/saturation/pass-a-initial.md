# Saturation Pass A - Initial Post-Remediation

Date: 2026-05-06

Lens: Codecraft, AI Systems, Production Flow.

Result: new material finding found.

## Finding

FQA-035: `pnpm final-qa:surface` accepted a live creative-domain receipt with 12/12 artifacts even when the receipt was not bound to the current git commit. The live proof writer also omitted `gitCommit`, so stale or copied all-domain receipts could support false launch proof.

Evidence:
- `scripts/ci/final-qa-surface-gate.mjs:250`
- `scripts/proof/live-creative-domain-execution.ts:185`
- `.omx/proof/domain-gauntlet-live.json`

## Remediation

Status: verified.

The live proof writer now records `gitCommit`, and the final-QA surface gate rejects receipts that are stale, future-dated, missing `gitCommit`, wrong-commit, missing provider/model, not `live-execution`, or not passing. A patched live GLM run on commit `1986f35323fc97f65d01941021eaa890faad0956` passed all 12 domains, and `pnpm final-qa:surface` accepted the current-commit-bound receipt.
