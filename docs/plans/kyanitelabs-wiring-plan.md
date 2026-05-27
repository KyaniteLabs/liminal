# Plan: Living Website — Liminal × kyanitelabs.tech × PostHog

**Date:** 2026-05-25
**Status:** Draft — awaiting review

---

## What This Actually Is

kyanitelabs.tech is not a static site with a `/liminal/` section bolted on. It's a **living canvas**. Liminal is the engine that continuously generates, tests, and evolves the site's visual and interactive elements. PostHog is the **fitness function** — it measures what real visitors actually respond to.

The site is alive. It changes. It gets better on its own.

---

## How It Works — The Living Loop

```
                    ┌─────────────────────────────────┐
                    │        kyanitelabs.tech          │
                    │        (your VPS, nginx)         │
                    │                                  │
                    │  Pages contain <canvas>/<iframe> │
                    │  slots powered by Liminal output │
                    └──────────┬──────────────────────┘
                               │
                    ┌──────────▼──────────────────────┐
                    │       PostHog (cloud)            │
                    │  • Feature flags per slot        │
                    │  • $pageview, scroll, click      │
                    │  • session replay                │
                    │  • experiment results API        │
                    └──────────┬──────────────────────┘
                               │  experiment results
                               │  (variant A vs B)
                    ┌──────────▼──────────────────────┐
                    │   Liminal Evolution Daemon       │
                    │   (cron / systemd on VPS)        │
                    │                                  │
                    │  1. Pull PostHog experiment data │
                    │  2. Feed into FitnessCombiner     │
                    │     as a new fitness axis:        │
                    │     engagement (0-1)              │
                    │  3. RalphLoop generates variants  │
                    │     → RenderAndScorePipeline      │
                    │     → VisualScorer + AudioScorer  │
                    │  4. Deploy winning variant        │
                    │  5. Create new PostHog experiment │
                    │  6. Sleep. Repeat.                │
                    └─────────────────────────────────┘
```

---

## What Already Exists (No Build Needed)

| Component | Status | Location |
|-----------|--------|----------|
| **MAP-Elites grid** | ✅ Working | `src/evolution/MapElites.ts` |
| **FitnessCombiner** | ✅ 4-axis weighted fitness | `src/evolution/FitnessCombiner.ts` |
| **NoveltyArchive** | ✅ K-NN novelty scoring | `src/evolution/NoveltyArchive.ts` |
| **AestheticModel** | ✅ K-NN quality predictor | `src/evolution/AestheticModel.ts` |
| **BehaviorVectors** | ✅ Code → behavior embedding | `src/evolution/BehaviorVectors.ts` |
| **EvolutionEngine** | ✅ Mutation proposals | `src/evolution/EvolutionEngine.ts` |
| **ProgressiveDesignTiers** | ✅ Glitch → Perfect progression | `src/evolution/ProgressiveDesignTiers.ts` |
| **RenderAndScorePipeline** | ✅ Headless render → score | `src/render/RenderAndScorePipeline.ts` |
| **VisualScorer** | ✅ Color/edge/composition/contrast | `src/render/VisualScorer.ts` |
| **HTMLWrapper** | ✅ Multi-domain HTML output | `src/utils/htmlWrapper.ts` |
| **RalphLoop** | ✅ Full generation loop | `src/core/RalphLoop.ts` |
| **PostHog on kyanitelabs.tech** | ✅ Fully wired | `/static/posthog.js` on site |
| **EvolutionIntegration** | ✅ Coordinates MAP-Elites + novelty + aesthetic | `src/core/EvolutionIntegration.ts` |

**What's missing:** The bridge between Liminal's evolution system and the live site. The feedback loop that closes when real humans interact.

---

## What We Build — 3 Pieces

### Piece 1: Engagement Fitness Axis

**File:** New `src/evolution/EngagementFitness.ts`

PostHog experiment results become a 5th fitness axis alongside novelty, quality, technical, diversity.

