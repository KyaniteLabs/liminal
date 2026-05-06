# Architecture and Philosophy

## Substrate

Liminal’s substrate is the fixed structure that drives each run: an optional prompt (which may include `{{context}}`), context injection from the accumulated world state, evaluation via the CreativeEvaluator, and termination via the promise string, max-iterations cap, and optional quality gate. Together these define how the agent sees the world and when it stops.

## Loop start

Each run begins with a human-supplied prompt and an optional seed. The prompt is stable across iterations; the seed can bootstrap initial code or parameters. The loop then repeatedly generates, evaluates, and accumulates until a termination condition is met. `RalphLoop.reset()` clears context between runs to prevent state bleed.

## Curation

Users curate rather than micromanage: they control visibility (what the agent sees in context) and high-level control (prompt, limits, quality threshold). The system is designed so that curation of prompts and parameters shapes outcomes without requiring low-level editing of generated code.

## Primary interfaces

Liminal has three primary interfaces:

1. **CLI** (`liminal -p "..."`, `liminal chat`, `liminal fix`, etc.) — the original interface for generation, compost, ledger, and utilities.
2. **Studio** (`liminal studio`) — the GUI-first workbench. It starts the GUI backend plus browser app, uses the HTTP/SSE bridge for streamed generation and preview events, and exposes an Improve lane for repair, hardening, and optimization proposals.
3. **Bubble Tea TUI** (`liminal bubbletea`) — the Go-based terminal operator cockpit with 50+ event handlers, streaming responses, and Ctrl+X Cortex panel.

CLI and programmatic API remain available for automation and integration.

## Self-improvement feedback loop (updated 2026-03-21)

Liminal has closed-loop creative feedback systems plus a guarded self-healing loop. The self-healing loop has three modes: `repair` for failing behavior, `harden` for blind spots on a mostly green system, and `improve` for evidence-backed optimizations on a fully green system. In v1, self-written changes are reviewable and verification-gated rather than auto-merged.

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

## Meta-Harness (added 2026-04-01)

The Meta-Harness implements the **Ralph Wiggum Principle**: the harness (agent model) "sits on the loop" and learns from failures, while the generators (generator models) run "in the loop" creating code. It is currently in manual-memory mode: it observes failures, detects patterns, records adaptation advice, and requires a human or agent remediation pass to apply code changes.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      META-HARNESS (Outer Loop)                       │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐          │
│  │ FailureLogger │──▶│ PatternDetector │──▶│ Manual Memory   │          │
│  └──────────────┘  └────────────────┘  └──────────────────┘          │
│         │                   │                     │                  │
│         ▼                   ▼                     ▼                  │
│  ~/.liminal/         Known Patterns        Applied Adaptations       │
│  failures/           (6 patterns)          (manual fix advice)       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ observes
┌─────────────────────────────────────────────────────────────────────┐
│                    GENERATOR LOOP (Inner Loop)                       │
│              (p5, GLSL, Tone.js, Strudel, etc.)                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Core principle**: *"Never fix broken output programmatically — update the harness so the next output isn't broken."*

### Known Patterns (from Dogfooding)

| Pattern | Description | Detection | Adaptation |
|---------|-------------|-----------|------------|
| `qwen-thinking-trap` | Qwen models get stuck in thinking mode | model.includes('qwen') + timeout + thinking.length > 1000 + empty code | Simplified prompts |
| `glsl-undefined-function` | GLSL uses noise() without defining it | domain='glsl' + validation error contains 'not defined' | Add function definitions |
| `tone-hallucinated-api` | Tone.js uses non-existent classes | domain='tone' + validation error contains 'is not a valid class' | API whitelist |
| `strudel-tidal-confusion` | Models use TidalCycles Haskell syntax | domain='strudel' + code contains 'd1 $' or 'sound "' | Anti-patterns section |
| `ascii-timeout` | ASCII art times out | domain='ascii' + errorType='timeout' | Reduce dimensions |
| `html-404-error` | HTML generator returns 404 | domain='html' + error.contains('404') | Fix endpoint routing |

### Design Decisions

- **Cold fallback**: Pattern detection runs without blocking generation; failures are logged asynchronously
- **Failure record schema**: Captures model, domain, prompt, code, error, errorType, validationErrors, thinking, duration — everything needed for post-hoc analysis
- **No false positives**: Patterns only trigger when multiple criteria match (e.g., Qwen + timeout + long thinking + empty code)
- **Adaptation tracking**: Every applied adaptation is logged with timestamp, enabling longitudinal analysis of harness effectiveness

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

## StudioAgent architecture (Phase 11, added 2026-04-07)

The StudioAgent is the chat-first TUI layer that makes Liminal feel like "Codex for creative generative art." It consists of 20+ modules in `src/agent/` that handle intent routing, autonomy modes, response composition, session persistence, and skill execution.

