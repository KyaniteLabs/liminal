# Living Website — Implementation Plan

## Context

kyanitelabs.tech is a static site on a VPS (nginx). PostHog is fully wired with proxy at `puenteworks.com/ph`. Liminal has a complete evolution system (MAP-Elites, FitnessCombiner, NoveltyArchive, AestheticModel, RenderAndScorePipeline) but zero integration with the live site. This plan bridges them so the site evolves autonomously using real visitor engagement as a fitness signal.

## Approach

Add an `engagement` fitness axis to the existing evolution system, a `PostHogClient` for server→PostHog communication, a `SlotManager` for named site regions, a `LivingSiteDaemon` that orchestrates generate→deploy→test→promote cycles, and a `liminal site evolve` CLI command. Modify `FitnessCombiner`, `EvolutionIntegration`, and `HTMLWrapper` minimally. Gate everything on `LIMINAL_POSTHOG_KEY` env var so existing behavior is untouched.

## Files to Modify

| File | Change |
|------|--------|
| `src/evolution/FitnessCombiner.ts` | Add `engagement` to `FitnessWeights`, rebalance defaults |
| `src/core/EvolutionIntegration.ts` | Accept optional `engagementScore` parameter |
| `src/utils/htmlWrapper.ts` | Inject PostHog snippet when env var set; update CSP `connect-src` |
| `src/compost/types.ts` | Add `engagement` to `fitnessWeights` type |
| `package.json` | Add `posthog-node` as direct dependency |

## New Files

| File | Purpose |
|------|---------|
| `src/evolution/EngagementFitness.ts` | PostHog experiment data → engagement score (0-1) |
| `src/analytics/PostHogClient.ts` | Server-side PostHog event wrapper |
| `src/site/SlotManager.ts` | Slot state management + persistence |
| `src/daemon/LivingSiteDaemon.ts` | Main evolution loop |
| `src/cli/SiteCommand.ts` | `liminal site evolve` CLI command |
| `test/unit/evolution/EngagementFitness.test.ts` | Unit tests |
| `test/unit/analytics/PostHogClient.test.ts` | Unit tests |
| `test/unit/site/SlotManager.test.ts` | Unit tests |
| `test/unit/daemon/LivingSiteDaemon.test.ts` | Unit tests |

## Reuse

| What | From | Path |
|------|------|------|
| MAP-Elites grid | Direct use per slot | `src/evolution/MapElites.ts` |
| FitnessCombiner | Extend with 5th axis | `src/evolution/FitnessCombiner.ts` |
| NoveltyArchive | Direct use per slot | `src/evolution/NoveltyArchive.ts` |
| AestheticModel | Direct use | `src/evolution/AestheticModel.ts` |
| BehaviorVectors.extractBehavior | For MAP-Elites insertion | `src/evolution/BehaviorVectors.ts` |
| RenderAndScorePipeline | Score variants before deploy | `src/render/RenderAndScorePipeline.ts` |
| VisualScorer | Within pipeline | `src/render/VisualScorer.ts` |
| HTMLWrapper.wrap | Generate variant HTML | `src/utils/htmlWrapper.ts` |
| RalphLoop.run | Generate variant code | `src/core/RalphLoop.ts` |
| FitnessCombiner (in CompostSoup) | Already used there | `src/compost/CompostSoup.ts:11` |
| EvolutionIntegration | Coordination pattern | `src/core/EvolutionIntegration.ts` |

## Steps

### Step 1: Add posthog-node dependency
- [ ] Run `pnpm add posthog-node`
- Verify: `grep posthog-node package.json`

### Step 2: Extend FitnessCombiner with engagement axis
- [ ] Add `engagement: number` to `FitnessWeights` interface
- [ ] Update `DEFAULT_FITNESS_WEIGHTS` to `{ novelty: 0.25, quality: 0.25, technical: 0.15, diversity: 0.10, engagement: 0.25 }`
- [ ] Update `FitnessComponents` to include `engagement`
- [ ] Update `calculate` to include `engagement` in weighted sum
- [ ] Update `clampComponents` to clamp `engagement`
- [ ] Update `CompostConfig.fitnessWeights` type in `src/compost/types.ts` — it uses `Partial<FitnessWeights>` so it picks up the new field automatically, but verify
- [ ] Update existing `FitnessCombiner.test.ts` — adjust default weight assertions (sum check, ordering check)
- [ ] Add test: calculate with 5 components including engagement
- Verify: `pnpm vitest run test/unit/evolution/FitnessCombiner.test.ts`

