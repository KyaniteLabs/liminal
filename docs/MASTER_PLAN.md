# Liminal Master Plan

## Philosophy

> "The code evolves. You curate. The system learns."

Permanent system: Intent → Creative Brief → RalphLoop → Gallery
Self-improvement: Taste Learning → Dream Recombination → Emergence Evaluation → Autonomous Gardener

---

## Phase Status Summary

| Phase | Name | Status | Key Modules |
|-------|------|--------|-------------|
| 1 | Verify Robustness | COMPLETE | Feature test matrix, telemetry |
| 2 | Creative Validation | COMPLETE | Genome DB, visual diff, model profiles |
| 3 | Seed Ideation | COMPLETE | SeedIdeator, CreativeBrief, domain expansion |
| 4 | Full Pipeline | COMPLETE | CLI, compost, TUI — physical output deferred |
| 5-8 | Infrastructure | COMPLETE | CI/CD, security, TUI migration, harness |
| 9 | Self-Hosting Ledger | COMPLETE | `src/ledger/` (TaskLedger, TaskRunner, TaskVerifier) |
| 10 | (skipped) | — | — |
| 11 | StudioAgent | COMPLETE | `src/agent/`, `src/tui-bridge/`, Bubble Tea Go TUI |
| 12 | (skipped) | — | — |
| 13 | LiminalCortex | COMPLETE | `src/cortex/` (PerceptionBus, GoalStore, PriorityAllocator) |
| 14 | Emergence Evaluation | COMPLETE | `src/emergence/` (NoveltyIndex, PerturbationProbe, EmergenceCritic) |
| 15 | Taste + Dreaming | COMPLETE | `src/learning/`, `src/dreaming/`, `src/compost/` (Rehydrator) |
| 16 | Autonomous Gardener | COMPLETE | `src/autonomy/` (Gardener, GardenHealth, StagnationDetector) |

---

## Phase 1: Verify Robustness (COMPLETE)

**Goal**: Confirm agents follow instructions, system is stable.
**Trigger for completion**: "I'm satisfied" from user.

### Current Status
- [x] Feature test matrix (7 models × 6 creative domains)
- [x] Parallel execution across providers
- [x] Live telemetry collection
- [ ] Complete full matrix run
- [ ] Document failure modes per model

### Deliverables
- `dogfood-qa-live/results.json` - All test results
- `landing-assets/live-evaluation-results.json` - Live-updating gallery data
- Model personality profiles (emergent from test data)

---

## Phase 2: Creative Validation (COMPLETE)

**Goal**: Measure if outputs are actually *good*, not just valid.

### Components

#### 2.1 Creative Genome Database
- Store ALL iterations (not just final)
- Parent → child lineage tracking
- Mutation operator effectiveness scoring
- Query: "What mutations improve p5.js fireworks?"

#### 2.2 Visual Diff Testing
- Screenshot every iteration
- Measure: pixel variance, edge detection, motion entropy
- Fail if iteration N identical to N-1 (stagnation detection)

#### 2.3 Model Personality Profiles
Auto-generated after sufficient tests:
```
MiniMax-M2.7:
  Strengths: [shaders, complex math, visual effects]
  Weaknesses: [audio, strudel syntax, minimal code]
  Typical iterations: 4-6
  Sweet spot: Iteration 3-4 for most domains
```

---

## Phase 3: Seed Ideation System (COMPLETE)

**Inspiration**: SEED by Christopher Kahler
**Goal**: Vague intent → Structured creative brief

### Workflow
```
"Something like Kid A"
    ↓
SeedIdeator.ideate()
    ↓
CreativeBrief:
  - extractedThemes: ["anxiety", "glitch", "organic-mechanical"]
  - emotionalTone: "paranoid warmth"
  - suggestedDomains: ["strudel", "hydra", "p5"]
  - concretePrompts: [
      { domain: "strudel", prompt: "Glitch techno beats" },
      { domain: "hydra", prompt: "Feedback loop paranoia" }
    ]
    ↓
User selects OR run all
    ↓
RalphLoop executes selected domains
    ↓
Gallery with full lineage
```

### Enhanced Workflow with Research Step (NEW)

```
"Something like Kid A"
    ↓
SeedIdeator.ideate()
    ├─ Step 1: RESEARCH (NEW)
    │   ├─ Search: "Kid A album Radiohead 2000"
    │   ├─ Find: glitch art, Warp Records, post-rock
    │   ├─ Current knowledge cutoff: 2026-03-31
    │   └─ Build reference corpus
    ├─ Step 2: Intent Extraction
    ├─ Step 3: Domain Matching
    └─ Step 4: Brief Generation
        └─ concretePrompts WITH citations
```

