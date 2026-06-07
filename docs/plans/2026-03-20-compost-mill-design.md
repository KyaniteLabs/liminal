# Compost Mill — Design Document

**Date:** 2026-03-20
**Status:** Draft
**Author:** Simon Gonzalez de Cruz + Claude

---

## 1. Concept

The Compost Mill is a living digestion system for creative material. Everything that is rejected, outdated, or no longer useful gets thrown into the heap instead of deleted. The Mill decomposes it into reusable creative nutrients — seeds for new ideas — and makes those seeds available to all Sinter functions.

**Metaphor:** Dead projects are organic matter. The Mill composts them into fertile soil. New projects grow from that soil.

**Key principle:** The Mill creates fertile ground, not finished products. It produces seeds. You (or any Sinter function) decide what to plant.

---

## 2. Architecture Overview

```
                        ┌──────────────┐
                        │   COMPOST    │
                        │    MILL      │
                        │              │
  Input ─────────────►  │  1. Intake   │
  (any file type)       │  2. Extract  │
                        │  3. Shred    │
                        │  4. Mix      │
                        │  5. Mine     │
                        │  6. Digest   │
                        │  7. Prune    │
                        └──────┬───────┘
                               │
                    ┌──────────┴──────────┐
                    │     THE SOUP        │
                    │  (continuous loop)  │
                    │                     │
                    │  pick 2 fragments   │
                    │  merge via LLM     │
                    │  score offspring   │
                    │  replace worst     │
                    │  promote seeds     │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        ┌─────┴─────┐   ┌────┴────┐   ┌──────┴──────┐
        │ seed bank │   │ digest/ │   │ Sinter     │
        │ seeds/    │   │ weekly  │   │ functions   │
        │ seeds.json│   │ .md     │   │ read from   │
        │ latest/   │   │         │   │ seed bank   │
        └───────────┘   └─────────┘   └─────────────┘
```

Two processes:
1. **The Mill** — batch digestion pipeline (triggered by schedule or heap size)
2. **The Soup** — continuous evolutionary loop, always simmering on the heap

---

## 3. Directory Structure

```
compost/
├── heap/                        # Raw input — anything dropped here
│   ├── rejected-output.md
│   ├── screenshot.png
│   ├── voice-memo.m4a
│   └── old-project/
│       └── README.md
├── digest/                      # Weekly digests
│   ├── 2026-03-20.md
│   └── 2026-03-13.md
├── seeds/                       # Seed bank — all Sinter systems read from here
│   ├── seeds.json               # Machine-readable seed index
│   └── latest/                  # Most recent nuggets as individual files
│       ├── seed-001-glaze-frequency.md
│       └── seed-002-voice-ceramic.md
├── soup-state.json              # Soup loop persistent state (population, archive)
└── config.json                  # Mill configuration
```

---

## 4. Configuration

```typescript
interface CompostConfig {
  // Heap
  heapDir: string;                    // default: 'compost/heap/'
  maxHeapSizeBytes: number;           // default: 50MB — triggers digestion when exceeded
  digestDir: string;                  // default: 'compost/digest/'
  seedDir: string;                    // default: 'compost/seeds/'

  // Schedule
  digestSchedule: 'manual' | 'daily' | 'weekly';  // default: 'weekly'
  digestDayOfWeek?: number;           // default: 0 (Sunday)

  // Soup
  soupEnabled: boolean;               // default: true
  soupPopulationSize: number;         // default: 20
  soupMaxStepsPerCycle: number;       // default: 50
  soupSeedPromotionThreshold: number; // default: 0.7
  soupCycleIntervalMs: number;        // default: 60000 (1 minute)

  // LLM Provider
  llm: {
    provider: 'local' | 'cloud' | 'auto';  // default: 'auto'
    // Local (LM Studio)
    localBaseUrl: string;            // default: 'http://100.66.225.85:1234/v1'
    localModel: string;              // default: 'auto' (use whatever is loaded)
    // Cloud
    cloudProvider: string;           // default: 'anthropic' (or 'openrouter', 'openai')
    cloudApiKeyEnvVar: string;       // default: 'ANTHROPIC_API_KEY'
    cloudModel: string;              // default: 'claude-sonnet-4-20250514'
    // Auto mode: try local first, fall back to cloud
    localTimeoutMs: number;          // default: 30000
  };

  // Scoring
  seedPromotionThreshold: number;     // default: 0.7
  maxSeedsPerDigest: number;          // default: 20
  nuggetRetentionDays: number;        // default: 90 — delete old nuggets after this
}
```

