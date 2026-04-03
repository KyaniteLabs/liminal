# Forensic Audit Report: Liminal Archaeology Deliverables

**Date:** April 2, 2026
**Auditor:** Archaeology audit synthesis agent (glm-5.1)
**Scope:** All 6 audit dimensions across `narrative/data/` files, cross-referenced with `archaeology.html`, `reverse-engineering-plan.md`, and source git history.
**Methodology:** Each claim verified against primary source data (git log, source code, original JSON/JSONL files). No data files were modified.

---

## 1. Executive Summary

### Overall Data Quality Rating: B+

The Liminal Archaeology deliverable is structurally sound with generally accurate data. Of the 6 audit dimensions, 3 are clean or nearly clean (commits, models, YouTube), 2 have moderate issues that affect specific claims (sessions, dogfood), and 1 is a conceptual grading that is inherently subjective (architectures). No fabricated data was found anywhere. Zero nonexistent models. Zero invented sessions. The core narrative -- that one developer built a sophisticated creative coding framework in 33 days using AI assistance -- is well-supported by the evidence.

### Issues by Severity

| Severity | Count | Summary |
|----------|-------|---------|
| CRITICAL | 1 | 7.4% dogfood success rate conflates two datasets |
| MODERATE | 8 | Session double-counting, swapped telemetry values, date errors, scope conflation, misattributed behavior |
| MINOR | 8 | Off-by-one dates, rounding, cosmetic inconsistencies |

### Confidence by Domain

| Domain | Confidence | Notes |
|--------|-----------|-------|
| Commit history | High | All era counts exact; 3 moderate date/count errors in peripheral fields |
| Model release dates | High | 27/32 exact; Claude Code CLI off by 23 days; no fabricated models |
| Session telemetry | Medium | 58 unique sessions (not 71); 920 messages (not 1,148); 4 compounding errors |
| Architecture analogies | Medium | 0 formal exact matches; 6 valid rough analogies; 2 stretches; no incorrect modules |
| Dogfood results | Medium | Dead zone verified; success rate misderived; iter=1 misattributed |
| YouTube data | High | Core counts verified; ~0.6% false positives; scope conflation on creator count |

---

## 2. Critical Issues

### CRITICAL-1: Dogfood 7.4% Success Rate Conflates Two Datasets

**Claim:** "7.4% (4/54)" success rate across dogfood testing.
**Source:** `reverse-engineering-plan.md`, reflected in `archaeology.html` dogfood charts.
**Reality:** The numerator (4 successes) comes from Agent A's dataset (4 models x 9 domains = 36 runs, 4 passes = 11.1%). The denominator (54) comes from Agent B's test matrix dimensions (6 models x 9 domains). These are two separate test runs with different models, different harnesses, and different results. Neither dataset independently produces 4/54.
**Actual figures:**
- Agent A: 4/36 = 11.1% (minimax-m27, minimax-m25, lm-coder-40b, lm-qwen-9b)
- Agent B: 11/52 = 21.2% (granite-1b, granite-350m, gemma, qwen35, phi4, lfm)
- Combined: 15/88 = 17.0%
**Why critical:** This is a headline finding in the deliverable. Presenting a composite rate from mismatched numerator/denominator is factually misleading. Readers cannot reproduce the number from any single dataset.
**Affected charts/sections:** Dogfood crucible section, any "7.4%" callout in archaeology.html.

### CRITICAL-2: RalphLoop iter=1 Misattribution

**Claim:** RalphLoop "treats 0.68 as quality threshold met and exits at iteration 1."
**Reality:** The test harness (`scripts/dogfood-all-domains.ts`) was configured with `maxIterations: 1`. The loop stopped because it was only allowed one iteration, not because the quality gate evaluated 0.68 and found it acceptable. RalphLoop's quality gate only triggers at iteration >= 2. With `maxIterations: 1`, the gate never fires. A separate test with `maxIterations: 5` shows iterations going to 2.
**Why critical:** This inverts the causal story. The narrative says the scoring system has a "dead zone" where 0.68 passes as acceptable. The truth is the test harness never let the scoring system make that judgment.
**Affected charts/sections:** Dogfood crucible section, "Dead Zone" narrative framing, any claim that RalphLoop "accepted" 0.68.