Key architectural decisions:
- **Intent-based routing**: `IntentRouter` classifies user input by keyword detection into `direct` (simple chat), `generate` (creative generation), `command` (slash commands), or `agent` (structured workflows). Each intent routes to a dedicated handler.
- **Direct chat streaming**: `streamDirectChat()` uses `LLMClient.generate()` and chunks the response at 50 characters with 10ms delay to simulate streaming over SSE — no native streaming API needed.
- **Autonomy modes**: `AutonomyController` manages three levels: `assist` (user approves every action), `co-create` (agent proposes, user approves significant changes), and `autopilot` (agent acts independently with review gates).
- **Session persistence**: `SessionGraph` records every turn to `LiminalFS` (the filesystem-based session store), enabling session resume and audit trails.
- **Bridge-only mode**: The HTTP/SSE bridge runs without the Go Bubble Tea binary, accepting connections from any HTTP client. Signal handlers use `process.once` with try/catch guards for clean shutdown.

## LiminalCortex — background executive (Phase 13, added 2026-04-16)

LiminalCortex is a background executive that runs alongside the Studio session, continuously perceiving system events, managing goals, and proposing improvements. It is the "autonomous improvement" layer that works while the user creates.

Key architectural decisions:
- **Perception bus**: `CortexPerceptionBus` receives events from all subsystems via `emitEphemeral()` — a high-frequency SSE mechanism for streaming cortex awareness without blocking the main event loop.
- **Priority allocator**: `PriorityAllocator` ranks goals by urgency, impact, and cost. Goals compete for a shared budget tracked by `BudgetTracker`.
- **Action proposer**: The cortex proposes actions (improvements, optimizations, explorations) but does not execute them directly — they flow through the autonomy system for user approval.
- **Supervisor + StuckDetector**: `CortexSupervisor` monitors the cortex loop for livelocks and dead ends, while `StuckDetector` identifies when the system is cycling without progress.
- **TUI integration**: Ctrl+X toggles the Cortex panel in the Bubble Tea TUI. `/cortex start|stop` controls the loop. `/cortex` shows the dashboard.

## Emergence evaluation (Phase 14, added 2026-04-16)

The emergence evaluation layer measures whether the system's creative output is genuinely novel and structurally interesting, not just technically correct.

Key components:
- **NoveltyIndex**: k-nearest-neighbors scoring against a feature archive. Outputs with few near-neighbors score higher novelty.
- **TemporalStructureAnalyzer**: Measures whether outputs evolve meaningfully over time (not just randomly) using entropy and autocorrelation.
- **PerturbationProbe**: Introduces seeded perturbations (via mulberry32 PRNG for determinism) and measures resilience — does the system recover gracefully or collapse?
- **EmergenceCritic**: Weighted ensemble across 6 dimensions (novelty, structure, temporal, resilience, fertility, aesthetic). Each dimension has its own sub-scorer.
- **NicheQuotaPolicy**: Entropy-based balancing ensures the system explores diverse creative niches rather than converging on a single style.

## Taste learning and dreaming (Phase 15, added 2026-04-16)

Taste learning closes the loop between user preferences and generation quality. Dreaming provides an offline recombination mechanism that explores creative possibilities without user involvement.

Key architectural decisions:
- **Preference dataset**: `PreferenceDatasetBuilder` collects (prompt, output, score, user_signal) tuples from every generation. The dataset grows with use.
- **Margin-based training**: `TasteModelTrainer` uses a simplified SGD on pairwise preference margins — no ML framework required. The model is a weight vector over creative features.
- **Runtime scoring**: `TasteModelRuntime` scores candidate outputs in real-time, biasing the replay queue toward user-preferred styles.
- **Replay bias policy**: `ReplayBiasPolicy` controls the ratio of fresh exploration vs. taste-informed replay, using `Math.random()` at 5 decision points for stochastic mixing.
- **Dream queue**: `DreamQueue` manages prioritized recombination tasks with concurrency control. `DreamPlanner` selects parent pairs based on complementary strengths.
- **Cross-modal transfer**: `CrossModalTransfer` maps techniques between domains (e.g., visual symmetry → musical counterpoint), enabling creative cross-pollination in dreams.
- **Compost rehydration**: `CompostRehydrator` and `MotifIndexer` resurrect dormant compost material based on motif density scoring, ensuring old ideas get revisited.

## Autonomous Gardener (Phase 16, added 2026-04-16)

The Autonomous Gardener is a background creative steward that manages taste learning, dream recombinations, and emergence evaluation without user intervention. It is the top-level orchestrator for the self-improving creative system.

Key architectural decisions:
- **Three autonomy modes**: `assist` (propose, wait for approval), `co-create` (execute, report results), `autopilot` (execute, only escalate failures).
- **Budget management**: Each `cycle()` receives a total token/action budget. The gardener allocates across taste updates, dream tasks, and emergence probes proportionally.
- **Stochastic task selection**: `ReplayBudgetPolicy` uses `Math.random()` to mix between fresh exploration, dream recombination, and taste-biased replay — preventing the system from converging on any single strategy.
- **Garden health monitoring**: `GardenHealthMonitor` tracks creative diversity, seed freshness, and compost health, alerting when intervention is needed.
- **Stagnation detection**: `StagnationDetector` identifies when the system is producing diminishing returns and triggers perturbation or niche exploration.
