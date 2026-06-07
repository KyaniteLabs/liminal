# Factory intake for issue #30: [Analysis] Feature Viability Analysis — Sinter as Commercial Product

Repository: `KyaniteLabs/liminal`
Category: `llm_fix`
Source issue: `#30`

## User request

## Summary

Comprehensive viability analysis for Sinter as a **proprietary commercial product**. Full document: [`docs/feature-viability-analysis.md`](../../feature-viability-analysis.md)

**Updated 2026-04-21:** Analysis refreshed to reflect Phases 11-16 completion (StudioAgent, LiminalCortex, Emergence, Taste Learning, Autonomous Gardener). PR #322.

### Top 3 Opportunities
1. **Creative Coding SaaS** ($10-30/mo) — Fastest path to revenue
2. **API / Engine Licensing** ($0.01-0.10/generation) — High-value, low-volume
3. **Programmatic Video Studio** ($50-500/video) — Highest revenue potential

### Top 3 Risks
1. **LLM dependency** — Core value requires external APIs
2. **Quality scoring not validated against human judgment** — EmergenceCritic + CreativeBoard help but human calibration still needed
3. **Competitive response** — Large players could add creative code output in a sprint

### Key Finding
The **Autonomous Gardener** (TasteModelTrainer + DreamPlanner + EmergenceCritic + StagnationDetector) is the most commercially interesting subsystem — a genuine data flywheel that gets smarter with usage.

### Critical Legal Actions Required
1. Re-license from MIT to proprietary (BSL or custom EULA)
2. Audit AGPL dependencies (hydra-synth, strudel)
3. Trademark search for "Sinter"
4. Create THIRD_PARTY_NOTICES file

### Recommended Phases
- **Phase 0:** Legal foundation (re-license, AGPL audit, trademark)
- **Phase 1:** SaaS MVP (months 1-3) — web UI, auth, billing, multi-tenant API
- **Phase 2:** Close feedback loops (months 3-6) — **MOSTLY COMPLETE** (taste learning, dreaming, emergence evaluation all shipped)
- **Phase 3:** Expand revenue (months 6-12) — API licensing, education tier, programmatic video

### Gaps Closed Since Original Analysis
- ~~Meta-harness is open-loop~~ → Thinking-Trace Feedback Loop + MetaHarnessIntegration
- ~~No RLHF or preference learning~~ → TasteModelTrainer with margin-based SGD
- ~~Cross-domain crossover is hand-coded~~ → CrossModalTransfer maps between domains
- ~~No TUI~~ → StudioAgent (chat-first) + Bubble Tea TUI

### Gaps Still Open
- No web UI for SaaS (Studio TUI exists, browser UI does not)
- No auth, rate limiting, or multi-tenancy
- Quality scoring not calibrated against human judgment

---

*Generated from deep codebase exploration + market research. Updated 2026-04-21 to reflect current codebase state.*

## Factory interpretation

This issue was picked up by `issue-closer`, but no safe code edit was
produced by the configured agent providers. The Factory is therefore
converting the issue into an implementation contract instead of silently
skipping it.

## Acceptance contract

- Confirm the desired behavior from the issue title and body.
- Identify the smallest implementation slice that can ship independently.
- Add or update tests/proofs for that slice before merging implementation.
- Keep credentials, local machine paths, and deployment secrets out of the repo.
- Close or update the source issue when the implementation PR lands.

## Next Factory action

Dispatch a repo worker against this contract. If the request is too broad,
split it into smaller `agent-ready` issues with concrete acceptance checks.
