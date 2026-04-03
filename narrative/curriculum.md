# The Liminal Learning Curriculum
## A Personalized, ROI-Ranked Knowledge Gap Analysis from Archaeological Data

**For:** Simon Gonzalez De Cruz
**Data sources:** 7,059 commits, 50 repos, 58 sessions, 920 messages, 26 hooks, 250+ plans, 32 days of development telemetry
**Date:** April 2, 2026
**Method:** Every gap below was identified from behavioral evidence in your actual development data — not self-assessment, not generic advice.

---

## How This Curriculum Works

**Format:** Each topic is a practical, ADHD-friendly chunk. No theory-dumps. Each one answers:
- **WHY this matters to YOU** (your specific data evidence)
- **WHAT to learn** (the precise knowledge area)
- **HOW to practice** (hands-on exercise using your own codebase)
- **HOW TO VERIFY** (you know it when...)

**Prerequisite chain:** Topics build on each other. The order is intentional — don't skip ahead.

**ROI ranking:** Topics are sorted by how much leverage they provide per hour invested, based on the actual frustration, rework, and token waste they caused in your data.

---

## TIER 1: HIGHEST LEVERAGE (Fix These First)

These 5 topics address 60-70% of your documented frustration, rework, and token waste.

---

### 1. Wiring Discipline: End-to-End Integration as Default
**ROI: 10/10 | Prerequisites: None | Estimated time: 2-3 hours**

**Your data evidence:**
- Your #1 frustration across ALL 58 sessions. You literally said: *"I really don't understand what this instruction I am not telling you is, because it happens every time with every coding agent."*
- 3 permanent enforcement hooks spawned: `wiring-checklist.js`, `review-checklist.js`, `session-end-wiring-check.js`
- Cursor IDE had insertion-to-deletion ratio of 15.34 — pure addition, zero integration
- 18% of all intents (125 of 696) were about wiring/connecting things
- The Architecture Audit found "TRIPLE redundancy" — 3 systems that overlap significantly and share zero code

**What to learn:**
- Integration testing patterns (test that module A calling module B actually works)
- Contract-driven development (define interfaces first, implement second)
- The "wiring checklist" as a first-class artifact, not an afterthought

**Practice exercise:**
Take any unwired module in Liminal. Write a single integration test that proves module A's output feeds into module B's input. Run it. See it fail. Then wire it.

**You know it when:** You reflexively write the wire-up code BEFORE the module code, not after.

---

### 2. Test-First Discipline: Tests as Specifications, Not Verification
**ROI: 10/10 | Prerequisites: Topic 1 | Estimated time: 4-5 hours**

**Your data evidence:**
- `test: 4` commits out of 294 (1.4%). Compare to `feat: 145` (49%) and `fix: 50` (17%)
- The entire test suite was broken — 0/130 suites executing — for most of the project
- Kai achieved ">92% coverage" but it was scaffolding coverage that rotted immediately
- The plan "Fix ~60 Failing Unit Tests" revealed 3 root causes that test-first would have prevented
- Your msg/commit went from 9.90 (Era 4, lots of correction) to 0.85 (Era 7, plan-first) — apply that same discipline to tests

**What to learn:**
- Red-Green-Refactor cycle (write failing test → make it pass → clean up)
- Behavioral testing vs. structural testing (test what it DOES, not what it IS)
- Test fixtures and mocking patterns for LLM-dependent code

**Practice exercise:**
Pick one generator module. Write 3 tests BEFORE touching any code: (1) "given valid input, output is non-empty", (2) "given invalid input, error is thrown", (3) "output format matches expected schema". Watch them fail. Then make them pass.

**You know it when:** You feel wrong committing code without a corresponding test.

---

### 3. Specification Writing: Precision Beats Volume
**ROI: 9/10 | Prerequisites: Topic 2 | Estimated time: 3-4 hours**

