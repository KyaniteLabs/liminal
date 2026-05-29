# Living Website — Accepted Facts

1. FitnessCombiner has a 5th fitness axis called 'engagement' with weight 0.25. Weights rebalanced to: novelty(0.25), quality(0.25), technical(0.15), diversity(0.10), engagement(0.25).
2. EngagementFitness computes a 0-1 score from PostHog experiment data: 0.3×dwellRate + 0.2×scrollDepth + 0.3×interactionRate + 0.2×retentionScore. Each component normalized to 0-1.
3. New variants that have no PostHog data yet receive engagement=0.5 (neutral) so they don't get penalized before being tested.
4. PostHogClient wraps posthog-node to send server-side events (generation_started, generation_completed, generation_failed, variant_deployed, variant_promoted, variant_retired) to the PostHog project via puenteworks.com/ph proxy.
5. posthog-node is added as a direct dependency in package.json (currently only a transitive dep via revideo).
6. SlotManager manages named site regions (slots). Each slot has: id, page path, allowed domains, active variant (htmlPath, experimentId, fitness, deployedAt), optional challenger variant. State persisted to JSON on disk.
7. Slots are added in phases: Phase 1 = home-hero. Phase 2 = about-background, blog-header. Phase 3 = nav-accent, footer-art, 404-page.
8. Each slot on kyanitelabs.tech pages is an iframe or div loaded via PostHog feature flag. The inline script calls posthog.getFeatureFlag('liminal-slot-{id}') to load the correct variant. Control variant loads the original static content.
9. HTMLWrapper.wrap() injects the PostHog bootstrap snippet into every generated HTML page when LIMINAL_POSTHOG_KEY env var is set. The snippet uses the shared API key and proxy host.
10. All CSP variants in htmlWrapper.ts are updated to include connect-src allowing https://puenteworks.com/ph so PostHog XHR calls are allowed from within Liminal-generated pages.
11. LivingSiteDaemon runs a loop every 6 hours. Each cycle: (1) check challenger experiments for sufficient data, (2) promote winners, (3) generate new challengers for slots without one, (4) deploy challenger HTML, (5) create PostHog experiments.
12. A variant must have at least 200 visitors before the daemon evaluates it for promotion. Below this threshold, the experiment continues running.
13. Every 7 days, the daemon generates a wildcard variant: completely novel (no seed from current winner), with FitnessCombiner weights temporarily shifted toward novelty (0.5) and away from engagement (0.1).
14. Every generated variant passes through RenderAndScorePipeline (headless render → VisualScorer) before deployment. Variants that fail rendering or score below 0.2 are discarded.
15. Deployed variant HTML files are written to /var/www/kyanitelabs/liminal-asset/{slot-id}-{hash}.html on the VPS, served by nginx under the same kyanitelabs.tech domain.
16. The daemon is invocable via `liminal site evolve` CLI command. Supports --once (single cycle), --dry-run (generate but don't deploy), and --slot (target specific slot).
17. Each generation cycle emits server-side PostHog events with: slot id, variant hash, model used, domain, fitness components, visual score, generation duration.
18. No existing Liminal behavior changes unless LIMINAL_POSTHOG_KEY is set. When the env var is absent, FitnessCombiner uses the existing 4-axis weights and HTMLWrapper produces output without PostHog injection.
19. Each slot has its own MAP-Elites grid instance so evolution in one slot doesn't pollute the behavior space of another.
20. All existing tests pass after the changes. No regression in RalphLoop, FitnessCombiner, EvolutionIntegration, HTMLWrapper, or PreviewServer behavior.