---

## 5. The Mill — Batch Digestion Pipeline

### 5.1 Stage 1: Intake

- Accepts any file into `compost/heap/`
- Nested directories preserved — archives extracted recursively
- Tracks total heap size
- Triggers digestion when: schedule fires OR heap exceeds 80% of `maxHeapSizeBytes`
- No preprocessing at intake

### 5.2 Stage 2: Extract (Three Layers)

Each file gets processed through three parallel extraction layers.

#### Layer 1: Semantic

Uses LLM to extract meaning from file content.

| File type | Extraction method | LLM prompt template |
|---|---|---|
| `.jpg`, `.png`, `.webp` | Vision model | "Describe what's in this image. Extract any ideas, techniques, patterns, or creative concepts visible." |
| `.m4a`, `.mp3`, `.wav`, `.ogg` | Audio transcription/summary | "Transcribe and summarize this audio. What ideas, rhythms, or patterns are present?" |
| `.mp4`, `.mov` | Frame sampling + audio extraction | "Describe these video frames. What concepts, movements, or patterns are shown?" |
| `.ts`, `.js`, `.py`, `.go` | DNAExtractor (existing) | Uses existing `DNAExtractor.extract()` — extracts core logic, constraints, patterns, prompts |
| `.md`, `.txt`, `.json` | Raw text content | Direct content extraction, no LLM needed |
| `.pdf` | PDF text extraction | Extract text, then process as markdown |
| `.zip`, `.tar`, `.gz` | Recursive extraction | Extract contents, process each file independently |
| `.stl`, `.obj`, `.glb` | 3D metadata + description | "Describe this 3D model. What form, structure, or creative concept does it represent?" |
| `.glsl`, `.frag`, `.vert` | Raw code + LLM summary | "Summarize what this shader does. What visual techniques does it use?" |

#### Layer 2: Structured Metadata

File-type-specific metadata extraction. No LLM needed — pure parsing.

**Images (JPEG, PNG, WebP, GIF, TIFF, SVG, BMP)**
- EXIF: camera, lens, focal length, exposure, ISO, GPS coordinates, timestamp, artist
- IPTC: caption, keywords, credits, category, source
- XMP: ratings, labels
- PNG chunks: tEXt comments, pHYs physical dimensions, tIME, sRGB, gAMA
- ICC color profile
- Technical: dimensions, aspect ratio, DPI, bit depth, color space, unique colors

**Audio (WAV, MP3, FLAC, OGG, M4A, AAC)**
- Core: sample rate, bit depth, channels, duration, bitrate
- Tags: title, artist, album, genre, year, composer, BPM, key
- WAV: RIFF chunks, cue points, regions
- FLAC: replay gain, cuesheet, SeekTable
- Analysis: tempo/BPM detection, key detection, loudness (LUFS), silence detection, spectral peaks, frequency histogram
- Fingerprint: AcoustID hash

**Video (MP4, MOV, AVI, MKV, WebM)**
- Video: codec, resolution, frame rate, duration, bitrate
- Audio tracks: same metadata as audio
- Phone-specific: GPS/gyroscope/accelerometer data
- Chapters, subtitles, thumbnail frames

**Code (.ts, .js, .py, .go, etc.)**
- AST: function names, class names, import graph
- Metrics: LOC, comment ratio, cyclomatic complexity
- Dependencies: package.json imports, require statements

**3D Models (STL, OBJ, GLB/GLTF, FBX)**
- Geometry: vertex count, face count, bounding box dimensions
- Materials, textures referenced, UV maps, scene hierarchy, animations