---

## 3. Moderate Issues

### MODERATE-1: Session Count 71 vs 58 (Double-Counting)

**Claim:** 71 total Claude Code sessions with human messages.
**Actual:** 58 unique sessions. 13 sessions on the boundary date 2026-03-22 appear in both era4-quality.json and era5-conversational.json chunks, inflating the sum.
**Source:** `narrative/data/telemetry-sessions.json` total_sessions field.
**Correct figure:** 58 unique sessions.

### MODERATE-2: Message Count 1,148 vs 920 (4 Compounding Errors)

**Claim:** 1,148 total human messages across all sessions.
**Actual:** 920 unique human messages. Four compounding errors inflate the telemetry figure:
1. 13 overlapping sessions double-counted in era4+era5 sums (+189 messages)
2. era6/era7 `human_messages_total` values swapped (era6=148/era7=41 should be era6=41/era7=148)
3. era4 telemetry value inflated: 297 vs actual chunk sum 277 (+20)
4. era5 telemetry value inflated: 348 vs actual chunk sum 329 (+19)

### MODERATE-3: Claude Code CLI Release Date Off by 23 Days

**Claim:** Claude Code CLI released 2025-02-01.
**Actual:** 2025-02-24 (launched alongside Claude 3.7 Sonnet).
**Source:** `narrative/data/external-data-sources.json` or model-timeline data.
**Impact:** Affects any timeline chart showing Claude Code adoption lag relative to release.

### MODERATE-4: Mar 21 Daily Commit Count Wrong (14 vs 9)

**Claim:** `daily_commit_frequency` for 2026-03-21 = 14.
**Actual:** 9 commits on Mar 21 (verified by git log).
**Source:** `narrative/data/commit-eras.json` daily_commit_frequency.

### MODERATE-5: [A]-Burst Count Inflated (15 vs 12)

**Claim:** "15 [A]-tagged commits in 6-minute burst (00:29-00:35)" in Era 2 key_events.
**Actual:** 12 [A]-tagged commits in the 00:29-00:35 burst. Total [A] commits on Mar 19 = 15, but 3 of those were hours later (10:26, 11:32, 14:02), not in the burst.
**Source:** `narrative/data/commit-eras.json` Era 2 key_events.

### MODERATE-6: Task-Job Count Inconsistent (27 vs 29)

**Claim:** "Kai agent runs 27 task-jobs" in Era 1 key_events.
**Actual:** 29 total task-job commits (25 on Feb 28, 4 on Mar 1). The description field in the same file correctly says 29, but key_events says 27.
**Source:** `narrative/data/commit-eras.json` Era 1 key_events.

### MODERATE-7: YouTube Creator Count Scope Conflation

**Claim:** 815 unique creators.
**Actual:** 815 is for the full 3-year arc (Apr 2023-Apr 2026, 2,215 videos). For the 2025+ scope used alongside the 1,481 video count, the correct figure is 433 unique channels.
**Source:** `narrative/data/youtube-ai-correlation.json` creator_influence_map.total_unique_creators.

### MODERATE-8: Undocumented YouTube Classification Methodology

**Issue:** No methodology documentation for how videos were classified into topics. The presence of keyword-based false positives (government "agents" classified as agent_arch) indicates automated classification without human review.
**Source:** `narrative/data/youtube-ai-correlation.json`.

---

## 4. Minor Issues

### MINOR-1: Project Lifespan 32 vs 33 Days

**Claim:** "32 days (Feb 28 - Apr 1, 2026)."
**Actual:** Feb 28 to Apr 1 inclusive is 33 days.
**Source:** `narrative/data/commit-eras.json` lifespan field.

