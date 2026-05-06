# Liminal Final QA Persona-Cluster Audit

Date: 2026-05-06

This folder records the final pre-publication QA campaign for Liminal.

The campaign uses the imported Factory personas and their RAG seed manifests as read-only expert lenses. It does not wire personas into runtime behavior, prompts, Studio, TUI, or audit automation.

## Release Bar

All material issues are release-blocking. Material means anything plausibly causing security risk, silent failure, swallowed errors, customer anger, launch-claim dishonesty, integration debt, broken UX, broken generation, serious bottlenecks, or future maintenance traps.

## Evidence Rules

- Findings require file/line evidence, command evidence, or live-run evidence.
- Public RAG sources may inform positive patterns, but full transcripts/articles are not copied here.
- Public code references are reusable only when the source repository has a visible compatible license.
- Remediation waits until audit saturation, except for active credential/data-exposure emergencies.

## Files

- `preflight-inventory.md` records the starting state.
- `cluster-roster.md` defines tester clusters and source lenses.
- `coverage-manifest.jsonl` assigns every tracked file to primary and secondary clusters.
- `coverage-summary.json` summarizes manifest coverage.
- `findings-ledger.md` is the canonical findings ledger.
- `verification/verification-log.md` records command and live proof runs.
- `verification/live-sweep-summary.md` separates deterministic, live, failed, and limited proof evidence.
- `cluster-reports/` preserves first-pass persona-cluster reports.
- `saturation-status.md` records whether the stop condition has been met.
- `remediation-plan.md`, `mitigation-plan.md`, `prevention-plan.md`, and `defense-plan.md` turn findings into action after saturation.

## Stop Condition

The audit can stop only after two independent saturation passes produce no new material findings, only duplicates, already-covered mitigations, or explicitly non-material nits.
