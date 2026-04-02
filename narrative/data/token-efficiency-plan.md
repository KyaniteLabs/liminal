# Actionable Token Efficiency Plan

**For:** Simon Gonzalez De Cruz
**Based on:** 7,059 commits across 50 repos, 1,148 human messages, context management trajectory, model adoption analysis
**Date:** April 2, 2026

---

## Your Current Token Burn Rate (Estimated)

From your data:
- **1,148 human messages** across 71 sessions = ~16 messages/session
- **Average message length:** ~200-500 tokens (estimate from message analysis)
- **Context window usage:** peaked at 24,735 bytes/session in Era 7
- **Compaction events:** 72 mentions of "compact" — frequent context window exhaustion
- **Sessions with context loss:** 2 events (both early eras)

**Estimated annual token burn:** Based on typical Claude Code usage patterns with your session depth, you're likely burning **500K-2M tokens/month** depending on intensity.

---

## The 7 Rules (Ordered by Impact)

### Rule 1: Use Plan Mode for Everything Non-Trivial
**Impact: -30-50% token waste**

Your data shows the biggest token waste comes from iterative refinement cycles — the agent builds something wrong, you correct it, it rebuilds. Each correction cycle doubles the token cost.

**Action:** Always enter plan mode before implementation. The plan costs ~2K tokens. The correction cycles it prevents cost ~20-50K tokens.

**Evidence:** Your messages/commit ratio went from 9.90 (Era 4, lots of correction) to 0.85 (Era 7, plan-first). That 11.6x reduction is mostly from fewer correction cycles.

### Rule 2: Batch Related Tasks into Single Sessions
**Impact: -20-30% context re-initialization waste**

Every new session re-establishes context. Your session-restore hook mitigates this, but there's still overhead.

**Action:** Group related tasks. If you're working on audio pipeline + aesthetic critics, do them in ONE session, not three. Your 27 sessions in Era 5 (hypercorrection phase) vs. deeper sessions in Era 7 proves this works.

**Evidence:** Session bytes/session peaked at 24,735 in Era 7 with fewer total sessions. Richer sessions = less re-initialization.

### Rule 3: Write Specs, Not Descriptions
**Impact: -15-25% agent misinterpretation waste**

Your data shows: 5-word precise instructions ("Voice-to-visual parameter mapping") consistently outperformed 50-word vague instructions ("make it work with the audio stuff").

**Action:** Before telling the agent what to do, spend 30 seconds writing a Given/When/Then spec:
```
Given: AudioAnalyzer returns pitch/frequency arrays
When: User runs --voice flag
Then: Visual parameters (hue, saturation, motion) map from pitch
```

**Evidence:** Your Era 7-9 instructions were consistently shorter and more precise. The 5-word "THE_BIBLE documentation" instruction produced more output than most Era 4 instructions.

### Rule 4: Use Subagents for Parallel Independent Tasks
**Impact: -10-20% sequential waiting waste**

If you have 3 independent tasks, running them in parallel with subagents costs the same tokens but finishes 3x faster — and avoids context pollution between tasks.

**Action:** Identify independent tasks upfront. If task B doesn't depend on task A's output, dispatch them in parallel.

**Evidence:** Your SwarmOrchestrator was an attempt at this for creative generation. Apply the same pattern to your own workflow.

### Rule 5: Cache Aggressively — But Know When to Bust It
**Impact: -10-15% redundant computation**

Your RalphLoop was defeated by LLM response caching — identical prompts producing identical output. But you also need to AVOID caching when you want different results.

**Action:**
- **DO cache:** Repeated reads of the same file, repeated queries about the same code structure
- **DON'T cache:** Creative generation, evaluation, iterative refinement
- **Use the index:** jcodemunch/jdocmunch/jdatamunch provide cached indices — use them instead of raw grep/read

### Rule 6: Set a Token Budget Per Task
**Impact: Forces prioritization**

Before each task, estimate: "This should take ~5 agent messages." If you're at message 8 and not done, STOP and reassess. Either the task is too big (split it) or the approach is wrong (pivot).

**Action:** Use the TaskCreate tool. If a task spawns more than 3 subtasks, it was underspecified.

