# Sing Voice→Visual Expression Engine — Implementation Plan

**Goal:** Replace Sing's thin 5-scalar voice pipeline with a reusable, stabilized voice→visual expression engine so singing drives rich visual *mutation* (hue/form/shimmer/bloom/bursts), not just scaling.

**Architecture:** All work lands in `packages/audio-core` (browser/worklet-safe, shared). A worklet ring buffer + real FFT + YIN + one-euro filter produces a stabilized, enriched raw feature frame; a `SemanticMapper` translates it into `{palette, form, motion, texture, density, composition}`; an extended preset schema lets presets bind uniforms to semantic channels OR raw features; a default mapping makes any preset rich for free.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), pnpm workspace, Vitest, Web Audio AudioWorklet, WebGL. Reuses existing pure-TS extractors in `packages/audio-core/src/` (`FormantAnalyzer`, `PitchColorMapper`, `TimbreExtractor`, `AudioToVisualMapper`, `BPMKeyDetector`).

**Design ref:** `docs/plans/2026-06-06-sing-voice-visual-engine-design.md`

**Working branch:** `feat/sing-voice-visual-engine` (already created).

**Conventions (read before starting):**
- ESM: every relative import ends in `.js` (e.g. `import { hann } from './dsp/window.js'`).
- Tests: Vitest, colocated under `test/unit/audio/` or `packages/audio-core` per existing patterns (see `test/unit/audio/pitch-color-mapper.test.ts`). Use `vi.hoisted()` for any mock var referenced in `vi.mock()`. Assert specific values/tight ranges — no bare `toBeDefined()`.
- Each task is TDD: write failing test → run it (confirm fail) → implement → run (confirm pass) → commit + push.
- Verify command for the whole package: `pnpm --filter @liminal/audio-core test` (fallback `pnpm vitest run <path> --coverage=false`).
- `pnpm sing:typecheck` and `pnpm sing:build` must stay green after each phase.

---

## Phase 1 — DSP stabilization foundation

New dir: `packages/audio-core/src/dsp/`.

### Task 1.1: Hann window
**Files:** Create `packages/audio-core/src/dsp/window.ts`; Test `test/unit/audio/dsp/window.test.ts`

- **Step 1 — failing test:**
```ts
import { describe, expect, it } from 'vitest';
import { hannWindow, applyWindow } from '@liminal/audio-core/dsp/window.js';
describe('hannWindow', () => {
  it('is 0 at edges and 1 at center for odd length', () => {
    const w = hannWindow(5);
    expect(w[0]).toBeCloseTo(0, 6);
    expect(w[2]).toBeCloseTo(1, 6);
    expect(w[4]).toBeCloseTo(0, 6);
  });
  it('applyWindow scales samples in place-equivalent output', () => {
    const out = applyWindow(new Float32Array([1, 1, 1, 1, 1]), hannWindow(5));
    expect(out[2]).toBeCloseTo(1, 6);
    expect(out[0]).toBeCloseTo(0, 6);
  });
});
```
- **Step 2 — run, expect FAIL** (`Cannot find module`): `pnpm vitest run test/unit/audio/dsp/window.test.ts --coverage=false`
- **Step 3 — implement:** `hannWindow(n)` returns `Float32Array` with `0.5 - 0.5*cos(2πi/(n-1))`; `applyWindow(samples, w)` returns elementwise product (lengths must match, else throw).
- **Step 4 — run, expect PASS.**
- **Step 5 — commit + push.**

### Task 1.2: Radix-2 real FFT (magnitude spectrum)
**Files:** Create `packages/audio-core/src/dsp/fft.ts`; Test `test/unit/audio/dsp/fft.test.ts`
- **Test (behavioral):** feed a pure sine at bin k into `magnitudeSpectrum(samples, sampleRate)` of length 1024; assert the peak bin corresponds to the sine frequency within ±1 bin and that a DC-only input peaks at bin 0.
```ts
it('peaks at the sine frequency bin', () => {
  const N = 1024, sr = 48000, freq = 440;
  const s = new Float32Array(N);
  for (let i = 0; i < N; i++) s[i] = Math.sin(2 * Math.PI * freq * i / sr);
  const mag = magnitudeSpectrum(s, sr);
  const peak = mag.indexOf(Math.max(...mag));
  const peakHz = peak * sr / N;
  expect(Math.abs(peakHz - freq)).toBeLessThan(sr / N + 1);
});
```
- **Implement:** standard iterative radix-2 Cooley-Tukey on real input (imag=0), bit-reversal permutation, returns first `N/2` magnitudes. Require N power of two (throw otherwise). This replaces the O(N²) DFT in `VoiceFeatureStream.computeSpectrum`.
- **Verify:** `pnpm vitest run test/unit/audio/dsp/fft.test.ts --coverage=false`
- Commit + push.

