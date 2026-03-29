# Voice Input + Aesthetic Guardrails Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add voice/singing audio input that drives visual generation via real-time audio feature extraction, and an aesthetic quality system that enforces color, layout, typography, and sound harmony rules during generation.

**Architecture:** Two new modules (`src/audio/` and `src/aesthetic/`) wired into the existing RalphLoop — audio features inject pre-generation context into prompts, aesthetic critics run post-generation as a quality gate. Both integrate with CLI flags, LoopConfig, and the prompt library.

**Tech Stack:** meyda (audio features), pitchfinder (pitch detection), chroma-js (color science), vitest (tests)

---

## Context

The design doc (`docs/plans/2026-03-28-voice-aesthetic-design.md`) specifies two features. The RalphLoop currently has a quality gate at lines 204-228 of `src/core/RalphLoop.ts` that uses domain-specific thresholds. The aesthetic guardrails plug into this gate as an additional scoring dimension. The audio pipeline produces `VisualParameters` that get injected into prompts via `ContextBuilder.ts`.

Key integration points:
- **RalphLoop.ts:190-194** — `ScoringEngine.score()` call where aesthetic dimension gets added
- **RalphLoop.ts:204-228** — quality gate where aesthetic violations trigger feedback
- **LoopConfig.ts:20-95** — `LoopOptions` needs new fields for audio + aesthetic config
- **ContextBuilder.ts:16-72** — `buildContextForInjection()` needs to append audio-derived context
- **prompts/index.ts:4-16** — side-effect import pattern for new prompt registrations
- **bin/liminal:36-97** — flag parsing loop for new CLI flags
- **src/index.ts** — barrel exports for new public APIs

Existing patterns:
- Tests: vitest with `describe/it/expect`, imports use `.js` extensions (ESM)
- Prompts: `PromptLibrary.register({ id, version, category, systemPrompt, ... })` called at module load, then bare `import './module.js'` in barrel
- Config: `LoopOptions` fields normalized via `??` in `normalizeOptions()`

---

## Task 1: Audio Feature Types

**Files:**
- Create: `src/audio/types.ts`
- Create: `test/unit/audio/audio-types.test.ts`

**Step 1: Write the failing test**

```typescript
// test/unit/audio/audio-types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  AudioFeatures, PitchData, TimbreData,
  AudioAnalysisResult, VisualMappingParams
} from '../../../src/audio/types.js';

describe('Audio types', () => {
  it('AudioFeatures has required fields', () => {
    const features: AudioFeatures = {
      rms: 0.5, energy: 0.6, spectralCentroid: 2000,
      spectralFlatness: 0.3, zcr: 100, mfcc: [1, 2, 3],
      loudness: -10, spectralFlux: 0.2, chroma: new Float32Array(12),
      perceptualSharpness: 0.4
    };
    expect(features.rms).toBe(0.5);
    expect(features.mfcc).toHaveLength(3);
    expect(features.chroma).toHaveLength(12);
  });

  it('PitchData has required fields', () => {
    const pitch: PitchData = { frequency: 440, clarity: 0.95, midi: 69, noteName: 'A4' };
    expect(pitch.midi).toBe(69);
  });

  it('TimbreData has required fields', () => {
    const timbre: TimbreData = { brightness: 0.7, roughness: 0.3, warmth: 0.5, noisiness: 0.2 };
    expect(timbre.brightness).toBeGreaterThanOrEqual(0);
  });

  it('AudioAnalysisResult composes features, pitch, timbre', () => {
    const result: AudioAnalysisResult = {
      features: { rms: 0.5, energy: 0.6, spectralCentroid: 2000, spectralFlatness: 0.3, zcr: 100, mfcc: [1, 2, 3], loudness: -10, spectralFlux: 0.2, chroma: new Float32Array(12), perceptualSharpness: 0.4 },
      pitch: { frequency: 440, clarity: 0.95, midi: 69, noteName: 'A4' },
      timbre: { brightness: 0.7, roughness: 0.3, warmth: 0.5, noisiness: 0.2 },
      timestamp: Date.now()
    };
    expect(result.pitch?.noteName).toBe('A4');
  });

  it('VisualMappingParams maps audio to visual properties', () => {
    const params: VisualMappingParams = {
      palette: { hues: [0.1, 0.3], saturations: [0.5, 0.7], lightness: [0.6, 0.8] },
      motion: { speed: 0.5, turbulence: 0.3, rhythm: 'smooth' },
      form: { complexity: 0.6, sharpness: 0.4, scale: 0.7 },
      dynamics: { energy: 0.8, envelope: [0.5, 0.6, 0.7], onsets: [100, 500] },
      composition: { focalWeight: 0.6, balance: 0.5 }
    };
    expect(params.motion.rhythm).toBe('smooth');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/audio/audio-types.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/audio/types.ts` with the five interfaces matching the design doc's `AudioFeatures`, `PitchData`, `TimbreData`, `AudioAnalysisResult`, and `VisualMappingParams` (with nested palette/motion/form/dynamics/composition sub-objects per the design doc lines 68-94).

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/audio/audio-types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/audio/types.ts test/unit/audio/audio-types.test.ts
git commit -m "feat(audio): add audio feature type definitions"
```

---

## Task 2: Aesthetic Types and Design Constraints

**Files:**
- Create: `src/aesthetic/types.ts`
- Create: `test/unit/aesthetic/aesthetic-types.test.ts`

**Step 1: Write the failing test**

```typescript
// test/unit/aesthetic/aesthetic-types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  DesignConstraints, AestheticViolation, AestheticReport,
  CriticConfig, AestheticPreset
} from '../../../src/aesthetic/types.js';
import { DEFAULT_DESIGN_CONSTRAINTS, PRESET_PROFILES } from '../../../src/aesthetic/types.js';

