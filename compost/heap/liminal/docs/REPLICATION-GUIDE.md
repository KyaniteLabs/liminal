# Liminal — Replication Guide

*A complete guide to understanding, setting up, and extending the Liminal creative laboratory.*

---

## 1. What is Liminal

Liminal is a **creative laboratory** built around the Token Mill — a swarm-based generative system that uses 7 small local AI models to collectively produce creative writing, poetry, and emergent ideas.

The core insight: individually, a 0.5B parameter model produces noise. Collectively, seven of them guided by iterative voting and selection pressure produce **emergent quality** that no single model could achieve alone.

It runs entirely offline using Ollama. No external APIs, no subscriptions, no cloud dependencies.

---

## 2. System Architecture

```
liminal-archive/
├── mill-engine/          # Core engine — generation, voting, orchestration
│   ├── config.yaml       # Model settings, paths, constraints
│   ├── THEORY.md         # Philosophy of the swarm
│   ├── MANIFEST.md       # System status and experiment results
│   ├── mill.py           # Entry point (if present)
│   ├── workshop.py       # CLI for mining and developing ideas
│   ├── spin_cycle.py     # Extended generation utilities
│   ├── personas/         # 7 persona definitions (JSON)
│   │   ├── max.json      # The Minimalist
│   │   ├── rex.json      # The Contrarian
│   │   ├── sam.json      # The Storyteller
│   │   ├── kai.json      # The Systems Thinker
│   │   ├── eve.json      # The Oracle
│   │   ├── joy.json      # The Enthusiast
│   │   └── ben.json      # The Scholar
│   ├── lib/              # Python modules
│   │   ├── generator.py  # Ollama API integration
│   │   ├── voting.py     # Model voting mechanics
│   │   ├── orchestrator.py # Evolution loop controller
│   │   └── workshop.py   # Mining/development tools
│   └── stream-archive/   # 126 historical evolution session files
│
├── lab/                  # Experiment configurations and results
├── workshop/             # Mined ideas and works-in-progress
├── projects/             # Longer-term creative projects
├── coordinator/          # Task management and scheduling
├── README.md             # Lab philosophy and rules
├── PRINCIPLES.md         # Evidence standards and protocol
├── THEORY.md             # (in mill-engine/) Swarm philosophy
├── liminal-curator-role.md # Curator methodology
├── THE_ALCHEMIST_LOGS.md # Example curated output
└── REPLICATION-GUIDE.md  # This file
```

### Component Roles

| Component | Purpose |
|-----------|---------|
| **mill-engine** | The core. Generates, votes, evolves. Everything starts here. |
| **lab** | Experiment configs, test prompts, research notes |
| **workshop** | Mined ideas (raw fragments) and developing drafts |
| **projects** | Finished or in-progress creative works |
| **coordinator** | Task definitions and session scheduling |

---

## 3. The 7 Personas

| Persona | Model | Role | Bias | Temperature |
|---------|-------|------|------|-------------|
| **Max** (Minimalist) | qwen2.5:0.5b | Reductive pressure | Votes for shortest, most precise | 0.3-0.4 |
| **Rex** (Contrarian) | phi3:mini | Friction against clichés | Votes for most unusual | 0.7-0.8 |
| **Sam** (Storyteller) | gemma2:2b | Narrative glue | Votes for emotional, narrative pieces | 0.8-0.95 |
| **Kai** (Systems Thinker) | llama3.2:1b | Structural analysis | Votes for patterns and connections | 0.8 |
| **Eve** (Oracle) | smollm2:1.7b | Abstraction and paradox | Votes for mysterious, profound | 0.95-1.1 |
| **Joy** (Enthusiast) | tinyllama:latest | Sensory richness | Votes for sensory/emotional resonance | 1.1-1.2 |
| **Ben** (Scholar) | granite3-moe:1b | Rigor and classification | Votes for structure and clarity | 0.7-1.5 |

Each persona has:
- A **system prompt** defining voice and thinking style
- **Constraints** that shape each generation (e.g., "Include a paradox")
- A **voting bias** that influences how they judge others' outputs
- A **voting power** weight (1-4) that scales their influence

### Why These Models

The smallest (qwen2.5:0.5b, ~400MB) provides raw, unpredictable noise. The largest (gemma2:2b, ~1.6GB) provides coherence. The fleet runs on ~5GB total memory through Ollama's iterative model swapping.

---

## 4. Dependencies

