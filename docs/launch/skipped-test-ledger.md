# Skipped Test Ledger

Launch label: demo-mitigated, owned before broad production claims.

| Test | Owner | Reason | Launch Label | Verification |
| --- | --- | --- | --- | --- |
| `test/unit/swarm/SwarmOrchestrator.test.ts` routes visual prompt to visual experts | Swarm routing | Disabled route assertion for visual expert selection; needs deterministic routing fixture before unskip. | harden | `pnpm test -- SwarmOrchestrator` |
| `test/unit/swarm/SwarmOrchestrator.test.ts` returns personas matching routed experts | Swarm routing | Disabled persona-match assertion; depends on same deterministic routing fixture as visual expert selection. | harden | `pnpm test -- SwarmOrchestrator` |
| `test/unit/swarm/SwarmOrchestrator.test.ts` extracts code from markdown fence responses | Swarm parsing | Disabled code-extraction assertion; launch risk if swarm output is marketed as production-ready. | harden | `pnpm test -- SwarmOrchestrator` |

Public-demo disposition: these skipped swarm assertions are not on the Studio Improve or draft-first workbench recording path. They remain hardening work before claiming swarm output as production-ready.

CI also reports skipped tests from gated slow/e2e slices. Those are accepted only while their suites are intentionally environment-gated; each promoted feature must move from skipped to proven before marketing.