describe('Aesthetic types', () => {
  it('DesignConstraints has all constraint categories', () => {
    const c: DesignConstraints = {
      color: { harmonyMode: 'analogous', maxColors: 5, saturationRange: [0.1, 0.9], lightnessRange: [0.2, 0.8], contrastMin: 4.5, temperatureBalance: 'balanced' },
      layout: { focalPointRequired: true, minWhitespace: 0.2, balanceThreshold: 0.6, compositionGuide: 'rule-of-thirds' },
      typography: { maxFonts: 2, sizeHierarchyRequired: true, minReadability: 4.5, fontStyle: 'any' },
      sound: { maxDissonance: 0.3, rhythmicCoherenceMin: 0.6, tonalCenterRequired: true },
      general: { complexityRange: [0.3, 0.8], forbiddenPatterns: [], minAestheticScore: 0.6 }
    };
    expect(c.color.maxColors).toBe(5);
  });

  it('AestheticViolation has required fields', () => {
    const v: AestheticViolation = { rule: 'max-colors', severity: 'error', message: 'Too many colors', location: 'line 42' };
    expect(v.severity).toBe('error');
  });

  it('AestheticReport has score, violations, passed', () => {
    const r: AestheticReport = { score: 0.8, violations: [], passed: true, timestamp: Date.now() };
    expect(r.passed).toBe(true);
  });

  it('DEFAULT_DESIGN_CONSTRAINTS has sensible values', () => {
    expect(DEFAULT_DESIGN_CONSTRAINTS.color.maxColors).toBe(7);
    expect(DEFAULT_DESIGN_CONSTRAINTS.general.minAestheticScore).toBe(0.6);
  });

  it('PRESET_PROFILES has minimalist, vibrant, cinematic, playful, free', () => {
    expect(Object.keys(PRESET_PROFILES)).toContain('minimalist');
    expect(Object.keys(PRESET_PROFILES)).toContain('vibrant');
    expect(Object.keys(PRESET_PROFILES)).toContain('cinematic');
    expect(Object.keys(PRESET_PROFILES)).toContain('playful');
    expect(Object.keys(PRESET_PROFILES)).toContain('free');
  });
});
```

**Step 2: Run test — FAIL**

**Step 3: Create `src/aesthetic/types.ts`** with `DesignConstraints`, `AestheticViolation`, `AestheticReport`, `CriticConfig`, and `AestheticPreset` types per the design doc lines 146-191. Include `DEFAULT_DESIGN_CONSTRAINTS` and `PRESET_PROFILES` constants.

**Step 4: Run test — PASS**

**Step 5: Commit**

```bash
git add src/aesthetic/types.ts test/unit/aesthetic/aesthetic-types.test.ts
git commit -m "feat(aesthetic): add design constraint types and preset profiles"
```

---

## Task 3: Pitch Utilities (pure, no deps)

**Files:**
- Create: `src/audio/PitchUtils.ts`
- Create: `test/unit/audio/pitch-utils.test.ts`

**Depends on:** Task 1

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { frequencyToMidi, frequencyToNoteName, midiToFrequency, clampFrequency } from '../../../src/audio/PitchUtils.js';

describe('PitchUtils', () => {
  it('frequencyToMidi(440) === 69', () => expect(frequencyToMidi(440)).toBe(69));
  it('frequencyToNoteName(440) === "A4"', () => expect(frequencyToNoteName(440)).toBe('A4'));
  it('frequencyToMidi(261.63) ~ 60 (C4)', () => expect(frequencyToMidi(261.63)).toBeCloseTo(60, 0));
  it('midiToFrequency(69) === 440', () => expect(midiToFrequency(69)).toBeCloseTo(440, 1));
  it('clampFrequency clamps to [20, 8000]', () => {
    expect(clampFrequency(10)).toBe(20);
    expect(clampFrequency(20000)).toBe(8000);
    expect(clampFrequency(440)).toBe(440);
  });
});
```