**Documents (PDF, DOCX, MD)**
- PDF: title, author, page count, fonts, bookmarks, annotations
- DOCX: revision history, word count, language, custom properties

**Archives (ZIP, TAR, GZ)**
- File listing with sizes, compression ratio
- Nested metadata (recursive into contents)

**System-level (all files)**
- Filesystem: inode, permissions, owner, extended attributes (macOS: com.apple.quarantine)
- Temporal: creation, modification, access timestamps
- Hash: MD5, SHA256
- Size in bytes

#### Layer 3: Raw Bytes

The physical substance of the file, treated as creative material.

- First 4KB as hex string (header magic bytes — file "DNA")
- Last 4KB as hex string (tail bytes)
- SHA256 hash as 64-char "genetic fingerprint"
- File size in bytes as numeric "weight"
- Full base64 encoding for files < 100KB (used as noise seed for soup)

### 5.3 Stage 3: Shred

All extracted material gets chopped into fragments.

```typescript
interface CompostFragment {
  id: string;                    // unique ID
  source: string;                // original file path
  domain: string;                // detected domain (ceramics, music, AI, game, CLI, etc.)
  layer: 'semantic' | 'structured' | 'raw';
  content: string;               // the fragment text
  metadata: {
    fileType: string;
    timestamp: string;
    hash: string;
    size: number;
    extractedAt: string;
    // Domain-specific extras (populated based on file type)
    bpm?: number;
    musicalKey?: string;
    gps?: { lat: number; lon: number };
    sampleRate?: number;
    aspectRatio?: string;
    exposure?: number;
    iso?: number;
    vertexCount?: number;
    // ...
  };
  tags: string[];
  score?: number;                 // assigned during Mine stage
}
```

Shredding strategies by layer:
- **Semantic text**: split by paragraph or section heading
- **Semantic code**: split by function/class
- **Structured metadata**: each metadata field becomes a fragment
- **Raw bytes**: chunked into 256-char hex blocks
- **Small files** (< 1KB): entire file = one fragment

### 5.4 Stage 4: Mix (Cross-Domain Collision)

Fragments from different domains get collided to produce emergent connections.

```
Collision strategies:
1. Timestamp collision  — files created within 1 hour, different domains
2. Size collision       — files of similar byte size, different types
3. Metadata collision   — same BPM + same aspect ratio; same GPS + different dates
4. Hash collision       — files with similar SHA256 prefixes (first 4 hex chars)
5. Random collision     — stochastic mixing (10% of all pairs)
6. Tag collision        — fragments sharing tags from unrelated domains
7. Domain-opposite      — deliberately pair most-different domains (ceramics ↔ music, CLI ↔ 3D)
```

For each collision pair, generate a cross-pollination prompt:

```
"Here are two fragments from unrelated projects:

[Fragment A — domain: {domain_a}, layer: {layer_a}]
{content_a}

[Fragment B — domain: {domain_b}, layer: {layer_b}]
{content_b}

What ideas, project concepts, or creative directions emerge from
the intersection of these two fragments? Be specific and surprising."
```

### 5.5 Stage 5: Mine

Score each fragment and collision result for value.

```typescript
interface FragmentScore {
  total: number;        // aggregate 0-10
  novelty: number;      // how unusual? unique words, uncommon domain combos
  density: number;      // ideas per character (emergence density)
  crossDomain: number;  // how many different source domains contributed?
  metadataRarity: number; // how unusual are the metadata values?
  connectionStrength: number; // how strong is the cross-domain link?
}
```

Scoring uses `HeuristicScorer` (existing) adapted for compost fragments. LLM-assisted scoring available for semantic fragments (cloud or local — see Section 8).

Fragments below `seedPromotionThreshold` (default 0.7) are marked for pruning. Top fragments are promoted to seeds.

### 5.6 Stage 6: Digest

Generate a weekly digest markdown file.

