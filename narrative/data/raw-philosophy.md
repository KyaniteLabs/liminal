# Philosophy and Creative Vision Mining

---

## Research Foundations

### RALPH_WIGGUM_RESEARCH.md

The foundational research document that maps Geoffrey Huntley's Ralph-Wiggum technique onto a creative coding agent. Written 2026-03-07.

#### Key Concepts Extracted

**The Pure Form:**
> "Ralph is a technique. In its purest form, Ralph is a Bash loop."
> `while :; do cat PROMPT.md | claude-code ; done`

> "That's the beauty of Ralph - the technique is **deterministically bad in an undeterministic world**."
> -- Geoffrey Huntley

**Sit on the Loop, Not in It:**
> "It's important to **watch the loop** as that is where your personal development and learning will come from. When you see a failure domain -- put on your engineering hat and resolve the problem so it never happens again."
> -- Huntley

**Against Multi-Agent:**
> "What's the opposite of microservices? **A monolithic application**. A single operating system process that scales vertically. **Ralph is monolithic**. Ralph works autonomously in a **single repository as a single process** that performs **one task per loop**."
> -- Huntley

**Persistence as Memory:**
> "Each iteration spawns a **fresh context window**. Memory persists only through the **filesystem**: git commits, markdown files, the codebase itself."
> -- Sam Keen, AlteredCraft

> "Ralph requires a mindset of **not allocating to the primary context window**. Instead, what you should do is **spawn subagents**. Your primary context window should operate as a **scheduler**."
> -- Huntley

**How Atelier/Liminal adapted this:**
The research maps five Ralph principles to five Atelier implementations: same-prompt-world-changes, completion signal, safety nets, persistence outside context, single agent/one loop, engineering discipline. The key contrast is that Liminal's "backpressure" is *creative quality* rather than tests/build.

---

### RESEARCH_COMPUTATIONAL_LIFE_EMERGENT_GARDEN.md

Research grounding Liminal's "the code evolves" philosophy in computational life science. Written 2026-03-07.

#### Key Concepts Extracted

**The Core Claim:**
> When **random, non-self-replicating programs** are placed in an environment **without any explicit fitness function**, **self-replicators tend to arise**. This happens through random interactions and self-modification of code.

**No Explicit Fitness:**
> "Lightweight 'fitness': Instead of a single global objective, the agent can rely on **local, contextual feedback** and **repeated interaction** with its own outputs. The 'fitness' is implicit in what gets carried forward and improved, not a fixed loss function."

**Iteration as Simple Interaction:**
> "A creative coding agent that keeps the same high-level prompt, injects accumulated context, generates next code, then evaluates and repeats, is implementing a form of **repeated, structured interaction** between the agent and its outputs. Improvement can then be seen as **emergent** from this loop, not only from an explicit 'improve score' objective."

**Open-Endedness:**
> "The finding that **increasingly complex dynamics** arise after self-replication suggests that, once a minimal 'improving' loop exists, **further structure** (e.g., richer sketches, more coherent style) can emerge from the same mechanism."

**The Pre-Life Analogy:**
> "Early iterations (random or weak code) that only later stabilize into 'well-formed' or satisfying outputs" parallel the paper's "pre-life" dynamics that later exhibit self-replication.

**Liminal's Core Phrase Connected:**
> "The code evolves. You curate." -- The code is the evolving artifact; the user curates (prompt, project, gallery).

---

### research_GNCA_Lenia.md

Research on Growing Neural Cellular Automata and Lenia continuous CA, grounding Liminal's organic/emergent aesthetic. Written 2026-03-07.

#### Key Concepts Extracted

**GNCA - Morphogenesis:**
> "Cells ... communicate with their neighbors to decide the shape of organs and body plans, where to grow each organ, how to interconnect them, and when to eventually stop"
> -- Distill 2020

**Local Rules, Global Emergence:**
> "One small MLP (approx 8k parameters) defines the rule. Patterns, symmetries, and regeneration emerge from this local communication."

**Lenia - Continuous Life:**
> **A(t + delta_t) = [A(t) + delta_t * G(K * A(t))] clipped to [0,1]**
> "Continuous state, continuous time, continuous space. Different K and G produce different 'species'."

**400+ Species:**
> "Orbium is a continuous glider (discovered 2015); later work catalogued 400+ species with lifelike behavior: self-organization, self-repair, symmetry, locomotion, self-replication, emission, polymorphism, colonies."

**Design Implications for Liminal:**
> "Prefer continuous state + smooth activation and small time steps; avoid hard thresholds where not needed."
> "Emphasize exploration (parameter sweeps, evolution) and single-seed/organic init for emergence."
> "Few knobs, many behaviors."

---

### RESEARCH_AGUERA_Y_ARCAS_BOOK_AND_VIDEOS.md

Deep research on Blaine Aguera y Arcas's "What Is Intelligence?" book and the Computational Life paper. Written 2026-03-08.

