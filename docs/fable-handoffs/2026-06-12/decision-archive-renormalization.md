# DECISION NEEDED — Archive score re-normalization (stale-inflated floors gate admission)

**For:** Simon. **From:** Fable overnight loop 2026-06-12. **Type:** archive mutation + ~$ evaluator spend — your call, not auto-executed.

## Evidence (PR #32, `pnpm quality:rescore:floors`, run 2026-06-12 ~02:45 PT)

Re-scored the BOTTOM-2 entries per visual domain with the current banded-rubric judge (full 16-line output in `codex-findings.md` § FLOOR RESCORE):

- Mean `fresh − stored` = **−0.063**; every domain except p5 negative → stored floors are systematically inflated vs today's judge.
- Worst entries: `hyd_e6b82c2a` stored 0.65 → fresh **0.252** (−0.398); `thr_1653e2a6` stored 0.65 → fresh **0.372** (−0.278).
- **kinetic is sealed:** all 20 entries stored at exactly 0.85 (pre-banding ceiling cluster); fresh honest kinetic scores run 0.78–0.82 → nothing can ever displace, by `QualityArchive.add()`'s score-sorted top-20 (`src/learning/QualityArchive.ts:180`). textgen (floor 0.85) and ascii (0.82) are partially sealed the same way.
- Meanwhile admission IS otherwise alive: displacement admissions hydra/svg/ascii landed 2026-06-12 morning (entry timestamps), now visible via the new `admitted`/`floors` ledger fields (PR #31).

Net: the self-improvement ratchet is biased against fresh work by the per-domain inflation delta, and fully seized for kinetic/textgen.

## Options

**A (recommended): one-time class-mediated re-score.** Build + run a script that loads the archive THROUGH `QualityArchive`, re-renders + re-scores every entry with `scoreRenderedEvidence` (same path as rescore-tops), updates `qualityScore` in place, saves through the class. Backup `~/.sinter/archive/quality_archive.json` first (timestamped copy). Cost: ~200 evaluator calls (cloud GLM — rescore-floors' 16+3 calls ran fine). Honest floors immediately; admission unbiased; kinetic unseals.

**B: judge-version field + same-version comparison.** Add `judgeVersion` to new entries; admission compares only same-version scores, stale entries decay out. No mutation, but slow (weeks) and adds permanent complexity.

**C: do nothing.** Most domains still churn (deltas −0.03..−0.1), but kinetic/textgen stay sealed and every domain's ratchet is biased by its inflation delta.

## If you pick A — ready-to-dispatch worker brief

```
pushing-dispatch task start --executor minimax --task "Create scripts/quality/renormalize-archive.mjs in repo ~/workspaces/liminal: (1) copy ~/.sinter/archive/quality_archive.json to quality_archive.backup-<ISO>.json and verify byte size >0; (2) load via dist/learning/QualityArchive.js class ONLY (never hand-write the JSON); (3) for every non-quarantined entry in visual domains (p5,glsl,three,hydra,svg,ascii,textgen,kinetic) re-render via dist/render/HeadlessRenderer.js renderWithEvidence and re-score via dist/core/ScoringEngine.js scoreRenderedEvidence (same recipe as scripts/quality/rescore-tops.mjs); (4) update each entry's qualityScore via the class and persist through the class save; (5) print per-domain before/after floor+mean and total entries touched; (6) wire 'quality:renormalize' into package.json. Work in ISOLATED worktree .claude/worktrees/renormalize off origin/main, never git checkout in the main checkout. Acceptance: node --check passes; dry-run flag (--dry) prints report without saving; one real run ONLY after --dry output looks sane; reload via class afterwards and assert entry count unchanged. Land via Forgejo PR per docs/fable-handoffs/2026-06-12/codex-window-tasks.md rule 6. Claude model restriction: Sonnet or Haiku only; no Opus, no Fable." --cwd ~/workspaces/liminal
```

Safety notes baked in: timestamped backup before touching anything; class-mediated load/save (the 2026-06-10 archive-wipe near-miss rule); `--dry` first; entry count asserted after.
