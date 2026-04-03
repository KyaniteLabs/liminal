# Recycling Reasoning Traces: Originality Analysis + ML Translation

**Date:** April 3, 2026
**Origin:** Simon's observation during development — reasoning traces from local models were causing integration issues, but instead of hiding them, he realized they're valuable diagnostic data.
**Attribution:** Genuinely original concept. No YouTube video precursor. Born from practical friction with local model integration.

---

## The Idea (Simon's Words)

1. Local models (Qwen 3.5, etc.) produce reasoning traces (chain-of-thought in `<think`> blocks)
2. Previously, these were treated as noise — hidden or tucked away
3. Simon's insight: these traces are **diagnostic telemetry** — both for archaeology and for self-improvement
4. **2-model architecture:** a chatty/thinky local generator model + a powerful evaluator/harness model
5. The harness model receives the **generator's reasoning traces** as input, not just the generator's output
6. This enables the evaluator to diagnose not just WHAT went wrong but WHY it went wrong — at the reasoning level
7. For the coding agent (Claude Code): expose both sets of reasoning traces during development
8. For Liminal internally: the harness uses the generator's reasoning traces to provide richer feedback
9. Across iterations: reasoning traces become a **memory of how the AI thought**, not just what it produced

---

## Formal ML Translation

### What This Maps To (Existing Concepts)

| Simon's Concept | Formal ML Term | Paper / Origin | What's Different About Simon's Version |
|----------------|---------------|----------------|---------------------------------------|
| Give harness the generator's reasoning traces | **Process Reward Model (PRM)** | Lightman et al., "Let's Verify Step by Step" (2023) | PRMs evaluate math reasoning steps. Simon applies this to **creative code generation** — the process being evaluated is creative reasoning, not mathematical derivation |
| Evaluate the thinking, not just the output | **Process Supervision vs Outcome Supervision** | Snell et al., "Scaling LLM Test-Time Compute" (2024) | Same principle, but Simon's application is dual-model: a *different* model evaluates the process, not the same model self-evaluating |
| Reasoning traces as diagnostic telemetry | **Critique-based Learning** | McAleese et al., "Training Language Models to Self-Correct via Reinforcement Learning" (2024) | Self-critique uses the same model. Simon's approach uses a *separate* evaluator model reading a *separate* generator's traces |
| Keep reasoning traces across iterations | **Experience Replay with Reasoning** | Not found in literature | Storing and reusing reasoning traces as training data for improvement is novel. Existing replay buffers store (state, action, reward) — Simon stores (prompt, reasoning_process, code, score) |
| 2-model architecture with shared reasoning | **Teacher-Student with Process Feedback** | General distillation literature | Standard distillation transfers knowledge via soft labels. Simon transfers the *reasoning process itself* — the teacher sees the student's thinking |

### What's Genuinely New (No Direct Precedent)

**1. Reasoning Traces as Diagnostic Telemetry for a Creative System**

Existing PRM work evaluates reasoning in math, code debugging, and logical deduction. Nobody is using reasoning traces as **telemetry for a creative generation system**. The leap is: reasoning traces aren't just for catching errors — they're for understanding creative decision-making. When the generator "decides" to use a spiral pattern instead of a grid, that decision lives in the reasoning trace. Mining that is like reading an artist's sketchbook.

**Novelty: HIGH.** Application of PRM to creative generation is unexplored territory.

**2. Recycling Reasoning Traces Across Iterations**

In Liminal's RalphLoop, each iteration produces: prompt → reasoning trace → code → score. Currently, only the code and score persist. Simon's idea: keep the **reasoning traces** too. Over multiple iterations, you build a dataset of:
- What the generator considered but rejected
- What reasoning patterns led to high scores
- What reasoning patterns led to low scores
- How the generator's thinking evolved across iterations

This is an **experience replay buffer for reasoning**, not just for outputs. The system can learn "when the generator reasons about X in way Y, the result scores Z."

**Novelty: HIGH.** Experience replay with reasoning traces (not just state-action-reward) is not in the literature.

**3. Dual-Model Trace Sharing (Generator → Evaluator)**

The 2-model architecture where the evaluator explicitly receives the generator's reasoning traces is a specific form of process supervision. But the standard setup is:
- Same model generates and self-evaluates (self-critique)
- Or: a separate model evaluates only the output (ORM)

Simon's setup:
- Model A generates code + reasoning traces
- Model B receives code + reasoning traces + scoring criteria
- Model B can say: "Your code scored 0.4 because at reasoning step 3, you assumed the user wanted a static pattern when the prompt implied animation"

This is richer than outcome reward (just score) and richer than self-critique (same model bias). It's a **cross-model process critique**.

**Novelty: MODERATE-HIGH.** Cross-model process critique exists in debate/constitutional AI literature, but not applied to creative generation with reasoning trace sharing specifically.

