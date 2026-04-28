# Voice Input + Aesthetic Guardrails Design

**Goal:** Add voice/singing audio input that drives visual generation via real-time audio feature extraction, and a comprehensive aesthetic quality system that enforces design, color, layout, typography, and sound harmony rules during generation.

**Architecture:** Two new modules (`src/audio/` and `src/aesthetic/`) wired into the existing RalphLoop as pre-generation context (audio features → visual parameters) and post-generation quality gates (aesthetic critic → violation feedback). Both integrate with CLI flags, chat/TUI interview flow, and the prompt library.

**Tech Stack:** Meyda.js (MIT, audio features), pitchfinder (MIT, pitch detection), chroma-js (Apache-2.0, color science), naudiodon (MIT, Node.js mic capture), color-thief (MIT, palette extraction from rendered output)

---

## Feature A: Voice/Singing Audio Input Pipeline

### Module Structure

```
src/audio/
  AudioAnalyzer.ts          — Core feature extraction (Meyda + pitchfinder)
  AudioCapture.ts           — Platform abstraction: BrowserAudioSource, NodeAudioSource, FileAudioSource
  AudioFeatureTypes.ts      — Type definitions for all extracted features
  AudioToVisualMapper.ts    — Maps audio features → VisualParameters for prompt injection
  prompts/
    audio-visual.ts         — PromptLibrary entries for audio-driven generation
```

### AudioCapture Abstraction

`AudioSource` interface yields `Float32Array` frames at 44.1kHz:

- **BrowserAudioSource** — `getUserMedia` + `AudioWorklet` for live mic streaming in browser
- **NodeAudioSource** — naudiodon for CLI mic capture (requires PortAudio native dep)
- **FileAudioSource** — loads WAV/MP3 files for offline analysis

All three produce the same frame format, keeping the analysis layer platform-agnostic.

### AudioAnalyzer (Meyda + pitchfinder)

Runs on 512-sample buffers (~23ms at 44.1kHz).

**Real-time features (every frame):**

| Feature | Source | Visual mapping |
|---------|--------|----------------|
| RMS / energy | Meyda | Visual intensity, scale, opacity |
| Spectral centroid | Meyda | Color brightness, shape sharpness |
| Spectral flatness | Meyda | Texture roughness vs smoothness |
| Spectral flux | Meyda | Motion turbulence, chaos level |
| MFCC (13 coefficients) | Meyda | Shape complexity, multi-param control |
| Chroma (12 pitch classes) | Meyda | Color hue palette |
| Loudness (Bark bands, 24) | Meyda | Per-frequency visual intensity |
| Perceptual sharpness | Meyda | Edge sharpness, detail level |
| Pitch (f0) | pitchfinder (YIN) | Primary hue, motion path, vertical position |
| ZCR (zero crossing rate) | Meyda | Texture density |

**Accumulated features (sliding window):**

| Feature | Window | Visual mapping |
|---------|--------|----------------|
| Onset detection | 100ms | Trigger events, particle bursts |
| Vibrato rate/depth | 500ms | Oscillation frequency/amplitude |
| Amplitude envelope | 100ms | Overall visual dynamics curve |
| BPM estimate | 2-5s | Animation tempo |

### AudioToVisualMapper

Converts raw AudioFeatures into structured VisualParameters:

```typescript
interface VisualParameters {
  palette: {
    hues: number[];          // from chroma + pitch
    saturations: number[];   // from spectral flatness
    lightness: number[];     // from spectral centroid
  };
  motion: {
    speed: number;           // from BPM
    turbulence: number;      // from spectral flux
    rhythm: 'smooth' | 'pulsing' | 'chaotic';
  };
  form: {
    complexity: number;      // from MFCC dimensionality
    sharpness: number;       // from spectral centroid
    scale: number;           // from RMS energy
  };
  dynamics: {
    energy: number;          // from RMS
    envelope: number[];      // smoothed amplitude over time
    onsets: number[];        // detected onset timestamps
  };
  composition: {
    focalWeight: number;     // from energy peaks
    balance: number;         // from stereo/spectral balance
  };
}
```

These get injected into the generation prompt alongside the user's text prompt as structured context.

### Prompt Library Entries

- `audio.voice-to-visual` — System prompt for audio-driven visual generation. Instructs the LLM to interpret VisualParameters and map them to the target domain (p5.js, shader, Three.js, etc.).

