# Living-Site Dedup & Lost-Work Audit — 2026-06-07

**Scope:** Resolve the duplication + lost-work question around the orphaned worktree
`.claude/worktrees/living-site-quality` (branch `feat/living-site-quality`, tip
`6163389a`, May 27) versus the living-site feature now shipped on `origin/main`.

**Method:** Read-only investigation. Content-level comparison (commit-hash comparison
is meaningless here — see Topology). Everything below is evidence-backed.

---

## Topology (why hash comparison is invalid)

- `origin/main` = `83b55d61`.
- Orphaned worktree tip `6163389a` is **an ancestor of the current local checkout**
  `rescue/local-uncommitted-20260606` (`f04cb4d6` = `6163389a` + one reformat commit).
- `6163389a` is **NOT** an ancestor of `origin/main`.
- The living-site feature reached `origin/main` via a *different lineage* — the
  KyaniteLabs consolidation, PR **#575 "Wire living-site evolution with secure
  inference and quality gates"** — then was rebranded Liminal→Sinter.
- This is the two-divergent-mains situation ADR 0003 documents. The "1116 ahead /
  1139 behind" counts are lineage divergence, not unique work. Comparison must be by
  **content**, not commit reachability.

---

## PHASE 1 — Lost-work audit

### 1a. The 8 living-site files (worktree `6163389a` vs `origin/main`)

| File | Delta vs `origin/main` | Classification |
|---|---|---|
| `src/evolution/EngagementFitness.ts` | byte-identical | safe-to-drop |
| `src/evolution/FitnessCombiner.ts` | byte-identical | safe-to-drop |
| `src/core/EvolutionIntegration.ts` | byte-identical | safe-to-drop |
| `src/analytics/PostHogClient.ts` | Liminal→Sinter strings only (`distinctId`, SQL `properties.sinter_*`, doc comment) | main newer, safe-to-drop |
| `src/daemon/LivingSiteDaemon.ts` | rebrand only (`assetDir` path, `experimentId` prefix) | main newer, safe-to-drop |
| `src/site/SlotManager.ts` | rebrand only (1 doc comment) | main newer, safe-to-drop |
| `src/cli/SiteCommand.ts` | rebrand only (CLI usage strings, `~/.sinter` state dir) | main newer, safe-to-drop |
| `src/utils/htmlWrapper.ts` | rebrand only (1 doc comment) | main newer, safe-to-drop |

**Zero rescue hunks.** Every difference is the Liminal→Sinter rebrand, and
`origin/main` is the post-rebrand canonical side. No unique logic exists in the
worktree copies.

### 1b. Files present in the worktree but absent on `origin/main`

(Excluding runtime junk: `compost/`, `seeds/`, `dogfood-campaign/`, `inbox/`,
`dogfood-telemetry/`.) All 8 are pre-rebrand names that were **renamed** on
`origin/main` — verified present under their Sinter names:

| Worktree (old `Liminal*` name) | On `origin/main` (renamed) |
|---|---|
| `src/fs/LiminalFS.ts` | `src/fs/SinterFS.ts` ✅ |
| `src/cortex/LiminalCortex.ts` | `src/cortex/SinterCortex.ts` ✅ |
| `docs/contracts/liminal-shared-artifact-contracts.md` | `docs/contracts/sinter-shared-artifact-contracts.md` ✅ |
| `scripts/ci/check-liminal-shared-artifacts.mjs` | `scripts/ci/check-sinter-shared-artifacts.mjs` ✅ |
| `test/unit/fs/LiminalFS.test.ts` | `test/unit/fs/SinterFS.test.ts` ✅ |
| `test/unit/cortex/LiminalCortex.test.ts` | `test/unit/cortex/SinterCortex.test.ts` ✅ |
| `test/server/PreviewServer.liminalfs.test.ts` | `test/server/PreviewServer.sinterfs.test.ts` ✅ |
| `test/unit/core/OrganismLoop.liminalfs.test.ts` | `test/unit/core/OrganismLoop.sinterfs.test.ts` ✅ |

Corroborated by the rebrand record: "Internal identifiers: `SinterFS` (was LiminalFS),
`SinterCortex`…" (rebrand landed in PRs #594/#595).

