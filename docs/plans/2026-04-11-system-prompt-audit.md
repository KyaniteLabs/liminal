# System Prompt Audit — Liminal

**Date:** April 11, 2026
**Scope:** `liminal` repository only
**Worktree:** `.worktrees/agent-prompt-audit-20260411`
**Branch:** `agent-prompt-audit-20260411`

## Why this audit exists

This pass audits Liminal's system-prompt surfaces for three things:

1. **Quality** — clarity, non-contradiction, stable behavior, and good separation of role vs. task.
2. **Token efficiency** — avoid duplicated instructions, stale examples, and oversized low-yield prompt text.
3. **Accuracy** — remove technically wrong guidance and align prompts with current framework usage.

## Research basis used in this pass (current as of April 11, 2026)

The changes and recommendations below were grounded in current primary or official sources plus one recent research paper:

- OpenAI API docs navigation for **Prompt engineering**, **Structured output**, **Prompt caching**, **Prompt optimizer**, and **Reasoning best practices**: https://developers.openai.com/api/docs/guides/latest-model
- OpenAI guidance on prompt/version separation of concerns in the Assistants migration docs: https://platform.openai.com/docs/assistants/migration/playground%23.ejs
- OpenAI guidance to add discovered edge cases into grader evals as prompt changes ship: https://platform.openai.com/docs/guides/graders/
- Anthropic long-context prompting guidance: place long data high in context, structure with XML tags, ground in quotes: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips
- Anthropic XML-tag prompting guidance: https://docs.anthropic.com/es/docs/build-with-claude/prompt-engineering/use-xml-tags
- Recent research on reliability/stability of prompts in general-purpose systems: **Prompt Stability Matters** (arXiv:2505.13546): https://arxiv.org/abs/2505.13546
- Strudel API reference: https://strudel.cc/functions/intro/
- Hydra docs/examples surface: https://hydra.ojack.xyz/docs/ja/docs/learning/

### Practical rules extracted from those sources

- Prefer **shorter, non-contradictory prompts** over giant all-in-one prompts unless the added detail earns its keep.
- Keep **stable prompt prefixes** and move volatile task/context data later when possible.
- Prefer **clear structure** and delimiter tags over ad-hoc prose blobs.
- Separate **high-level behavior/constraints** from orchestration details.
- Back prompt changes with **tests/evals**, not taste alone.
- Optimize for **stability and consistency**, not just single-run quality.

## Audit rubric

Each surface was scored informally on:

- **Accuracy risk** — is any instruction technically wrong or stale?
- **Contradiction risk** — does the prompt tell the model to do incompatible things?
- **Token ROI** — does prompt length buy better behavior, or just repeat itself?
- **Leverage** — how central is the prompt to core generation or harness execution?

## Highest-ROI fixes landed in this pass

### 1) `src/harness/prompts/self-improve.ts`
**Surface(s):** `SELF_IMPROVE_SYSTEM_PROMPT`, `createAgentSystemPrompt()`
**Why high leverage:** central harness prompt; affects autonomous repair behavior.
**Issues found:** oversized examples, repeated tool prose, weaker failure/verification contract.
**Action:** compressed prompt, preserved tool contract, made verification and rollback expectations sharper.

### 2) `src/prompts/p5.ts`
**Surface(s):** `p5.generate`, `p5.improve`
**Why high leverage:** core creative domain; frequent generation path.
**Issues found:** direct contradiction between “raw JS only / no markdown” and “must be wrapped in a markdown code block”.
**Action:** removed contradiction, reduced duplication, kept core p5 constraints.

### 3) `src/prompts/three.ts`
**Surface(s):** `three.generate`
**Why high leverage:** core domain + accuracy bug.
**Issues found:** prompt mixed legacy global-script guidance with `examples/jsm` OrbitControls path, which is a modern module path.
**Action:** switched guidance to one consistent modern module/import-map pattern with `three/addons/controls/OrbitControls.js`.

### 4) `src/prompts/glsl.ts`
**Surface(s):** `glsl.generate`
**Why high leverage:** core domain + repeated prompt bloat.
**Issues found:** “raw code only” vs “single code block” conflict; oversized inline example code; arbitrary 1000-char requirement stronger than validator.
**Action:** removed contradiction, trimmed prompt, aligned minimum complexity guidance with validator floor (`800`).

### 5) `src/prompts/remotion.ts`
**Surface(s):** `remotion.generate`, `remotion.improve`
**Why high leverage:** core generation path; structured code transformations.
**Issues found:** code-block wording drift and weaker separation of prior code in the improve prompt.
**Action:** cleaned output contract and replaced fenced prior-code block with XML-style tags.

## Follow-up slice landed after initial pass

### 6) `src/prompts/specialized/chat.ts`
**Surface(s):** `CHAT_SYSTEM_PROMPT`, `buildChatPrompt()`, `chat.assistant`
**Why medium/high leverage:** general assistant surface; reused across chat interactions.
**Issues found:** unstructured ad-hoc context formatting and a real PromptLibrary interpolation bug (`{{userPrompt}}` instead of `${userPrompt}`).
**Action:** switched to explicit XML-style context tags, tightened the system prompt, and fixed prompt-template interpolation.

### 7) `src/prompts/specialized/evaluation.ts`
**Surface(s):** `buildEvaluationPrompt()`
**Why medium leverage:** evaluation stability matters for downstream scoring and prompt iteration.
**Issues found:** less structured prompt framing around code/context.
**Action:** moved the user-facing evaluation payload to explicit `<evaluation_context>` and `<generated_code>` sections for better parser/model stability.