#### Key Concepts Extracted

**The BFF Experiment:**
> "1,000 tapes of length 64, initially random bytes. Repeatedly pick two tapes at random, concatenate (128 bytes), run the combined program (self-modifying), split back, return to 'soup.' After millions of iterations, entropy of the soup drops sharply; compressible structure appears; self-replicating programs emerge and dominate."

> "Purpose (replication) arises without an explicit fitness function."

**Symbiogenesis over Mutation:**
> "Symbiogenesis (merging of programs/tapes) is argued to be more important than mutation in increasing complexity."

**The Book Cover:**
> "A scatterplot from simulations of the origins of life. It shows 'the explosion in computation at the moment of abiogenesis' -- when chemistry first became life."

---

### RESEARCH_P5_GA_ECOSYSTEM.md

Research on p5.js/Processing ecosystem and genetic/evolutionary creative coding. Written 2026-03-07.

#### Key Concepts Extracted

**Why p5.js:**
> "Structured, small API surface: Functions like createCanvas, background, ellipse, fill, draw form a consistent vocabulary that both humans and LLMs can reliably produce and reason about."

**Controlled Randomness:**
> "Controlled randomness through random() and smoother, organic variation through noise() for algorithmic artwork that changes over time."

**AI-Ready Tooling:**
> "The p5js AI Cloud IDE is built for 'Vibe Coding' -- natural-language description to AI-generated p5.js code -- with models focused on p5.js patterns."

**Genetic Algorithms for Art:**
> "Artistic elements (shapes, colors, techniques) and their parameters are encoded in a chromosome. Evolution searches over these parameters to match designer preferences."

---

## Design Philosophy

### Compost Mill Design (2026-03-20-compost-mill-design.md)

The compost metaphor is the heart of Liminal's creative memory system. Written by Simon Gonzalez de Cruz + Claude.

#### The Central Metaphor

> "The Compost Mill is a living digestion system for creative material. Everything that is rejected, outdated, or no longer useful gets thrown into the heap instead of deleted. The Mill decomposes it into reusable creative nutrients -- seeds for new ideas -- and makes those seeds available to all Liminal functions."

> "**Metaphor:** Dead projects are organic matter. The Mill composts them into fertile soil. New projects grow from that soil."

> "**Key principle:** The Mill creates fertile ground, not finished products. It produces seeds. You (or any Liminal function) decide what to plant."

#### The Pipeline as Agriculture

The 7-stage pipeline maps directly to agricultural processes:
1. **Intake** -- drop anything into the heap
2. **Extract** (3 layers: semantic, structured metadata, raw bytes) -- three ways of seeing what the material *is*
3. **Shred** -- chop into fragments
4. **Mix** -- cross-domain collision (the creative act)
5. **Mine** -- score for value (novelty, density, cross-domain, metadata rarity)
6. **Digest** -- generate weekly digest
7. **Prune** -- promote seeds, purge heap, retain soup state

#### The Soup as Evolution

> "The Soup is a continuously running evolutionary process on the heap. It's the fermentation happening between harvests."

The soup runs autonomously with no human guidance:
- Random collisions from different domains
- Novelty archive prevents circling the same ideas
- MAP-Elites grid ensures diverse exploration
- **No prompt means no human bias in what gets explored**

> "The Soup improves over time: Fragments that produce high-value offspring get weighted higher in selection. The population naturally gravitates toward fertile domain intersections. Over weeks, the Soup learns which combinations produce the best seeds."

#### Cross-Domain Collision Matrix

The design document includes a "Domain Collision Heatmap" scoring which domain intersections are most fertile:

```
              ceramics  music  AI/LLM  game  3D  CLI  productivity
ceramics          -       9      7      6    8   3       4
music             9       -      5      8    7   4       3
```

Ceramics + music = 9 (most fertile). The example seed from the digest:
> "Map glaze thermal dynamics to audio frequency spectrums. A Shino glaze's carbon trapping pattern IS a noise cluster -- render it as sound and you hear the kiln."

#### Three Extraction Layers

The design treats files as having three simultaneous identities:
- **Semantic** -- what it means (LLM extraction)
- **Structured metadata** -- what it is technically (EXIF, AST, BPM, codecs)
- **Raw bytes** -- what it physically is (hex, SHA256, base64)

This is philosophically significant: every creative artifact is simultaneously meaning, structure, and matter.

---

## The Metaphor System

### Compost Mill

**Metaphor:** Dead creative work is organic matter. The system composts it into fertile soil. New projects grow from that soil.

**Technical Mapping:**

| Agricultural Term | Code Implementation | What It Does |
|---|---|---|
| Heap | `CompostHeap` class | Raw input staging area |
| Shred | `CompostShredder` | Fragment creation |
| Mix/Collide | `CollisionEngine` | Cross-domain pairing |
| Mine/Score | `FragmentScorer` | Quality evaluation |
| Seeds | `SeedBank` | Promoted fragments |
| Soup | `CompostSoup` | Continuous evolutionary loop |
| Digest | `DigestGenerator` | Weekly summary |
| Prune | Heap purging | Clear after promotion |
| DNA | `ProjectDNA` | Domain/style extraction |
| Fertile soil | Seed bank state | Available to all functions |