### MINOR-2: Mar 1 Daily Commit Count Off by 1

**Claim:** 2026-03-01 = 9 commits.
**Actual:** 8 commits (verified by git log).
**Source:** `narrative/data/commit-eras.json` daily_commit_frequency.

### MINOR-3: Claude 3.5 Sonnet Date Off by 1 Day

**Claim:** 2024-06-20.
**Actual:** Announcement date is 2024-06-21. The model ID suffix is 20240620, so the dataset uses the build date rather than the announcement date.
**Impact:** Negligible.

### MINOR-4: Ollama Release Date Off by ~1 Month

**Claim:** 2023-06-01.
**Actual:** Initial public release was July 2023.
**Impact:** Slightly affects adoption_lag calculation for Ollama (claimed 29 months, should be ~28 months).

### MINOR-5: Qwen 2 Date Off by 1 Day

**Claim:** 2024-06-06.
**Actual:** Official blog post dated 2024-06-07. Likely timezone difference.
**Impact:** Negligible.

### MINOR-6: Cursor IDE Date Approximate

**Claim:** 2023-03-01.
**Actual:** Wikipedia lists initial release as 2023 with no specific date. March 1 is an approximation. Some sources say public launch was 2024.
**Impact:** Low confidence in exact date but year is correct.

### MINOR-7: YouTube AI Search Count Semantic Ambiguity

**Claim:** 618 AI coding searches.
**Actual:** 618 entries in ai_coding_searches array, but 4 are tagged "tools" or "creative" (not "ai"). Strict AI-tagged count is 614.
**Impact:** 4-entry difference, depends on definition of "AI search."

### MINOR-8: YouTube Same-Date Duplicates

**Issue:** 2 video entries appear twice on the same date ("AI Agent Learns to Escape" and "AI Olympics" on 2026-03-20 and 2026-03-21 respectively).
**Impact:** 2 out of 1,481 entries. Could be data artifacts or legitimate double-watches.

---

## 5. Verified Correct

The following claims were verified and found accurate:

### Commit History
- Total commits through Apr 1: 294 (correct at time of generation)
- Contributor counts: Simon 229, Pastorsimon1798 63, Kyanite 1, Kai 1 (exact match)
- Commit type breakdown: feat 145, fix 50, docs 30, chore 14, refactor 7, test 4, perf 1, security 1, other 42 (exact match, sums to 294)
- Era 6 zero-commit silence on Mar 24-27 (confirmed)
- GitHub CSV: 7,059 data rows across 50 repos (confirmed)
- Era commit ranges and date ranges: 8 of 9 eras have exact date and count matches (only Era 1 has a minor edge case with a Mar 7 commit)

### Model Release Dates (27/32 Exact)
- All major model releases verified correct: GPT-4, GitHub Copilot, GPT-4 Turbo, Claude 3 Opus, Gemini 1.5 Pro, GPT-4o, GPT-4o-mini, Claude 3.5 Haiku, o1, Gemini 2.0, Gemini 2.5, Claude 4 Opus, o3, Qwen 2.5, Qwen 2.5-Coder, Qwen 3, Qwen 3 Coder, Windsurf, MiniMax-Text-01, MiniMax-M2.5, MiniMax-M2.7, GLM-4, GLM-4-9B, GLM-4.7, GLM-5
- All 6 external research claims verified correct: Claude Sonnet 4.6, Gemini 3.1 Pro, GPT-5.3 Codex, Claude Opus 4.5, Claude Sonnet 4, Claude Sonnet 3.7
- Zero fabricated or nonexistent models