**Research Requirements:**
- Web search for named references
- Knowledge date awareness
- Reference provenance tracking
- Future: Karpathy-style autoresearch

### Creative Domain Types
See: `docs/CREATIVE_DOMAIN_TYPES.md`

Current: 11 domains (p5, GLSL, Three, Strudel, Hydra, Tone.js, Revideo, HTML, ASCII, Kinetic, TextGen)

---

## Phase 4: Full Pipeline (COMPLETE — physical output deferred to future feature)

### Components
- **Interface**: GUI/CLI for the RalphLoop ✅ (CLI + Studio + Bubble Tea TUI)
- **Curation Tools**: Select, fork, evolve favorites ✅ (gallery, compost, archive)
- **Multi-domain Fusion**: Single prompt → interacting domains (partial — cross-domain crossover exists)
- **Networked Sessions**: Collaborative creative (future)
- **Physical Output**: Plotter, CNC integrations (potential future feature — SVG/G-code output for pen plotters and CNC machines)

---

## Integration Points

### SEED → Liminal
```typescript
// SEED produces PLANNING.md for PAUL
// Liminal adaptation:
const brief = await seedIdeator.ideate("Kid A vibes");
// Produces CREATIVE_BRIEF.md for RalphLoop
```

### RalphLoop ↔ Creative Genome
- Every iteration saved to genome
- Query genome for mutation suggestions
- "What worked for similar prompts?"

### Gallery → Seed
- Previous works as reference points
- "Like my previous fireworks but more ambient"

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Testing is temporary | Verify robustness, then focus on creative system |
| 2026-03-31 | SeedIdeator approved | Intent extraction critical for user experience |
| 2026-03-31 | Expand domain types | 11 domains for full creative coverage |
| 2026-03-31 | Creative Genome permanent | Lineage tracking is core differentiator |
| 2026-04-07 | Bubble Tea replaces Ink | Go-based TUI for better performance and UX |
| 2026-04-07 | Studio = chat-first | User-first interface, not autonomy-first |
| 2026-04-16 | User-first architecture | Previous roadmap deferred user interaction; corrected |
| 2026-04-16 | Taste without ML framework | Margin-based SGD is sufficient, avoids heavy deps |

---

## Next Actions

See phase status summary above. All phases through 16 are complete. Future work:

1. **Physical output** (potential future feature) — SVG/G-code for pen plotters and CNC machines
2. **Networked sessions** — collaborative creative sessions
3. **Multi-domain fusion** — single prompt → interacting domains

---

## Phase 9: Self-Hosting Task Ledger (COMPLETE — Apr 15, 2026)

**Goal**: Internal task management with corpus-based execution and shell-free verification.

### Key Components
- **TaskLedger** — JSON-backed task store with CRUD operations
- **TaskRunner** — Executes tasks with timeout and output capture
- **TaskVerifier** — Uses `execFileSync` (shell-free) with metacharacter guard and prefix whitelist
- **CLI**: `liminal ledger list|show|run|verify|accept|reject|status`

### Security
- TaskVerifier rejects commands containing shell metacharacters (`;`, `|`, `$`, backticks, etc.)
- Only whitelisted binary prefixes allowed (`git`, `node`, `pnpm`, `npm`, `echo`, `cat`, `ls`)
- 50 unit tests + 4 integration tests

---

## Phase 11: StudioAgent — Chat-First TUI (COMPLETE — Apr 7, 2026)

**Goal**: "Codex for creative generative art" — a terminal-native creative agent you talk to.

### Key Components
- **StudioAgent** (`src/agent/StudioAgent.ts`) — Delegate pattern with intent classification
- **IntentRouter** (`src/agent/IntentRouter.ts`) — Keyword-based classification: direct, generate, command, agent
- **AutonomyController** (`src/agent/AutonomyController.ts`) — Three modes: assist, co-create, autopilot
- **ResponseComposer** (`src/agent/ResponseComposer.ts`) — Response formatting with provenance metadata
- **SessionGraph** (`src/agent/SessionGraph.ts`) — LiminalFS persistence for session resume
- **TuiBridgeService** (`src/tui-bridge/TuiBridgeService.ts`) — HTTP/SSE bridge with direct chat streaming
- **Bubble Tea Go TUI** (`bubbletea/`) — 50+ event handlers, streaming rendering, Ctrl+X Cortex panel

