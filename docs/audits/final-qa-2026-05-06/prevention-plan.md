# Prevention Plan

Status: first-pass prevention plan.

## Required New Gates

- Package script target integrity: parse `package.json` scripts and fail when local script targets do not exist.
- Git/CI package install proof: install the current repo as a clean git dependency with `CI=1`, import `liminal-ai`, and run `liminal --version`.
- Claim-to-proof ledger: fail launch docs when public claims lack command/live proof or explicit caveat.
- Receipt integrity: validate commit SHA, timestamp freshness, provider identity, artifact existence, and case matrix for release-gate receipts.
- Strict test-quality mode: fail weak assertions, empty tests, `.only`, skipped material tests without ledger entry, and untested examples.
- Example smoke: compile or execute every public example exactly as written.
- Integration and slow CI must be green before release readiness can be claimed.
- Live creative-domain proof must cover every public launch domain or the launch docs must declare the narrower set.
- Provider setup diagnostics: run credential-free validation for every documented provider and keep CLI provider shorthands aligned with ProviderRuntime defaults.
- Browser/UI smoke: prove visible stop control, visible preview error state, and at least one Studio prompt-to-preview path.
- Cancellation smoke: prove AbortSignal reaches provider calls and retry backoff.
- Visual proof fixture suite: blank, solid, transparent, corrupt, and valid screenshots.
- Prompt-runtime contract tests: audit prompts through the actual generator wrappers.
- Event-contract schema test: backend TUI event types and GUI telemetry parser stay in lockstep.
- SSE replay test: long content stream reconnect preserves lifecycle, provenance, terminal status, and errors.

## CI Policy

- Required PR checks must include root typecheck/build/lint, strict quality, package-script target integrity, git/CI package install proof, claim-to-proof docs lint, example smoke, and one product-facing browser/e2e smoke.
- Slow exhaustive browser/e2e and provider proofs may run on schedule or release branches, but the PR path must still cover representative user-facing surfaces.
- Branch protection must enforce required checks and pull-request review before publication.

## Documentation Rules

- Docs cannot say `ready`, `complete`, `production`, `GA`, `verified`, or `proof` without a nearby evidence link.
- Runtime-behavior docs must cite implementation files or tests.
- Deprecated harness-era flows belong in archival docs only, never first-time user docs.
- Persona/RAG materials must be labeled as reference material unless runtime skill installation exists and is verified.
