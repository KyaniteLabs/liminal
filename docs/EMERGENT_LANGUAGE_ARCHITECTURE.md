# Emergent Agent Language — Architecture

## Overview

Liminal's emergent language system gives the creative swarm its own compact vocabulary. Instead of sending verbose English instructions every round, personas communicate via structured notation tokens that are denser, cheaper, and evolve over time.

**Three complementary systems:**
- **CreativeNotation** (declarative) — fixed registry of ~30 tokens for input instructions
- **SymbolicCreativeLanguage** (emergent) — discovers symbols dynamically from outputs and tracks effectiveness
- **Agora Protocol** (inter-agent) — NL→routine compression for structured agent communication

## Notation Schema

### Token Format

```
~X:word
```

Where `X` is a category prefix and `word` is the specific token.

### Categories

| Prefix | Category   | Count | Examples |
|--------|-----------|-------|---------|
| `~d`   | Domain    | 6     | `~d:p5`, `~d:shader`, `~d:three`, `~d:hydra`, `~d:strudel`, `~d:tone` |
| `~s`   | Style     | 5     | `~s:organic`, `~s:geometric`, `~s:minimal`, `~s:maximal`, `~s:fractal` |
| `~m`   | Mood      | 5     | `~m:ethereal`, `~m:calm`, `~m:energetic`, `~m:dark`, `~m:playful` |
| `~t`   | Technique | 6     | `~t:noise`, `~t:particles`, `~t:symmetry`, `~t:recursion`, `~t:physics`, `~t:audio-reactive` |
| `~x`   | Avoid     | 4     | `~x:grids`, `~x:straight`, `~x:static`, `~x:flat` |

### Example

```
Input:  "~d:shader ~s:organic ~m:dark ~t:noise ~x:grids"
Expands to: "GLSL / fragment shader art, flowing natural biomorphic forms, shadowy heavy ominous, Perlin / simplex noise field, avoid grid-based layouts"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CreativeNotation.ts                      │
│  NOTATION_REGISTRY (26 tokens)                               │
│  expandNotation()  ←→  compressToNotation()                  │
└──────────────┬──────────────────────┬───────────────────────┘
               │                      │
       ┌───────▼──────┐       ┌───────▼──────────┐
       │ NotationTranslator │  │ prompt-fragments  │
       │ encodePrompt()     │  │ composeExpertPrompt│
       │ decodePrompt()     │  │ + notationLegend   │
       └──────────────────┘  └────────────────────┘
               │                      │
               │              ┌───────▼──────────┐
               │              │ ExpertPersonas.ts  │
               │              │ promptParts{}       │
               │              │ → composeExpertPrompt│
               │              └────────────────────┘
               │
       ┌───────▼──────────────────────────────────┐
       │ SymbolicCreativeLanguage.ts                │
       │ evolveNotation(winners, losers)            │
       │   → compressToNotation each seed           │
       │   → boost EMA for winning tokens (α=0.3)  │
       │   → decay EMA for losing tokens (α=0.15)  │
       │ getNotationStats() → token → EMA score     │
       └───────────────┬──────────────────────────┘
                       │
               ┌───────▼──────────┐
               │ CompostSoup.ts    │
               │ After each cycle: │
               │ sort by score     │
               │ split winners/losers │
               │ → evolveNotation()│
               └──────────────────┘


Phase B: Agora Inter-Agent Protocol
────────────────────────────────────

┌─────────────────────────────────────────────┐
│              AgoraProtocol.ts                │
│  compileToRoutine(nl) → compressed tokens    │
│  expandRoutine(routine) → full English       │
│  createMessage() → AgoraMessage factory      │
│  summarizeExchange() → token consensus       │
│  RoutineStage: propose|critique|vote|         │
│                 refine|merge                  │
└──────────────┬───────────────────────────────┘
               │
       ┌───────▼──────────────────────────┐
       │       RoutineChannel.ts           │
       │  broadcast() → all recipients     │
       │  directMessage() → single target  │
       │  getHistory(round?) → records     │
       │  getCompressedExchange(round)     │
       │    → summarizeExchange if ≥3 msgs │
       │  stats() → compression ratio      │
       └──────────────┬───────────────────┘
                      │
       ┌──────────────▼──────────────────┐
       │      SwarmOrchestrator.ts        │
       │  routineChannel (per-instance)   │
       │                                  │
       │  Each round:                     │
       │    winner → broadcast(propose)   │
       │    others → directMessage(refine)│
       │  On convergence:                 │
       │    winner → broadcast(merge)     │
       │                                  │
       │  EventBus SWARM_ROUND emitted    │
       │  with full round data after      │
       │  convergence check               │
       └──────────────────────────────────┘
```

