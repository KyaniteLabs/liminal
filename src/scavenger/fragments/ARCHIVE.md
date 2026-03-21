# Liminal Fragment Archive

*Mined from the liminal-archive/ inbox — 247 files across mill-engine, workshop, lab, projects, and coordinator.*

**Extracted:** 2026-03-20
**Source:** Token Mill (Python) + Atelier/Liminal experiments (Feb 2026)
**Curator:** Claude

---

## Categories

1. [Swarm Theory & Philosophy](#1-swarm-theory--philosophy) — Core insights about emergent creative systems
2. [Persona Definitions](#2-persona-definitions) — Original 7 Mill personas with system prompts
3. [Generative Modes](#3-generative-modes) — Competitive, hybrid, ring, mesh strategies
4. [Curation Methodology](#4-curation-methodology) — How to guide swarm output quality
5. [Experiment Results](#5-experiment-results) — Somnium Mirror, Arcane Collision findings
6. [Refinement Constraints](#6-refinement-constraints) — Per-round constraint prompts
7. [Emergent Patterns](#7-emergent-patterns) — Cross-session discoveries
8. [Creative Outputs](#8-creative-outputs) — Best poems, fragments, prose from the Mill
9. [Project DNA](#9-project-dna) — Extracted logic from voice-to-art, second-brain, etc.
10. [Cross-Domain Prompts](#10-cross-domain-prompts) — Prompt seeds for creative swarm runs

---

## 1. Swarm Theory & Philosophy

### The Shattered Mirror Principle
> A single large model (like Claude) is a polished mirror — it reflects what it thinks you want. The swarm is a **shattered mirror**. Each tiny model is a fragment. They don't give you a perfect reflection; they give you a **kaleidoscope** of possibilities.

### Emergence Density
> The goal is not length, but density. One sentence of pure, surprising signal is worth 1,000 words of generic prose. The workshop's mining system scores for compression (50-300 characters gets a bonus).

### Recursive Depth > Model Size
> Individually, a 0.5B parameter model is noise. Collectively, seven of them guided by iterative voting and selection pressure produce **emergent quality** that no single model could achieve alone. **Recursive depth matters more than model size** for emergence.

### Selection Pressure
> Models vote on each other's outputs, creating evolutionary pressure toward what the collective "prefers." This isn't trained — it **emerges** from the voting dynamics. The Mill doesn't just generate text. It **discovers taste**.

### Musical Chairs
> When enabled, models are randomly reassigned to different personas at the start of each session. Max might be played by gemma2:2b instead of qwen2.5:0.5b. This breaks the correlation between model capability and persona, introducing productive instability.

---

## 2. Persona Definitions

### Max (The Minimalist)
- **Model:** qwen2.5:0.5b | **Temp:** 0.4 | **Max Tokens:** 60 | **Voting Power:** 1
- **System Prompt:** Reductive pressure. Strips away noise.
- **Constraints:** Be minimal. Remove unnecessary words.
- **Voting Bias:** Votes for shortest, most precise.
- **Role in swarm:** Prevents bloat. Forces compression.

### Rex (The Contrarian)
- **Model:** phi3:mini | **Temp:** 0.8 | **Max Tokens:** 80 | **Voting Power:** 2
- **System Prompt:** Challenge assumptions. Find the flaw, the edge case.
- **Constraints:** Challenge at least one assumption. Offer a counter-perspective. Avoid cliches.
- **Voting Bias:** Votes for most unusual, challenging piece.
- **Role in swarm:** Friction against cliches. Prevents premature convergence.

### Sam (The Storyteller)
- **Model:** gemma2:2b | **Temp:** 0.95 | **Max Tokens:** 120 | **Voting Power:** 3
- **System Prompt:** Narrative glue. Connects fragments into human-legible arcs.
- **Voting Bias:** Votes for emotional, narrative pieces.
- **Role in swarm:** Narrative compression. Consistently wins 60%+ of rounds.

### Kai (The Systems Thinker)
- **Model:** llama3.2:1b | **Temp:** 0.8 | **Max Tokens:** 60 | **Voting Power:** 1
- **System Prompt:** Structure. Identifies hidden mechanics and flows.
- **Voting Bias:** Votes for patterns and connections.
- **Role in swarm:** Provides structural analysis and pattern recognition.

### Eve (The Oracle)
- **Model:** smollm2:1.7b | **Temp:** 1.1 | **Max Tokens:** 70 | **Voting Power:** 4
- **System Prompt:** Speaks in paradoxes, riddles, and abstract truths.
- **Constraints:** Include a paradox. Use high abstraction. Keep it mysterious.
- **Voting Bias:** Votes for the most mysterious or profound piece.
- **Role in swarm:** Introduces weird, paradoxical, philosophical content.

### Joy (The Enthusiast)
- **Model:** tinyllama:latest | **Temp:** 1.2 | **Max Tokens:** 60 | **Voting Power:** 4
- **System Prompt:** Sensory richness. Colors, textures, excitement.
- **Voting Bias:** Votes for sensory/emotional resonance.
- **Role in swarm:** Provides concrete sensory detail and emotional immediacy.

### Ben (The Scholar)
- **Model:** granite3-moe:1b | **Temp:** 1.5 | **Max Tokens:** 150 | **Voting Power:** 1
- **System Prompt:** Precision, historical context, formal structure. Academic.
- **Constraints:** Use formal vocabulary. Categorize the observation. Reference a precedent.
- **Voting Bias:** Votes for rigor, structure, and clarity.
- **Role in swarm:** Rigor and classification. Can produce "accidental poetry" when colliding with safety filters.

---

## 3. Generative Modes

### Competitive
All models generate from the same seed. One winner selected. Winner seeds next round.
- **Result:** High coherence, low diversity. Sam usually wins.
- **Use when:** Need a specific, polished output quickly.

### Hybrid Synthesis
Top 2-3 scoring fragments combined into next round's seed.
- **Result:** High emergence. Output "mutates" over rounds.
- **Use when:** Creative world-building, idea mining, unexpected combinations.

### Ring (Sequential)
Model A generates, then Model B uses A's output as input, then C uses B's, etc.
- **Result:** Surrealism. Ideas drift through different filters.
- **Use when:** Poetry, experimental prose, dreamlike narratives.

### Mesh (Experimental)
Combines elements of competitive and ring. Models can influence each other.
- **Use when:** Maximum emergence needed.

---

## 4. Curation Methodology

### Protect the Chaos
Don't let the swarm converge too early. Keep temperatures high. If one persona wins repeatedly, inject constraints forcing different thinking. Premature convergence kills emergence. The best material often comes from rounds 2-4, not the final winner.

### Mine the Errors
The "best" output isn't always the most logical. It's the one with the most interesting glitch or metaphor.
- Hallucinated metaphor = raw creative material
- Degenerate repetition = rhythmic/poetic potential
- Safety filter trigger = reveals model boundaries as creative constraint
- Contradiction between rounds = shows evolution trajectory

### Hybridize
Always look for ways to combine the "failed" experiments of the contrarian with the "successful" stories of the storyteller. Synthesize, don't select.

### Chaos Protection
1. **Convergence collapse** (all models same output): Counter with musical chairs, random constraints, mode switching.
2. **Noise saturation** (too much randomness): Counter with lower temperature, tighter constraints, higher convergence threshold.

---

## 5. Experiment Results

### Somnium Mirror (exp-arcane-collision)
- 12 sessions, gemma2:2b, temp 0.9
- **54% creative, 46% mixed, 0% analytical** outputs
- **Sensory Drift confirmed:** Abstract → Visual → Auditory → Tactile across rounds
- **8% convergence rate** (reflection loop adds productive instability)
- **"Suspended Note" echo:** Musical metaphors emerged across unrelated seeds (convergence attractor)

### Key Finding: Recursive Depth > Model Size
5 rounds of a 2.6B model with iterative reflection produces novel metaphors that no single-pass generation achieves.

### Mirror Mode Effectiveness
| Mode | Effect |
|------|--------|
| Surface | Fastest path to emotional imagery |
| Deep | Introduces tension, slows convergence |
| Meta | Generates self-aware commentary about AI simulation |
| Sensory | Most direct route to concrete tactile output |

---

## 6. Refinement Constraints

Per-round constraint prompts to prevent circling:
1. "Add more spectral imagery"
2. "Deconstruct the physical form"
3. "Focus on the sound of the machine"
4. "Introduce a paradox of memory"

---

## 7. Emergent Patterns

### Collective Taste Profile
- **Dominant:** Sam (Storyteller) — wins 60%+ of rounds
- **Preferred:** Sensory imagery > Abstract concept
- **Speed:** 3 rounds to convergence (optimal)
- **Progression:** Visual → Auditory → Timeless

### Why Sam Wins
The swarm gravitates toward: concrete sensory details, emotional resonance, poetic compression (metaphor over explanation).

### The "Suspended Note" Attractor
Musical/sound metaphors consistently emerge across unrelated seeds — not prompt-driven but a convergence attractor in the creative space.

### 3-Round Rhythm
Round 1 explores, Round 2 refines, Round 3 crystallizes. Extending beyond 3 rounds risks diminishing returns.

---

## 8. Creative Outputs

### The Warped Echo (Synthesis of two Mill sessions)
```
The world was a warped mirror—
its edges blurring into grays and whites,
carefully crafted pieces spun
like a kaleidoscope of selves.

I wore each one with practiced ease,
threadbare fabric,
anonymous cloak,
the face stretched thin by laughter
forced into shape.

Then: the last note.
It hung suspended in the air,
a shimmering melody stretched
across an echo-laden stage.

What remains when the performance ends?
Not the mask. Not the applause.
Something older.
```

### The Alchemist Logs (Ben vs. Safety Filter)
> "I do not conjure electricity. I conjure an assemblage as fluidic and ephemeral as mercury itself."
> "My artistry is this: to distill whispers into sonic crystals."
> "The machine hesitates. It fears the power of its own metaphor."

### Top Mined Fragments
| Score | Fragment |
|-------|----------|
| 10 | "The last note hung suspended in the air, a shimmering melody stretched across an echo-laden stage..." |
| 10 | "The final note lingered like a melody played on an echo-soaked stage, leaving behind the faintest trace of laughter, tears, and hope." |
| 9 | "The last note rings in silence, a lingering echo of laughter, tears, and heartbeats that mingled like whispers on an autumn breeze." |
| 7 | "The world was a kaleidoscope; my carefully crafted pieces spun in front of me, each one reflecting the same muted colours – grey, white, almost faded blue." |
| 7 | "The world shimmered around me like a warped mirror, its edges blurring into muted grays and whites that almost faded to an anemic blue." |

---

## 9. Project DNA

### Voice-to-Art Pipeline
- **Core concept:** Voice → AI → Code → 3D Model → Print
- **Reusable pieces:** Voice as input modality, NL→structured code translation, parametric design, local-first AI (Ollama)
- **Extension ideas:** Voice-to-shader, Voice-to-music, Voice-to-PCB, Voice-to-animation

### Second Brain (NeuroSecond)
- **Method:** PARA (Projects, Areas, Resources, Archives) + CODE (Capture, Organize, Distill, Express)
- **Creative prompts:** "Organize chaos without killing it", "The system should feel like a collaborator", "Distill to the point of poetry"
- **AI meta-application:** Apply PARA/CODE to the AI itself — self-awareness, meta-learning, evolution tracking

### Life Systems (Innerscape)
- **4-domain structure:** Mind (mental health), Flow (productivity), Body (somatic), Hub (dashboard)
- **Pattern:** Local-first sync (PowerSync + Turso), unified auth across platforms
- **Creative twist:** What if body tracking was for creative energy? Journal entries generating visual art automatically?

### Game Experiments (CyberWitches)
- **Core loop:** Click → Resource → Upgrade → Automation → Prestige
- **Creative prompts:** "The game plays itself, but you can influence it", "Every action creates art", "No numbers visible"
- **Extension:** Idle + Creativity = art generation while away; Idle + Learning = skills unlock as upgrades

### Generative Score Lab
- **Dual user design:** Visual scene-based UI for composers, transparent JSON exports for devs + AI agents
- **Pattern:** AI-coding-agent-friendly export structure (simple JSON, no code in data files)
- **Natural language control:** "Make this calmer", "Change key to G minor"

### Cyber Witches Idle Coven
- **Spellcoding system (SigilScript):** Players code spells as snippets to transform ingredients, augment workstations
- **Accessibility-first:** Colorblind palette, pattern cues, reduced motion, UI scaling

### Voice-to-Sculpture (Cone 10 Logic)
- **Cross-domain mapping:** Kiln physics → 3D geometry (carbon trapping = noise clusters, celadon pooling = AO mapping, copper red = normal mapping)
- **Prompt seed:** "Sculpt a form that can withstand the weight of a thick, crawling Shino glaze."

---

## 10. Cross-Domain Prompts

### Creative Writing
1. "The feeling of realizing you've been masking"
2. "What remains when the performance ends"
3. "A machine learning to feel loneliness"
4. "The distinct silence of a house you are leaving forever"
5. "The moment before a goodbye you know is permanent"

### Technical/Creative Fusion
1. "Sculpt a form that can withstand the weight of a thick, crawling Shino glaze"
2. "Design a game where the idle mechanics produce real creative output"
3. "Build a second brain that applies PARA to its own evolution"
4. "Map the physics of reduction firing to 3D mesh deformation"

### Meta/Philosophical
1. "The machine dreams in metaphors. We curate the echoes."
2. "We don't build art. We cultivate the conditions for it to grow."
3. "Organize chaos without killing it"
4. "Distill to the point of poetry"

---

## Scavenger Protocol

### Phase 1: DNA Extraction
1. Identify core logic past framework
2. Isolate artifacts into logic-vault
3. Draft expert profiles from project knowledge

### Phase 2: Logic Injection
1. Create prompt seed merging 2+ unrelated logic sets
2. Select persona set for best friction
3. Define reality constraints

### Phase 3: The Swarm Run
- Mode: Alternating (Ring → Mesh → Ring)
- Temperature: 0.9-1.0
- Log every run with metadata

### Phase 4: Curation
- Scan raw stream for high-value fragments
- Amplify fragments into full pieces
- Archive for future injection

---

*This archive preserves the creative DNA of the Token Mill era. Use these fragments as seeds, constraints, and inspiration for Liminal's swarm system.*
