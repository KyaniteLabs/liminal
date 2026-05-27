# Living Website — Goal

Make kyanitelabs.tech a self-evolving website where Liminal's creative engine continuously generates, tests, and deploys visual/interactive variants. PostHog A/B testing provides the engagement fitness signal that feeds back into Liminal's evolution system. The site changes autonomously and gets more beautiful over time.

**Facts:** `goals/living-website/facts.md`
**Plan:** `goals/living-website/plan.md`

**Done when:**
- FitnessCombiner has a 5th `engagement` axis with working EngagementFitness module
- PostHogClient sends server-side events and reads experiment results
- SlotManager manages site regions with active/challenger variant state
- HTMLWrapper injects PostHog snippet when env var is set, CSP updated
- LivingSiteDaemon runs generate→render→score→deploy→test→promote cycles
- `liminal site evolve` CLI command works with --once, --dry-run, --slot flags
- All new modules have unit tests, all existing tests pass
- No behavior change when LIMINAL_POSTHOG_KEY is not set

---

Launch this goal with `/goal goals/living-website/goal.md`