**Step 2: Run — FAIL. Step 3: Implement** using `midi = 69 + 12 * log2(freq/440)`. Pure math, no deps. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 4: AudioToVisualMapper (pure mapping)

**Files:**
- Create: `src/audio/AudioToVisualMapper.ts`
- Create: `test/unit/audio/audio-to-visual-mapper.test.ts`

**Depends on:** Task 1

**Step 1: Write failing test** for `mapToVisualParams(features, pitch?, timbre?)` returning `VisualMappingParams`:
- High pitch → high brightness, cool hues
- Low pitch → low brightness, warm hues
- High energy → high dynamics.energy, large scale
- All outputs clamped [0, 1]
- Null pitch → sensible defaults

**Step 2: Run — FAIL. Step 3: Implement** pure normalization formulas. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 5: ColorHarmonyCritic (static regex analysis)

**Files:**
- Create: `src/aesthetic/critics/ColorHarmonyCritic.ts`
- Create: `test/unit/aesthetic/color-harmony.test.ts`

**Depends on:** Task 2

**Step 1: Write failing test** for `analyzeColorHarmony(code, constraints): AestheticReport`:
- Code with 2 harmonious analogous hex colors → passes (score > 0.7)
- Code with 10+ distinct hex colors → maxColors violation
- Code with `fill('#ff0000')` + `background('#00ff00')` → complementary harmony detected
- Code with no colors → neutral pass (score 0.5)

**Step 2: Run — FAIL. Step 3: Implement** using regex to extract hex/rgb/hsl/named colors. Compute HSL hue distances. Check harmony mode compliance. No external deps yet. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 6: LayoutCritic (static code analysis)

**Files:**
- Create: `src/aesthetic/critics/LayoutCritic.ts`
- Create: `test/unit/aesthetic/layout.test.ts`

**Depends on:** Task 2

**Step 1: Write failing test** for `analyzeLayout(code, constraints): AestheticReport`:
- Code with `createCanvas(400, 400)` + `translate(width/2, height/2)` → passes
- Code with positions outside canvas → out-of-bounds warning
- Code with `textAlign(CENTER, CENTER)` → layout bonus
- Code missing `createCanvas` → warning

**Step 2: Run — FAIL. Step 3: Implement** regex extraction of canvas dims, positions, alignment. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 7: TypographyCritic (static code analysis)

**Files:**
- Create: `src/aesthetic/critics/TypographyCritic.ts`
- Create: `test/unit/aesthetic/typography.test.ts`

**Depends on:** Task 2

**Step 1: Write failing test** for `analyzeTypography(code, constraints): AestheticReport`:
- `textSize(16)` → passes
- `textSize(200)` → exceeds maxFontSize warning
- `textSize(4)` → below minFontSize warning
- Multiple `textFont()` calls without `loadFont()` → warning
- No text usage → neutral score

