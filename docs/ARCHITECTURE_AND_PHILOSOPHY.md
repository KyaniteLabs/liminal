# Architecture and Philosophy

## Substrate

Liminal’s substrate is the fixed structure that drives each run: an optional prompt (which may include `{{context}}`), context injection from the accumulated world state, evaluation via the CreativeEvaluator, and termination via the promise string, max-iterations cap, and optional quality gate. Together these define how the agent sees the world and when it stops.

## Loop start

Each run begins with a human-supplied prompt and an optional seed. The prompt is stable across iterations; the seed can bootstrap initial code or parameters. The loop then repeatedly generates, evaluates, and accumulates until a termination condition is met. `RalphLoop.reset()` clears context between runs to prevent state bleed.

## Curation

Users curate rather than micromanage: they control visibility (what the agent sees in context) and high-level control (prompt, limits, quality threshold). The system is designed so that curation of prompts and parameters shapes outcomes without requiring low-level editing of generated code.

## Full GUI

The primary interface is a full graphical UI where users start runs, view iterations, inspect the gallery, and export results. The GUI exposes all LoopOptions: collaboration modes (swarm/deep/simple), evaluation strategies, MAP-Elites, archive learning, aesthetic model, auto-compost, stagnation detection, and merge-every-N. CLI and programmatic API remain available for automation and integration.

## Self-improvement feedback loop (updated 2026-03-21)

Liminal now implements a complete closed-loop self-improvement cycle:

```
Generate → Evaluate → Store (archive + compost + MAP-Elites + novelty)
                ↓
    Retrieve (semantically matched examples from archive,
              diverse elites from MAP-Elites,
              novel behavior from novelty archive,
              DNA from compost,
              predicted quality from aesthetic model)
                ↓
    Enhance Context → Generate Better → Repeat
```

Key subsystems and their roles:
- **Compost DNA injection**: Promoted seeds register as ProjectDNA in GeneratorRegistry; when a prompt matches a DNA’d domain, coreLogic and example prompts are injected into generation context.
- **MAP-Elites diversity**: When coverage drops below 30%, diversity hints are injected into the next iteration’s context, driving exploration of under-explored behavior regions.
- **Semantic few-shot**: ArchiveLearning ranks examples by keyword overlap with the current prompt, budgets total context to 2000 chars, and truncates to key snippets.
- **Novelty-aware stagnation**: High novelty scores reset the stagnation counter — even when quality plateaus, the system is still exploring.
- **Auto-compost**: When enabled, quality outputs automatically feed back into the compost heap; when the heap reaches capacity, a digest is triggered automatically.
- **Swarm mining**: Mined fragments from swarm sessions feed into archive learning, closing the swarm→learning feedback loop.
- **Aesthetic model**: Persists across runs (saved to `~/.liminal/aesthetic_model.json`); predictions bias generation — low-prediction regions get "try different" hints, high-prediction regions get "lean in" guidance.
- **Dynamic routing**: Routing data updates from actual generation outcomes via rolling averages, replacing static A/B test numbers over time.

## Emergent recursion / computational life

The loop is a sandbox for self-improving, recursive behavior: the same prompt over a changing world can produce emergent refinement. The design tolerates (and optionally encourages) computational-life-style dynamics within safe bounds—sandboxed execution and clear termination prevent runaway or unsafe self-modification. With the 2026-03-21 unification, all subsystems (loop, compost, swarm, archive, MAP-Elites) now participate in the feedback cycle, making "computational life" a reality rather than aspiration.

## Cloud and local LLMs

Liminal supports both cloud and local LLM backends. Users can use a hosted API (e.g. Inception) for speed and quality or run fully local (e.g. Ollama) for privacy and offline use; the loop and substrate are backend-agnostic.

## Voice and audio pipeline (added 2026-03-29)

The audio pipeline transforms voice and audio signals into visual parameters that guide generation. The design philosophy is *perceptual mapping*: audio features that humans perceive (pitch height, loudness, brightness, rhythm) are mapped to visual parameters humans perceive (color hue, size, complexity, tempo).

