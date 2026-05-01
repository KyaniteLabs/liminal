# Skipped Test Ledger

Launch label: demo-mitigated, owned before broad production claims.

## Current explicit skips

| Test / suite | Owner | Reason | Action | Verification |
| --- | --- | --- | --- | --- |
| `test/unit/swarm/SwarmOrchestrator.test.ts` routes visual prompt to visual experts | Swarm routing | Disabled route assertion for visual expert selection; needs deterministic routing fixture before unskip. | Harden and unskip before claiming production-ready swarm routing. | `pnpm test -- SwarmOrchestrator` |
| `test/unit/swarm/SwarmOrchestrator.test.ts` returns personas matching routed experts | Swarm routing | Disabled persona-match assertion; depends on same deterministic routing fixture as visual expert selection. | Harden and unskip with the visual expert fixture. | `pnpm test -- SwarmOrchestrator` |
| `test/unit/swarm/SwarmOrchestrator.test.ts` extracts code from markdown fence responses | Swarm parsing | Disabled code-extraction assertion; launch risk if swarm output is marketed as production-ready. | Harden before marketing swarm output as production-ready. | `pnpm test -- SwarmOrchestrator` |
| Browser/CDN/sandbox gated skips in `test/integration/renderer.test.js`, `test/unit/sandbox.test.ts`, `test/render/render-and-score.test.ts` | Render/sandbox | Requires browser/CDN/sandbox resources that are not part of fast PR CI. | Keep gated until #456/#457 promote route-level browser proof. | `pnpm test:ci:slow` plus targeted render tests after browser install. |
| `test/e2e/sandbox-self-improve.e2e.test.ts` and related e2e skips | E2E owner | Slow/browser workflow is intentionally skipped on normal PRs. | Promote when the user-facing launch claim depends on it. | `pnpm test:e2e` or workflow-dispatched slow CI. |
| `test/e2e/models/*`, `test/e2e/cloud-providers.test.ts`, `test/e2e/full-loop-cloud.test.ts` | Provider/runtime | Requires live provider credentials and can be polluted by local env. | Keep gated; run only for live-provider claims. | `RUN_CLOUD_MODEL_TESTS=1 pnpm test:cloud` and `pnpm proof:live-provider-smoke`. |

Public-demo disposition: skipped swarm assertions are not on the Studio Improve or draft-first workbench recording path. They remain hardening work before claiming swarm output as production-ready.

## Current CI skip truth

The normal PR `slow-browser-and-e2e` job is skipped. A green PR therefore proves fast repo health, not slow browser/e2e health. See `docs/launch/test-ci-truth-matrix-2026-05-01.md` for the command-to-claim map.