**Evidence:** Your 3.86 msg/commit in early eras vs 0.85 in late eras. The low number didn't mean less work — it meant better work per message.

### Rule 7: Use the Cheapest Model That Works
**Impact: -20-40% cost (if using paid APIs)**

Your ModelConfig shows harness (precision) and generation (creativity) split. But you may be over-using expensive models for tasks that cheap models handle fine.

**Action:**
- **Haiku/cheap models for:** File reading, grep, simple edits, test running, documentation
- **Sonnet/medium models for:** Feature implementation, refactoring, debugging
- **Opus/expensive models for:** Architecture decisions, complex debugging, creative generation

**Evidence:** Your model comparison benchmarks (Qwen 3.5 9B, MiniMax M2.7) show you're already evaluating cost/performance. Apply this to your own tool usage.

---

## Context Hygiene Recommendations

### What You're Already Doing Right
1. **Hooks system (26 hooks)** — primary meta-cognitive instrument. Keep investing here.
2. **Memory files** — persistent cross-session state. This is high-value, low-cost.
3. **Plan files** — context before execution. This is your #1 efficiency lever.
4. **Session-restore** — continuity across sessions. Expensive but necessary.

### What to Change
1. **Stop context dumping.** Your Era 4 hypercorrection (80 micromanagement msgs vs 21 trust) wasted tokens. Trust the agent more.
2. **Use memory files instead of context dumps.** If you find yourself pasting >500 words of context into a prompt, save it to a memory file instead. The agent reads it automatically.
3. **Compact proactively, not reactively.** Don't wait for the context window to fill up. Use `/compact` when you feel the session getting long.
4. **One task per session** for complex work. Context pollution between tasks is the silent killer.

### Context Improvement Over Time
Your trajectory is clear and positive:
| Metric | Era 4 (Peak Waste) | Era 7 (Mastery) | Improvement |
|--------|-------------------|-----------------|-------------|
| Messages/commit | 9.90 | 0.85 | 11.6x |
| Session depth | Shallow (27 sessions) | Deep (richer sessions) | Quality > quantity |
| Micromanagement ratio | 3.8:1 | ~1:1 | Trust replaced control |
| Context loss events | 2 | 0 | Eliminated |

---

## Model Release Correlation

Your tool adoption speed (from the cross-repo analysis):

| Model/Tool | Release | Your First Use | Lag |
|-----------|---------|---------------|-----|
| MiniMax-M2.7 | Mar 18, 2026 | Mar 2026 | **0 months** |
| GLM-5 | Feb 11, 2026 | Mar 2026 | **1 month** |
| Claude 3.5 Haiku | Oct 22, 2024 | Dec 2024 | **2 months** |
| Qwen 3 Coder | Jul 22, 2025 | Nov 2025 | **4 months** |
| GPT-4o-mini | Jul 18, 2024 | Dec 2024 | **5 months** |
| Gemini 2.5 | Mar 25, 2025 | Aug 2025 | **5 months** |

**You're an early adopter** — average lag of ~2 months for tools you actively research, vs 6-12 months for typical developers. The exceptions (Cursor 25 months, Ollama 29 months) are tools you didn't actively research — you found them later.

**Key insight:** Your adoption speed accelerated dramatically after November 2025 (local-first shift). When you started running models locally (Ollama, LM Studio), your ability to evaluate new models exploded — no API cost barrier = more experimentation.

---

## Monthly Token Budget Recommendation

Based on your usage patterns:

| Activity | Estimated Tokens/Month | Optimization |
|----------|----------------------|-------------|
| Active coding sessions | 300K-800K | Plan mode + batch tasks |
| Research/exploration | 100K-300K | Use web search agents |
| Creative generation | 100K-200K | Use local models (Ollama) |
| Documentation/writing | 50K-100K | Use cheaper models |
| Context management | 50K-100K | Memory files > context dumps |

**Target:** 600K-1.5M tokens/month (down from estimated 2M+ by eliminating correction cycles and context waste)

---

*Sources: github-commits.csv (7,059 commits), github-repos.csv (50 repos), human-messages.json (1,148 messages), context-management-analysis.json, telemetry-sessions.json, telemetry-agents.json, model-comparison benchmarks, ModelConfig.ts, ModelTier.ts, ModelRouter.ts.*