### Dogfood Results
- Dead zone 0.68 verified: CreativeEvaluator gives identical 0.68 scores to p5 code regardless of actual quality (160-byte stubs score same as 2,163-byte full implementations)
- Score formula reverse-engineered: technicalScore * 0.6 + creativeScore * 0.4, with tech=4/5 (0.8) -> 0.48 and creative=3/6 (0.5) -> 0.20 = 0.68
- Cross-contamination confirmed: Three.js, Strudel, Hydra, Tone.js, and HTML code rejected with "p5.js code must contain at least one of: function"
- Agent A error breakdown: 16/32 failures were "No LLM configured" config errors (not quality failures)

### Architecture Analogies
- All 10 named modules exist in source code and are functional
- MAP-Elites grid is genuinely a quality-diversity archive (closest to a real reinvention)
- NoveltyArchive k-NN scoring is genuinely novelty search (correct algorithm, wrong data structure for scale)
- getRandomElite() uses uniform random (confirmed, not tournament selection)
- NoveltyArchive linear scan is O(n*k) (confirmed)
- VotingEngine Borda count implementation confirmed, no calibration (confirmed)

### YouTube Data
- 1,481 AI videos count: exact match
- 6,813 total searches: exact match
- Monthly breakdowns: internally consistent
- Data provenance: genuine Google Takeout export data
- Quiet period correction: correctly notes 13 cross-repo commits during Liminal silence
- ~0.6% false positive rate in topic classification

---

## 6. Fix Recommendations

### Phase 1: Must Fix Before Any Public Reference

| # | Issue | File | Change |
|---|-------|------|--------|
| F1 | 7.4% dogfood rate | `reverse-engineering-plan.md`, archaeology.html | Replace "4/54 (7.4%)" with Agent A: "4/36 (11.1%)" and Agent B: "11/52 (21.2%)" separately, or use combined "15/88 (17.0%)" |
| F2 | RalphLoop iter=1 framing | `reverse-engineering-plan.md`, archaeology.html | Change from "loop treated 0.68 as acceptable" to "test harness limited to 1 iteration (maxIterations:1), preventing quality gate from evaluating" |
| F3 | Session count 71->58 | `narrative/data/telemetry-sessions.json` | Correct `total_sessions` to 58; add deduplication note |
| F4 | Message count 1148->920 | `narrative/data/telemetry-sessions.json` | Correct `total_human_messages` to 920; fix era6/era7 swapped values; correct era4/era5 inflated values |
| F5 | Claude Code CLI date | model-timeline data | Change from 2025-02-01 to 2025-02-24 |

### Phase 2: Should Fix for Accuracy

| # | Issue | File | Change |
|---|-------|------|--------|
| F6 | Mar 21 commit count | `commit-eras.json` daily_commit_frequency | Change 2026-03-21 from 14 to 9 |
| F7 | [A]-burst count | `commit-eras.json` Era 2 key_events | Change "15 [A]-tagged commits in 6-minute burst" to "12 [A]-tagged commits in 6-minute burst, plus 3 more later that day" |
| F8 | Task-job count | `commit-eras.json` Era 1 key_events | Change "27 task-jobs" to "29 task-jobs" |
| F9 | YouTube creator scope | `youtube-ai-correlation.json` | Add scope qualifier: "815 unique creators (full 3-year arc)" and "433 unique channels (2025+ scope)" |
| F10 | YouTube methodology | `youtube-ai-correlation.json` | Add methodology section documenting classification approach and known limitations |

### Phase 3: Nice to Fix (Cosmetic)

| # | Issue | File | Change |
|---|-------|------|--------|
| F11 | Lifespan 32->33 | `commit-eras.json` | Change to "33 days" or document exclusive-end convention |
| F12 | Mar 1 commit count | `commit-eras.json` | Change 2026-03-01 from 9 to 8 |
| F13 | Ollama date | model-timeline data | Change from 2023-06-01 to 2023-07-01 |
| F14 | Claude 3.5 Sonnet date | model-timeline data | Change from 2024-06-20 to 2024-06-21 (or note model-build-date convention) |
| F15 | Qwen 2 date | model-timeline data | Change from 2024-06-06 to 2024-06-07 |
| F16 | YouTube AI search count | `youtube-search-analysis.json` | Either change to 614 or document that 4 entries are tagged non-AI |