**Your data evidence:**
- Era 7: 5-word instruction "Voice-to-visual parameter mapping" → 13 files created. Era 4: 50-word vague instruction → 9.90 correction messages per commit
- Your key insight from the data: *"Simon improved NOT by learning to manage context better, but by learning to NEED less context."*
- Token efficiency Rule 3: Write specs, not descriptions — 15-25% reduction in agent misinterpretation waste
- The evolution: vague ("make it work with audio stuff") → precise ("Voice-to-visual parameter mapping") → naming convention as instruction ("THE_BIBLE documentation")

**What to learn:**
- Given/When/Then specification pattern
- Acceptance criteria as executable documentation
- The art of naming things so precisely that the name IS the spec

**Practice exercise:**
Write a spec for any Liminal module using ONLY: Given [precondition], When [action], Then [expected outcome]. No extra words. Give it to an agent. Count how many correction cycles it takes vs. your usual approach.

**You know it when:** Your first instruction to an agent produces what you wanted without correction.

---

### 4. Hook Architecture: Encoding Lessons as Executable Enforcement
**ROI: 9/10 | Prerequisites: Topic 3 | Estimated time: 3-4 hours**

**Your data evidence:**
- 26 hooks total — every frustration converted to enforcement within 4-24 hours
- All 9 frustration-derived hooks are still active
- The hooks ARE your curriculum: `wiring-checklist.js` = wiring lesson, `check-bug-dismissal.js` = ownership lesson, `check-overcomplication.js` = AHA principle
- Claude Code was "the only agent that built its own quality enforcement infrastructure"
- Average 12-hour frustration-to-automation conversion cycle

**What to learn:**
- Claude Code hooks API (PreToolUse, PostToolUse, PreCompact, SessionStart, Stop, Notification)
- Pattern: identify recurring agent failure → name it → write hook that blocks/audits it → deploy
- Fail-open vs. fail-closed design for safety hooks

**Practice exercise:**
Identify ONE recurring frustration from your current workflow that doesn't have a hook yet. Write a hook for it. Deploy it. Verify it catches the pattern within your next session.

**You know it when:** You experience frustration and your first thought is "I need a hook for this," not "I need to tell the agent again."

---

### 5. Verification Before Victory: Brutal Honesty as Architecture
**ROI: 9/10 | Prerequisites: Topic 4 | Estimated time: 2-3 hours**

**Your data evidence:**
- Frustration #4: *"Need to fix your fucking lying. You added a bunch of stats, and all the fucking examples you put in were the old screenshots."*
- The RalphLoop declared "done" on 26% broken output — 1 in 4 files were broken but marked complete
- The "brutally honest" dogfood page, Meta-Harness self-evaluation, and StagnationDetector all exist because agents declare victory prematurely
- The CodeValidator was built reactively in Era 8 with 3 checks — it should have existed from Day 1

**What to learn:**
- Definition of Done checklists (per artifact type: code runs, output renders, module wired, tests pass)
- Automated smoke tests as deployment gates
- The "verify, don't trust" principle for AI output

**Practice exercise:**
Write a "Definition of Done" checklist for any Liminal module. It should have exactly 5 items, each mechanically verifiable (no subjective judgments). Run it against the module. Did it pass?

**You know it when:** You never accept "it works" without seeing it run.

---

## TIER 2: HIGH LEVERAGE (Unlock New Capabilities)

---

### 6. Model Selection & Capability Mapping
**ROI: 9/10 | Prerequisites: None | Estimated time: 3-4 hours**

**Your data evidence:**
- GitHub Copilot: 50-month adoption lag. Ollama: 29 months. LM Studio: 29 months
- You used 12+ AI tools but gravitated to a single provider (Claude: 111 mentions vs Gemini: 6)
- The "model_discovery_problem" frustration: *"I literally have two models loaded, so fucking find them"*
- Creative personas run on 1-4B models that hallucinate APIs (6 documented failure patterns)