### Task 1.3: YIN pitch detector
**Files:** Create `packages/audio-core/src/dsp/yin.ts`; Test `test/unit/audio/dsp/yin.test.ts`
- **Test:** synth sine at 220 Hz and 130.81 Hz (C3) over a 2048 window; assert `detectPitchYin(samples, sr).frequency` within ±2 Hz and `clarity > 0.8`; assert white-noise input returns `frequency: null`.
- **Implement:** YIN (difference function → cumulative mean normalized difference → absolute threshold 0.1 → parabolic interpolation). Return `{ frequency: number | null, clarity: number }`. Frequency range clamp 50–2000 Hz. **Delete the zero-crossing fallback** path once wired (Task 1.6).
- **Verify:** `pnpm vitest run test/unit/audio/dsp/yin.test.ts --coverage=false`
- Commit + push.

### Task 1.4: One-Euro filter
**Files:** Create `packages/audio-core/src/dsp/OneEuroFilter.ts`; Test `test/unit/audio/dsp/one-euro.test.ts`
- **Test:** a step input settles toward the new value over successive `filter(value, tMs)` calls (monotonic approach, not instant); a noisy-around-constant signal has lower variance out than in; fast ramps are tracked with less lag than a fixed EMA at the same min-cutoff.
- **Implement (complete):**
```ts
export interface OneEuroOptions { minCutoff?: number; beta?: number; dCutoff?: number; }
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;
  private readonly minCutoff: number; private readonly beta: number; private readonly dCutoff: number;
  constructor(o: OneEuroOptions = {}) { this.minCutoff = o.minCutoff ?? 1.0; this.beta = o.beta ?? 0.01; this.dCutoff = o.dCutoff ?? 1.0; }
  private alpha(cutoff: number, dt: number): number { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(x: number, tMs: number): number {
    if (this.tPrev === null || this.xPrev === null) { this.tPrev = tMs; this.xPrev = x; return x; }
    const dt = Math.max(1e-3, (tMs - this.tPrev) / 1000); this.tPrev = tMs;
    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(this.dCutoff, dt); const dxHat = this.dxPrev + aD * (dx - this.dxPrev); this.dxPrev = dxHat;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff, dt); const xHat = this.xPrev + a * (x - this.xPrev); this.xPrev = xHat;
    return xHat;
  }
  reset(): void { this.xPrev = null; this.dxPrev = 0; this.tPrev = null; }
}
```
- **Verify:** `pnpm vitest run test/unit/audio/dsp/one-euro.test.ts --coverage=false`
- Commit + push.

### Task 1.5: Ring buffer + hop accumulator
**Files:** Create `packages/audio-core/src/dsp/RingBuffer.ts`; Test `test/unit/audio/dsp/ring-buffer.test.ts`
- **Test:** push three 128-sample quanta into a 2048 buffer with hop 256; assert `takeFrameIfReady()` returns null until ≥hop samples since last frame, then returns a 2048-length Float32Array (most recent N, zero-padded until full); ordering is chronological (oldest→newest).
- **Implement:** fixed Float32Array(2048), write index, sample counter; `push(quantum)`; `takeFrameIfReady(hop)` returns the latest 2048-sample window (in order) once `hop` new samples have accumulated, else null.
- **Verify:** `pnpm vitest run test/unit/audio/dsp/ring-buffer.test.ts --coverage=false`
- Commit + push.