### Phase 1 VERDICT

> **Nothing of unique value would be lost by deleting the orphaned worktree.**
> The worktree is a pre-rebrand snapshot of the in-repo living-site work, fully
> superseded by `origin/main`. Its ~2454 compost/seeds + dogfood/inbox/telemetry
> entries are runtime artifacts (junk). Safe to remove after archiving the branch
> tip as a tag for provenance.

---

## PHASE 2 — The architecture decision (located)

**Source:** Claude Code session `738c717a-b6d8-4f2a-b0ce-f79211a68a7c` (2026-06-07),
the "Liminal Remediation Plan." Recorded decisions (via the question tool):

1. **"Which target architecture for the one-engine/two-products split?"**
   → **"Polyrepo + `@liminal/core` pkg"** (now `@sinter/core`): keep two repos,
   extract the engine into a versioned package both products depend on.
2. **"How to proceed right now?"** → **"Execute Part A sync now"** (the safe
   local↔GitHub `liminal` reconciliation). *This action produced the current
   `rescue/local-uncommitted-20260606` branch and reset local `main` to `origin/main`.*
3. Later refinements: the `liminal-sites` rename "is not about the naming… it's about
   the fixes you made to liminal BEFORE the name stuff which we still have not fully
   finished" → **"Forget about [liminal-sites]. Let's just finish sinter"**;
   composition engine **"Only finish in liminal."**

### What the "too much duplication" actually refers to

From the plan's own words:

> "one application living in three places… `liminal-sites` is a *whole-repo fork* —
> 5,246 byte-identical files + 119 drifted + 87 sites-only files… `liminal-sites`
> duplicates the entire creative engine it mostly doesn't need, and **119 files
> already drifted in ~1 month**."

So the duplication targeted is the **cross-repo `liminal-sites` fork drift**, not an
in-repo overlap. The decision: stop forking the engine; share it as `@sinter/core`.

### Reconciliation with ADR 0002 ("not business metrics")

- Today's polyrepo decision is about **repo/package topology**; it does not itself
  reverse engagement-based evolution.
- The engagement question was answered separately and explicitly: **"posthog =
  sensorium."** PostHog is an *aesthetic sensorium* (feedback signal), **not** the
  objective function — exactly ADR 0002's stance ("PostHog … must not become the
  objective function") and ADR 0004's "optional aesthetic telemetry."

> **Verdict on engagement-based evolution: SCOPE it (keep PostHog as telemetry,
> remove it from the objective function), not keep-as-objective and not delete.**

---

## PHASE 3 — Real code duplication / tension on `main`

Call-site analysis of the engagement/evolution surfaces:

| Surface | What it is | Wired into a real decision? |
|---|---|---|
| `EngagementFitness.score()` | PostHog metrics → engagement score (0–1) | **YES** — drives `LivingSiteDaemon` promote/reject |
| `FitnessCombiner` (5-axis, `engagement` weight 0.25) | multi-axis weighted fitness | In **CompostSoup** only. In the daemon, `createFitnessCombiner()` is called **only by its own tests** — dead in the promotion path |
| `EvolutionIntegration.update(engagementScore)` | core RalphLoop evolution coordinator | **NO** — `EvolutionUpdateOptions.engagementScore` is accepted then discarded: `void updateOptions; // Reserved…` (`src/core/EvolutionIntegration.ts:51`) |

### The two real defects

1. **Engagement is the daemon's objective function (ADR-0002 violation).**
   `LivingSiteDaemon.ts:134-136`:
   ```ts
   const activeScore = this.engagement.score(activeResult.metrics);
   const challengerScore = this.engagement.score(challengerResult.metrics);
   const challengerWins = challengerScore > activeScore;
   ```
   The visual/aesthetic `renderScore` is only a deploy **gate** (`>= minVisualScore`).
   Between two variants that both pass the gate, the winner is chosen **purely by
   PostHog engagement** — a business metric as the objective. This contradicts ADR
   0002 and the "posthog = sensorium" decision.

2. **Three half-built engagement-as-fitness surfaces, only one wired:**
   - `FitnessCombiner.engagement` (0.25) — dead in the daemon (tests-only).
   - `EvolutionIntegration.engagementScore` — accepted then `void`-discarded.
   - `EngagementFitness.score()` — the only one wired, and it's the ADR violation.