### Step 3: Create EngagementFitness
- [ ] Create `src/evolution/EngagementFitness.ts`
  - `EngagementMetrics` interface: dwellRate, scrollDepth, interactionRate, retentionScore (all 0-1)
  - `score(metrics)` → 0.3×dwell + 0.2×scroll + 0.3×interact + 0.2×retention
  - `fromPostHogExperiment(experimentId, posthogClient)` → fetch results, compute metrics, return score
  - Neutral default: `neutralScore()` returns 0.5
- [ ] Create `test/unit/evolution/EngagementFitness.test.ts`
  - Test score computation with known inputs
  - Test all-zero returns 0
  - Test all-one returns ~1
  - Test neutralScore returns 0.5
  - Test clamping handles values > 1
- Verify: `pnpm vitest run test/unit/evolution/EngagementFitness.test.ts`

### Step 4: Create PostHogClient
- [ ] Create `src/analytics/PostHogClient.ts`
  - Wraps `posthog-node` PostHog class
  - Constructor reads `LIMINAL_POSTHOG_KEY` and `LIMINAL_POSTHOG_HOST` (default: `https://puenteworks.com/ph`)
  - `trackEvent(event, properties)` — sends custom event
  - `getExperimentResults(experimentId)` — calls PostHog API to get variant-level funnel/conversion data
  - `createFeatureFlag(key, variants)` — creates a multivariate flag
  - `isConfigured()` — returns true if key is set
  - `shutdown()` — flush + shutdown
- [ ] Create `test/unit/analytics/PostHogClient.test.ts`
  - Test isConfigured returns false without env var
  - Test trackEvent with mock PostHog
  - Test constructor defaults
- Verify: `pnpm vitest run test/unit/analytics/PostHogClient.test.ts`

### Step 5: Update EvolutionIntegration for engagement
- [ ] Add optional `engagementScore?: number` parameter to `update()` method
- [ ] When provided, pass through to FitnessCombiner's `calculate` call (or store for external combination)
- [ ] Update `test/unit/core/EvolutionIntegration.test.ts` — add test for engagement score passthrough
- Verify: `pnpm vitest run test/unit/core/EvolutionIntegration.test.ts`

### Step 6: Create SlotManager
- [ ] Create `src/site/SlotManager.ts`
  - `SiteSlot` interface: id, page, domains, active variant, challenger variant
  - `SlotVariant` interface: htmlPath, experimentId, fitness, deployedAt, model, domain
  - Constructor takes state file path (JSON on disk)
  - `load()` / `save()` state persistence
  - `getSlot(id)` / `getAllSlots()`
  - `setActive(slotId, variant)` / `setChallenger(slotId, variant)`
  - `clearChallenger(slotId)`
  - `promoteChallenger(slotId)` — challenger becomes active, clear challenger
  - `needsChallenger(slotId)` — returns true if no challenger exists
- [ ] Create `test/unit/site/SlotManager.test.ts`
  - Test CRUD operations
  - Test promoteChallenger swaps correctly
  - Test persistence load/save round-trip
  - Test needsChallenger logic
- Verify: `pnpm vitest run test/unit/site/SlotManager.test.ts`

### Step 7: Update HTMLWrapper for PostHog injection
- [ ] Add `injectPostHog(html)` private method to `HTMLWrapper`
  - Returns unmodified HTML if `LIMINAL_POSTHOG_KEY` env var is not set (fact 18)
  - Inserts PostHog snippet before `</head>` with: init call using env key + host
  - Adds engagement tracking: pageview, scroll depth, click on slot elements
- [ ] Update all CSP constants to add `https://puenteworks.com/ph` to `connect-src`
  - `DEFAULT_CSP`: change `connect-src 'none'` → `connect-src https://puenteworks.com/ph`
  - `HYDRA_CSP`: append ` https://puenteworks.com/ph` to existing connect-src
  - `STRUDEL_CSP`: append ` https://puenteworks.com/ph` to existing connect-src
  - `TONE_CSP`: change `connect-src 'none'` → `connect-src https://puenteworks.com/ph`
