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

### 9) `src/prompts/audio.ts` and `src/prompts/aesthetic.ts`
**Surface(s):** `audio.voice-to-visual`, `aesthetic.constraints`
**Why medium leverage:** frequently rendered PromptLibrary templates.
**Issues found:** both templates used `{{var}}` placeholders even though `PromptLibrary.render()` only interpolates `${var}`.
**Action:** fixed the template syntax, bumped versions, and added a regression guard to ensure PromptLibrary templates stay on the supported interpolation format.

### 10) `src/llm/PromptBuilder.ts` and `src/llm/LLMClient.ts`
**Surface(s):** medium/local/tiny tier prompt builders and the small-model `generateP5Sketch()` fallback
**Why medium/high leverage:** these are the non-PromptLibrary fallback paths used when model capability is limited.
**Issues found:** prompt structure was less consistent than the audited primary prompt surfaces and used looser ad-hoc section formatting.
**Action:** standardized those fallback prompts around explicit tags and a tighter code-only contract so lower-capability paths follow the same structured guidance pattern as the main prompt library.

### 11) `src/prompts/hydra.ts`
**Surface(s):** `hydra.generate`
**Why medium leverage:** large domain prompt with dense API guidance.
**Issues found:** prompt text treated `.speed()` like a chain method and listed `color()` as a source, which does not match current Hydra docs.
**Action:** corrected the API guidance, added a `GLOBAL SETTINGS` section for `speed`/`bpm`, and added a regression guard test.

### 12) `src/prompts/blog-to-video.ts`
**Surface(s):** `blog.script`, `blog.spec`
**Why medium leverage:** long-context narrative prompts with large structured user inputs.
**Issues found:** the prompts were not obviously incorrect, but they passed large user payloads as loose markdown instead of explicit labeled sections.
**Action:** wrapped the variable input payloads in explicit XML-style tags so theme/context/script/options are easier for the model to segment and for future evals to reason about.

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

## Ranked ROI view after the audit

This is the final ranking view I used after the code changes above were landed and verified.

| Rank | Surface | Why it ranked here | Outcome |
|---:|---|---|---|
| 1 | `src/harness/prompts/self-improve.ts` | Central autonomous harness path; highest leverage prompt in repo | **Fixed** |
| 2 | `src/prompts/p5.ts` | Core generation path with direct contradiction risk | **Fixed** |
| 3 | `src/prompts/three.ts` | Core generation path with framework-accuracy risk | **Fixed** |
| 4 | `src/prompts/glsl.ts` | Core generation path with contradiction + prompt bloat | **Fixed** |
| 5 | `src/prompts/remotion.ts` | Core generation path; weaker prior-code separation | **Fixed** |
| 6 | `src/prompts/specialized/chat.ts` | General assistant path; real template bug + weak structure | **Fixed** |
| 7 | `src/prompts/specialized/evaluation.ts` | Downstream scoring stability surface | **Fixed** |
| 8 | `src/prompts/collaboration.ts` / `src/prompts/collab-internal.ts` | Repeated critique surfaces in collaboration flow | **Fixed** |
| 9 | `src/prompts/audio.ts` / `src/prompts/aesthetic.ts` | Real PromptLibrary interpolation bugs | **Fixed** |
| 10 | `src/llm/PromptBuilder.ts` / `src/llm/LLMClient.ts` fallback prompts | High leverage for lower-capability / fallback model paths | **Fixed** |
| 11 | `src/prompts/hydra.ts` | Large, domain-heavy, but no concrete contradiction or wiring defect found | **Audited; deferred** |
| 12 | `src/prompts/blog-to-video.ts` | Very large prompt surfaces, but structure appears intentionally spec-heavy; needs eval-led changes, not taste edits | **Audited; deferred** |
| 13 | `src/prompts/music.ts` | Strong syntax grounding; only one contradiction was fixed in the first slice | **Partially fixed; otherwise stable** |
| 14 | compost / swarm / persona micro-prompts | Small surfaces, low token cost, low defect risk | **Audited; no change needed** |

## Final remaining-surface finding

After the fourth slice, a stricter prompt sweep did **not** reveal any additional high-ROI bugs on the remaining prompt surfaces. The unresolved opportunities are now mostly architectural or eval-driven:

- move more JSON-shaped prompts to schema-native structured outputs
- add prompt-lint / eval automation across the full PromptLibrary
- run targeted evals before trimming the large narrative/Hydra prompts

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

### F. The same wiring bug class existed in multiple PromptLibrary templates
The third slice confirmed the placeholder mismatch was systemic, not isolated: `audio.voice-to-visual` and `aesthetic.constraints` used the same unsupported `{{...}}` syntax. Those were fixed and covered by an audit-level regression test.

### G. The fallback path now matches the primary prompt strategy more closely
After the first three slices, the remaining quality gap was not a direct bug but an architectural inconsistency: fallback prompts in `PromptBuilder` and `LLMClient` were less structured than the main audited prompt surfaces. The fourth slice aligned them with the same explicit-tag, code-only style for better stability across model tiers.

### H. One remaining domain prompt still had an accuracy bug
The stricter final sweep found one more concrete issue in `hydra.generate`: the prompt described `.speed()` as though it were a chain method and misclassified `color()` as a source function. That was fixed with a narrow, source-backed patch instead of a broad stylistic rewrite.

### I. The narrative prompts benefited from structure, not content churn
For `blog.script` and `blog.spec`, the best improvement was not to rewrite the prompt philosophy but to make the long user-provided inputs more legible with explicit tags. This keeps the intent stable while improving long-context segmentation and future evalability.

## Follow-up backlog after this pass

1. Add a prompt-lint/eval layer for all PromptLibrary surfaces, not just targeted tests.
2. Split large prompts like `blog.script` / `blog.spec` into smaller mode-specific templates if runtime evidence shows they are latency or consistency hotspots.
3. Migrate chat/eval/collaboration prompts from “JSON requested in text” to native structured outputs where those call sites support it.
4. Normalize fallback prompts in `PromptBuilder` and `LLMClient` around a smaller stable-prefix contract.

## Verification expected for this audit

- Prompt-focused unit tests
- TypeScript build / typecheck
- Prompt inventory review in this worktree only
