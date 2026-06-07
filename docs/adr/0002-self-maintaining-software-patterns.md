# ADR 0002: Self-Maintaining Software Patterns from Ramp Labs

- **Status:** Accepted
- **Date:** 2026-05-09

## Context

Ramp Labs published "How we made Ramp Sheets self-maintaining" (Alex Levinson, Data Driven NYC, May 5 2026; [Substack](https://ramplabs.substack.com/p/self-maintaining)) documenting patterns for autonomous software maintenance at scale. Their system (Ramp Inspect) maintains a product with 10,000+ users using 1,000+ AI-generated monitors, with 50% of merged PRs coming from background agents.

Key patterns identified:

1. **Evidence verification** — agents must prove their work succeeded through sandboxed reproduction, not just report completion
2. **Separation of duties** — builder agents cannot be final verifiers of their own changes
3. **Monitor-driven triage** — on PR merge, agent generates production monitors; on monitor fire, agent reproduces issue in sandbox before pushing fix
4. **Noise filtering with state storage** — append PR links to monitor descriptions so subsequent agents stand down (deduplication without coordination layer)
5. **Monitor density metric** — ~1 monitor per 75 lines of code, treating observability like test coverage

Sinter already has partial implementations: `TaskVerifier` runs build + semantic scoring, `HarnessAgent` runs build + verify command, `MetaHarnessIntegration` captures failures and detects patterns. But agents can self-approve changes, verification is not separated from execution, and there is no structured evidence proof.

## Decision

Adopt three patterns with immediate effect, document the remaining two for future implementation:

### Immediately adopted

**1. Evidence verification (mandatory)**

Agents must produce structured `EvidenceProof` after completing work. An `EvidenceProof` contains:
- What was attempted (task description)
- What was observed (build output, test results, scoring results)
- Whether the observation matches the intent
- The proof is signed with a `verifierId` separate from the `builderId`

Implementation: Add `EvidenceProof` type to `src/harness/types.ts`, populate it in `HarnessAgent.executeTask()`, validate it in `TaskVerifier.verify()`.

**2. Separation of duties (mandatory)**

The agent that builds a change cannot be the agent that verifies it. `HarnessAgent` records a `builderId` on each session. Verification runs through `TaskVerifier` which has its own identity (`verifierId`). A session is only marked `SUCCESS` when the verifier's `EvidenceProof` confirms the builder's work.

Implementation: Add `builderId` / `verifierId` fields to `AgentSession` and `TaskCandidate`. Reject sessions where `builderId === verifierId`.

**3. Noise-aware failure handling**

When `PatternDetector` identifies a pattern that was already handled in a recent session, the system skips redundant triage and logs a deduplication event instead of re-analyzing. This mirrors Ramp's "append PR link to monitor" pattern.

Implementation: Add `lastHandledAt` to pattern records in `HarnessMemory`. Skip pattern triage when the same pattern was handled within the last hour for the same domain.

### Deferred (documented as requirements)

**4. Monitor-driven triage** — Requires a production monitoring system that Sinter does not yet have. Document as a requirement for when Sinter ships to production users.

**5. Monitor density metric** — Depends on production monitoring. Document as a target metric: "what percentage of code surface is monitored?"

## Consequences

- Every agent action now produces auditable evidence, making the `AgentSession` a first-class proof artifact
- The `builderId` / `verifierId` split prevents self-approval, catching cases where an agent's build passes but its change doesn't actually solve the task
- Failure deduplication reduces noise in the harness log and prevents agents from re-analyzing the same known pattern
- Future production monitoring can plug into the `EvidenceProof` type to generate monitors on merge
- Tests must be updated to provide `builderId` and `verifierId` in session/candidate fixtures