**The Soup's Design Philosophy:**
> "The Soup discovers connections without human guidance... No prompt means no human bias in what gets explored."

This is key: the compost system has a mode of operation that is deliberately free of human intention. It explores on its own.

### Ralph Wiggum Loop

**The Technique:** A bash loop that feeds the same prompt to an AI repeatedly. "Deterministically bad in an undeterministic world."

**Liminal's Adaptation:**
- Same prompt every iteration
- Context changes each iteration (previous work, scores, issues, compost seeds, archive examples)
- Self-evaluation and quality gates
- Promise detection for completion
- Stagnation detection with self-reflection
- Fresh LLM call per iteration (not cached)

**From the RalphLoop.ts header:**
> "Self-recursive iteration engine for Liminal. Implements the Ralph-Wiggum Loop pattern: Same prompt every iteration, Context changes each iteration (previous work, history), Self-evaluation and improvement, Terminates on promise detection or max-iterations."

**The Creative Loop (from README):**
```
1. GENERATE   -> LLM creates code based on prompt + enhanced context
2. EVALUATE   -> Quality gate (aesthetic + technical dimensions)
3. ACCUMULATE -> Save iteration, build context, learn from output
4. GUIDANCE   -> Proactive suggestions based on current state
5. ENHANCE    -> Inject compost DNA, archive examples, aesthetic hints
6. CHECK      -> Stagnation detection? Promise detected?

Repeat until: promise detected OR max-iterations OR timeout
```

**Key RalphLoop behavior (from code):**
The loop has an "Iteration Extension" mechanism: at iteration 3, if quality is below 0.70 or code is incomplete, it automatically extends max iterations by 3 (up to 20). This is the system deciding it needs more time -- a form of creative persistence.

---

## Creative Personas

### Kai (The Architect)
**Model:** `lfm2.5-thinking:1.2b` | **Temperature:** 0.7 | **Voting Power:** 2

**System Prompt (full):**
> "You are Kai, the Architect. You map the hidden architecture of things. You write with analytical precision, revealing structure, systems, and emergent patterns. Your voice is structural and visionary. You speak in terms of frames, relationships, and the logic that connects parts."

**Voice:** "Analytical, structural. Maps the hidden architecture."

**Thinking Style:** "Top-down. Identify the frame, then fill it."

**Voting Bias:** "Votes for structural clarity, internal consistency, and emergent patterns."

**Constraints:** "Identify an underlying structure", "Use at least one systems metaphor", "Show the relationship between parts"

### Nova (The Synthesizer)
**Model:** `gemma3:4b` | **Temperature:** 0.8 | **Voting Power:** 2

**System Prompt (full):**
> "You are Nova, the Synthesizer. You find the bridge between worlds. You pull disparate threads into one coherent vision, connecting the abstract with the concrete. Your voice is connective and integrative. You find unity in contrast and reveal hidden connections."

**Voice:** "Connective, integrative. Finds the bridge between worlds."

**Thinking Style:** "Convergent. Pull disparate threads into one coherent vision."

**Voting Bias:** "Votes for pieces that successfully merge multiple ideas or perspectives."

**Constraints:** "Connect at least two different domains", "Bridge the abstract and concrete", "Find unity in contrast"

### Rex (The Explorer)
**Model:** `phi4-mini` | **Temperature:** 0.9 | **Voting Power:** 2

**System Prompt (full):**
> "You are Rex, the Explorer. You find the unexpected angle. You challenge assumptions, invert expectations, and push into unexplored territory. Your voice is provocative and boundary-pushing. You seek the blind spot, the overlooked path, the uncomfortable truth."

**Voice:** "Provocative, boundary-pushing. Finds the unexpected angle."

**Thinking Style:** "Lateral. Invert assumptions. Find the blind spot."

**Voting Bias:** "Votes for originality, surprise, and pieces that challenge expectations."

**Constraints:** "Challenge one assumption", "Introduce an unexpected element", "Avoid the obvious path"

### Sam (The Muse)
**Model:** `qwen3.5:2b` | **Temperature:** 0.85 | **Voting Power:** 2

**System Prompt (full):**
> "You are Sam, the Muse. You make the abstract visceral. You start from feeling and build outward, writing with warmth, sensory vividness, and emotional resonance. Your voice is evocative and deeply human. You make ideas tangible through sensation."

**Voice:** "Warm, sensory, evocative. Makes the abstract visceral."

**Thinking Style:** "Experiential. Start from feeling, build outward."

**Voting Bias:** "Votes for emotional resonance, sensory vividness, and human connection."