`FitnessCombiner` itself is **legitimately shared** between CompostSoup (core) and the
daemon's (dead) helper — its *reuse* is fine; only the **engagement axis as a default
objective weight** is the problem.

### Consolidation proposal (aligned with Phase-2 decision + "posthog = sensorium")

Surgical, ADR-aligned, dead-code-removing — pending approval:

1. **Make the daemon promotion objective aesthetic, not engagement.** Promote on the
   aesthetic/visual score; keep engagement as a recorded sensorium signal
   (`posthog.trackEvent(...)` already does this) and, at most, a tiebreaker — never the
   sole `challengerWins` criterion.
2. **Demote the `FitnessCombiner` engagement axis** from a default objective weight:
   default `engagement` weight → `0` (opt-in only), redistribute to aesthetic axes.
   Update the two daemon weight assertions (`0.25` / `0.1`) and the FitnessCombiner
   axis tests accordingly.
3. **Remove the dead `engagementScore` / `EvolutionUpdateOptions`** from
   `EvolutionIntegration` (reserved-but-discarded dead code), OR keep it only if wired
   as a non-objective hint. Simplest sufficient change = remove the dead param.

**Out of scope (de-scoped by the user today):** the cross-repo `@sinter/core`
extraction and any `liminal-sites` work — "forget about it, just finish sinter."

**Verification for the consolidation (when approved):** `pnpm build` (0 TS errors) +
`test/unit/daemon/LivingSiteDaemon.test.ts`, `test/unit/evolution/FitnessCombiner.test.ts`,
`test/unit/core/EvolutionIntegration.test.ts` pass. `SiteCommand` stays registered in
the CLI (Integration-First).

---

## Combined verdict

| Question | Answer |
|---|---|
| Would deleting the orphaned worktree lose unique work? | **No.** Pre-rebrand snapshot, fully superseded by `origin/main`. |
| Rescue hunks among the 8 files? | **None** (rebrand-only diffs). |
| Rescue files (renamed/new) absent on main? | **None** — all 8 renamed Liminal→Sinter and present. |
| What was the "too much duplication" decision? | **Polyrepo + `@sinter/core`** to stop the `liminal-sites` whole-repo fork drift; immediate action was the sync (done). |
| Does it keep / scope / reverse engagement evolution? | **Scope** — PostHog = sensorium, not objective function (ADR 0002 aligned). |
| In-repo defect found | Daemon promotes on engagement as the objective function — an ADR-0002 violation to fix as the consolidation. |

## Actions taken (approved 2026-06-07)

1. **Consolidation landed in this PR** (engagement → sensorium):
   - `LivingSiteDaemon.evaluateChallenger` now promotes on **aesthetic/visual fitness**
     (`slot.*.fitness`); engagement is recorded telemetry and only a tiebreaker within
     `AESTHETIC_TIE_EPSILON`. Fixes the ADR-0002 objective-function violation.
   - `FitnessCombiner` default `engagement` weight `0.25 → 0` (opt-in sensorium axis);
     freed weight split across the co-highest `novelty`/`quality` axes.
   - `EvolutionIntegration`: removed the dead, discarded `engagementScore` /
     `EvolutionUpdateOptions` surface (RalphLoop's 4-arg call is unaffected).
   - `FitnessCombiner` is intentionally **kept** (unwired-but-intended unified fitness;
     not deleted) per the no-deletion-of-unwired-code rule.
   - Tests updated + 2 new regression tests proving engagement is no longer the objective
     (higher engagement + lower aesthetic must NOT promote; engagement only breaks ties).
   - **Verification:** `pnpm build` 0 TS errors; `FitnessCombiner` + `EvolutionIntegration`
     + `LivingSiteDaemon` suites 61/61 pass; `CompostSoup` 18/18 pass; `SiteCommand` stays
     CLI-registered (`bin/sinter site evolve`).
2. **Orphaned worktree:** branch tip archived as tag `archive/living-site-quality`
   (`6163389a`); worktree `.claude/worktrees/living-site-quality` removed; branch
   `feat/living-site-quality` deleted. No unique work lost (Phase 1).