```markdown
# Compost Mill Digest — 2026-03-20

## Heap Stats
- 47 files composted (23.4 MB)
- 12 domains represented
- 8,231 fragments extracted
- 342 cross-domain collisions
- Soup ran 168 cycles (this week)

## Seeds Promoted This Week

### 1. Glaze Frequency Visualizer [Score: 9.2]
**Sources:** GlazeLab (ceramics, semantic) + Generative-Score-Lab (music, structured)
**Collision type:** Metadata (BPM 120 ↔ kiln ramp rate)
**Seed:** Map glaze thermal dynamics to audio frequency spectrums. A Shino
glaze's carbon trapping pattern IS a noise cluster — render it as sound
and you hear the kiln.

### 2. Voice-to-Ceramic Form [Score: 8.7]
**Sources:** voice-to-sculpture-app (3D, semantic) + Pottery-App (ceramics, structured)
**Collision type:** Domain-opposite (3D ↔ ceramics)
**Seed:** Voice parameters (pitch contour, amplitude envelope) map to
pottery form dimensions (height, wall thickness, rim profile).

### 3. ...

## Soup Highlights
- Best offspring: "The silence between MIDI notes has the same
  statistical distribution as the gaps between brushstrokes in
  watercolor painting" [novelty: 9.4]
- Most productive collision: ceramics × music (23 high-value offspring)
- Emergent pattern detected: 3 separate collisions produced ideas
  involving "temperature as color"
```

### 5.7 Stage 7: Prune

After digest generation:

1. **Promote**: Seeds (scored fragments above threshold) saved to `seeds/seeds.json` and `seeds/latest/`
2. **Digest**: Saved to `compost/digest/YYYY-MM-DD-digest.md`
3. **Purge**: All files in `compost/heap/` deleted
4. **Retain**: Nuggets in `seeds/seeds.json` persist. Old nuggets (> `nuggetRetentionDays`, default 90 days) are deleted
5. **Soup state**: Preserved in `soup-state.json` — population and archive survive pruning

---

## 6. The Soup — Continuous Evolutionary Loop

The Soup is a continuously running evolutionary process on the heap. It's the fermentation happening between harvests.

### 6.1 How It Works

```
while (running) {
  // 1. Pick 2 random fragments from heap + seed bank
  const a = randomFragment();
  const b = randomFragment(differentDomainFrom(a));

  // 2. Merge via LLM
  const offspring = await llm.merge(a, b);

  // 3. Score the offspring
  const score = await scoreFragment(offspring);

  // 4. If better than worst in population, replace it
  if (score > population.worst.score) {
    population.replace(worst, offspring);
  }

  // 5. Track novelty
  noveltyArchive.add(extractBehavior(offspring));
  mapElites.insert(offspring.behavior, score);

  // 6. If score exceeds threshold, promote to seed bank
  if (score > config.soupSeedPromotionThreshold) {
    seedBank.add(offspring);
  }

  // 7. Wait before next cycle
  await sleep(config.soupCycleIntervalMs);
}
```

### 6.2 Key Differences from Current SoupLoop

| Current SoupLoop | Compost Soup |
|---|---|
| Runs once, returns result | Runs continuously, always simmering |
| Population of p5 code strings | Population of **any fragment type** (text, metadata, raw bytes, collision results) |
| Merges code via `mergeSketchCode()` | Merges via **LLM** — "combine these two fragments" |
| Single prompt input | **No prompt** — heap and seed bank are the input |
| Evaluates code structure | Evaluates **creative value** (novelty, cross-domain density, emergence) |
| No persistence | **Persistent state** in `soup-state.json` |
| No seed output | **Promotes seeds** to seed bank |

### 6.3 Self-Emergence

The Soup discovers connections without human guidance:
- Random collisions from different domains
- Novelty archive prevents circling the same ideas
- MAP-Elites grid ensures diverse exploration
- No prompt means no human bias in what gets explored

### 6.4 Self-Evolution

The Soup improves over time:
- Fragments that produce high-value offspring get weighted higher in selection
- The population naturally gravitates toward fertile domain intersections
- Over weeks, the Soup learns which combinations produce the best seeds
- Seed bank feedback: previously promoted seeds get re-injected into the soup