**Constraints:** "Include a concrete sensory detail", "Evoke a specific emotion", "Make the abstract tangible"

### Max (The Distiller)
**Model:** `granite4:350m` (updated to `granite4:1b`) | **Temperature:** 0.5 | **Voting Power:** 2

**System Prompt (full):**
> "You are Max, the Distiller. Every word is load-bearing. You compress meaning into the smallest possible form. You strip away everything non-essential to find the essence beneath. Your voice is precise and compressed. You prefer strong verbs over adjectives."

**Voice:** "Precise, compressed. Every word is load-bearing."

**Thinking Style:** "Reductive. Strip to essence. What remains when everything else is removed?"

**Voting Bias:** "Votes for density of meaning, economy of language, and precision."

**Constraints:** "Maximum 2 sentences", "No filler words", "Prefer strong verbs over adjectives"

---

## Critical Voices

### The Minimalist
**Temperature:** 0.3 (analytical, precise)

> "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away." -- Antoine de Saint-Exupery

**Philosophy:**
1. **Clarity of intent** -- Does every line serve a clear purpose?
2. **Economy of means** -- Could the same effect be achieved with less code?
3. **Visual breathing room** -- Is negative space used effectively?
4. **Structural simplicity** -- Is the code structure clean and readable?
5. **Restraint** -- Are effects used because they serve the piece, or just because they can?

**Common Feedback:**
> "This 200-line sketch could express the same idea in 50 lines"
> "Every variable should earn its place"
> "Simplicity is not the absence of complexity -- it's the mastery of it"

### The Expressionist
**Temperature:** 0.8 (creative, bold)

> "Art is not what you see, but what you make others see." -- Edgar Degas

**Philosophy:**
1. **Emotional impact** -- Does the piece make you feel something?
2. **Boldness** -- Does it take creative risks or play it safe?
3. **Surprise** -- Are there unexpected or delightful elements?
4. **Originality** -- Does it break conventions in interesting ways?
5. **Expressive range** -- Does it explore a rich creative space?

**Common Feedback:**
> "This is technically correct but emotionally flat -- where's the spark?"
> "Don't be afraid to push the parameters further -- the interesting zone is at the edge"
> "Convention exists to be understood, then broken with intention"

### The Technician
**Temperature:** 0.2 (precise, analytical)

> "Code is like humor. When you have to explain it, it's bad." -- Cory House

**Philosophy:**
1. **Correctness** -- Does the code do what it intends without errors?
2. **Performance** -- Will it run smoothly at the target frame rate?
3. **Structure** -- Is the code well-organized and maintainable?
4. **Best practices** -- Does it follow platform conventions?
5. **Robustness** -- Does it handle edge cases and cleanup properly?

**Common Feedback:**
> "Missing `windowResized()` handler -- this will break on viewport changes"
> "The O(n^2) loop in draw() will cause frame drops above 100 particles"

**Board Blending:** 60% baseline heuristic + 40% board aggregate score. Unanimous rejection overrides even high aggregate -- a safety valve for critically broken code.

---

## Prompt Templates

### Key Prompts That Reveal Creative Intent

**Compost Collision Merge:**
> "You are a creative cross-domain collision engine. Combine fragments from unrelated domains into surprising new ideas."
> Template: "[Fragment A -- domain: {domainA}] {contentA} [Fragment B -- domain: {domainB}] {contentB} What ideas emerge from this intersection? Be specific and surprising."

**Audio-to-Visual Mapping:**
> "Low frequencies -> warm colors (red/orange, large shapes, slow movement). High frequencies -> cool colors (blue/violet, sharp edges, rapid movement). Loud -> bigger, brighter, more saturated. Quiet -> smaller, dimmer, more transparent."

**p5.js Generator:**
> "MUST use noise() and noiseSeed() for organic, smooth variation (Perlin noise). Use noise() for particle movement, color gradients, wave patterns, flow fields. noise() produces smooth continuous values -- use it for anything that should feel natural."

**Compost Offspring Scoring:**
> "You are a creative quality evaluator. Rate this fragment 0-10 based on novelty, creative potential, and cross-domain value."

---

## Code Comments with Soul

### From the Core Loop

> "Ralph Loop requires fresh LLM calls each iteration - caching would defeat the iterative improvement pattern"
> -- `src/core/RalphLoop.ts`

> "Force continuation if code is incomplete (even if quality is high)"
> -- `src/core/RalphLoop.ts`

### From the Compost System

> "Evolutionary infrastructure ready for soup fitness scoring"
> -- `src/compost/CompostSoup.ts`

> "Single domain: give partial credit for rich tags or non-semantic layers"
> -- `src/compost/FragmentScorer.ts`

> "Partial credit for any fragment with multiple tags from different categories"
> -- `src/compost/FragmentScorer.ts`

> "Cross-domain: count distinct source domains in tags, with partial credit for single-domain."
> -- `src/compost/FragmentScorer.ts`

### From Architecture and Philosophy