### Architecture
```
User input → IntentRouter → StudioAgent
  ├─ direct   → streamDirectChat() (simple LLM chat, chunked streaming)
  ├─ generate → streamEngineeringTask() (full creative loop)
  ├─ command  → slash command handlers
  └─ agent    → structured workflow delegation
```

The bridge runs standalone without the Go binary (bridge-only mode), enabling HTTP clients.

---

## Phase 13: LiminalCortex — Background Executive (COMPLETE — Apr 16, 2026)

**Goal**: Background agent that perceives system events, manages goals, and proposes improvements autonomously.

### Key Components
- **CortexPerceptionBus** — Receives events from all subsystems via `emitEphemeral()`
- **GoalStore** — Persistent goal management with priority scoring
- **LiminalCortex** — Main loop: perceive → prioritize → propose → (wait for approval in assist mode)
- **PriorityAllocator** — Ranks goals by urgency, impact, cost
- **BudgetTracker** — Shared budget across cortex actions
- **CortexSupervisor** — Monitors for livelocks and dead ends
- **StuckDetector** — Identifies cycling without progress
- **CortexExplainer** — Human-readable cortex state explanations

### TUI Integration
- Ctrl+X toggles Cortex panel
- `/cortex start|stop` controls the loop
- `/cortex` shows dashboard with current goals and actions

---

## Phase 14: Emergence Evaluation Layer (COMPLETE — Apr 16, 2026)

**Goal**: Measure whether creative output is genuinely novel and structurally interesting.

### Key Components
- **NoveltyIndex** — kNN scoring against feature archive
- **TemporalStructureAnalyzer** — Entropy and autocorrelation for temporal evolution
- **PerturbationProbe** — Seeded perturbations (mulberry32 PRNG) with resilience measurement
- **EmergenceCritic** — Weighted ensemble across 6 dimensions
- **NicheQuotaPolicy** — Entropy-based diversity balancing
- **ArchiveTaskPlanner** — Plans archive maintenance tasks

### CLI
- `liminal emergence score <file>` — Score all emergence dimensions
- `liminal emergence probe <file>` — Run perturbation probes

---

## Phase 15: Taste Learning, Dreaming, and Garden Policies (COMPLETE — Apr 16, 2026)

**Goal**: Close the loop between user preferences and generation quality. Enable offline creative exploration.

### Taste Learning
- **PreferenceDatasetBuilder** — Collects (prompt, output, score, user_signal) tuples
- **TasteModelTrainer** — Margin-based SGD on pairwise preferences (no ML framework)
- **TasteModelRuntime** — Real-time candidate scoring
- **ReplayBiasPolicy** — Stochastic mixing of fresh exploration vs. taste-informed replay

### Dreaming
- **DreamQueue** — Prioritized recombination tasks with concurrency control
- **DreamPlanner** — Selects parent pairs based on complementary strengths
- **RecombinationEngine** — Combines parent outputs into novel candidates
- **CrossModalTransfer** — Maps techniques between domains (visual → musical → code)

### Compost Rehydration
- **CompostRehydrator** — Resurrects dormant material based on motif density
- **MotifIndexer** — Indexes and scores creative motifs

### Garden Policies
- **GardenHealthMonitor** — Tracks creative diversity, seed freshness, compost health
- **GardenPolicy** — Rules for autonomous garden management
- **StagnationDetector** — Identifies diminishing returns

---

## Phase 16: Autonomous Gardener (COMPLETE — Apr 16, 2026)

**Goal**: Background creative steward that manages taste, dreaming, and emergence without user intervention.

### Key Components
- **AutonomousGardener** (`src/autonomy/AutonomousGardener.ts`) — Top-level orchestrator
- Three autonomy modes: assist (propose), co-create (execute + report), autopilot (execute, escalate failures)
- Budget management: each `cycle()` allocates across taste/dream/emergence proportionally
- Stochastic task selection via `ReplayBudgetPolicy` (5 `Math.random()` decision points)
- Garden health monitoring and stagnation detection

---

## Key Metrics

- **Test Coverage**: 77%+ statements, 67%+ branches (ratchet-enforced)
- **Robustness**: 95%+ feature tests passing
- **Creative Quality**: 0.7+ average CreativeEvaluator score
- **Iteration Efficiency**: < 5 iterations to quality threshold
- **Intent Alignment**: User recognizes intent in output
- **Determinism**: All stochastic test paths use `vi.spyOn(Math, 'random')` for reproducibility