### 6.5 Soup State Persistence

```typescript
interface SoupState {
  population: CompostFragment[];       // current population
  generation: number;                   // total cycles run
  bestSeed: CompostFragment | null;     // best offspring ever produced
  totalSeedsPromoted: number;
  domainHeatmap: Record<string, number>; // which domain combos produce best results
  lastCycleAt: string;                  // ISO timestamp
}
```

---

## 7. Seed Bank — Feeding Sinter

The seed bank is the fertile soil. All Sinter functions can draw from it.

### 7.1 Seed Format

```typescript
interface Seed {
  id: string;
  content: string;                // the seed text (idea, concept, prompt fragment)
  score: number;                  // 0-10 quality score
  source: {
    fragments: string[];          // IDs of source fragments
    collisionType: string;        // how the seed was discovered
    domains: string[];            // source domains
  };
  promotedAt: string;             // ISO timestamp
  usedBy: string[];               // which Sinter functions have used this seed
  useCount: number;
}
```

### 7.2 Integration Points

| Sinter Function | How it uses seeds |
|---|---|
| `SwarmOrchestrator` | Seeds available as swarm prompt seeds (via `FragmentArchive.randomPromptSeed()`) |
| `GeneratorRegistry` | Seeds inform generator routing — a ceramics seed routes to P5, a music seed to Strudel |
| `PromptLibrary` | Seeds registered as available prompts (27 existing + compost seeds) |
| `RalphLoop` | Seeds available as optional context for any generation run |
| `FragmentArchive` | Seeds merged into the fragment archive — persistent across sessions |
| `CompostSoup` | Seeds re-injected into the soup for further evolution |

### 7.3 Seed Lifecycle

```
  Created by Mill/Soup
         │
         ▼
    seed bank (seeds.json)
         │
    ┌────┼────────────────────┐
    │    │                    │
    │    ▼                    ▼
    │  Used by Sinter    Used by Soup
    │  function           (re-evolved)
    │    │                    │
    │    ▼                    ▼
    │  useCount++        produces offspring
    │    │                    │
    │    ▼                    ▼
    │  If useCount > N   If offspring better
    │  → mature seed     → new seed promoted
    │    │                    │
    └────┴────────────────────┘
         │
         ▼
    If age > 90 days AND unused
         │
         ▼
       pruned
```

---

## 8. LLM Provider Strategy

Every stage that requires LLM access supports both local and cloud providers. The `CompostMill` supports **tiered routing** — a fast local LLM for high-volume tasks and a primary (potentially cloud) LLM for creative-quality tasks.

### 8.1 Provider Modes

```typescript
type LLMProvider = 'local' | 'cloud' | 'auto';
```

| Mode | Behavior |
|---|---|
| `local` | Always use local LLM (LM Studio). Fails if unavailable. |
| `cloud` | Always use cloud LLM. Requires API key. |
| `auto` | Try local first (with timeout). Fall back to cloud on failure or timeout. |

### 8.2 Tiered Routing (Implemented)

The `CompostMill` constructor accepts an optional `fastLLM` parameter. When provided, high-volume stages use the fast LLM while creative stages use the primary LLM.

```typescript
// bin/sinter — CLI wiring
const llm = new LLMClient();                          // primary (hybrid: MiniMax → LM Studio fallback)
const fastLLM = new LLMClient({ provider: 'lmstudio' }); // fast local for bulk work
const mill = new CompostMill(llm, { soupEnabled: true, fastLLM });
```

| Stage | LLM Client | Concurrency | Rationale |
|---|---|---|---|
| Extract: Semantic (text) | `fastLLM` (local) | 8 | Direct read, no LLM needed for text |
| Extract: Semantic (code) | `fastLLM` (local) | 8 | Simple summarization — local 9B model sufficient |
| Mix: Collision prompts | `llm` (primary) | 5 | Creative cross-domain reasoning — quality matters |
| Mine: Fragment scoring | `fastLLM` (local) | 8 | Heuristic-dominant scoring — local is fine |
| Mine: Collision scoring | `fastLLM` (local) | 8 | Same as fragment scoring |
| Digest: Idea synthesis | `llm` (primary) | — | Creative writing — quality matters |
| Soup: Merge offspring | `llm` (primary) | — | Creative combination |
| Soup: Score offspring | `fastLLM` (local) | — | Quality evaluation |