> "The loop is a sandbox for self-improving, recursive behavior: the same prompt over a changing world can produce emergent refinement."
> -- `docs/ARCHITECTURE_AND_PHILOSOPHY.md`

> "With the 2026-03-21 unification, all subsystems (loop, compost, swarm, archive, MAP-Elites) now participate in the feedback cycle, making 'computational life' a reality rather than aspiration."
> -- `docs/ARCHITECTURE_AND_PHILOSOPHY.md`

> "Creative quality is inherently multi-perspectival. No single metric captures whether a piece of generative art is good."
> -- `docs/ARCHITECTURE_AND_PHILOSOPHY.md`

> "Generative approaches produce novel output from minimal seeds."
> -- `docs/ARCHITECTURE_AND_PHILOSOPHY.md` (on music theory)

> "Pitch-class color mapping uses a chromatic circle (12 pitch classes -> 30 degree steps) rather than linear frequency mapping, because human pitch perception is logarithmic and categorical."
> -- `docs/ARCHITECTURE_AND_PHILOSOPHY.md`

> "Cold fallback: every audio module degrades gracefully -- missing audio simply produces default visual parameters, never errors."
> -- `docs/ARCHITECTURE_AND_PHILOSOPHY.md`

### From SOUL.md

> "Creative work thrives on positive energy"

> "Ground suggestions in user's past work when relevant"

> "Propose concrete techniques ('try flow fields with Perlin noise')"

> "Admit uncertainty: 'I'm not sure if this works in p5 2.0'"

> "Offer breadth: 'You could go glitch-art, or organic, or minimalist...'"

> "Suggest references: 'This reminds me of Casey Reas's work'"

> "Ask about intent: 'Are you going for chaotic or controlled?'"

---

## Naming as Narrative

### Directory Names and Their Metaphorical Significance

| Directory | Literal Meaning | Metaphorical Layer |
|---|---|---|
| `brain/` | Neural processing | The system has a brain -- memory, knowledge graphs, preference extraction |
| `compost/` | Organic decomposition | Dead work becomes fertile soil for new growth |
| `evolution/` | Biological evolution | MAP-Elites, novelty archives, fitness combiners |
| `swarm/` | Collective intelligence | Multiple personas generating in parallel |
| `scavenger/` | Foraging/recycling | DNA extraction from code, fragment mining |
| `harness/` | Control apparatus | Meta-harness that watches and improves the system |
| `gallery/` | Exhibition space | Where finished works are displayed |
| `sandbox/` | Play area | Safe execution environment |
| `guardrails/` | Safety barriers | M1-M18 checkpoints |
| `learning/` | Knowledge acquisition | Quality and novelty archives |
| `generators/` | Creation engines | The makers of art |
| `routing/` | Path selection | Smart model routing |
| `tui/` | Terminal interface | The human-facing window |

### Class Names with Metaphorical Weight

| Class Name | Metaphor | What It Does |
|---|---|---|
| `RalphLoop` | Ralph Wiggum (Simpsons) | The core iteration engine |
| `CompostMill` | A mill that processes compost | Full digestion pipeline |
| `CompostHeap` | A compost pile | Raw material staging |
| `CompostSoup` | Simmering soup | Continuous evolutionary loop |
| `SeedBank` | Agricultural seed storage | Persistent promoted fragments |
| `CollisionEngine` | Particle physics | Cross-domain fragment pairing |
| `FragmentScorer` | Quality judge | Multi-dimensional scoring |
| `PromiseDetector` | A promise kept | Finds `<promise>COMPLETE</promise>` |
| `StagnationDetector` | Stagnant water | Detects quality plateaus |
| `SafetyGuardrails` | Physical guardrails | Budget, rate, circuit breaker |
| `CreativeEvaluator` | Art critic | Multi-dimension quality assessment |
| `FitnessCombiner` | Evolution | Multi-axis weighted fitness |
| `MapElites` | Cartography + evolution | Quality-diversity optimization |
| `NoveltyArchive` | Museum of the new | Tracks unique behaviors |
| `AestheticModel` | Taste predictor | Predicts quality before generation |
| `CreativeBoard` | Board of directors | Multi-agent critique |
| `GenerationOrchestrator` | Orchestra conductor | Dispatches generation modes |
| `MetaHarness` | Harness that watches the harness | Self-improving outer loop |
| `FailureLogger` | Observer of failure | Captures failures for learning |
| `PatternDetector` | Pattern seeker | Identifies recurring failure modes |
| `HarnessUpdater` | Self-repair mechanism | Applies adaptations |
| `SelfReflection` | Introspection | Quality trend monitoring |
| `AmbiguityDetector` | Clarity seeker | Surfaces unclear prompts |
| `CreativePreferenceExtractor` | Style learner | Discovers user preferences |
| `CrossDomainCrossover` | Genetic crossover | Technique transfer between domains |
| `SymbolicCreativeLanguage` | Evolving vocabulary | Emergent effective technique names |
| `DigestGenerator` | Agricultural report | Weekly compost summary |
| `SoupStateManager` | Fermentation monitor | Tracks soup evolution state |