**Step 2: Run — FAIL. Step 3: Implement** regex for `textSize()`, `textFont()`, `textStyle()`. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 8: SoundHarmonyCritic (static code analysis)

**Files:**
- Create: `src/aesthetic/critics/SoundHarmonyCritic.ts`
- Create: `test/unit/aesthetic/sound-harmony.test.ts`

**Depends on:** Task 2

**Step 1: Write failing test** for `analyzeSoundHarmony(code, constraints): AestheticReport`:
- Code with harmonious frequencies (C4=261.63, E4=329.63, G4=392) → passes
- Code with tritone interval → dissonance warning
- Code with `gain.value = 0.9` → excessive gain warning
- Code with no audio → neutral pass

**Step 2: Run — FAIL. Step 3: Implement** regex extraction of frequency/gain literals. Map to notes, check interval consonance. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 9: AestheticCritic Orchestrator

**Files:**
- Create: `src/aesthetic/AestheticCritic.ts`
- Create: `src/aesthetic/index.ts` (barrel)
- Create: `test/unit/aesthetic/aesthetic-critic.test.ts`

**Depends on:** Tasks 5, 6, 7, 8

**Step 1: Write failing test** for `AestheticCritic.critique(code, config?): AestheticReport`:
- Runs all critics, aggregates scores (weighted average)
- Can disable individual critics via `config.enabledCritics`
- Merges violations from all critics
- Empty code → score 0
- Well-formed p5.js code with colors, layout, typography → high score
- Non-visual domain (music only) → only runs SoundHarmony + AestheticRules

**Step 2: Run — FAIL. Step 3: Implement** AestheticCritic class instantiating all 4 critics, dispatching based on domain, aggregating. Create barrel `src/aesthetic/index.ts` re-exporting all public types + classes. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 10: Install Audio Dependencies + AudioExtractor

**Files:**
- Create: `src/audio/AudioExtractor.ts`
- Create: `test/unit/audio/audio-extractor.test.ts`

**Depends on:** Task 1

**Step 1: Install deps**

```bash
npm install meyda
```

**Step 2: Write failing test** for `extractFeatures(buffer: Float32Array): AudioFeatures`:
- Silent buffer → near-zero rms/energy
- Known sine wave → predictable spectral centroid range
- Buffer of length 512/1024/2048 → no error
- Returns all required AudioFeatures fields populated

**Step 3: Run — FAIL. Step 4: Implement** using `Meyda.extract(['rms', 'energy', 'spectralCentroid', 'spectralFlatness', 'zcr', 'mfcc', 'loudness', 'spectralFlux', 'chroma', 'perceptualSharpness'], buffer)`. Handle Meyda returning null for short buffers. **Step 5: Run — PASS. Step 6: Commit.**

---

## Task 11: PitchExtractor (pitchfinder integration)

**Files:**
- Create: `src/audio/PitchExtractor.ts`
- Create: `test/unit/audio/pitch-extractor.test.ts`

**Depends on:** Task 1, Task 3

**Step 1: Install deps**

```bash
npm install pitchfinder
```

**Step 2: Write failing test** for `detectPitch(buffer: Float32Array, sampleRate: number): PitchData | null`:
- 440Hz sine wave at 44100 → `{ frequency: ~440, midi: 69, noteName: 'A4' }`
- Silent buffer → null
- Uses `frequencyToMidi` and `frequencyToNoteName` from PitchUtils

**Step 3: Run — FAIL. Step 4: Implement** using `pitchfinder.YIN(44100)`. Map to `PitchData` via PitchUtils. **Step 5: Run — PASS. Step 6: Commit.**

---

## Task 12: TimbreExtractor (derived from AudioFeatures)

**Files:**
- Create: `src/audio/TimbreExtractor.ts`
- Create: `test/unit/audio/timbre-extractor.test.ts`

**Depends on:** Task 1, Task 10