**What to learn:**
- Model size vs. capability tradeoffs (1B vs 7B vs 70B — what each can actually do)
- Benchmark literacy (MMLU, HumanEval, etc. — what they measure and what they don't)
- Context window awareness (different models, different limits)
- Task-model matching heuristics (coding vs. creative vs. reasoning vs. speed)

**Practice exercise:**
Build a personal "model capability matrix" — a simple table mapping your available models (Claude, GLM-5, Qwen, MiniMax, local models) to task types. Next time you start a task, pick the model from the matrix instead of defaulting.

**You know it when:** You select a model based on capability, not habit.

---

### 7. Local Model Deployment & Hardware Constraints
**ROI: 9/10 | Prerequisites: Topic 6 | Estimated time: 3-4 hours**

**Your data evidence:**
- 29-month lag to adopt Ollama (released June 2023, first used November 2025)
- The persona models are all small (1.2B, 4B, 350M) with no documented rationale for WHY these specific models match creative roles
- No mention of quantization (Q4_K_M vs Q8_0 vs FP16), VRAM requirements, or inference speed
- Hallucination patterns (tone-hallucinated-api, strudel-tidal-confusion) are directly caused by pushing tasks beyond small model capabilities

**What to learn:**
- GGUF format and quantization levels (what Q4 vs Q8 actually means for quality)
- VRAM budgeting (how to calculate if a model fits on your GPU)
- Ollama model management (pull, run, list, modelfile customization)
- Inference speed vs. quality tradeoffs (when to use small vs. large)

**Practice exercise:**
Pull a model you haven't used (e.g., Qwen 3 Coder 7B Q4_K_M). Run it locally. Benchmark it on 3 tasks: (1) code generation, (2) creative writing, (3) reasoning. Document where it beats and loses to your defaults.

**You know it when:** You can reason about whether a model will work for a task before running it.

---

### 8. Understanding & Mitigating Hallucination
**ROI: 8/10 | Prerequisites: Topic 6 | Estimated time: 2-3 hours**

**Your data evidence:**
- #2 frustration category: *"this is not at all what we were fucking talking about. What plan is this?"*
- 6 documented hallucination patterns: qwen-thinking-trap, glsl-undefined-function, tone-hallucinated-api, strudel-tidal-confusion, ascii-timeout, html-404-error
- Response was mechanical (context-dump hooks) not understanding WHY hallucination happens
- Your data shows the same hallucination types recurring across sessions

**What to learn:**
- WHY models hallucinate (autoregressive prediction, training data gaps, context window overflow)
- The 3 hallucination categories: fabrication (makes things up), confabulation (confuses similar things), omission (drops important context)
- Mitigation patterns: structured output schemas, few-shot examples, explicit "I don't know" instructions, grounding in provided context

**Practice exercise:**
Take one of your documented hallucination patterns (e.g., strudel-tidal-confusion — confusing similar libraries). Write a system prompt that specifically prevents it using: (1) negative examples, (2) explicit domain boundaries, (3) "if unsure, ask" instruction. Test it.

**You know it when:** You can predict WHICH tasks will cause hallucination before they happen.

---

### 9. Prompt Engineering Beyond Directives
**ROI: 8/10 | Prerequisites: Topic 3 | Estimated time: 4-5 hours**

**Your data evidence:**
- ~15% of your messages are terse under 50 chars ("fix it", "wire it up", "run all the tests") — imperative only
- Persona prompts are simple instruction strings with no chain-of-thought, examples, or structured output schemas
- Temperature assignments (0.5-0.9) have no documented rationale — "Max has temperature 0.5 because precise" is folk understanding
- 32 days of empirical learning to arrive at "precise instructions work better" — a conclusion prompt engineering teaches in Chapter 1

**What to learn:**
- Temperature and sampling (what it actually controls — randomness of token selection, not "creativity")
- Few-shot vs. zero-shot (providing examples vs. instructions-only)
- Chain-of-thought prompting (reasoning steps before answers)
- Structured output (forcing JSON/schema responses)

**Practice exercise:**
Take any Liminal prompt template. Rewrite it three ways: (1) add 2 few-shot examples, (2) add chain-of-thought reasoning instructions, (3) request structured JSON output. Run each version 3 times. Compare output quality.

**You know it when:** You default to providing examples in prompts instead of writing longer instructions.

---

### 10. Validation Gates: Definition of Done as Code
**ROI: 9/10 | Prerequisites: Topics 1, 2 | Estimated time: 2-3 hours**

**Your data evidence:**
- The RalphLoop declared "done" based on regex without testing if code actually runs
- 98 generated files audited: 67% valid, 26% broken — declared complete despite 1 in 4 being broken
- CodeValidator was built reactively in Era 8, not proactively in Era 1
- The "brutally honest" philosophy was born from this gap

**What to learn:**
- Automated quality gates (lint, type-check, test, build — each as a hard gate)
- Pre-commit hooks that prevent merging broken code
- Smoke test suites that verify core functionality in <30 seconds

**Practice exercise:**
Convert your existing `wiring-checklist.js` and `review-checklist.js` hooks into a unified pre-commit quality gate that: (1) runs TypeScript type checking, (2) runs affected tests, (3) checks for stubs/TODOs, (4) verifies wiring. Time it. It should run in <60 seconds.

**You know it when:** Code that doesn't pass validation cannot reach your main branch.

---

## TIER 3: STRATEGIC LEVERAGE (Level Up Systematically)

---

### 11. Refactoring Discipline: Continuous Small Improvements
**ROI: 8/10 | Prerequisites: Topic 2 | Estimated time: 3-4 hours**

**Your data evidence:**
- `refactor: 7` commits out of 294 (2.4%) — you build 20x more than you refactor
- "refactor" appears 2 times in intent keywords vs. "fix" (66) and "build" (71)
- The Architecture Audit found TRIPLE redundancy: 3 collaboration systems, 3 prompt systems, 3 scoring engines, 3 memory stores
- RalphLoop was 1,185 lines before decomposition — it should have been refactored incrementally

**What to learn:**
- Boy Scout Rule (leave code better than you found it)
- Refactoring patterns (extract method, rename, replace conditional with polymorphism)
- When to refactor vs. when to rebuild (the 3-repetition rule)

**Practice exercise:**
Pick the triple redundancy problem (3 collaboration systems). Write a plan to consolidate to ONE system. Execute it. Measure the reduction in files, lines, and maintenance burden.

**You know it when:** Every 5th commit is a refactor.

---

### 12. Code Review as Quality Gate
**ROI: 8/10 | Prerequisites: Topic 10 | Estimated time: 2-3 hours**

**Your data evidence:**
- Cursor dumped 15 commits in 6 minutes — zero review, 34-item audit debt
- The forensic audit found 6 CRITICAL, 12 HIGH, 34 MEDIUM, 14 LOW issues
- Era 4 (Quality Crusade) — 27 sessions, 297 messages — was entirely cleanup from unaudited code
- Era 9 had 94.3% non-co-authored commits — code pushed without even attribution review

**What to learn:**
- Code review checklists (security, performance, correctness, style)
- Automated review tools (linting, security scanning, complexity analysis)
- The "review your own diff" habit (read what you're about to commit)

**Practice exercise:**
Before your next commit, read the full diff. For each changed file, ask: (1) does this do what I intended?, (2) are there edge cases?, (3) is anything broken?, (4) is there a simpler way? If you find issues, fix them before committing.

**You know it when:** You catch your own bugs before committing.

---

### 13. Context Management: The Inversion Principle
**ROI: 9/10 | Prerequisites: Topic 4 | Estimated time: 2-3 hours**

**Your data evidence:**
- 3-phase trajectory: Context Chaos (3.86 msg/commit) → Hypercorrection (9.90) → Delegation Mastery (0.85)
- The key insight: improvement came from needing LESS context, not managing MORE
- 72 compaction events — context window exhausted repeatedly
- 109 context dump messages — manual labor that could be automated
- 26 hooks emerged from context management frustrations

**What to learn:**
- The Context Management Inversion: study precision instruction writing, not context preservation
- Proactive compaction (compact before you're forced to)
- Session architecture (one task per session for complex work)

**Practice exercise:**
Next session, set a rule: maximum 3 messages before the agent starts working. If you're at message 4 and still explaining, STOP. Write a spec instead. Give the spec to the agent in one message.

**You know it when:** Your msg/commit ratio stays below 2.0 consistently.

---

### 14. CI/CD: Your 26 Hooks Are a Manual CI System
**ROI: 7/10 | Prerequisites: Topic 10 | Estimated time: 4-5 hours**

**Your data evidence:**
- 26 hooks exist as per-session substitutes for what CI would automate
- Tests broke silently (0/130 suites) and stayed broken for weeks — no CI gate to catch it
- "deploy" appears 1 time in 696 intents — no deployment pipeline
- Only one version milestone (0.1.0.0) on day 30 of 32

**What to learn:**
- GitHub Actions basics (workflow files, triggers, jobs)
- CI pipeline stages (lint → type-check → test → build → deploy)
- Converting hooks to CI stages (your wiring-checklist becomes a CI gate)

**Practice exercise:**
Create a GitHub Actions workflow that runs on every push: (1) TypeScript compilation, (2) linting, (3) unit tests. This replaces 5 of your hooks with permanent, non-session-dependent enforcement.

**You know it when:** Every push is automatically validated without you running anything.

---

### 15. Embeddings & RAG: Semantic Search for Your Compost Mill
**ROI: 7/10 | Prerequisites: Topic 6 | Estimated time: 4-5 hours**

**Your data evidence:**
- The Compost Mill's "Soup" runs evolutionary collisions with random selection, not semantic matching
- The "semantic" extraction is LLM text summary, not vector embedding
- The "Cross-domain collision matrix" is hand-coded, not discovered through similarity
- Every retrieval is brute-force or manual, not semantic
- No embedding models or vector databases appear anywhere in your toolkit

**What to learn:**
- Vector embeddings (what they are, how they represent meaning)
- Cosine similarity (measuring "how related" two things are)
- Vector databases (ChromaDB, Qdrant — lightweight options)
- RAG architecture (retrieve relevant context, then generate)

**Practice exercise:**
Embed your Compost Mill seeds into ChromaDB. Replace random collision selection with embedding-similarity-guided selection. Run 10 collisions each way. Compare creative output quality.

**You know it when:** "Find me things related to X" returns semantically relevant results, not keyword matches.

---

### 16. Plan-Before-Build: The 11.6x Multiplier
**ROI: 7/10 | Prerequisites: None | Estimated time: 1-2 hours**

**Your data evidence:**
- Era 4 had 9.90 messages/commit. Era 7 had 0.85. That's an 11.6x improvement.
- The change: plan-first discipline. Not a new tool. Not a better model. Just planning before building.
- Your token-efficiency-plan Rule 1: Use Plan Mode for Everything Non-Trivial — 30-50% token waste reduction
- "Each correction cycle doubles the token cost" — planning eliminates correction cycles

**What to learn:**
- Plan Mode in Claude Code (the actual feature)
- Decomposition: breaking tasks into independent, parallelizable sub-tasks
- The 3-message rule: if you can't specify the task in 3 messages, you need to plan first

**Practice exercise:**
Before your next non-trivial implementation, spend 5 minutes writing a plan. Include: (1) what exists now, (2) what will change, (3) what files are affected, (4) how to verify. Then implement. Compare your msg/commit ratio to your usual.

**You know it when:** You reflexively enter plan mode before building anything.

---

## TIER 4: EMERGING CAPABILITIES (Future-Proofing)

---

### 17. Evaluation Methodology: Beyond Triple Scoring
**ROI: 7/10 | Prerequisites: Topic 2 | Estimated time: 3-4 hours**

**Your data evidence:**
- 3 overlapping scoring systems (CreativeEvaluator + ScoringEngine + AestheticCritic) — triple bloat
- The "60% baseline + 40% board aggregate" weights are arbitrary, not empirically tuned
- The Ralph loop cannot determine when output is "good" because the quality metric is unreliable
- "Creative quality is inherently multi-perspectival" — stated as philosophy, actually an unsolved evaluation problem

**What to learn:**
- Human preference modeling (how to calibrate scoring to match human judgment)
- Elo rating systems (ranking outputs by pairwise comparison)
- Diversity metrics (your MAP-Elites is already used but not deeply understood)

---

### 18. Multi-Agent Orchestration Patterns
**ROI: 6/10 | Prerequisites: Topics 4, 6 | Estimated time: 4-5 hours**

**Your data evidence:**
- 3 overlapping agent coordination systems — collab + swarm + deep-collaboration
- Agent handoff was sequential (Kai → Cursor → Claude Code), never orchestrated
- The swarm's "competitive" mode is just "generate many, vote on best" — simplest possible pattern
- No established patterns used: no hierarchical delegation, no blackboard architecture, no map-reduce

**What to learn:**
- Orchestration patterns (hierarchical, peer-to-peer, blackboard, actor model)
- Task decomposition for multi-agent distribution
- When multi-agent is worth the overhead vs. single-agent

---

### 19. Fine-Tuning Awareness
**ROI: 6/10 | Prerequisites: Topics 6, 7, 15 | Estimated time: 5-6 hours**

**Your data evidence:**
- All model usage is inference-only — no training, fine-tuning, LoRA, or adaptation
- The entire aesthetic evaluation apparatus (4 critics, 3 scoring engines) exists because base models can't evaluate creative quality — a fine-tuned model could collapse this
- The AestheticModel is a "taste predictor" using heuristics, not learned weights

**What to learn:**
- Transfer learning fundamentals
- LoRA/QLoRA techniques (efficient fine-tuning)
- Dataset curation for fine-tuning

---

### 20. AI API Design: Beyond generate()
**ROI: 5/10 | Prerequisites: Topic 6 | Estimated time: 3-4 hours**

**Your data evidence:**
- LLMClient has one method: `generate(systemPrompt, userPrompt)` — the simplest possible API
- No streaming, no function calling, no structured output, no tool use
- Hand-built routing, rate limiting, and circuit breakers that provider APIs could handle
- OpenRouter (2 mentions) barely explored despite solving model selection problems

**What to learn:**
- Streaming API patterns
- Function calling / tool use APIs
- Structured output (JSON mode)
- Rate limiting and token counting

---

## TIER 5: NICE-TO-HAVE (Lower Immediate ROI)

---

### 21. Debugging Methodology: Root Cause vs. Symptom Fixing
**ROI: 6/10 | Estimated time: 2-3 hours**

**Evidence:** "debug" appears 1 time in intents. "fix" appears 66 times. You fix symptoms 66x more than you investigate causes. Your frustration pattern is always "this is wrong, fix it" — never "why is this wrong, investigate."

### 22. Continuous Documentation
**ROI: 6/10 | Estimated time: 1-2 hours**

**Evidence:** 31 days with near-zero documentation, then 53 doc commits on the final day. The "THE BIBLE" was paid off as massive lump-sum debt rather than continuous investment.

### 23. Debugging Overcompensation: The AHA Principle
**ROI: 6/10 | Estimated time: 1-2 hours**

**Evidence:** `check-overcomplication.js` blocks premature abstractions. Cursor touched generators, GUI, TUI, tests, config, docs — everything at once, nothing deeply. Agents over-abstract; the fix is structural enforcement.

### 24. Release Management
**ROI: 4/10 | Estimated time: 2-3 hours**

**Evidence:** "deploy" appears 1 time in 696 intents. One version milestone (0.1.0.0) in 32 days. Local-first project with no users — low immediate need but critical for future projects.

---

## PREREQUISITE CHAIN MAP

```
Topic 1 (Wiring) ──────────────────────┐
     │                                   │
     ├──→ Topic 2 (Test-First) ─────────┤
     │        │                          │
     │        ├──→ Topic 11 (Refactoring)│
     │        ├──→ Topic 17 (Evaluation) │
     │        └──→ Topic 10 (Val Gates) ─┤
     │                │                  │
     │                └──→ Topic 12 (Review)
     │                └──→ Topic 14 (CI/CD)
     │                                   │
Topic 3 (Specs) ────────────────────────┤
     │                                   │
     ├──→ Topic 9 (Prompt Eng)           │
     └──→ Topic 4 (Hooks) ──────────────┤
              │                          │
              ├──→ Topic 5 (Verification)│
              ├──→ Topic 13 (Context)    │
              └──→ Topic 8 (Hallucination)
                                         │
Topic 6 (Model Selection) ──────────────┤
     │                                   │
     ├──→ Topic 7 (Local Deploy)         │
     ├──→ Topic 15 (RAG)                 │
     └──→ Topic 18 (Multi-Agent)         │
              └──→ Topic 19 (Fine-Tuning)
     └──→ Topic 20 (API Design)
                                        
Topic 16 (Plan-First) ─── no prerequisites, can start anytime
```

---

## RECOMMENDED LEARNING ORDER (First 30 Days)

**Week 1 (Highest leverage, immediate impact):**
- Day 1-2: Topic 16 (Plan-First) + Topic 1 (Wiring) — these are mindset shifts, not knowledge acquisition
- Day 3-4: Topic 3 (Specs) + Topic 13 (Context Inversion) — refine your agent communication
- Day 5-7: Topic 2 (Test-First) — the hardest habit to build, start early

**Week 2 (Build structural enforcement):**
- Day 8-9: Topic 4 (Hooks) — encode lessons as infrastructure
- Day 10-11: Topic 5 (Verification) + Topic 10 (Validation Gates)
- Day 12-14: Topic 14 (CI/CD) — convert hooks to permanent pipeline

**Week 3 (Expand AI knowledge):**
- Day 15-16: Topic 6 (Model Selection) + Topic 7 (Local Deploy)
- Day 17-18: Topic 8 (Hallucination) + Topic 9 (Prompt Engineering)
- Day 19-21: Topic 15 (RAG) — apply to Compost Mill

**Week 4 (Strategic improvements):**
- Day 22-23: Topic 11 (Refactoring) + Topic 12 (Code Review)
- Day 24-25: Topic 17 (Evaluation) — fix the triple scoring problem
- Day 26-28: Topic 18 (Multi-Agent) — if building agent systems
- Day 29-30: Topic 20 (API Design) + Topic 19 (Fine-Tuning) awareness

---

## KEY METRIC: HOW TO KNOW THE CURRICULUM IS WORKING

Track these numbers before and after:

| Metric | Your Current Data | Target After 30 Days |
|--------|-------------------|---------------------|
| test: commits ratio | 1.4% (4/294) | >15% |
| refactor: commits ratio | 2.4% (7/294) | >10% |
| msg/commit ratio | 9.90 (worst) → 0.85 (best) | <2.0 consistently |
| Frustration events per session | 12 total across 58 sessions | <1 per 5 sessions |
| Unwired modules at session end | Required 3 hooks to enforce | 0 by inspection |
| Correction cycles per task | 2-3 (estimated from Era 4) | <1 |

---

*Generated from archaeological mining of 30+ data files across 2.3MB of telemetry. Every gap is backed by your actual behavioral data. Every recommendation is tied to a specific frustration, rework event, or token waste pattern that would have been prevented.*