### Audio Feature Mappings (Intuitive Defaults)

These are the default mappings that AudioToVisualMapper uses. Users can customize via config:

| Audio property | Visual property | Intuition |
|----------------|----------------|-----------|
| Low pitch | Warm colors (red/orange) | Low = deep = warm |
| High pitch | Cool colors (blue/violet) | High = bright = cool |
| Loudness | Size/scale/opacity | Louder = bigger |
| Spectral brightness | Color lightness | Bright sound = light colors |
| Spectral flatness (noisy) | Rough/grainy texture | Noisy sound = noisy surface |
| Spectral flux (changing) | Turbulent motion | Changing sound = chaotic motion |
| Chroma distribution | Multi-hue palette | Each pitch class = a hue |
| Rhythm/onsets | Particle bursts, triggers | Beat = visual hit |
| Vibrato | Oscillation/wobble | Voice wobble = visual wobble |
| BPM | Animation speed | Tempo = visual tempo |

---

## Feature B: Aesthetic Guardrails

### Module Structure

```
src/aesthetic/
  AestheticCritic.ts            — Orchestrator: runs applicable domain critics, aggregates scores
  AestheticFeatureTypes.ts      — Shared types: DesignConstraints, CriticResult, AestheticScore
  critics/
    ColorHarmonyCritic.ts       — Palette harmony, contrast, temperature, saturation
    LayoutCritic.ts             — Rule of thirds, balance, whitespace, visual hierarchy
    TypographyCritic.ts         — Font pairing, size hierarchy, readability
    SoundHarmonyCritic.ts       — Consonance, rhythmic coherence, tonal center
    AestheticRulesCritic.ts     — Birkhoff O/C, rhythm, focal point, domain-specific rules
  extractors/
    ColorExtractor.ts           — Regex/AST extraction of color values from code
    LayoutExtractor.ts          — Extract positioning, sizing, canvas structure
    TypographyExtractor.ts      — Extract font choices, sizes, text elements
    SoundExtractor.ts           — Extract music/audio patterns from code
  DesignConstraints.ts          — Constraint definition type + preset profiles
  prompts/
    aesthetic-guardrails.ts     — PromptLibrary entries for constraint injection
```

### DesignConstraints Type

```typescript
interface DesignConstraints {
  color: {
    harmonyMode: 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'monochromatic' | 'free';
    maxColors: number;                     // max distinct colors on canvas
    saturationRange: [number, number];     // OKLCH chroma bounds [min, max]
    lightnessRange: [number, number];      // OKLCH L bounds
    contrastMin: number;                   // minimum contrast ratio between fg/bg
    temperatureBalance: 'warm' | 'cool' | 'balanced' | 'any';
    forbiddenColors?: string[];            // e.g., ['#000000', '#FFFFFF']
  };
  layout: {
    focalPointRequired: boolean;           // must have a clear focal point
    minWhitespace: number;                 // 0-1, minimum background fraction
    balanceThreshold: number;              // 0-1, how balanced left/right must be
    compositionGuide: 'rule-of-thirds' | 'golden-ratio' | 'center' | 'free';
  };
  typography: {
    maxFonts: number;                      // max distinct font families
    sizeHierarchyRequired: boolean;        // must have clearly different sizes
    minReadability: number;                // minimum contrast for text
    fontStyle: 'serif' | 'sans-serif' | 'mono' | 'mixed' | 'any';
  };
  sound: {
    maxDissonance: number;                 // 0-1, allowable dissonance level
    rhythmicCoherenceMin: number;          // 0-1, minimum rhythmic consistency
    tonalCenterRequired: boolean;          // must establish a key
  };
  general: {
    complexityRange: [number, number];     // Birkhoff order/complexity sweet spot
    forbiddenPatterns: string[];           // e.g., 'pure-black-background', 'default-blue'
    minAestheticScore: number;             // 0-1, aggregate score threshold
  };
}
```

### Preset Profiles