**Step 1: Write failing test** for `extractTimbre(features: AudioFeatures): TimbreData`:
- High spectral centroid + low spectral flatness → brightness > 0.7
- High ZCR + high spectral flatness → noisiness > 0.7
- High energy + low spectral centroid → warmth > 0.7
- All outputs clamped [0, 1]

**Step 2: Run — FAIL. Step 3: Implement** normalization formulas from AudioFeatures. No new deps. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 13: AudioAnalyzer Orchestrator

**Files:**
- Create: `src/audio/AudioAnalyzer.ts`
- Create: `src/audio/index.ts` (barrel)
- Create: `test/unit/audio/audio-analyzer.test.ts`

**Depends on:** Tasks 4, 10, 11, 12

**Step 1: Write failing test** for `AudioAnalyzer.analyze(buffer, sampleRate): AudioAnalysisResult` and `AudioAnalyzer.getVisualMapping(result): VisualMappingParams`:
- Chains extractor → pitch → timbre into full result
- getVisualMapping delegates to AudioToVisualMapper
- Timestamp is set

**Step 2: Run — FAIL. Step 3: Implement** AudioAnalyzer class composing AudioExtractor, PitchExtractor, TimbreExtractor. Create barrel `src/audio/index.ts`. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 14: AestheticStrategy (ScoringStrategy plugin)

**Files:**
- Create: `src/aesthetic/AestheticStrategy.ts`
- Create: `test/unit/aesthetic/aesthetic-strategy.test.ts`

**Depends on:** Task 9, uses `ScoringEngine` interface from `src/core/ScoringEngine.ts`

**Step 1: Write failing test:**
```typescript
import { ScoringEngine } from '../../../src/core/ScoringEngine.js';
import { AestheticStrategy } from '../../../src/aesthetic/AestheticStrategy.js';
import type { ScoringStrategy } from '../../../src/core/ScoringEngine.js';

describe('AestheticStrategy', () => {
  it('implements ScoringStrategy interface', () => {
    const strategy: ScoringStrategy = new AestheticStrategy();
    expect(strategy.name).toBe('aesthetic');
    expect(typeof strategy.score).toBe('function');
  });

  it('returns ScoringResult with aesthetic dimension', async () => {
    const strategy = new AestheticStrategy();
    const result = await strategy.score({ output: 'fill("#ff0000"); rect(10, 10, 100, 100);' });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.dimensions.aesthetic).toBeDefined();
    expect(result.strategy).toBe('aesthetic');
  });

  it('can be registered into ScoringEngine', () => {
    const engine = new ScoringEngine();
    engine.register(new AestheticStrategy());
    expect(engine.getStrategy('aesthetic')).toBeDefined();
  });
});
```

**Step 2: Run — FAIL. Step 3: Implement** AestheticStrategy implementing `ScoringStrategy`. Its `score(input)` calls `AestheticCritic.critique(input.output)` and maps to `ScoringResult`. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 15: Wire Audio + Aesthetic Config into LoopConfig

**Files:**
- Modify: `src/core/LoopConfig.ts` (add ~8 fields to LoopOptions)
- Create: `test/unit/core/loop-config-extensions.test.ts`

**Depends on:** Tasks 2, 13

**Step 1: Write failing test:**
```typescript
import { normalizeOptions } from '../../../src/core/LoopConfig.js';
import type { LoopOptions } from '../../../src/core/LoopConfig.js';

describe('LoopConfig audio + aesthetic extensions', () => {
  it('accepts useAestheticGuardrails option', () => {
    const opts = normalizeOptions({ useAestheticGuardrails: true });
    expect(opts.useAestheticGuardrails).toBe(true);
  });

  it('defaults useAestheticGuardrails to false', () => {
    const opts = normalizeOptions({});
    expect(opts.useAestheticGuardrails).toBe(false);
  });

  it('accepts aestheticConfig with preset', () => {
    const opts = normalizeOptions({ aestheticConfig: { preset: 'cinematic' } });
    expect(opts.aestheticConfig.preset).toBe('cinematic');
  });

  it('accepts visualMappingParams option', () => {
    const params = { palette: { hues: [0.1], saturations: [0.5], lightness: [0.6] }, motion: { speed: 0.5, turbulence: 0.3, rhythm: 'smooth' as const }, form: { complexity: 0.6, sharpness: 0.4, scale: 0.7 }, dynamics: { energy: 0.8, envelope: [], onsets: [] }, composition: { focalWeight: 0.6, balance: 0.5 } };
    const opts = normalizeOptions({ visualMappingParams: params });
    expect(opts.visualMappingParams).toBeDefined();
  });
});
```

