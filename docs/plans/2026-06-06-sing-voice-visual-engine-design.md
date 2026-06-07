# Sing Voice→Visual Expression Engine — Design

**Date:** 2026-06-06
**Status:** Approved (design); implementation plan to follow
**Owner:** Simon Gonzalez de Cruz

## Problem

Singing into Sinter Sing today feels shallow and rough. Symptoms (owner-reported): the visuals "only get bigger and smaller," respond in a "stupid" one-dimensional way, and are jittery/laggy with cheap-looking output. A voice carries far more information than the system uses.

### Root cause (verified in code)
- The Sing performance runtime uses a thin pipeline: `packages/audio-core/VoiceFeatureStream` extracts ~5 crude scalars (rms, pitch, centroid, spectralFlux, onset) and the shader receives ~12 raw scalar uniforms, mapped as "scale this uniform."
- Pitch is analyzed on a **128-sample (~2.7ms) window** per audio quantum — too short to resolve sung pitch, so it frequently falls back to noisy **zero-crossing estimation** (`VoiceFeatureStream.ts:28`). → jitter.
- The "FFT" is a hand-rolled **O(N×bins) DFT** with trig in the inner loop (`VoiceFeatureStream.ts:78`). → crude, low-res spectral features.
- Smoothing is fixed EMA (0.68–0.82) in `render/pipeline.ts` — hides jitter but adds lag.
- The project **already built rich voice→visual intelligence** (`AudioToVisualMapper` → `{palette, motion, form, dynamics, composition}`, `FormantAnalyzer`, `PitchColorMapper`, `TimbreExtractor`, `VoiceToShapeMapper`, `BPMKeyDetector`) — but it lives in the old `src/audio/` path and is **not wired into Sing**. These modules are pure TS (browser/worklet-safe) and are currently **duplicated** between `src/audio/` and `packages/audio-core/`.

## Goal

A **reusable voice→visual expression engine**: any GLSL preset can declare which vocal dimensions drive which visual mutations, so singing produces rich *mutation* (hue shifts, form morphs, blooms, shimmer, bursts) rather than scaling. This also future-proofs the organism's auto-generated presets.

Non-goals (v1): full dedup of `src/audio/`; offline MP4 render; LLM in the performance hot path.

## Section 1 — Architecture & data flow

Three-stage layered engine, all in `packages/audio-core` (browser/worklet-safe, shared):

```
mic → [worklet] ring buffer (2048) + Hann + real FFT + YIN pitch
        → RAW FEATURE FRAME (enriched, stabilized via one-euro filter)
        → [SemanticMapper] musical/perceptual translation
        → SEMANTIC VISUAL STATE { palette, form, motion, texture, density, composition }
        → [PresetBinder] preset-declared bindings (semantic OR raw) + curve/smoothing
        → GLSL uniforms → render
```

- **Layered interface:** semantic state is the primary binding surface; raw features remain available as an escape hatch.
- The unused `AudioToVisualMapper` becomes the seed of `SemanticMapper`, consolidated into `audio-core`.
- Hot path is pure DSP/math — **no LLM**.

## Section 2 — Expressive vocabulary (default mapping)

Each vocal dimension drives a *different kind* of mutation:

| Vocal feature | Drives | Visual effect |
|---|---|---|
| Pitch-class (chroma) | palette **hue** | each note paints a color; melody repaints the scene |
| Octave | composition **scale / height** | higher register = higher, finer, lighter |
| Vowel (F1·F2) | **form family / morph** | "ah"=open bloom · "ee"=sharp/spiky · "oo"=round/closed |
| Vibrato (rate+depth) | motion **shimmer / oscillation** | expressive wobble → visible shimmer |
| Loudness / RMS | **density / coverage** | louder = more & fuller, not just bigger |
| Dynamics arc (swell) | **bloom vs recede** | crescendo grows/opens; decay recedes |
| Timbre / brightness | palette **value** + texture **glow** | bright = luminous; dark = deep/matte |
| Breathiness (HNR) | texture **grain / softness** | airy = soft/grainy; pure = clean |
| Attack / onset | **bursts / spawns** | consonants fire particle bursts/ripples |
| Pitch stability | **form coherence vs dissolve** | steady = solid; unstable = dissolving |

## Section 3 — Preset schema extension

Extend `PresetSchema.mapping` with a `source` discriminator (backward-compatible — existing `feature→uniform` entries become `source:'raw'`):

```ts
{ source: 'semantic', channel: 'palette.hue',     target: 'u_hue',     curve, smoothing }
{ source: 'semantic', channel: 'form.complexity', target: 'u_complex', curve, smoothing }
{ source: 'raw',      feature: 'pitchHz',          target: 'u_pitch',   min, max, curve, smoothing }
```

A **default mapping** auto-binds the full vocabulary so any preset (including future auto-generated ones) is rich without declaring anything.

## Section 4 — DSP stabilization (foundation)

In the `audio-core` worklet path:
- **Ring buffer (2048)** accumulated across quanta; analyze on a hop.
- **Hann window** → **real radix-2 FFT** (replaces O(N²) DFT).
- **YIN pitch** on the full window; delete the zero-crossing fallback.
- **One-Euro filter** per feature (replaces fixed EMA): low latency when moving, smooth when holding.
- **Adaptive auto-gain** so quiet and belted singing both map well.

## Section 5 — Consolidation

`packages/audio-core` becomes the single source for rich extraction (reusing the pure-math logic already present). Sing consumes it. Full dedup of the `src/audio/` copies is a **follow-up**, not forced in v1 (avoids destabilizing the main sinter world).

## Section 6 — Phased build plan

1. **DSP foundation** — ring buffer + FFT + YIN + one-euro + auto-gain. *Verify: stable pitch on a sung fixture; latency budget.*
2. **Enriched features** — vowel/formants, vibrato, timbre, breathiness, dynamics arc, pitch-class. *Verify: feature unit tests on PCM fixtures.*
3. **SemanticMapper** — raw → `{palette, form, motion, texture, density, composition}`. *Verify: mapping unit tests.*
4. **Preset schema + binder** — semantic/raw bindings, curves, one-euro smoothing, default mapping. *Verify: binding tests.*
5. **Showpiece preset(s)** — GLSL using the full vocabulary (blooming moonlit garden). *Verify: owner sings.*
6. **Default mapping + docs** — richness for any preset; document the vocabulary.

## Section 7 — Testing / verification

- Unit tests on **recorded PCM fixtures** (deterministic): pitch/vowel within tolerance, SemanticMapper, PresetBinder, one-euro filter.
- Latency/perf budget assertion (analysis under hop budget).
- Error paths: silence, broadband noise, clipping.
- Repo standards: behavioral assertions, `vi.hoisted`, no weak assertions, coverage ratchet.
- Final gate is human: owner singing into the showpiece preset.

## Relationship to broader strategy

This is the prerequisite for "Live Loop v0" (`author → sing → ingest → improve`): no point recording sessions for the organism to learn from until the perform experience is rich and good. The Sing→organism `SessionIngester` (currently missing) is the next milestone *after* this engine makes singing worth recording.