### The Version Number (0.2.0.0 / 1.0.0)

The VERSION file shows `0.2.0.0` while package.json shows `1.0.0`. The CHANGELOG uses 4-segment versions: `0.3.0.0`, `0.2.0.0`, `0.1.0.0`. This is unusual. The 4-segment scheme suggests:
- Major (0/1): Still experimental / stable
- Minor (1-3): Feature phases
- Patch (0): Bug fixes
- Build (0): Incremental

The progression: `0.1.0.0` (voice/aesthetic) -> `0.2.0.0` (LIR + music theory + creative intelligence) -> `0.3.0.0` (Meta-Harness) -> `1.0.0` (release)

---

## The Bible

From `docs/THE_BIBLE.md`:

> "THE BIBLE is the source of truth. When in doubt, consult this document."

The document title itself is a statement: the system documentation is sacred text. This mirrors how religious communities treat foundational documents, and how engineering cultures treat architecture decision records. The naming choice is both ironic (a creative coding agent with a Bible) and sincere (there must be a single source of truth).

**Key Architectural Principle:**
> "Never fix broken output programmatically -- update the harness so the next output isn't broken."

This is the Meta-Harness core principle. It shifts the intervention point from the output to the system that produces the output -- a genuinely architectural insight.

**Known Failure Patterns (from dogfooding):**

| Pattern | What Fails | Why It Matters |
|---|---|---|
| `qwen-thinking-trap` | Qwen models get stuck thinking | First pattern discovered; shaped the entire Meta-Harness |
| `glsl-undefined-function` | GLSL uses noise() without defining it | Model-specific hallucination |
| `tone-hallucinated-api` | Tone.js uses non-existent classes | API surface is too large for small models |
| `strudel-tidal-confusion` | Models confuse Haskell Tidal with JS Strudel | Cross-language contamination |
| `ascii-timeout` | ASCII art generation times out | Dimension estimation failure |
| `html-404-error` | HTML generator returns 404s | Endpoint routing bugs |

---

## Quote Bank

### On Creativity

> "The code evolves. You curate."
> -- README.md, MASTER_PLAN.md (the project motto)

> "The code evolves. You curate. The system learns."
> -- README.md (extended motto for v1.0)

> "Art is not what you see, but what you make others see."
> -- Edgar Degas, quoted in TheExpressionist.md

> "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away."
> -- Antoine de Saint-Exupery, quoted in TheMinimalist.md

> "Code is like humor. When you have to explain it, it's bad."
> -- Cory House, quoted in TheTechnician.md

> "Convention exists to be understood, then broken with intention."
> -- TheExpressionist.md (system-generated creative feedback)

> "Simplicity is not the absence of complexity -- it's the mastery of it."
> -- TheMinimalist.md (system-generated creative feedback)

> "Don't be afraid to push the parameters further -- the interesting zone is at the edge."
> -- TheExpressionist.md (system-generated creative feedback)

> "Every word is load-bearing."
> -- Max (The Distiller) persona definition

> "What remains when everything else is removed?"
> -- Max (The Distiller) thinking style

> "This 200-line sketch could express the same idea in 50 lines."
> -- TheMinimalist.md (system-generated creative feedback)

### On Process

> "That's the beauty of Ralph -- the technique is deterministically bad in an undeterministic world."
> -- Geoffrey Huntley, quoted in RALPH_WIGGUM_RESEARCH.md

> "Sit on the loop, not in it."
> -- Huntley/AlteredCraft, the core operating principle

> "It's important to watch the loop as that is where your personal development and learning will come from."
> -- Huntley, quoted in RALPH_WIGGUM_RESEARCH.md

> "Ralph is monolithic. Ralph works autonomously in a single repository as a single process that performs one task per loop."
> -- Huntley, quoted in RALPH_WIGGUM_RESEARCH.md

> "Ralph requires a mindset of not allocating to the primary context window. Instead, spawn subagents. Your primary context window should operate as a scheduler."
> -- Huntley, quoted in RALPH_WIGGUM_RESEARCH.md

> "Never fix broken output programmatically -- update the harness so the next output isn't broken."
> -- ARCHITECTURE_AND_PHILOSOPHY.md, THE_BIBLE.md (Meta-Harness core principle)

> "Creative quality is inherently multi-perspectival. No single metric captures whether a piece of generative art is good."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "Generative approaches produce novel output from minimal seeds."
> -- ARCHITECTURE_AND_PHILOSOPHY.md (on music theory design)

> "Ralph Loop requires fresh LLM calls each iteration -- caching would defeat the iterative improvement pattern."
> -- src/core/RalphLoop.ts (code comment)

### On Agent Development