**Step 2: Run — FAIL. Step 3: Add to `LoopOptions`:** `useAestheticGuardrails?: boolean`, `aestheticConfig?: { preset?: AestheticPreset; strictness?: 'lenient' | 'moderate' | 'strict'; constraints?: Partial<DesignConstraints> }`, `visualMappingParams?: VisualMappingParams`. Add corresponding required fields to `NormalizedLoopOptions`. Wire in `normalizeOptions()`. **Step 4: Run — PASS. Step 5: Commit.**

---

## Task 16: Wire Aesthetic Guardrails into RalphLoop Quality Gate

**Files:**
- Modify: `src/core/RalphLoop.ts` (lines ~190-228)
- Create: `test/integration/ralph-loop-aesthetic.test.ts`

**Depends on:** Tasks 9, 14, 15

**Step 1: Write failing test:**
```typescript
import { describe, it, expect } from 'vitest';

describe('RalphLoop aesthetic gate', () => {
  it('reduces score when aesthetic violations detected', async () => {
    // Run RalphLoop with useAestheticGuardrails: true and code that should
    // trigger violations (e.g., 15+ colors)
    // Verify that the aesthetic score dimension is populated in evaluation results
    // and that violations appear in iteration context
  });

  it('skips aesthetic gate when useAestheticGuardrails is false', async () => {
    // Default behavior: aesthetic gate not run
  });
});
```

**Step 2: Run — FAIL. Step 3: Modify RalphLoop.ts:**
- Import `AestheticCritic` from `../aesthetic/index.js`
- After the existing `scoringEngine.score()` call (~line 191), add: if `normalizedOptions.useAestheticGuardrails`, run `AestheticCritic.critique(currentCode, normalizedOptions.aestheticConfig)`. If `report.passed === false`, multiply `evaluation.score *= report.score` as penalty. Append violations to `evaluation.issues`.
- Emit aesthetic score in the `LOOP_EVALUATION` event (~line 196).
- At the quality gate (~line 217), also check if aesthetic score < `constraints.general.minAestheticScore` after iteration 2.

**Step 4: Run — PASS. Step 5: Commit.**

---

## Task 17: Wire Audio Context into ContextBuilder

**Files:**
- Modify: `src/core/ContextBuilder.ts`
- Create: `test/unit/core/audio-context-injection.test.ts`

**Depends on:** Tasks 13, 15

**Step 1: Write failing test:**
```typescript
import { buildContextForInjection } from '../../../src/core/ContextBuilder.js';

describe('Audio context injection', () => {
  it('appends audio analysis to context when visualMappingParams provided', () => {
    const params = { palette: { hues: [0.1, 0.3], saturations: [0.5, 0.7], lightness: [0.6, 0.8] }, motion: { speed: 0.5, turbulence: 0.3, rhythm: 'smooth' as const }, form: { complexity: 0.6, sharpness: 0.4, scale: 0.7 }, dynamics: { energy: 0.8, envelope: [], onsets: [] }, composition: { focalWeight: 0.6, balance: 0.5 } };
    const ctx = buildContextForInjection(1, { visualMappingParams: params } as any);
    expect(ctx).toContain('Audio-derived visual parameters');
    expect(ctx).toContain('hues');
  });

  it('does not append audio context when no params', () => {
    const ctx = buildContextForInjection(1, {});
    expect(ctx).not.toContain('Audio-derived visual parameters');
  });
});
```

**Step 2: Run — FAIL. Step 3: Modify `buildContextForInjection`** to accept `visualMappingParams` in its options parameter. When present, append a formatted block like:

```
Audio-derived visual parameters:
  Palette: hues=[0.10, 0.30], saturations=[0.50, 0.70], lightness=[0.60, 0.80]
  Motion: speed=0.50, turbulence=0.30, rhythm=smooth
  Form: complexity=0.60, sharpness=0.40, scale=0.70
  Dynamics: energy=0.80
  Composition: focalWeight=0.60, balance=0.50
```