| Preset | Color | Layout | Typography | Sound | General |
|--------|-------|--------|------------|-------|---------|
| `minimalist` | 2-3 colors, low saturation, monochromatic | High whitespace, rule-of-thirds | 1 font, strong hierarchy | Low dissonance | Low complexity |
| `vibrant` | 5+ colors, high saturation, triadic | Dynamic, center focus | Mixed, playful | High energy | High complexity |
| `cinematic` | High contrast, warm temperature, split-complementary | Golden ratio, balanced | Serif, large sizes | Low-mid dissonance | Mid complexity |
| `playful` | Bright, analogous + accent, high saturation | Irregular, asymmetric | Mixed, bold | Rhythmic, upbeat | High complexity |
| `free` | No constraints | No constraints | No constraints | No constraints | No constraints |

### AestheticCritic Flow

```
1. Determine domain (p5, shader, three, music, hydra, etc.)
2. Select applicable critics:
   - Color: all visual domains
   - Layout: p5, three, revideo
   - Typography: p5, revideo (when text detected)
   - Sound: music, strudel domains
   - General aesthetic: all domains
3. Run extractors to pull features from generated code
4. Each critic evaluates against DesignConstraints
5. Each returns: { score: 0-1, violations: string[], suggestions: string[] }
6. AestheticCritic aggregates into final AestheticScore
7. If score < threshold: violations injected into next RalphLoop iteration
```

### Critic Details

**ColorHarmonyCritic** (chroma-js):
- Extract all color literals from code (hex, rgb, hsl, named colors, GLSL vec3/vec4)
- Convert to OKLCH for perceptually uniform analysis
- Check: harmony mode compliance, max colors, saturation range, contrast ratios, temperature balance, forbidden colors
- Detect: neon (chroma > 0.3), muddy (chroma < 0.05 with L in 0.3-0.7), clashing (large hue gaps without harmony justification)

**LayoutCritic**:
- Extract canvas dimensions, element positions (rect, ellipse, translate, etc.)
- Check: focal point existence (visual weight center near composition guide intersections), whitespace (estimate from element coverage), balance (left/right, top/bottom weight distribution)
- Score based on deviation from constraints

**TypographyCritic**:
- Extract font families, sizes, weights from code (textFont, textSize, fillStyle.font, etc.)
- Check: max fonts, size hierarchy (at least 2x difference between levels), readability (contrast with background)
- Penalize: too many fonts, uniform sizes, low-contrast text

**SoundHarmonyCritic**:
- Extract musical patterns from code (note sequences, chord definitions, scale usage)
- Check: dissonance level (interval analysis), rhythmic coherence (pattern consistency), tonal center (key/scale adherence)
- Uses music theory rules: consonant intervals (unison, 3rd, 5th, 6th), avoid excessive tritones/minor seconds

**AestheticRulesCritic**:
- Birkhoff's measure: estimate order (symmetry, repetition, harmony) vs complexity (element count, color count, pattern diversity)
- Rhythm: detect repetitive patterns and score their regularity
- Focal point: identify the dominant visual element and its prominence
- Domain-specific: p5 animation quality, shader math correctness, Three.js scene composition

### Static vs Runtime Analysis

**Static pass (always runs):**
- Regex/AST extraction of color values, positions, fonts, audio patterns
- Fast (~1ms), deterministic, no external deps beyond chroma-js
- Catches literal values in code but misses runtime-generated ones

**Runtime pass (optional, for high-stakes or when static score is borderline):**
- Render code in headless browser (Puppeteer)
- Screenshot the canvas
- Extract actual pixel palette with color-thief
- Re-run color and layout critics on real pixel data
- Slower (~2-5s) but catches everything

### Quality Gate Integration in RalphLoop

After each generation iteration:

```
1. Run AestheticCritic.evaluate(code, domain, constraints)
2. Get AestheticScore { aggregate, color, layout, typography, sound, general }
3. If aggregate < constraints.general.minAestheticScore:
   a. Format violations as actionable feedback
   b. Inject into next iteration's context via ContextBuilder
   c. Increment aesthetic_violations counter
4. Feed aesthetic score into ScoringEngine as a new dimension
5. RalphLoop termination: if 3+ consecutive iterations fail aesthetic gate, stop
```

### Prompt Library Entries

- `aesthetic.constraints` — Template that injects design rules into any generator's system prompt
- `aesthetic.feedback` — Template for formatting violations as actionable regeneration feedback

---

## Integration

### CLI Flags

```
--voice                      Enable live mic input
--voice-file <path>          Use audio file instead of live mic
--aesthetic <preset>         Apply preset: minimalist, vibrant, cinematic, playful, free
--aesthetic-config <path>    Load custom DesignConstraints from JSON
```

