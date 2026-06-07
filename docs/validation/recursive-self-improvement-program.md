# Sinter — Recursive Self-Improvement Program (2026-06-07)

Goal: Sinter runs generation→evaluation→learning cycles continuously, accumulates experience, and measurably improves over time — with real before/after data, not assertions. Designed to be driven endlessly (paced for provider limits) and audited for genuine learning vs metric-gaming.

## The closed loop (what "learning" means here)

```
        ┌─────────────────────────────────────────────────────────┐
        │                                                         │
   novel prompt ─▶ GENERATE (LLM) ─▶ EVALUATE (scorer/novelty/taste) │
        ▲                                   │                      │
        │                          score ≥ 0.65?                   │
   enhancePrompt(archive,                    │ yes                  │
   compost, intuition) ◀── QualityArchive ◀──┘ addOutput (persist) │
        │                  + compost heap + emergence archive       │
        └─────────────────────────────────────────────────────────┘
```

Each high-scoring artifact enriches a **persistent** store; the next prompt is **enhanced** from that store (few-shot exemplars + compost materials + intuition). Over many cycles, the population's mean quality and diversity should rise — that is the measurable claim.

## Honest gap analysis — found by EXECUTION, not assumption

The substrate (`autonomy/` garden, `dreaming/`, `learning/` taste+archive, `evaluation/` novelty+emergence, compost heap) was extensively **scaffolded but not wired to learn end-to-end**. Four gaps, each verified by running the system:

1. **Generations never recorded to the emergence/garden archive.** `RalphLoop` never called `EmergenceHooks.onCreativeRun`, so the garden's experience archive stayed empty (`garden status` = 0 entries after a real run). **Fixed:** RalphLoop now records each run as emergence experience (guarded, test-skipped).
2. **The garden reads a fresh, empty in-memory archive each invocation** and never hydrates persisted entries → it is stateless across runs. **Open** (next fix: hydrate `ArchivePlacement` from SinterFS in `garden status`/`start`).
3. **The archive-learning loop was gated behind `useArchiveLearning` (default off) with no CLI flag** — unreachable from `sinter generate`. **Fixed:** added `--learn` (wires `useArchiveLearning` + a default `~/.sinter/archive/quality_archive.json`).
4. **Even with `--learn`, the QualityArchive write was fire-and-forget** (`archive.add(item).catch(...)`), lost when the CLI `process.exit()`-ed before the async write flushed → nothing accumulated. **Fixed:** `ArchiveLearning.addOutput` now `await`s persistence; RalphLoop awaits the call.

The compost heap path already worked (it accumulated 2454 seeds); the QualityArchive + emergence paths did not, until these fixes.

## Fitness signal + the Goodhart guard

- Primary signal: Sinter's own evaluator score (0–1). Honest but gameable.
- **Multi-metric** to resist gaming: quality score trend, archive growth, novelty index, emergence scorecard, domain diversity, garden health/fertility.
- **Human/vision audit (required):** periodically render the latest gallery artifacts (`pnpm quality:render` / `quality:matrix`) and have a vision-capable reviewer confirm the *measured* improvement is *real* beauty, not metric inflation. Text-only models cannot do this — it stays with the orchestrator.

## Driver, pacing, dogfooding

- **Cycle harness:** `scripts/quality/self-improve-cycle.mjs [N]` — runs N novel generations with `--learn --intuition`, captures before/after (archive size, per-gen scores, mean, intra-cycle trend), appends one record to `docs/validation/self-improve-ledger.jsonl`.
- **Pacing:** provider 5-hour token limits are real (MiniMax hit its cap this session). The harness stops early + cleanly on a 429 and records partial progress; cycles are resumable (the archive + ledger persist).
- **Recurring:** a cron runs a small bounded cycle per window so it "runs endlessly" across limits, each cycle appending to the ledger; the orchestrator reviews the ledger trend + does the vision audit.
- **Dogfooding:** Sinter generates the artifacts, Sinter evaluates them, Sinter's compost/archive learns from them, and Sinter's enhanced prompts drive the next round — the system improves itself on its own output.

## Progress measurement

The ledger (`self-improve-ledger.jsonl`) is the record of truth: one JSON line per cycle with archive size before/after, scores, mean, and trend. "Real progress" = archive monotonically accumulating AND mean score / diversity trending up across cycles, corroborated by periodic vision audits.