### Task 1.6: Rewire `analyzeVoiceFrame` onto the stabilized DSP path
**Files:** Modify `packages/audio-core/src/VoiceFeatureStream.ts`; Modify `packages/audio-core/src/audio/`→ actually worklet at `packages/sing/src/audio/worklet.ts`; Test `test/unit/audio/voice-feature-stream.test.ts`
- **Test:** with a 2048 sine fixture at 196 Hz (G3), `analyzeVoiceFrame` returns `pitchHz` within ±2 Hz and `confidence > 0.8` (previously failed → zero-crossing). White noise → `voiced: false`. Silence → `rms < 0.001`, `pitchHz: 0`.
- **Implement:** `analyzeVoiceFrame` consumes a full window (≥1024). Replace `computeSpectrum` DFT with `magnitudeSpectrum` (Task 1.2); replace `detectPitch`/zero-crossing with `detectPitchYin` (Task 1.3). Worklet (`worklet.ts`) pushes each 128-quantum into a `RingBuffer` and only calls `analyzeVoiceFrame` + posts a frame when `takeFrameIfReady(HOP=256)` returns a window. **Keep the SharedArrayBuffer write path** but only update on ready frames.
- **Verify:** `pnpm vitest run test/unit/audio/voice-feature-stream.test.ts --coverage=false` and `pnpm sing:typecheck`.
- **Latency check (new):** add `test/unit/audio/dsp/latency.test.ts` asserting one `analyzeVoiceFrame` call on a 2048 window completes in < 5 ms median over 50 runs (perf budget; mark skipped on CI if flaky, with a `log()`-style comment). Commit + push.

### Task 1.7: One-euro smoothing in the frame stabilizer
**Files:** Modify `packages/sing/src/render/pipeline.ts` (`stabilizeSingFrame`); Test `test/unit/audio/sing-stabilize.test.ts`
- **Test:** feed a jittery pitch sequence (e.g. 200, 260, 205, 255 Hz over 4 frames at ~16ms apart); assert one-euro output variance is lower than raw but tracks a sustained jump (200→400 held for 5 frames reaches >390 by frame 5 — proving low lag vs the old fixed-0.82 EMA which would lag more). Use per-feature `OneEuroFilter` instances (module-level map keyed by feature, reset on `start`).
- **Implement:** replace the fixed-coefficient `smoothValue` calls in `stabilizeSingFrame` with `OneEuroFilter` instances (rms, pitchHz, centroid, flux). Keep `normalizeRange`/`clamp01`. Keep onset as-is (event-like).
- **Verify:** `pnpm vitest run test/unit/audio/sing-stabilize.test.ts --coverage=false`. Commit + push.

---

## Phase 2 — Enriched feature vector

### Task 2.1: Extend `VoiceFeatureFrame` with rich fields
**Files:** Modify `packages/audio-core/src/VoiceFeatureStream.ts` (interface + analyzer); Test extends `voice-feature-stream.test.ts`
- Add fields: `pitchClass: number` (0–11), `octave: number`, `vowel: PhonemeCategory` + `formants: FormantData` (reuse `estimateFormants` from `FormantAnalyzer.js` — needs MFCC; compute MFCC from spectrum or approximate from FFT bins), `timbre: TimbreData` (reuse `extractTimbre`), `brightness: number`, `breathiness: number` (1 − harmonicity; derive from YIN clarity + spectral flatness), `vibratoRate: number`, `vibratoDepth: number` (Task 2.2), `dynamics: number` (short-term RMS envelope slope).
- **Test:** sustained "ah"-like formant fixture → `vowel` in open category; bright synth → `brightness > 0.6`; pure sine → `breathiness < 0.2`.
- Reuse existing `estimateFormants`, `extractTimbre`, `pitchClassToHue`/`midiToPitchClass`/`frequencyToMidi` from `PitchColorMapper.js`. **Do not reimplement** — import them.
- **Verify:** `pnpm vitest run test/unit/audio/voice-feature-stream.test.ts --coverage=false`. Commit + push.

### Task 2.2: Vibrato tracker
**Files:** Create `packages/audio-core/src/dsp/VibratoTracker.ts`; Test `test/unit/audio/dsp/vibrato.test.ts`
- **Test:** feed a pitch series modulated at 6 Hz, ±30 cents → `rate` within ±1 Hz of 6, `depth` > 0 and proportional; steady pitch → `rate≈0, depth≈0`.
- **Implement:** maintain a short pitch-cents history (e.g. last ~0.5s); estimate dominant modulation rate via autocorrelation of the de-meaned cents series, depth via half peak-to-peak cents.
- **Verify:** `pnpm vitest run test/unit/audio/dsp/vibrato.test.ts --coverage=false`. Commit + push.

---

## Phase 3 — SemanticMapper