---

## 7. Impact Assessment

### Charts/Sections in archaeology.html Affected

| Chart/Section | Impact Level | Issues |
|---------------|-------------|--------|
| Dogfood crucible narrative | **HIGH** | CRITICAL-1 (7.4% rate), CRITICAL-2 (iter=1 misattribution), F1, F2 |
| Session timeline / message volume charts | **HIGH** | MODERATE-1, MODERATE-2 (71->58 sessions, 1148->920 messages) |
| Model timeline chart | **MEDIUM** | MODERATE-3 (Claude Code CLI date), F5 |
| Commit heatmap / daily frequency | **MEDIUM** | MODERATE-4, MODERATE-5, MODERATE-6 (Mar 21 count, burst count, task-jobs) |
| YouTube creator influence section | **MEDIUM** | MODERATE-7 (815 vs 433 scope) |
| YouTube topic breakdown | **LOW** | MODERATE-8 (undocumented methodology), ~0.6% false positives |
| Era boundaries visualization | **LOW** | MINOR-1 (lifespan 32 vs 33) |
| "Almost Got It Right" architecture table | **NONE** | Claims are verified correct |

### Sections Unaffected by Any Audit Finding

- Era boundary definitions (9/9 era count matches exact)
- Commit type breakdown chart (exact match)
- Contributor distribution (exact match)
- Architecture analogy descriptions (conceptual, not numerical -- all modules exist)
- Model release dates (27/32 exact, remainder minor offsets)
- YouTube search volume trends (6,813 total verified)
- Quiet period cross-repo activity (correctly documented)

---

## 8. Architecture Analogy Grading Summary

For reference, the 10 architecture analogies graded:

| Analogy | Module | Grade | Notes |
|---------|--------|-------|-------|
| Variational Autoencoder | CompostMill | rough_analogy | ETL pipeline, not VAE |
| GAN | Generator + AestheticCritic | rough_analogy | Static rule filter, not adversarial training |
| Mixture of Experts | SwarmOrchestrator | rough_analogy | Dense ensemble, not sparse routing |
| Multi-Head Attention | 5 personas | forced_comparison | Independent LLM calls, not attention heads |
| (1+1) Evolution Strategy | RalphLoop | rough_analogy | Iterative refinement, no mutation operator |
| Aspect-Oriented Programming | 26 hooks | rough_analogy | Interceptor chain, constrained lifecycle |
| Event Sourcing | ContextAccumulation | forced_comparison | State snapshots, not event log |
| Reward Model | ScoringEngine | rough_analogy | Hand-coded heuristics, not learned model |
| Multi-Armed Bandit | ModelRouter | rough_analogy | Deterministic routing, no exploration |
| MAP-Elites + Novelty Search | MapElites + NoveltyArchive | rough_analogy | Correct algorithms, write-only archives |

**Speculative claims without empirical backing:** All improvement percentages (30-50%, 15-25%, 60-80%) and token waste estimates (~2.25M) are narrative framing, not engineering estimates. No baseline measurements, no A/B tests, no methodology for attribution.

---

## 9. Conclusion

The Liminal Archaeology deliverable tells a true story. The facts that matter most -- 294 commits in 33 days, 9 distinct eras, a 0.68 scoring dead zone, real YouTube watch data, genuine Claude Code session transcripts -- are verified. The issues found are data preparation artifacts (session double-counting, telemetry value swaps), a conflated dogfood statistic, and minor date imprecisions. None suggest fabrication or intentional misrepresentation.

The recommended approach is: fix Phase 1 items before any external sharing or publication, fix Phase 2 before treating the deliverable as a reference document, and address Phase 3 when convenient.

---

*Audit completed April 2, 2026. All source data files left unmodified.*