```typescript
export interface EngagementMetrics {
  /** % of visitors who stayed >10s (0-1) */
  dwellRate: number;
  /** Average scroll depth (0-1) */
  scrollDepth: number;
  /** % who clicked/interacted (0-1) */
  interactionRate: number;
  /** Bounce rate inverse (1 - bounce) (0-1) */
  retentionScore: number;
}

export class EngagementFitness {
  /** Pull experiment results from PostHog API and compute engagement score */
  async fromPostHog(experimentId: string): Promise<EngagementMetrics>;

  /** Normalize to a single 0-1 score for FitnessCombiner */
  score(metrics: EngagementMetrics): number;
}
```

**How it plugs in:**
- `FitnessCombiner` currently has 4 weights: novelty(0.4), quality(0.3), technical(0.2), diversity(0.1)
- Add `engagement` as a 5th axis, rebalance to: novelty(0.25), quality(0.25), technical(0.15), diversity(0.10), **engagement(0.25)**
- Engagement score only available after a variant has been live → new variants start with engagement=0.5 (neutral) until data comes in

### Piece 2: Site Slot System

**File:** New `src/site/SlotManager.ts`

The kyanitelabs.tech pages get named "slots" — regions where Liminal can inject creative output. Think of them like ad slots, but for art.

```typescript
export interface SiteSlot {
  /** e.g. 'home-hero', 'about-background', 'blog-header' */
  id: string;
  /** Which page this slot lives on */
  page: string;
  /** Which generators can fill this slot */
  domains: Domain[];
  /** Current active variant */
  activeVariant: {
    htmlPath: string;       // path on disk served by nginx
    experimentId: string;   // PostHog experiment ID
    fitness: number;        // combined fitness score
    deployedAt: string;     // ISO timestamp
  };
  /** Challenger variant (A/B test in progress) */
  challenger?: {
    htmlPath: string;
    experimentId: string;
    fitness: number;
    deployedAt: string;
  };
}
```

**How slots work on the site:**
- Each slot is an `<iframe>` or `<div id="liminal-slot-{id}">` in the page HTML
- A tiny inline script calls `posthog.getFeatureFlag('liminal-slot-{id}')` → returns variant path
- Loads the right HTML/CSS/JS for that variant
- PostHog automatically tracks which variant each visitor saw

**Example kyanitelabs.tech page change:**
```html
<!-- Before: static hero image -->
<section class="hero">
  <img src="/static/hero.jpg" alt="...">
</section>

<!-- After: living hero slot -->
<section class="hero">
  <div id="liminal-slot-home-hero" style="width:100%;height:100vh;"></div>
  <script>
    posthog.onFeatureFlags(function() {
      var variant = posthog.getFeatureFlag('liminal-home-hero') || 'control';
      var el = document.getElementById('liminal-slot-home-hero');
      if (variant === 'control') {
        el.innerHTML = '<img src="/static/hero.jpg" alt="...">';
      } else {
        var iframe = document.createElement('iframe');
        iframe.src = '/liminal-asset/' + variant + '.html';
        iframe.style.cssText = 'width:100%;height:100%;border:none;';
        el.appendChild(iframe);
      }
      posthog.capture('liminal_slot_loaded', {
        slot: 'home-hero', variant: variant
      });
    });
  </script>
</section>
```

### Piece 3: Evolution Daemon

**File:** New `src/daemon/LivingSiteDaemon.ts`

A long-running process (or cron-triggered) on the VPS that:

```
Loop every N hours:
  1. For each slot in SlotManager:
     a. Check if challenger has enough PostHog data (min 200 visitors per variant)
     b. If yes → pull engagement scores → feed into FitnessCombiner
     c. If challenger wins → promote to active, retire old
     d. If active wins → discard challenger

  2. For slots without a challenger:
     a. Run RalphLoop with:
        - Current active variant as seed
        - FitnessCombiner with engagement axis
        - MAP-Elites grid for the slot
        - Random domain mutation (p5 → three → glsl etc.)
     b. Generate 3-5 candidates
     c. Run RenderAndScorePipeline on each
     d. Pick best candidate as new challenger
     e. Deploy challenger HTML to /liminal-asset/{slot}-{hash}.html
     f. Create PostHog feature flag + experiment for this slot
     g. Log generation to PostHog (server-side event)

  3. Occasionally (every ~24h):
     a. Generate completely novel variant (no seed)
     b. Inject novelty-seeking bias into FitnessCombiner weights
     c. This prevents convergence — keeps the site surprising
```

