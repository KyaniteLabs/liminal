# Living Site Quality Gates Implementation Plan

**Goal:** Make living-site challengers brand-aligned and conservative enough that low-quality generated visuals do not deploy.

**Architecture:** Keep the existing daemon/generator/PostHog wiring, but add a local KyaniteLabs creative brief, route every challenger prompt through that brief, and render-score the generated code before writing it to the served asset directory. PostHog remains engagement feedback after deployment; inference still comes from the configured Sinter generator/LLM provider.

**Tech Stack:** TypeScript, Vitest, Sinter GeneratorRegistry, HTMLWrapper, RenderAndScorePipeline.

---

### Task 1: Brand prompt contract

**Files:**
- Modify: `src/daemon/LivingSiteDaemon.ts`
- Test: `test/unit/daemon/LivingSiteDaemon.test.ts`

**Step 1:** Write tests asserting the living-site prompt includes KyaniteLabs brand context, palette, anti-generic constraints, page/slot context, and domain.

**Step 2:** Run the focused daemon test and verify the new tests fail because `buildCreativePrompt` does not exist.

**Step 3:** Add a public `buildCreativePrompt(slot, wildcard)` helper and use it in `generateAndDeployChallenger`.

**Step 4:** Run the focused daemon test and verify green.

### Task 2: Conservative render deploy gate

**Files:**
- Modify: `src/daemon/LivingSiteDaemon.ts`
- Test: `test/unit/daemon/LivingSiteDaemon.test.ts`

**Step 1:** Write tests asserting the default visual deploy threshold is at least 0.6 and that low render scores fail the daemon gate.

**Step 2:** Run the focused daemon test and verify fail.

**Step 3:** Import `RenderAndScorePipeline`, render-score generated code, skip deployment below `minVisualScore`, and record score/warnings in PostHog events.

**Step 4:** Run daemon tests, then the living-site focused suite, then `pnpm build`.

### Task 3: Inference explanation

**Files:**
- Modify: `docs/plans/2026-05-27-living-site-quality-gates.md`

**Step 1:** Document where inference comes from: RalphLoop → GenerationOrchestrator/domain generator → LLMClient/provider config; PostHog does not generate.

**Step 2:** Include operational expectations: no key/config means no cycle; bad render means no deploy; good render becomes challenger; engagement data later promotes/loses.

## Inference Path

The living website daemon does **not** get its creative inference from PostHog. PostHog is only the measurement layer after a challenger exists.

When `sinter site evolve` runs with `LIMINAL_POSTHOG_KEY` configured, the path is:

1. `LivingSiteDaemon.runCycle()` selects a site slot that needs a challenger.
2. `buildCreativePrompt(slot, wildcard)` creates a KyaniteLabs-specific brief: page, slot, domain, palette, motion rules, anti-generic constraints, and technical constraints.
3. `RalphLoop.run(prompt, buildRalphLoopOptions(slot))` performs the actual generation loop.
4. Inside RalphLoop, Sinter's existing generation orchestration calls the configured generator/LLM stack. The exact provider/model comes from normal Sinter provider configuration (`--provider`, env/config defaults, role config), not from this daemon.
5. RalphLoop iterates up to 5 times with a minimum quality score of 0.78, render scoring enabled, aesthetic/human-perception guardrails enabled, and criteria for aesthetic, technical, novelty, emergence, and interestingness.
6. The daemon then independently render-scores the final code with `RenderAndScorePipeline` and requires `minVisualScore >= 0.65` before writing anything to the nginx-served asset directory.
7. If the render fails or score is too low, the daemon tracks `liminal_variant_rejected` and deploys nothing.
8. If it passes, the daemon writes the challenger HTML, records its score as initial fitness, and tracks `liminal_variant_generated`.
9. PostHog engagement data is used later to decide whether that challenger beats the currently active variant.