### RalphLoop Integration

```
1. Load audio (if --voice or --voice-file)
   → AudioCapture → AudioAnalyzer → AudioToVisualMapper → VisualParameters

2. Load design constraints (if --aesthetic or default)
   → DesignConstraints preset or custom config + audio-derived color constraints

3. Build prompt:
   → User prompt + VisualParameters (structured context) + DesignConstraints (rules)

4. Generate code via LLM (existing GenerationOrchestrator flow)

5. Post-generation aesthetic gate (NEW):
   → AestheticCritic.evaluate(code, domain, constraints)
   → If violations: inject feedback into next iteration

6. Score + iterate (existing ScoringEngine + aesthetic dimension)
```

### Chat/TUI Integration

**New interview questions (InterviewPhase.ts):**

1. Discovery phase: "Would you like to sing or hum to influence the generation?" [Yes / Upload audio / No]
2. Discovery phase: "Any aesthetic preferences?" [Minimalist / Vibrant / Cinematic / Playful / Custom / Surprise me]
3. If Custom: "What matters most?" [Color harmony / Layout / Typography / Everything]

**CreativeBrief extensions:**
- `audioFeatures?: AudioFeatures` — extracted audio data
- `visualParameters?: VisualParameters` — mapped visual params
- `designConstraints?: DesignConstraints` — aesthetic rules

**TUI feedback:**
- Live waveform/level meter when recording in the preview panel
- Aesthetic violation messages shown during generation progress

### New Domain Types

- `Domain` type gains `'voice'` (triggers audio pipeline, output domain determined by prompt)
- `DomainType` in RoutingData gains `'voice'`
- Voice keywords: sing, hum, voice, singing, melody, vocal, microphone, mic

### Dependencies

| Package | License | Purpose |
|---------|---------|---------|
| `meyda` | MIT | Audio feature extraction (spectral, MFCC, chroma, loudness) |
| `pitchfinder` | MIT | Pitch detection (YIN algorithm) |
| `chroma-js` | Apache-2.0 | Color science, harmony checks, contrast ratios |
| `naudiodon` | MIT | Node.js microphone capture (native, PortAudio binding) |
| `color-thief` | MIT | Palette extraction from rendered canvas (runtime pass) |

---

## Example Flows

### Example 1: Live singing → p5.js visual

```bash
$ liminal --voice --prompt "flowing particles" --aesthetic cinematic
```

1. Mic opens, user sings a descending melody
2. AudioAnalyzer extracts: pitch drops from C5 to C3, chroma = C-heavy, RMS moderate, spectral centroid drops (darker)
3. AudioToVisualMapper produces: hues shift blue→red, moderate energy, smooth rhythm
4. Cinematic constraints: high contrast, warm temperature, golden ratio layout
5. LLM generates p5.js code with warm red/blue particle system, golden ratio composition
6. AestheticCritic checks: colors are warm ✓, layout balanced ✓, contrast good ✓
7. Output: flowing warm-toned particle system matching the sung melody's arc

### Example 2: Upload recording → shader

```bash
$ liminal --voice-file singing.wav --prompt "glsl aurora" --aesthetic vibrant
```

1. WAV file loaded, full offline analysis: BPM=120, key=E minor, chroma distribution, spectral envelope
2. VisualParameters: multi-hue palette from chroma, pulsing rhythm at 120bpm, high complexity
3. Vibrant constraints: 5+ colors, high saturation, triadic harmony
4. LLM generates GLSL shader with colorful aurora bands synced to detected rhythm
5. AestheticCritic checks color harmony, no muddy/neon violations
6. Output: vibrant aurora shader with rhythmic pulsing matching the recording

### Example 3: Chat mode with guardrails

```
> liminal chat

Liminal: What would you like to create?
You: A abstract generative landscape

Liminal: Any aesthetic preferences?
  [Minimalist] [Vibrant] [Cinematic] [Playful] [Custom] [Surprise me]
You: Cinematic

Liminal: Would you like to sing or hum to influence it?
You: [Yes]

[Recording... waveform shown in TUI]
User sings for 10 seconds
[Analyzing audio...]

Liminal: Generating cinematic landscape...
  Iteration 1: aesthetic score 0.65 (violations: contrast too low, no clear focal point)
  Iteration 2: aesthetic score 0.87 (all clear)
  Done!
```