---

## Fitness Function — The Heart

Current Liminal fitness:
```
fitness = 0.4×novelty + 0.3×quality + 0.2×technical + 0.1×diversity
```

Living site fitness:
```
fitness = 0.25×novelty + 0.25×quality + 0.15×technical + 0.10×diversity + 0.25×engagement

Where engagement = normalize(
  0.3×dwellRate +
  0.2×scrollDepth +
  0.3×interactionRate +
  0.2×retentionScore
)
```

**Key insight:** Engagement only has 25% weight. The site doesn't just chase clicks — it balances human response with Liminal's own aesthetic judgment. A visually stunning piece that gets moderate engagement beats a boring piece that gets high engagement.

---

## A/B Test Flow

```
Day 0: Daemon generates Variant A (p5 particle system, minimax-m27)
       → Deploys to /liminal-asset/home-hero-a1b2c3.html
       → Creates PostHog flag 'liminal-home-hero' with variants: control, a1b2c3
       → 50/50 traffic split

Day 1: 400 visitors saw each variant
       → PostHog reports: control avg dwell 8s, a1b2c3 avg dwell 23s
       → Engagement score: control=0.35, a1b2c3=0.72
       → a1b2c3 wins → becomes new active

Day 1: Daemon generates Variant B (GLSL shader, gemma-4b)
       → Creates new experiment: a1b2c3 vs b4d5e6
       → Repeat

Every 7 days: Daemon generates a wild card — completely different domain,
       different aesthetic direction. This is the novelty pressure.
```

---

## File Changes Summary

| New files | Purpose |
|-----------|---------|
| `src/evolution/EngagementFitness.ts` | PostHog → engagement score |
| `src/site/SlotManager.ts` | Named slots on kyanitelabs.tech pages |
| `src/daemon/LivingSiteDaemon.ts` | Evolution loop + PostHog experiment management |
| `src/analytics/PostHogClient.ts` | Server-side PostHog API wrapper (uses existing `posthog-node`) |
| `scripts/deploy/deploy-variant.ts` | Copy variant HTML to nginx-served directory |

| Modified files | Change |
|----------------|--------|
| `src/evolution/FitnessCombiner.ts` | Add `engagement` axis (5th weight) |
| `src/core/EvolutionIntegration.ts` | Accept engagement score from PostHog |
| `src/utils/htmlWrapper.ts` | Add PostHog snippet to output HTML + update CSP for proxy |
| kyanitelabs.tech HTML pages | Add slot `<div>` + PostHog feature flag script |

---

## Implementation Order

```
Step 1: EngagementFitness + PostHogClient
        → Can test with mock data, no site changes needed
        ~2-3h

Step 2: FitnessCombiner 5th axis + EvolutionIntegration update
        → Engagement flows into evolution scoring
        ~1-2h

Step 3: SlotManager + kyanitelabs.tech HTML changes
        → Add first slot (home hero) to the actual site
        ~2-3h (mostly the site HTML, not Liminal code)

Step 4: htmlWrapper PostHog injection + CSP update
        → Every Liminal output gets analytics
        ~1-2h

Step 5: LivingSiteDaemon
        → The loop that ties everything together
        ~3-4h

Step 6: Deploy variant script + nginx config
        → Serve Liminal assets from VPS
        ~1h

Step 7: First automated generation cycle
        → Daemon runs, generates challenger, creates experiment
        ~1h (testing + validation)
```

**Total: ~12–16 hours**

---

## Open Decisions

1. **Slot locations** — Which pages get slots and where? Suggestion: start with `home-hero` (the biggest visual impact) and `about-background` (subtle ambient). Expand from there.

2. **Cycle frequency** — How often should the daemon run? Every 6 hours? Every 24? Depends on traffic volume — need enough visitors per variant for statistical significance.

3. **Minimum sample size** — How many visitors before declaring an A/B winner? PostHog suggests ~200 per variant minimum, but more is better for low-effect experiments.

4. **Novelty schedule** — How often should the daemon inject a completely wild-card variant? Weekly? Every 3rd cycle?

5. **VPS directory** — Where on the VPS should variant HTML files live? Something like `/var/www/kyanitelabs/liminal-asset/`?