### 8) `src/prompts/collaboration.ts` and `src/prompts/collab-internal.ts`
**Surface(s):** critic and domain-expert role prompts
**Why medium leverage:** repeated analysis prompts in collaborative pipelines.
**Issues found:** “Think step by step” phrasing added token cost and invited hidden reasoning without improving the output contract.
**Action:** replaced that wording with concise, evidence-backed analysis requirements and kept the rubric intact.

## Full inventory coverage

All prompt surfaces below were reviewed in this audit.

| Area | Prompt surface(s) audited | Priority | Result |
|---|---|---:|---|
| Harness | `SELF_IMPROVE_SYSTEM_PROMPT`, `createAgentSystemPrompt()` | High | **Fixed now** |
| Generator: p5 | `p5.generate`, `p5.improve` | High | **Fixed now** |
| Generator: GLSL | `glsl.generate` | High | **Fixed now** |
| Generator: Three.js | `three.generate` | High | **Fixed now** |
| Generator: Remotion | `remotion.generate`, `remotion.improve` | High | **Fixed now** |
| Generator: Hydra | `hydra.generate` | Medium | Audited; keep for now; future token trim possible without changing behavior |
| Generator: Music | `music.strudel`, `music.p5-webaudio` | Medium | Audited; syntax grounding is strong; no urgent correctness issue found |
| Generator: Audio | `audio.voice-to-visual` | Medium | Audited; concise enough; no immediate contradiction found |
| Narrative | `blog.script`, `blog.spec` | Medium | Audited; very large, but the extra structure appears intentional; defer trimming until eval data exists |
| Aesthetic / Eval | `aesthetic.constraints`, `eval.heuristic-persona`, `EVALUATION_SYSTEM_PROMPT` | Medium | Audited; future opportunity is schema-driven outputs and leaner repeated instructions |
| Specialized chat | `chat.assistant`, `CHAT_SYSTEM_PROMPT` | Medium | Audited; good grounding rules; future opportunity is native structured-output enforcement instead of prompt-only JSON |
| Specialized design | `DESIGN_SYSTEM_PROMPT` | Medium | Audited; useful constraint surface; future opportunity is smaller mode-specific prompt variants |
| Collaboration roles | `collab.role.creator`, `collab.role.visionary`, `collab.role.technical-critic`, `collab.role.artistic-critic`, `collab.role.domain-expert`, `collab.role.integrator`, `collab.role.refiner` | Medium | Audited; future opportunity is replacing free-form reviews with stricter schemas |
| Collaboration internal | `collab.synthesis`, `collab.scoring`, `collab.analysis`, `collab.refine`, `collab.generation`, `collab.generation.alternative` | Medium | Audited; no urgent correctness defect found |
| Swarm personas | `swarm.persona.kai`, `swarm.persona.nova`, `swarm.persona.rex`, `swarm.persona.sam`, `swarm.persona.max`, `swarm.voting` | Low | Audited; intentionally stylized, low token cost, low urgency |
| Compost | `compost.extract-code`, `compost.extract-image`, `compost.collision-merge`, `compost.offspring-scoring`, `compost.digest-narrative`, `compost.seed-extraction`, `compost.synthesis` | Low | Audited; concise and fit-for-purpose |
| Supporting prompt builders | `PromptBuilder`, `LLMClient.generateP5Sketch()` fallback prompt | Medium | Audited; note future opportunity to unify fallback wording and stable-prefix caching patterns |

## Repo-level findings

### A. Most valuable bug class found: **prompt self-contradiction**
The biggest direct failures were not “weak taste” issues; they were prompts that simultaneously asked for **raw code only** and a **markdown/code block**. Those contradictions are cheap to remove and high ROI.

### B. Most important accuracy defect found: **stale/incorrect framework guidance**
The Three.js prompt had the highest accuracy risk because it blended modern `jsm` guidance with a non-module global-script setup.

### C. Most important efficiency defect found: **oversized low-yield prompt sections**
The harness self-improvement prompt carried too much example/tutorial mass relative to the live task loop.

### D. Biggest remaining opportunity: **schema-native outputs instead of prompt-only JSON promises**
Several prompts still ask for JSON in prose. The next highest-ROI follow-up is to move more of those surfaces to native structured output or stricter parser-backed schemas where runtime architecture allows it.

### E. Verification surfaced a real prompt wiring bug
The second audit slice found a production bug rather than a style issue: `chat.assistant` was registered with `{{userPrompt}}`, but `PromptLibrary.render()` only interpolates `${...}` placeholders. The audit fixed that bug and added a guardrail test so it cannot regress silently.

## Follow-up backlog after this pass

1. Add a prompt-lint/eval layer for all PromptLibrary surfaces, not just targeted tests.
2. Split large prompts like `blog.script` / `blog.spec` into smaller mode-specific templates if runtime evidence shows they are latency or consistency hotspots.
3. Migrate chat/eval/collaboration prompts from “JSON requested in text” to native structured outputs where those call sites support it.
4. Normalize fallback prompts in `PromptBuilder` and `LLMClient` around a smaller stable-prefix contract.

## Verification expected for this audit

- Prompt-focused unit tests
- TypeScript build / typecheck
- Prompt inventory review in this worktree only