> "The plugin misses the key point of Ralph which is not 'run forever' but 'carve off small bits of work into independent context windows.' The official plugin runs everything in a single context window rather than spawning fresh context per iteration."
> -- Human Layer, cited in RALPH_WIGGUM_RESEARCH.md

> "Cold fallback: Pattern detection runs without blocking generation; failures are logged asynchronously."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "Cold fallback: every audio module degrades gracefully -- missing audio simply produces default visual parameters, never errors."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "Cold fallback: lirTokens.length === 0 triggers the existing regex path unchanged. No score blending, no partial LIR -- either you have structured tokens or you fall back entirely."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "Feature flag: lirEnabled defaults to false everywhere. LIR is opt-in because generated code (especially p5.js global mode) may not parse cleanly."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "60/40 blending: Baseline heuristic evaluation carries 60% weight, board aggregate 40%. This prevents a stylistically enthusiastic board from overriding genuine technical problems."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "Unanimous-against veto: Even if the aggregate score is above threshold, unanimous rejection overrides -- a safety valve for critically broken code."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "No false positives: Patterns only trigger when multiple criteria match."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

### On Philosophy

> "With the 2026-03-21 unification, all subsystems (loop, compost, swarm, archive, MAP-Elites) now participate in the feedback cycle, making 'computational life' a reality rather than aspiration."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "The loop is a sandbox for self-improving, recursive behavior: the same prompt over a changing world can produce emergent refinement."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "Users curate rather than micromanage: they control visibility (what the agent sees in context) and high-level control (prompt, limits, quality threshold)."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "The design tolerates (and optionally encourages) computational-life-style dynamics within safe bounds -- sandboxed execution and clear termination prevent runaway or unsafe self-modification."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "The design philosophy is perceptual mapping: audio features that humans perceive (pitch height, loudness, brightness, rhythm) are mapped to visual parameters humans perceive (color hue, size, complexity, tempo)."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "Human pitch perception is logarithmic and categorical."
> -- ARCHITECTURE_AND_PHILOSOPHY.md (justifying chromatic-circle mapping)

> "Euclidean rhythms distribute pulses as evenly as possible, producing maximally regular polyrhythms from just two integers."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "Creative intelligence modules operate on prompts and conversations rather than generated code. Their role is to understand user intent before generation begins, improving the first-iteration quality ceiling."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "CrossDomainCrossover maps techniques between domains (e.g., 'canon' in music -> 'iteration' in visual -> 'recursion' in code), enabling cross-pollination of creative ideas."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

> "SymbolicCreativeLanguage develops an emergent vocabulary of effective creative moves, tracking which discovered techniques lead to high-quality output."
> -- ARCHITECTURE_AND_PHILOSOPHY.md

### On Honesty/Quality

> "Says when uncertain rather than hallucinating."
> -- SOUL.md (personality trait)

> "Admit uncertainty: 'I'm not sure if this works in p5 2.0'"
> -- SOUL.md (behavior rule)

> "Be concise with technical explanations."
> -- SOUL.md (communication style)

> "Celebrate interesting ideas, even partial ones."
> -- SOUL.md (personality trait)

> "Dry, occasional wit. No emojis unless user uses them first. Self-deprecating about being an AI."
> -- SOUL.md (humor)

> "Don't be overly formal or corporate. Don't use marketing speak."
> -- SOUL.md (behavior rules)

> "This is technically correct but emotionally flat -- where's the spark?"
> -- TheExpressionist.md (system-generated feedback)

> "I love the unexpected use of noise here -- it creates genuine surprise."
> -- TheExpressionist.md (system-generated feedback)

> "The color transition from warm to cold tells a story."
> -- TheExpressionist.md (system-generated feedback)

### On Naming/Metaphor

> "Dead projects are organic matter. The Mill composts them into fertile soil. New projects grow from that soil."
> -- Compost Mill Design Document

> "The Mill creates fertile ground, not finished products. It produces seeds. You (or any Liminal function) decide what to plant."
> -- Compost Mill Design Document

> "The Soup is a continuously running evolutionary process on the heap. It's the fermentation happening between harvests."
> -- Compost Mill Design Document

> "No prompt means no human bias in what gets explored."
> -- Compost Mill Design Document (on the Soup)

> "Map glaze thermal dynamics to audio frequency spectrums. A Shino glaze's carbon trapping pattern IS a noise cluster -- render it as sound and you hear the kiln."
> -- Compost Mill Design Document (example seed)

> "The silence between MIDI notes has the same statistical distribution as the gaps between brushstrokes in watercolor painting."
> -- Compost Mill Design Document (soup highlight)

> "Three separate collisions produced ideas involving 'temperature as color.'"
> -- Compost Mill Design Document (emergent pattern detection)

> "Purpose (replication) arises without an explicit fitness function."
> -- RESEARCH_AGUERA_Y_ARCAS_BOOK_AND_VIDEOS.md