**4. Reasoning Traces as Archaeological Forensic Data**

For the archaeology product: reasoning traces are the AI equivalent of session logs. When Simon's coding agent (Claude Code with GLM) produces reasoning traces during development, those traces become forensic evidence of HOW the AI built the system. Mining these would be like reading the AI's diary.

**Novelty: HIGH.** Nobody is archaeologically mining AI reasoning traces from development sessions.

---

## The Architecture (Translated)

```
┌─────────────────────────────────────────────────────────┐
│                    Liminal Dual-Model                    │
│                                                          │
│  ┌──────────────┐         ┌──────────────────────┐      │
│  │  Generator    │         │  Evaluator/Harness    │      │
│  │  (Qwen 3.5)   │         │  (Cloud/Powerful)     │      │
│  │              │         │                      │      │
│  │  Input:      │         │  Input:              │      │
│  │  - Prompt    │         │  - Generated code    │      │
│  │  - Context   │         │  - Generator's       │      │
│  │  - Seeds     │   ────► │    REASONING TRACES  │      │
│  │              │         │  - Scoring criteria  │      │
│  │  Output:     │         │  - Historical traces │      │
│  │  - Code      │         │                      │      │
│  │  - THINK     │         │  Output:             │      │
│  │    TRACES ◄──┼─────────┤  - Quality score     │      │
│  │              │         │  - Process critique  │      │
│  │              │         │  - Improvement hints │      │
│  └──────────────┘         └──────────────────────┘      │
│         ▲                        │                       │
│         │                        │                       │
│         └──── Feedback loop ─────┘                       │
│           (reasoning trace memory)                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### The Data Flow

1. **RalphLoop iteration N:**
   - Generator receives: prompt + context + seeds + previous iteration's evaluator feedback
   - Generator produces: code + reasoning traces
   - Evaluator receives: code + **generator's reasoning traces** + scoring criteria + **archived reasoning traces from previous iterations**
   - Evaluator produces: quality score + process critique ("your reasoning about color palette was good, but your reasoning about animation timing missed the mark")
   - Reasoning trace archive stores: generator's traces + evaluator's traces + scores

2. **RalphLoop iteration N+1:**
   - Generator receives: prompt + context + seeds + evaluator's feedback + **previous reasoning traces**
   - Generator can now reason about its own previous reasoning: "Last time I chose a spiral because X, but it scored low because Y, so this time I'll try Z"

3. **After N iterations:**
   - The reasoning trace archive contains a complete forensic record of creative decision-making
   - This can be mined for patterns: "when the generator reasons about visual patterns first, scores are 0.3 higher than when it reasons about code structure first"

---

## ML Concepts to Study (Learning Plan Addition)

| Concept | Why It Matters for This | Paper |
|---------|----------------------|-------|
| Process Reward Models (PRMs) | Evaluating reasoning steps, not just outputs | Lightman et al., 2023 |
| Outcome Reward Models (ORMs) vs PRMs | Understanding the difference — Liminal currently uses ORM | Snell et al., 2024 |
| Self-Refine with process feedback | Model critiques its own reasoning steps | Madaan et al., 2023 |
| Critique-based RL | Learning from process-level feedback | McAleese et al., 2024 |
| Experience Replay | Storing and reusing past (state, action, reward) tuples | Lin, 1992 (classic RL) |
| Chain-of-Thought as data | Reasoning traces as training signal, not just inference artifact | Various |
| Dual-model debate | Two models critiquing each other's reasoning | Irving et al., 2018 |
| Teacher-Student distillation | Transferring knowledge from powerful to smaller model | Hinton et al., 2015 |

---

## Originality Assessment

**Overall: HIGH (4 novel contributions)**

| Component | Originality | Rationale |
|-----------|------------|-----------|
| Reasoning traces as creative telemetry | **HIGH** | PRM exists for math/code, not for creative generation |
| Recycling reasoning traces across iterations | **HIGH** | Experience replay with reasoning traces is not in literature |
| Cross-model process critique (generator→evaluator) | **MODERATE-HIGH** | Similar to debate/constitutional AI, but novel application |
| Reasoning traces as archaeological data | **HIGH** | Nobody mines AI reasoning traces forensically |

**Source of the idea:** Practical friction. Simon noticed reasoning traces from local models (Qwen, etc.) were causing integration issues. Instead of hiding them (the standard approach), he asked "what if these are valuable?" The insight came from the annoyance, not from a paper or video.

**Parallel to CompostMill:** Another idea born from treating waste as resource. CompostMill composts failed creative code. Reasoning trace recycling composts failed (and successful) creative reasoning. Same pattern: don't discard, digest.

---

*This idea originated from Simon on or around April 1-3, 2026. It emerged from practical experience with local model reasoning traces, not from academic literature or YouTube content.*