## Token Evolution Flow

1. **Soup cycle runs** — seeds compete, scored by ScoringEngine
2. **Winners/losers identified** — top half vs bottom half
3. **Seeds compressed to notation** — `compressToNotation(seed.content)`
4. **EMA boosted/decayed** — matching tokens get α=0.3 boost (target 1.0) or α=0.15 decay (target 0.0)
5. **Future rounds influenced** — high-EMA tokens are preferred in prompt composition

## Agora Routine Flow (Phase B)

1. **Round completes** — SwarmOrchestrator has outputs + winner
2. **Winner broadcasts** — `propose` stage message with winning content to all others
3. **Non-winners refine** — each sends `refine` stage direct message back to winner
4. **Round exchange stored** — RoutineChannel groups messages by round number
5. **Compression triggers** — when ≥3 messages in a round, `summarizeExchange()` extracts densest tokens
6. **Convergence** — winner broadcasts `merge` stage as final consensus
7. **SWARM_ROUND emitted** — full round data (outputs, votes, winner, timestamp) via EventBus

## Token Savings

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Expert system prompt | ~160 tokens | ~137 tokens | 15% |
| Voting prompt per voter | ~70 words | ~22 words | 69% |
| Full notation directive | ~200 tokens | ~20 tokens | 90% |
| **Per swarm round (5+5)** | ~1,153 tokens | ~794 tokens | **31%** |

## File Map

| File | Purpose |
|------|---------|
| `src/swarm/CreativeNotation.ts` | Notation registry, expand/compress functions |
| `src/swarm/NotationTranslator.ts` | Prompt-aware encoder/decoder |
| `src/swarm/prompt-fragments.ts` | `notationLegend`, `composeExpertPrompt()` |
| `src/swarm/ExpertPersonas.ts` | Persona definitions with `promptParts` |
| `src/swarm/ModelRouter.ts` | Thompson Sampling Beta distributions per (model, taskType) |
| `src/swarm/AgoraProtocol.ts` | NL→routine compile/expand, message factory, exchange summarization |
| `src/swarm/RoutineChannel.ts` | Inter-agent message channel with broadcast/direct/compression |
| `src/brain/SymbolicCreativeLanguage.ts` | EMA tracking, `evolveNotation()` |
| `src/compost/CompostSoup.ts` | Evolution loop integration |
| `src/core/EventBus.ts` | `SWARM_ROUND` event with full round data |

## Testing

| Test file | Tests | Covers |
|-----------|-------|--------|
| `test/swarm/CreativeNotation.test.ts` | 10 | Expand, compress, round-trip, registry integrity |
| `test/swarm/NotationEvolution.test.ts` | 5 | EMA boost/decay, accumulation, crash safety |
| `test/swarm/ModelRouter.test.ts` | 10 | Thompson Sampling, exploration/exploitation |
| `test/swarm/RoutineChannel.test.ts` | 13 | Channel ops, history, eviction, compression, Agora round-trip, summarize |

## Honest Framing

This is **ML-inspired architecture**, not gradient-based training:
- "Contrastive learning" = LLM-as-discriminator
- "VQ-VAE" = embedding clustering
- "RL" = Thompson Sampling + bandit optimization
- "Curriculum learning" = progressive complexity
- "Agora routines" = structured message templates, not learned protocols

Future LoRA fine-tuning is possible — `QualityArchive.exportForFinetuning()` already exists as a pipeline.

## Implementation Status

| Phase | Status | Commits | Tests |
|-------|--------|---------|-------|
| P0: Foundation | Complete | 3 | Existing |
| P1: Performance | Complete | 3 | 10 (ModelRouter) |
| Phase A: Notation | Complete | 3 | 15 (CreativeNotation + NotationEvolution) |
| Phase B: Agora | Complete | 4 | 13 (RoutineChannel + AgoraProtocol) |
| **Total** | **Complete** | **13** | **38** |

## References

- CoComposer: ABC notation for multi-agent music (100% success)
- Verifiable Semantics: behavioral certification (51-96% disagreement reduction)
- EvoPrompt: evolutionary prompt optimization (25% over human, ICLR 2024)
- Agora: NL→routine progression (5x cost reduction, 100 agents)
- Kouwenhoven COLING 2025: LLMs get MORE verbose — explicit brevity pressure needed