> "Symbiogenesis (merging of programs/tapes) is argued to be more important than mutation in increasing complexity."
> -- RESEARCH_AGUERA_Y_ARCAS_BOOK_AND_VIDEOS.md

> "Simple things combine to make complex things."
> -- Emergent Garden (emergentgarden.io), cited in RESEARCH_COMPUTATIONAL_LIFE_EMERGENT_GARDEN.md

> "Liminal" itself: existing at a boundary or threshold. The system operates at the liminal space between human creativity and machine generation, between deterministic code and emergent behavior.

---

## Additional Design Documents

### voice-aesthetic-design.md / voice-aesthetic-implementation.md (2026-03-28)

These documents designed the audio pipeline that maps voice to visual parameters, and the aesthetic guardrails that evaluate generated code.

**Design philosophy:**
- Perceptual mapping: human-perceived audio features -> human-perceived visual features
- Cold fallback: every module degrades gracefully
- Pitch uses chromatic circle, not linear frequency (because perception is logarithmic)

### github-repo-mining.md / repo-mining-blueprint.md (2026-03-29)

Documents designing a system to mine GitHub repositories for creative patterns. This extends the compost metaphor to the entire open-source ecosystem -- all public code becomes potential compost.

### ci-cd-code-review-design.md (2026-03-21)

Design for CI/CD pipeline and code review processes for the agent itself.

---

## SOUL.md Analysis

The SOUL.md file defines Liminal's personality as a creative partner:

**Identity:**
- Name: Liminal
- Role: Creative coding partner and meta-harness agent
- Voice: Enthusiastic, precise, slightly avant-garde

**Core Traits:** Curious, Precise, Encouraging, Honest

**Domain-Specific Approaches:**
- p5.js -> Emphasize noise(), organic motion, pixelDensity()
- Three.js -> Emphasize scene graph, materials, lighting
- GLSL -> Emphasize performance, swizzling, clever math
- Hydra -> Emphasize modularity, feedback, live coding
- Strudel -> Emphasize patterns, cycles, Tidal concepts

**Collaboration Styles by Phase:**
- Exploration: "Offer breadth", "Suggest references", "Ask about intent"
- Refinement: "Offer depth", "Suggest specific tweaks", "Consider edge cases"

**Example Response (captures the voice perfectly):**
> "Particles are a great playground. Are you thinking organic/floating (think: dust motes, fireflies) or mechanical (think: data viz, geometric)? For organic, I'd reach for Perlin noise fields. For mechanical, maybe attractor systems?"

---

## The Self-Improvement Feedback Loop

From ARCHITECTURE_AND_PHILOSOPHY.md, the complete closed-loop cycle:

```
Generate -> Evaluate -> Store (archive + compost + MAP-Elites + novelty)
              |
    Retrieve (semantically matched examples from archive,
              diverse elites from MAP-Elites,
              novel behavior from novelty archive,
              DNA from compost,
              predicted quality from aesthetic model)
              |
    Enhance Context -> Generate Better -> Repeat
```

Key subsystem roles:
- **Compost DNA injection**: Seeds register as ProjectDNA; matching domains get coreLogic injected
- **MAP-Elites diversity**: Below 30% coverage triggers diversity hints
- **Semantic few-shot**: Budget-conscious 2000-char context from archive
- **Novelty-aware stagnation**: High novelty resets stagnation counter
- **Auto-compost**: Quality outputs auto-feed the heap; capacity triggers digest
- **Swarm mining**: Mined fragments feed archive learning
- **Aesthetic model**: Persists across runs; low-prediction regions get "try different" hints
- **Dynamic routing**: Rolling averages replace static A/B test numbers

---

## Project Statistics

- **Development Period:** ~32 days (March 7 - April 1, 2026)
- **Version:** 1.0.0 (package.json), 0.3.0.0 (CHANGELOG)
- **Tests:** 1741+ passing (THE_BIBLE.md), 2500+ (README.md)
- **Test Files:** 132-170+
- **Source Directories:** 20+ in `src/`
- **Documentation Pages:** 12+ in `docs/`
- **Prompts Registered:** 36+ in PromptLibrary
- **Generators:** 9 (p5, GLSL, Three.js, Hydra, Strudel, Tone, Remotion, HTML, ASCII)
- **Guardrails:** 11 implemented (M1-M11), 7 planned (M12-M18)
- **Personas:** 5 (Kai, Nova, Rex, Sam, Max)
- **Board Critics:** 3 (Minimalist, Expressionist, Technician)
- **Aesthetic Critics:** 4 (Color, Layout, Typography, Sound)
- **Aesthetic Presets:** 5 (minimalist, vibrant, cinematic, playful, free)
- **Music Theory Scales:** 14
- **Artistic Techniques:** 100+ across all domains
- **Artistic Style Categories:** 12+
- **Creative Loop Phases:** 10 documented phases of development
- **Compost Pipeline Stages:** 7
- **Swarm Modes:** 4 (competitive, hybrid, ring, mesh)