### Task 3.1: `SemanticVisualState` type + `mapVoiceToSemantic`
**Files:** Create `packages/audio-core/src/SemanticMapper.ts`; Test `test/unit/audio/semantic-mapper.test.ts`
- **Type:** flat, shader-friendly:
```ts
export interface SemanticVisualState {
  palette: { hue: number; saturation: number; value: number; accentHue: number };
  form: { family: number; complexity: number; symmetry: number; sharpness: number };
  motion: { flow: number; turbulence: number; shimmer: number };
  texture: { grain: number; glow: number; softness: number };
  density: { coverage: number; spawn: number };
  composition: { scale: number; focalY: number; depth: number };
}
```
- **Implement `mapVoiceToSemantic(frame: VoiceFeatureFrame): SemanticVisualState`** per the design vocabulary, reusing `pitchClassToHue` (palette.hue), `formantsToGeometry` (form), `mapToVisualParams`/`extractTimbre` where useful:
  - palette.hue ← `pitchClassToHue(frame.pitchClass)`; value ← brightness; saturation ← 0.4+0.5*voiced.
  - form.family ← vowel category index; complexity ← formant geometry; sharpness ← attack/brightness.
  - motion.shimmer ← vibrato depth·rate; flow ← dynamics; turbulence ← breathiness.
  - texture.grain ← breathiness; glow ← brightness; softness ← 1−sharpness.
  - density.coverage ← rms; spawn ← onset.
  - composition.scale ← octave-normalized; focalY ← pitch height; depth ← rms.
  - All outputs clamped 0–1 (hue 0–1 wrapped).
- **Test:** assert specific channels respond to specific inputs (e.g. raising `pitchClass` rotates `palette.hue`; `onset:1` raises `density.spawn`; high `vibratoDepth` raises `motion.shimmer`); silence → low-energy neutral state. Error path: NaN/Infinity inputs → finite clamped outputs.
- **Verify:** `pnpm vitest run test/unit/audio/semantic-mapper.test.ts --coverage=false`. Commit + push.

---

## Phase 4 — Preset schema extension + binder

### Task 4.1: Extend `PresetSchema` with layered bindings
**Files:** Modify `packages/audio-core/src/PresetSchema.ts`; Test `test/unit/audio/preset-schema.test.ts`
- Add `export type SemanticChannel = 'palette.hue' | 'palette.saturation' | 'palette.value' | 'palette.accentHue' | 'form.family' | 'form.complexity' | 'form.symmetry' | 'form.sharpness' | 'motion.flow' | 'motion.turbulence' | 'motion.shimmer' | 'texture.grain' | 'texture.glow' | 'texture.softness' | 'density.coverage' | 'density.spawn' | 'composition.scale' | 'composition.focalY' | 'composition.depth';`
- Make `SingPresetMapping` a discriminated union:
```ts
export type SingPresetMapping =
  | { source: 'raw'; feature: SingVoiceFeature; target: string; curve: SingMappingCurve; min: number; max: number; smoothing?: number }
  | { source: 'semantic'; channel: SemanticChannel; target: string; curve?: SingMappingCurve; smoothing?: number };
```
- **Backward compat:** in `validateSingPreset`, treat a mapping with no `source` but a valid `feature` as `source:'raw'` (normalize on validate). Keep `schemaVersion: 1`.
- **Test:** valid semantic mapping passes; valid legacy raw mapping (no `source`) normalizes to raw and passes; bad channel string fails with a specific error; empty mappings still fails.
- **Verify:** `pnpm vitest run test/unit/audio/preset-schema.test.ts --coverage=false`. Commit + push.

### Task 4.2: PresetBinder — bind semantic + raw to uniforms
**Files:** Modify `packages/sing/src/render/pipeline.ts` (`mapSingPresetUniforms`, `SingUniformFrame`); Test `test/unit/audio/preset-binder.test.ts`
- Add `semantic?: SemanticVisualState` to `SingUniformFrame`. In `mapSingPresetUniforms`: for `source:'semantic'` mappings, read `frame.semantic` by channel path; for `source:'raw'`, current behavior. Apply curve + one-euro smoothing per mapping (reuse Task 1.4 filter keyed by target).
- **Test:** a preset with `{source:'semantic', channel:'palette.hue', target:'u_hue'}` produces `u_hue` equal to `frame.semantic.palette.hue` (curve linear); a raw mapping still works; missing `frame.semantic` → semantic targets default to 0 without throwing.
- **Verify:** `pnpm vitest run test/unit/audio/preset-binder.test.ts --coverage=false` and `pnpm sing:typecheck`. Commit + push.

