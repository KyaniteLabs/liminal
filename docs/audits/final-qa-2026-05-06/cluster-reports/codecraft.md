# Codecraft Cluster Report

Personas: Matt Pocock, Theo Browne, Peter Steinberger

Lens: TypeScript/API quality, stack sanity, app polish, shipping discipline, rookie mistakes.

Status: first-pass white-box review complete. This cluster found release-blocking script, packaging, streaming, and test-quality gaps.

## Findings

### CC-001: Package script points to a missing route-performance proof file

- Severity: P1
- Material: yes
- Evidence: `package.json:69`, `docs/audits/final-qa-2026-05-06/verification/pnpm-proof-route-performance.log`
- Failure mode: `pnpm proof:route-performance` fails before executing any proof.
- Customer impact: final QA cannot trust the command-to-claim matrix.
- Recommended proof: package-script target checker and successful route-performance run.

### CC-002: Published package can lack `dist` when installed with `CI=true`

- Severity: P1
- Material: yes
- Evidence: `package.json:6`, `package.json:7`, `package.json:18`, `package.json:26`
- Failure mode: `dist` is ignored/untracked and `postinstall` skips the build under `CI=true`, so git installs or CI-like consumers can miss `dist/index.js`.
- Customer impact: users can install a package that cannot be imported or run.
- Recommended proof: clean temp git dependency install with `CI=1`, then import `liminal-ai` and run `liminal --version`.

### CC-003: Streaming fallback error can become an empty completed assistant response

- Severity: P1
- Material: yes
- Evidence: `src/llm/LLMClient.ts:1395`, `src/llm/LLMClient.ts:1400`, `src/llm/LLMClient.ts:1485`, `src/llm/providers/GoogleProvider.ts:200`, `src/tui-bridge/TuiBridgeService.ts:2530`, `src/tui-bridge/TuiBridgeService.ts:2549`, `test/unit/llm/provider-adapters.test.ts:786`
- Failure mode: fallback streaming can emit an `{type:"error"}` event, break out, log success, and the TUI bridge can publish a completed empty assistant message.
- Customer impact: a provider failure is silently converted into success.
- Recommended proof: stream fallback regression test that asserts visible failure and no completed empty response.

### CC-004: Default gates exclude GUI, Bubble Tea, scripts, and pending tests

- Severity: P2
- Material: yes
- Evidence: `package.json:39`, `package.json:41`, `tsconfig.json:26`, `tsconfig.json:27`, `vitest.config.ts:24`, `gui/package.json:7`, `test/pending`
- Failure mode: root checks pass while large product surfaces and pending suites are outside the default gate.
- Customer impact: launch confidence overstates actual product coverage.
- Recommended proof: final-QA vertical script that names included and excluded surfaces explicitly.

### CC-005: GUI and bridge erase shared event types and reach through internals

- Severity: P2
- Material: yes
- Evidence: `src/tui-bridge/types.ts:154`, `gui/src/gui/workbenchTelemetry.ts:3`, `gui/src/gui/workbenchTelemetry.ts:116`, `gui/src/gui/cockpitDerivation.ts:1`, `src/chat/ConversationManager.ts:257`, `src/tui-bridge/TuiBridgeService.ts:2509`, `src/tui-bridge/TuiBridgeService.ts:2549`
- Failure mode: the GUI has local event typing and the bridge accesses private conversation internals, increasing drift between frontend and backend truth.
- Customer impact: telemetry and UI state can disagree with runtime events.
- Recommended proof: shared event schema test and public conversation history API.
- Remediation: verified. `gui/src/gui/bridgeEvents.ts` now anchors GUI event types on `TuiBridgeEvent`, cockpit/telemetry consume that shared shim, and bridge conversation access goes through public `ConversationManager` methods with regression tests.

### CC-006: Test-quality checker misses weak assertions

- Severity: P2
- Material: yes
- Evidence: `scripts/testing/test-quality-check.mjs:30`, `scripts/testing/test-quality-check.mjs:35`, `scripts/testing/test-quality-check.mjs:162`, `scripts/testing/test-quality-check.mjs:163`
- Failure mode: regex checks look for spaced method calls such as `. toBeTruthy()` and strict mode is not default, so weak assertions survive.
- Customer impact: tests can pass while proving little.
- Recommended proof: fixture-driven tests for the checker itself and strict mode in final QA.