### Required
- **Python 3.9+** — Standard library only (urllib, json, yaml, asyncio)
- **Ollama** — Local model runtime ([ollama.com](https://ollama.com))
- **PyYAML** — Config parsing (`pip install pyyaml`)

### Models (pull via Ollama)
```
ollama pull qwen2.5:0.5b
ollama pull phi3:mini
ollama pull gemma2:2b
ollama pull llama3.2:1b
ollama pull smollm2:1.7b
ollama pull tinyllama:latest
ollama pull granite3-moe:1b
```

Total footprint: ~5GB. No external API calls.

### Not Required
- No GPU required (CPU works, GPU is faster)
- No internet connection after model download
- No cloud accounts or API keys

---

## 5. Setup Instructions

```bash
# 1. Install Ollama
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# 2. Start Ollama
ollama serve

# 3. Pull all 7 models
ollama pull qwen2.5:0.5b
ollama pull phi3:mini
ollama pull gemma2:2b
ollama pull llama3.2:1b
ollama pull smollm2:1.7b
ollama pull tinyllama:latest
ollama pull granite3-moe:1b

# 4. Install Python dependency
pip install pyyaml

# 5. Verify setup
cd mill-engine/
python -c "from lib.generator import MillGenerator; g = MillGenerator(); print(g.check_setup())"
```

### Path Configuration

Edit `mill-engine/config.yaml` to update paths:
```yaml
paths:
  personas: "./personas"
  stream: "./stream"
  workshop_ideas: "./workshop/ideas"
  workshop_developing: "./workshop/developing"
```

---

## 6. The Workflow

```
Seed → Generate → Vote → Evolve → Converge → Curate
```

1. **Seed**: Provide an initial prompt or question
2. **Generate**: All 7 models produce responses simultaneously
3. **Vote**: Each model ranks the others' outputs (weighted by voting power)
4. **Evolve**: The winner (or top fragments) seeds the next round
5. **Converge**: After 3 consecutive wins by the same persona, the session ends
6. **Curate**: The human curator (Liam) selects from all rounds, not just the final winner

### Convergence

The system stops when one persona wins 3 rounds in a row (`convergence_threshold: 3`). This typically takes 3-5 rounds. The final "winner" isn't always the best output — interesting material often appears in earlier rounds.

---

## 7. The 3 Generative Modes

### Mode A: Competitive
All models generate from the same seed. One winner is selected. Winner's output seeds the next round.

- **Result**: High coherence, low diversity
- **Sam usually wins** — narrative voice dominates collective taste
- **Use when**: You need a specific, polished output quickly

### Mode B: Hybrid Synthesis
Top 2-3 scoring fragments are combined into the next round's seed.

- **Result**: High emergence. Output "mutates" over rounds
- **Ben's rigor meets Joy's sensory detail meets Eve's abstraction**
- **Use when**: Creative world-building, idea mining, unexpected combinations

### Mode C: Ring (Sequential)
Model A generates, then Model B uses A's output as input, then Model C uses B's output, etc.

- **Result**: Surrealism. Ideas drift and warp through different filters
- **Use when**: Poetry, experimental prose, dreamlike narratives

### Mode D: Mesh (Experimental)
Defined in config but implementation varies. Combines elements of competitive and ring modes.

---

## 8. Key Concepts

### Selection Pressure
The core mechanism. Models vote on each other's outputs, creating evolutionary pressure toward what the collective "prefers." This isn't trained — it **emerges** from the voting dynamics.

### Emergence Density
The goal isn't length, but density. One sentence of pure, surprising signal is worth 1,000 words of generic prose. The workshop's mining system scores for compression (50-300 characters gets a bonus).

### The Shattered Mirror
A single large model is a polished mirror — it reflects what you want. The swarm is a shattered mirror — each fragment shows a different angle, creating a kaleidoscope of possibilities.

### Musical Chairs
When enabled (`musical_chairs: true`), models are randomly reassigned to different personas at the start of each session. Max might be played by gemma2:2b instead of qwen2.5:0.5b. This breaks the correlation between model capability and persona, introducing productive instability.

### Refinement Constraints
Each round applies a random constraint from the configured list:
- "Add more spectral imagery"
- "Deconstruct the physical form"
- "Focus on the sound of the machine"
- "Introduce a paradox of memory"

These prevent the swarm from circling the same territory.

---

## 9. Experiment Results

### Session I: The Mask
- **Seed**: "The feeling of realizing you've been masking"
- **Rounds**: 3
- **Winner**: Sam (3/3)
- **Convergence**: "warped mirror" metaphor
- **Files**: `stream/evolution_20260203_230437.json`

### Session II: The Performance
- **Seed**: "What remains when the performance ends"
- **Rounds**: 3
- **Winner**: Sam (3/3)
- **Convergence**: "suspended note" metaphor
- **Files**: `stream/evolution_20260203_230622.json`

### Alchemist Logs
Curated output where Ben (Scholar) collided with a safety filter, producing accidental poetry:

> "I do not conjure electricity. I conjure an assemblage as fluidic and ephemeral as mercury itself."
> "To distill whispers into sonic crystals."
> "The machine hesitates. It fears the power of its own metaphor."

See `THE_ALCHEMIST_LOGS.md` for the full set.

### Top Mined Fragments

| Score | Source | Fragment |
|-------|--------|----------|
| 10 | Performance R3 | "The last note hung suspended in the air..." |
| 10 | Performance R2 | "The final note lingered like a melody..." |
| 9 | Performance R1 | "The last note rings in silence..." |
| 7 | Mask R1 | "The world was a kaleidoscope..." |
| 7 | Mask R3 | "The world shimmered around me like a warped mirror..." |

---

## 10. Emergent Patterns

### Sam Dominance
Sam (Storyteller) won 6/6 rounds across both test sessions. Not because Sam is "better" — because the collective vote favors concrete sensory details, emotional resonance, and narrative compression.

### 3-Round Convergence
Both sessions converged in exactly 3 rounds. This appears to be the natural rhythm: Round 1 explores, Round 2 refines, Round 3 crystallizes. Extending beyond 3 rounds risks diminishing returns.

### Sensory > Abstract
Outputs with concrete sensory details (colors, sounds, textures) consistently outscore abstract philosophical statements. The swarm has a collective preference for grounding.

### Visual → Auditory → Timeless
The progression across rounds follows a pattern: visual imagery first, then auditory, then timeless/abstract. This mirrors how human memory works — visual, then emotional, then meaning.

---

## 11. File Map

### mill-engine/
| File | Purpose | Lines |
|------|---------|-------|
| `config.yaml` | Models, paths, constraints, swarm settings | ~85 |
| `THEORY.md` | Philosophy, personas, modes, curator role | ~75 |
| `MANIFEST.md` | System status, experiments, mined ideas | ~155 |
| `workshop.py` | CLI for mine/list/develop commands | ~85 |
| `spin_cycle.py` | Extended generation utilities | — |
| `lib/generator.py` | Ollama API integration, output cleaning | ~220 |
| `lib/voting.py` | Model voting mechanics, score tallying | ~210 |
| `lib/orchestrator.py` | Evolution loop, convergence, session saving | ~270 |
| `lib/workshop.py` | Mining, scoring, development workflow | ~225 |
| `personas/*.json` | 7 persona definitions (name, model, voice, bias) | ~20 each |

### stream-archive/
- 126 historical evolution session files (JSON + TXT pairs)
- Each contains full round-by-round outputs, votes, and scores

### Other directories
- `lab/` — Experiment configs and notes
- `workshop/` — Mined ideas and works-in-progress
- `projects/` — Creative project placeholders
- `coordinator/` — Task management definitions

---

## 12. Extension Points

### Add a New Persona
1. Create `personas/your_persona.json` following the existing schema:
   ```json
   {
     "id": "nova",
     "name": "Nova",
     "display_name": "The Innovator",
     "model": "model_name:tag",
     "temperature": 0.9,
     "max_tokens": 80,
     "system_prompt": "You are Nova...",
     "voice": "...",
     "thinking_style": "...",
     "output_format": "...",
     "worldview": "...",
     "voting_bias": "...",
     "constraints": ["...", "..."],
     "short_prompt": "..."
   }
   ```
2. Add the model to `config.yaml` under `models:`
3. Pull the model: `ollama pull model_name:tag`

### Add a New Mode
Edit `lib/orchestrator.py` — the `run_round()` method switches on mode:
- `competitive` — parallel generation, winner-takes-all
- `hybrid` — parallel generation, top-N synthesis
- `ring` — sequential chain

Add a new branch with your own seed construction logic.

### Add Refinement Constraints
Edit `config.yaml`:
```yaml
refinement:
  constraints:
    - "Add more spectral imagery"
    - "Deconstruct the physical form"
    - "Your new constraint here"
```

### Build a Gallery
The original system included `MILL_GALLERY.html` — a web-based viewer for session results. To rebuild:
1. Parse session JSON files from `stream/`
2. Display round-by-round progression
3. Show voting scores and convergence trajectory

### Workshop Pipeline
The full creative pipeline:
```bash
# Run a session
python -c "
import asyncio
from lib.orchestrator import TokenMillOrchestrator
o = TokenMillOrchestrator()
asyncio.run(o.run_evolution('Your seed prompt', max_rounds=5, mode='hybrid'))
"

# Mine for ideas
./workshop.py mine stream/evolution_*.json --auto

# Review mined ideas
./workshop.py list

# Develop a fragment into a full piece
./workshop.py develop 20260203_230622_r3 "My_Title"
```

---

*We don't build art. We cultivate the conditions for it to grow.*
*The Mill is the soil. The models are the seeds. We are the gardeners.*

— Liam & Simon