**Step 4: Run — PASS. Step 5: Commit.**

---

## Task 18: Register Audio + Aesthetic Prompts

**Files:**
- Create: `src/prompts/audio.ts`
- Create: `src/prompts/aesthetic.ts`
- Modify: `src/prompts/index.ts` (add 2 side-effect imports)
- Modify: `test/prompts/prompt-validation.test.ts` (add to EXPECTED_IDS)

**Depends on:** Tasks 9, 13

**Step 1: Write failing test modification** — add `'audio.voice-to-visual'` and `'aesthetic.constraints'` to `EXPECTED_IDS` array, update the count assertion. Add test that each renders correctly with template variables.

**Step 2: Run — FAIL. Step 3: Create prompt files** following the existing pattern from `src/prompts/p5.ts`:
- `src/prompts/audio.ts`: `PromptLibrary.register({ id: 'audio.voice-to-visual', version: '2.0.0', category: 'audio', systemPrompt: '...', tags: ['audio', 'visual'] })`
- `src/prompts/aesthetic.ts`: `PromptLibrary.register({ id: 'aesthetic.constraints', version: '2.0.0', category: 'evaluation', systemPrompt: '...', tags: ['aesthetic', 'evaluation'] })`
- Add `import './audio.js'` and `import './aesthetic.js'` to `src/prompts/index.ts`

**Step 4: Run — PASS. Step 5: Commit.**

---

## Task 19: Wire Audio + Aesthetic into CLI Flags

**Files:**
- Modify: `bin/liminal` (lines 36-97 flag parsing, lines 317-364 generate command)

**Depends on:** Tasks 16, 17

**Step 1: Write failing test** — verify CLI parses:
- `--voice` → `flags.voice = true`
- `--voice-file <path>` → `flags.voiceFile = args[++i]`
- `--aesthetic <preset>` → `flags.aesthetic = args[++i]`
- `--aesthetic-config <path>` → `flags.aestheticConfig = args[++i]`
- These get passed through to `run()` options as `useAestheticGuardrails: true`, `aestheticConfig: { preset: flags.aesthetic }`, etc.

**Step 2: Run — FAIL. Step 3: Add flag parsing** in the `for` loop at lines 43-97:
```javascript
} else if (arg === '--voice') {
  flags.voice = true;
} else if (arg === '--voice-file') {
  flags.voiceFile = args[++i];
} else if (arg === '--aesthetic') {
  flags.aesthetic = args[++i];
} else if (arg === '--aesthetic-config') {
  flags.aestheticConfig = args[++i];
}
```

Wire into the `run()` call at line ~338: `useAestheticGuardrails: !!(flags.aesthetic || flags.aestheticConfig)`, `aestheticConfig: flags.aesthetic ? { preset: flags.aesthetic } : undefined`.

**Step 4: Run — PASS. Step 5: Commit.**

---

## Task 20: End-to-End Wiring — Exports, CreativeBrief, InterviewPhase

**Files:**
- Modify: `src/index.ts` (add exports)
- Modify: `src/chat/types.ts` (extend CreativeBrief + Domain)
- Modify: `src/chat/InterviewPhase.ts` (add discovery questions)
- Create: `test/integration/e2e-aesthetic-audio.test.ts`

**Depends on:** All previous tasks