### Task 4.3: Default mapping (richness for any preset)
**Files:** Create `packages/audio-core/src/defaultMapping.ts`; Modify binder to merge defaults; Test `test/unit/audio/default-mapping.test.ts`
- Export `DEFAULT_SEMANTIC_MAPPINGS: SingPresetMapping[]` binding the full vocabulary to conventional uniform names (`u_hue, u_sat, u_val, u_form, u_complexity, u_shimmer, u_flow, u_turbulence, u_grain, u_glow, u_coverage, u_spawn, u_scale, u_focalY, u_depth`).
- Binder merges defaults for any uniform the preset does **not** explicitly map (preset overrides win).
- **Test:** a preset declaring only one mapping still yields all default uniforms; an explicit mapping overrides the default for that target.
- **Verify:** `pnpm vitest run test/unit/audio/default-mapping.test.ts --coverage=false`. Commit + push.

### Task 4.4: Wire SemanticMapper into the runtime loop
**Files:** Modify `packages/sing/src/main.ts`; Test `test/integration/sing-package.test.ts` (extend)
- In the frame path (around `main.ts:296`), after building `rawFrame`/`stableFrame`, call `mapVoiceToSemantic(latestFrame)` and attach as `stableFrame.semantic` before `renderer.render`.
- **Test (integration):** drive the pipeline with a fixture frame and assert the renderer receives a frame whose `semantic.palette.hue` matches the mapper output (≥2 real modules: VoiceFeatureStream/SemanticMapper + pipeline binder).
- **Verify:** `pnpm vitest run test/integration/sing-package.test.ts --coverage=false`, `pnpm sing:build`. Commit + push.

---

## Phase 5 — Showpiece preset

### Task 5.1: "Moonlit Garden" GLSL preset using the full vocabulary
**Files:** Create `packages/sing/src/presets/moonlitGarden.ts` (exports `createSingPreset(...)` artifact); Test `test/unit/audio/moonlit-garden-preset.test.ts`
- GLSL fragment shader consuming `u_hue, u_val, u_form, u_complexity, u_shimmer, u_coverage, u_spawn, u_scale, u_focalY` etc. to render a blue-green garden that: shifts hue with pitch-class, blooms (coverage/scale) with dynamics, shimmers with vibrato, bursts (spawn) on onsets, morphs form with vowel. Declares mostly semantic mappings; relies on defaults for the rest.
- **Test:** `validateSingPreset(moonlitGarden())` → `ok:true`; shader source contains the expected `uniform float u_*` declarations; mappings reference only valid `SemanticChannel`s.
- **Verify:** `pnpm vitest run test/unit/audio/moonlit-garden-preset.test.ts --coverage=false`, `pnpm sing:build`.
- **Human gate:** `pnpm sing:dev`, open in Chromium (COOP/COEP), sing — confirm hue tracks pitch, bloom tracks dynamics, shimmer tracks vibrato. (Owner verifies; not automatable.)
- Commit + push.

---

## Phase 6 — Docs + finalize

### Task 6.1: Document the vocabulary + update preset authoring
**Files:** Create `docs/sing-voice-visual-vocabulary.md`; update `packages/sing/README.md` if present.
- Document each `SemanticChannel`, which vocal feature drives it, default uniform name, and how to author a preset (semantic vs raw). Include the default-mapping table.
- **Verify:** `pnpm check:doc-links`. Commit + push.

### Task 6.2: Coverage + quality gate + PR
- Run `pnpm --filter @liminal/audio-core test` (or `pnpm test:ci:fast`) and `pnpm test:quality` — confirm coverage ratchet not decreased and no weak-assertion violations.
- Run full `pnpm sing:typecheck && pnpm sing:build`.
- Open PR `feat/sing-voice-visual-engine` → `main`; ensure CI green (the same gates as #586). Owner reviews; merge.

---

## Risks / watch-items
- **Worklet bundle:** FFT/YIN imported into the AudioWorklet must be bundled into the worklet build (vite worklet entry). Verify the worklet still loads after adding deps (`pnpm sing:build` + the human gate).
- **YIN cost at 2048:** if the latency test (1.6) exceeds budget, reduce analysis window to 1024 for pitch or downsample; keep FFT window separate from pitch window if needed.
- **MFCC for formants:** `estimateFormants` expects MFCC. If MFCC isn't cheaply available in-worklet, approximate formants from FFT peak picking or compute a small MFCC; keep it behind the same `FormantData` return shape so `formantsToGeometry` is reused unchanged.
- **Coverage ratchet:** new files need real behavioral tests (above) to avoid zero-coverage CI failures.