Key design decisions:
- **Pitch-class color mapping** uses a chromatic circle (12 pitch classes → 30° steps) rather than linear frequency mapping, because human pitch perception is logarithmic and categorical.
- **Formant-to-shape mapping** estimates F1/F2 from MFCCs rather than requiring phoneme labeling, keeping the pipeline language-agnostic.
- **Cold fallback**: every audio module degrades gracefully — missing audio simply produces default visual parameters, never errors.

## Music theory engine (added 2026-03-29)

The music theory engine treats algorithmic composition as a constraint satisfaction problem: given a scale, rhythm, and structure template, generate melodies and progressions that are musically coherent. The design favors *generative* approaches (Euclidean rhythms, Markov chains) over *transformative* ones (variation, development) because generative methods produce novel output from minimal seeds.

Key design decisions:
- **Euclidean rhythms** distribute pulses as evenly as possible, producing maximally regular polyrhythms from just two integers (steps, pulses).
- **Markov chain order** defaults to 2 (trigrams) — low enough to generalize from short seed melodies, high enough to capture musical phrases rather than random walks.
- **Krumhansl-Schmuckler key detection** uses Pearson correlation against key profiles — a well-studied cognitive model that matches how humans perceive tonal centers.

## Multi-agent creative critique (added 2026-03-29)

The CreativeBoard embodies the architectural principle that *creative quality is inherently multi-perspectival*. No single metric captures whether a piece of generative art is good. Instead, three agents with opposing philosophies (simplicity, expressiveness, correctness) deliberate and their disagreements surface as tensions and consensus.

Key design decisions:
- **Heuristic-only (no LLM)**: Board deliberation runs synchronously in hot paths without API calls. Each agent's analysis is a set of regex-based heuristics that approximate their philosophical stance.
- **60/40 blending**: Baseline heuristic evaluation carries 60% weight, board aggregate 40%. This prevents a stylistically enthusiastic board from overriding genuine technical problems.
- **Unanimous-against veto**: Even if the aggregate score is above threshold, unanimous rejection overrides — a safety valve for critically broken code.

## Creative intelligence (added 2026-03-29)

Creative intelligence modules operate on *prompts and conversations* rather than generated code. Their role is to understand user intent before generation begins, improving the first-iteration quality ceiling.

- **AmbiguityDetector** surfaces unclear prompts before generation, reducing wasted iterations on misunderstood intent.
- **CreativePreferenceExtractor** learns user style preferences from natural language, building a profile that persists across sessions.
- **CrossDomainCrossover** maps techniques between domains (e.g., "canon" in music → "iteration" in visual → "recursion" in code), enabling cross-pollination of creative ideas.
- **SymbolicCreativeLanguage** develops an emergent vocabulary of effective creative moves, tracking which discovered techniques lead to high-quality output.

## LIR-aware evaluation (added 2026-03-29)

When LIR is enabled, generated code is parsed into structured tokens *before* evaluation, replacing regex-based extraction with AST-level analysis. This is the architectural bridge between the LIR foundation (Phases 1-3 of the blueprint) and the evaluation pipeline.

Key design decisions:
- **Cold fallback**: `lirTokens.length === 0` triggers the existing regex path unchanged. No score blending, no partial LIR — either you have structured tokens or you fall back entirely.
- **Feature flag**: `lirEnabled` defaults to `false` everywhere. LIR is opt-in because generated code (especially p5.js global mode) may not parse cleanly.
- **GeneratedCodeParser** is ephemeral — no caching, no persistence. It parses, returns tokens, and the tokens flow through evaluation. Parse errors produce empty arrays, triggering fallback.

## Path safety and sandbox

Output, project name, gallery paths, and seed identifiers are validated so paths cannot escape the intended base directory (`normalizePath`, `assertSafeSegment`). User-controlled paths (e.g. `--output`, project name, export path) are resolved against the current working directory or gallery base and rejected if they would escape. Sandbox execution (Puppeteer) runs generated code with timeout and network restrictions; self-improvement has depth and rate limits.

## Persistence

MAP-Elites grid and AestheticModel training data persist across runs via JSON files in `~/.liminal/`. Dynamic routing performance data accumulates in `~/.liminal/routing/`. Archive learning data persists in `~/.liminal/archive/`. This means the system genuinely improves over time — each run builds on accumulated knowledge from all previous runs.