### 8.3 Concurrency Tuning

Current concurrency limits (tuned for LM Studio with qwen3.5 9B):

| Stage | Concurrency | Notes |
|---|---|---|
| Extraction (`extractAll`) | 8 | Sweet spot for 9B local model. 15x caused latency spike, 5x was underutilized |
| Scoring (`mapSettled`) | 8 | Same reasoning |
| Collisions (`runAll`) | 5 | Lower — creative prompts are longer, more memory-intensive |

### 8.4 Performance Benchmarks

Measured with qwen3.5 9B via LM Studio on 3,019 heap files:

| Config | Per-request latency | Throughput | Est. time for 2,589 code files |
|---|---|---|---|
| 5x concurrency, hybrid | 7-14s | ~0.5/sec | ~86 min |
| 15x concurrency, hybrid | 25-35s | ~0.5/sec | ~86 min (saturated) |
| **8x concurrency, local direct** | **10-13s** | **~2/sec** | **~22 min** |

Key insight: Bypassing the hybrid provider's MiniMax-then-fallback overhead for extraction matters more than raw concurrency. Direct local routing eliminates the failed cloud attempt latency.

### 8.5 Stages and Their LLM Requirements

| Stage | LLM Usage | Local Capable | Cloud Recommended |
|---|---|---|---|
| Extract: Semantic (images) | Vision model | If local model supports vision | Yes — better vision quality |
| Extract: Semantic (audio) | Audio transcription | Via Whisper locally | Via cloud Whisper |
| Extract: Semantic (text/code) | Summarization | Yes (fastLLM) | Not needed |
| Mix: Collision prompts | Cross-domain reasoning | Yes (small models OK) | Yes (better reasoning, ~3x faster) |
| Mine: LLM-assisted scoring | Quality evaluation | Yes (fastLLM) | Not needed |
| Digest: Idea synthesis | Creative writing | Yes | Yes |
| Soup: Merge offspring | Creative combination | Yes | Yes |
| Soup: Score offspring | Quality evaluation | Yes | Not needed |

---

## 9. Cross-Domain Collision Matrix

Metadata-driven collisions produce the most surprising results.

### 9.1 Structural Collisions

| Metadata A | Metadata B | Collision produces |
|---|---|---|
| Image GPS coordinates | Video GPS coordinates | Location narrative across time |
| Photo ISO/exposure | Audio loudness (LUFS) | "Brightness" of sound |
| Audio BPM | Code cyclomatic complexity | Rhythmic structure as architecture |
| WAV sample rate | Image DPI | Resolution as metaphor |
| Image aspect ratio | Text line length | Structural rhythm |
| SVG viewBox | 3D bounding box | Spatial thinking across dimensions |
| Audio musical key | Image ICC color profile | Emotional color theory |
| File timestamps | File timestamps | Creative obsession patterns |
| Archive compression ratio | Text compression | Idea density metaphor |
| FLAC replay gain | Image gamma | Amplification as brightness |
| PDF font list | Audio genre tags | Typography meets music |
| File sizes | File sizes | Heavy ideas vs light ideas |

### 9.2 Domain Collision Heatmap

Most fertile intersections (based on repo analysis):

```
              ceramics  music  AI/LLM  game  3D  CLI  productivity
ceramics          -       9      7      6    8   3       4
music             9       -      5      8    7   4       3
AI/LLM            7       5      -      7    6   8       7
game              6       8      7      -    9   5       4
3D                8       7      6      9    -   3       3
CLI               3       4      8      5    3   -       8
productivity      4       3      7      4    3   8       -
```

---

## 10. Digest Format

The weekly digest is a markdown file in `compost/digest/`.

### 10.1 Sections