- [ ] Call `injectPostHog` in `wrap()` after generating HTML but before returning
- [ ] Update `test/unit/generation/HTMLWrapper.test.ts`
  - Test no injection without env var
  - Test injection with env var (mock process.env)
  - Test CSP contains puenteworks.com/ph in all variants
- Verify: `pnpm vitest run test/unit/generation/HTMLWrapper.test.ts`

### Step 8: Create LivingSiteDaemon
- [ ] Create `src/daemon/LivingSiteDaemon.ts`
  - Constructor: PostHogClient, SlotManager, EngagementFitness, RenderAndScorePipeline
  - `runCycle()`:
    1. For each slot, check if challenger experiment has ≥200 visitors → if yes, evaluate, promote winner
    2. For slots needing challenger: generate via RalphLoop (short run, 3-5 iterations), render+score, pick best
    3. Deploy best variant HTML to `/var/www/kyanitelabs/liminal-asset/`
    4. Create PostHog feature flag for the new experiment
    5. Track generation event via PostHogClient
  - `generateVariant(slot, seed?, wildcard?)`:
    - Builds prompt from slot config (domain, page context)
    - Runs RalphLoop with engagement-aware FitnessCombiner
    - Returns top candidate
  - `shouldPromote(slot)`:
    - Pulls PostHog experiment data via EngagementFitness
    - Compares active vs challenger engagement scores
    - Returns winner
  - `isWildcardDay()`:
    - Returns true if 7 days since last wildcard
- [ ] Create `test/unit/daemon/LivingSiteDaemon.test.ts`
  - Test runCycle with mock dependencies
  - Test shouldPromote with known scores
  - Test isWildcardDay logic
  - Test variant generation (mock RalphLoop)
- Verify: `pnpm vitest run test/unit/daemon/LivingSiteDaemon.test.ts`

### Step 9: Create CLI command
- [ ] Create `src/cli/SiteCommand.ts`
  - Registers `site` subcommand with `evolve` action
  - `--once`: run single cycle, then exit
  - `--dry-run`: generate but don't deploy or create experiments
  - `--slot <id>`: target specific slot
  - `--interval <ms>`: override cycle interval (default: 6h = 21600000ms)
- [ ] Wire into CLI entry point (check how `ledger`, `compost` commands are registered in `src/index.ts`)
- Verify: `pnpm build && node bin/liminal site evolve --help`

### Step 10: Run full test suite
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] Verify no regressions in existing tests
- Verify: `pnpm test` exits 0

## Verification

```bash
# Step 2
pnpm vitest run test/unit/evolution/FitnessCombiner.test.ts

# Step 3
pnpm vitest run test/unit/evolution/EngagementFitness.test.ts

# Step 4
pnpm vitest run test/unit/analytics/PostHogClient.test.ts

# Step 5
pnpm vitest run test/unit/core/EvolutionIntegration.test.ts

# Step 6
pnpm vitest run test/unit/site/SlotManager.test.ts

# Step 7
pnpm vitest run test/unit/generation/HTMLWrapper.test.ts

# Step 8
pnpm vitest run test/unit/daemon/LivingSiteDaemon.test.ts

# Step 9
pnpm build && node bin/liminal site evolve --help

# Step 10
pnpm build && pnpm test
```

## Risks

1. **PostHog API auth**: The PostHog API key in the snippet is a public client key (`phc_...`). Server-side API calls (experiments, feature flags) may need a different personal API key. Need to verify which key type works for the REST API.
2. **RalphLoop in daemon context**: RalphLoop has many dependencies (LLMClient, LiminalFS, Gallery). Running it in daemon mode means all those must be configured in the VPS environment. May need a lighter generation path.
3. **CSP tightness**: Adding `connect-src` for PostHog in all variant HTML is correct but relaxes the existing `connect-src 'none'` default. This is intentional but worth noting.
4. **Existing test adjustments**: `FitnessCombiner.test.ts` has ordering assertions ("novelty as highest weight", "diversity as lowest") that will break with new defaults. These need updating, not deleting — the assertions should reflect the new weight order.