**Step 1: Write failing test:**
```typescript
import { describe, it, expect } from 'vitest';
import { AestheticCritic } from '../../../src/aesthetic/index.js';
import { AudioAnalyzer } from '../../../src/audio/index.js';

describe('E2E: audio + aesthetic wiring', () => {
  it('exports AudioAnalyzer and AestheticCritic from index', async () => {
    const mod = await import('../../../src/index.js');
    expect(mod.AestheticCritic).toBeDefined();
    expect(mod.AudioAnalyzer).toBeDefined();
  });

  it('AestheticCritic critiques real p5 code end-to-end', () => {
    const critic = new AestheticCritic();
    const report = critic.critique(`
      function setup() { createCanvas(400, 400); }
      function draw() {
        background('#1a1a2e');
        fill('#e94560');
        ellipse(width/2, height/2, 100, 100);
        fill('#16213e');
        textSize(16);
        text('Hello', width/2, height/2);
      }
    `);
    expect(report.score).toBeGreaterThan(0);
    expect(typeof report.passed).toBe('boolean');
  });

  it('AudioAnalyzer processes a generated buffer', () => {
    const analyzer = new AudioAnalyzer();
    const buffer = new Float32Array(1024);
    // Fill with a simple sine wave
    for (let i = 0; i < 1024; i++) buffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    const result = analyzer.analyze(buffer, 44100);
    expect(result.features.rms).toBeGreaterThan(0);
  });
});
```

**Step 2: Run — FAIL. Step 3: Wire everything:**

- `src/index.ts`: Add `export { AestheticCritic } from './aesthetic/index.js'`, `export { AudioAnalyzer } from './audio/index.js'`, plus type exports for `DesignConstraints`, `VisualMappingParams`, `AudioAnalysisResult`, `AestheticReport`.
- `src/chat/types.ts:97`: Add `'voice'` to `Domain` type union.
- `src/chat/types.ts:107-124`: Add `audioPreference?: 'voice' | 'hum' | 'instrument' | 'none'` and `designConstraints?: DesignConstraints` to `CreativeBrief`.
- `src/chat/InterviewPhase.ts`: Add to `discovery` phase array: `{ id: 'audioPreference', phase: 'discovery', question: 'Would you like to use voice or singing to influence the visuals?', type: 'choice', options: ['No, text only', 'Yes, voice input', 'Yes, upload audio file'], required: false }` and `{ id: 'aestheticPreset', phase: 'discovery', question: 'Any aesthetic preferences?', type: 'choice', options: ['Minimalist', 'Vibrant', 'Cinematic', 'Playful', 'Surprise me'], required: false }`.

**Step 4: Run — PASS. Step 5: Commit.**

---

## Dependency Graph

```
Task 1 (Audio Types) ──┬──> Task 3 (PitchUtils) ────> Task 11 (PitchExtractor) ─┐
                        ├──> Task 4 (Mapper) ────────────────────────────────────┤
                        ├──> Task 10 (AudioExtractor) ──> Task 12 (Timbre) ──────┤
                        └──────────────────────────────> Task 13 (Analyzer) <────┘
                                                                           │
Task 2 (Aesthetic Types) ──┬──> Task 5 (ColorHarmony) ──┐                   │
                            ├──> Task 6 (Layout) ────────┤                   │
                            ├──> Task 7 (Typography) ────┼──> Task 9 (Critic)│
                            └──> Task 8 (SoundHarmony) ──┘       │          │
                                                              Task 14 (Strategy)
                                                              Task 15 (LoopConfig) <── Task 13
                                                                   │
                                                              Task 16 (RalphLoop Gate)
                                                              Task 17 (ContextBuilder)
                                                              Task 18 (Prompts)
                                                              Task 19 (CLI Flags)
                                                              Task 20 (E2E Wiring) <── ALL
```

**Parallelizable groups:**
- Tasks 1 + 2 (types) — fully parallel
- Tasks 3, 4, 5, 6, 7, 8 (pure logic) — fully parallel after their deps
- Tasks 10, 11 (external deps) — parallel after Task 1

---

## Verification

After all tasks complete, verify end-to-end:

1. **Unit tests:** `npx vitest run` — all tests pass
2. **Aesthetic gate test:** Run `RalphLoop.run()` with `useAestheticGuardrails: true` and a code sample with 15+ colors — verify violations detected and score penalty applied
3. **Audio analysis test:** Create a 440Hz sine wave `Float32Array`, run through `AudioAnalyzer`, verify pitch detected near A4 and visual params generated
4. **Prompt validation:** `npx vitest run test/prompts/` — all 38 IDs registered (36 existing + 2 new)
5. **CLI smoke test:** `node bin/liminal --help` shows new `--voice`, `--aesthetic` flags
6. **TypeScript compilation:** `npx tsc --noEmit` — no type errors