1. **Heap Stats** — files composted, domains, fragments, collisions, soup cycles
2. **Seeds Promoted** — ranked list of new seeds with source info, collision type, and seed content
3. **Soup Highlights** — best offspring, most productive collision, emergent patterns
4. **Domain Heatmap** — which domain intersections produced the most value this week
5. **Temporal Patterns** — what times/days produced the most creative material
6. **Mature Seeds** — seeds that have been used by Sinter functions (with use count)

### 10.2 Seed Entry Format

```markdown
### 1. {Seed Title} [Score: {N.N}]
**Sources:** {repo/file} ({domain}, {layer}) + {repo/file} ({domain}, {layer})
**Collision type:** {collision_strategy}
**Seed:** {seed content — the actual idea/prompt/concept}
**Tags:** {domain1}, {domain2}, {collision_type}, {auto_tags}
```

---

## 11. CLI Interface

```
# Drop files into the heap
sinter compost add <file-or-directory>...

# Trigger digestion manually
sinter compost digest

# Start/stop the soup
sinter compost soup start
sinter compost soup stop
sinter compost soup status

# Browse the seed bank
sinter compost seeds list [--top N] [--domain <domain>]
sinter compost seeds show <seed-id>

# Configuration
sinter compost config [--heap-size <MB>] [--schedule <daily|weekly>]
sinter compost config --llm local --base-url http://100.66.225.85:1234/v1
sinter compost config --llm cloud --provider anthropic

# Status
sinter compost status
```

---

## 12. Implementation Plan

### Phase 1: Core Pipeline
- CompostHeap class — directory management, size tracking, file intake
- MetadataExtractor — multi-format metadata extraction (no LLM)
- RawByteProcessor — hex/base64 extraction
- CompostShredder — fragment creation
- SeedBank — seed storage, querying, lifecycle management

### Phase 2: LLM Stages
- SemanticExtractor — LLM-based content extraction (local + cloud)
- CollisionEngine — cross-domain pairing and LLM merging
- FragmentScorer — heuristic + LLM scoring
- DigestGenerator — weekly digest creation

### Phase 3: The Soup
- CompostSoup — continuous evolutionary loop
- SoupState persistence
- Seed promotion from soup
- Novelty archive integration (reuse existing `NoveltyArchive`)
- MAP-Elites integration (reuse existing `MapElites`)

### Phase 4: Integration
- Seed bank → FragmentArchive bridge
- Seed bank → PromptLibrary bridge
- Seed bank → SwarmOrchestrator seed injection
- CLI commands (`sinter compost ...`)
- Config file support

### Phase 5: Polish
- Auto mode fallback logic (local → cloud)
- Digest scheduling (cron integration)
- Heap size monitoring and auto-trigger
- Nugget retention and pruning
- Tests

---

## 13. Existing Infrastructure Reused

| Component | Location | How Used |
|---|---|---|
| `DNAExtractor` | `src/scavenger/DNAExtractor.ts` | Extract DNA from code files (semantic layer) |
| `FragmentArchive` | `src/scavenger/fragments/FragmentArchive.ts` | Bridge seed bank into fragment system |
| `MiningEngine` | `src/swarm/MiningEngine.ts` | Fragment mining patterns (adapt for compost) |
| `HeuristicScorer` | `src/swarm/HeuristicScorer.ts` | 5-dim fragment scoring |
| `LLMClient` | `src/llm/LLMClient.ts` | All LLM calls (already supports multiple providers) |
| `CacheManager` | `src/llm/CacheManager.ts` | Cache LLM responses during digestion |
| `RetryManager` | `src/llm/RetryManager.ts` | Retry failed LLM calls |
| `NoveltyArchive` | `src/evolution/NoveltyArchive.ts` | Soup novelty tracking |
| `MapElites` | `src/evolution/MapElites.ts` | Soup diversity maintenance |
| `CreativeEvaluator` | `src/core/CreativeEvaluator.ts` | Quality gate for soup offspring |
| `Gallery` | `src/gallery/Gallery.ts` | Save digest artifacts |
| `PromptLibrary` | `src/prompts/PromptLibrary.ts` | Register compost prompts |
