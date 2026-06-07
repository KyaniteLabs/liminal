# Sinter × Sing: Workshop / Instrument Split

**Status:** Proposed
**Date:** 2026-05-13
**Branch:** `claude/review-liminal-architecture-dhe0X`

## Context

Sinter is positioned as "the Claude Code for creative coding" — a workshop with cognitive organs (Cortex, Gardener, Archive, Compost, Taste, Dreaming). Its loops are turn-based: prompt → generate → evaluate → iterate → learn. This is the right design for *authoring* creative artifacts.

The user wants something different from Sinter too: a vocal instrument they can perform live, recorded for posterity, with <50ms voice→pixel latency. This is *performance*, not authoring. Trying to make Sinter do both has produced a hybrid Studio "sing mode" that satisfies neither — every architectural decision is pulled between contradictory masters (LLM-in-loop vs. real-time, session-scale vs. frame-scale, exploratory vs. instrument-tight).

The industry resolves this tension by separating the **workshop** (TouchDesigner patch designer, Notch authoring, custom Max/MSP patches) from the **instrument** (the deterministic runtime the performer plays). No professional voice→visual artist runs an LLM in the hot path; latency forbids it. Even AI-augmented tools (StreamDiffusion, AudioLDM, etc.) sit at 200ms–1s and feel laggy compared to true real-time — so the cutting edge uses AI to *design* mappings/visuals offline, then runs them deterministically.

This plan splits Sinter accordingly. Sinter becomes unambiguously the workshop. A new package, **Sing**, becomes the instrument. The seam between them is two file formats — Sinter writes presets; Sing writes session logs.

## Industry Reference (why this shape)

**Performance-time tools** (real-time, deterministic, low-latency):
- TouchDesigner, Resolume, MadMapper, VDMX, Notch — node-based, GPU-first, <16ms latency. Audio analysis = FFT, bands, onsets, RMS, sometimes MIDI/OSC.
- Web stack: Hydra (live coding), p5.js/Three.js + Web Audio `AnalyserNode`, Strudel.
- Voice specifically: pitch via YIN or CREPE (neural, ~10ms), formants via LPC, spectral centroid, MFCC, onset detection. Praat for offline analysis.
- Pro vocal-driven artists (Imogen Heap's MiMu, Holly Herndon, Reeps One) build *custom instruments* with deterministic mappings tuned over months. Nothing they do at performance time uses an LLM.

**Authoring-time tools** (slow, deep thought, generative):
- Design the mapping. Build presets. Train models. Curate the parameter space.
- This is where LLMs and systems like Sinter shine.

The pattern is universal: separate the *instrument* (real-time, deterministic, tuned) from the *workshop* (slow, exploratory, generative). The instrument is *played*; the workshop *makes the instrument*.

## Decision

**Two packages in the existing pnpm workspace, sharing an extracted audio-core library.** Pure web runtime for Sing. Recording captures telemetry + audio raw; visuals re-render offline at any quality.

No live coupling between Sinter and Sing. Sing runs on stage offline. Sinter ingests session logs afterward and learns.

### Confirmed design choices

| Choice | Decision | Rationale |
|--------|----------|-----------|
| Repo shape | Same repo, separate package (pnpm workspace) | Easy shared-library updates, single CI, single test ratchet |
| Sing runtime | Pure web (single HTML+JS bundle) | Works on any laptop, MediaRecorder built-in, no install friction |
| Recording approach | Telemetry + audio raw; render video offline | Pro pattern — re-render at any resolution, lets Sinter analyze telemetry directly |
| Sinter's role at performance time | None (offline only) | <50ms latency forbids LLM in the loop; clean seam |
| Sinter's role post-session | Ingests telemetry into Archive/Compost/Taste | Closes the learning loop without coupling runtimes |

## Repo Layout

`pnpm-workspace.yaml` already exists with `.` and `gui`. Extend to:

```
liminal/
├── packages/
│   ├── audio-core/        # NEW — extracted from src/audio/
│   │   └── src/
│   │       ├── PitchDetector.ts        # moved from src/audio/
│   │       ├── FormantAnalyzer.ts      # moved
│   │       ├── MicCapture.ts           # moved
│   │       ├── TimbreExtractor.ts      # moved
│   │       ├── VoiceFeatureStream.ts   # NEW — AudioWorklet wrapper
│   │       └── index.ts
│   └── sing/              # NEW — the instrument
│       ├── index.html
│       ├── vite.config.ts
│       └── src/
│           ├── main.ts
│           ├── audio/                 # uses @liminal/audio-core
│           ├── render/                # WebGL/WebGPU pipeline
│           ├── presets/               # loads Sinter preset artifacts
│           ├── recording/             # MediaRecorder audio + telemetry logger
│           └── ui/                    # minimal performance UI
├── src/             # Sinter core (unchanged shape, audio/ becomes thin re-export)
├── gui/             # Studio (sing mode gets refactored to "preset authoring")
└── pnpm-workspace.yaml
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - .
  - gui
  - packages/*
```

## The Seam: Two Artifact Formats

### 1. Preset Artifact (Sinter → Sing)

A directory under `~/.liminal/sing-presets/<id>/` containing:
- `preset.json` — manifest: name, description, generator domain, mapping table
- `sketch.{glsl,js}` — the visual code (GLSL/Three.js/p5)
- `mapping.json` — voice-feature → uniform/parameter bindings with curves

```jsonc
// mapping.json example
{
  "pitch_hz": { "target": "u_hue", "curve": "log", "range": [0, 1] },
  "rms": { "target": "u_intensity", "curve": "linear", "range": [0, 1.5] },
  "onset": { "target": "u_pulse", "trigger": true, "decay_ms": 200 },
  "spectral_centroid": { "target": "u_brightness", "curve": "linear", "range": [200, 4000] },
  "sibilance": { "target": "u_grain", "curve": "linear", "range": [0, 1] }
}
```

### 2. Session Log (Sing → Sinter)

A directory under `~/.liminal/sing-sessions/<timestamp>/`:
- `audio.webm` — raw voice recording (WebM/Opus container, MediaRecorder native output; canonical on-disk format for sessions)
- `telemetry.jsonl` — timestamped voice features + parameter values + preset transitions (one row per frame, ~60Hz)
- `meta.json` — preset ids used, duration, performer-marked highlights

The Session Ingester decodes WebM/Opus on read when feeding downstream pipelines (Archive embeddings, offline render). MediaRecorder writes Opus bytes straight to disk with no additional transcode step — note this is *not* lossless, since Opus is a lossy encoder; the contract is "one encode, never re-encoded." If a session requires archival-quality audio for later analysis, capture a parallel WAV via `AudioWorklet` PCM dump alongside the WebM (out of scope for v1).

```jsonc
// telemetry.jsonl example row
{ "t_ms": 1234, "pitch_hz": 440.2, "rms": 0.18, "onset": false, "centroid": 1840, "preset_id": "ember-orbit-v3", "params": { "u_hue": 0.47, "u_intensity": 0.27 } }
```

Sinter's Studio gets a "Session Inbox" that ingests these into Archive/Compost/Taste.

## Migration Steps (incremental, each commits independently)

### Phase 1 — Extract `packages/audio-core`

**Files to move:** `src/audio/*.ts` → `packages/audio-core/src/*.ts`

**Files to update:**
- `src/audio/index.ts` becomes a thin re-export from `@liminal/audio-core` (preserves Sinter's existing imports)
- `package.json` adds `"@liminal/audio-core": "workspace:*"` dep
- `packages/audio-core/package.json` is new
- `pnpm-workspace.yaml` adds `packages/*`

**Verification:** `pnpm build && pnpm test` passes unchanged. No Sinter feature should regress.

### Phase 2 — Scaffold `packages/sing`

Create the package with a minimal vertical slice:
- Mic input via `MicCapture` from `audio-core`
- One hardcoded GLSL preset
- One AudioWorklet running `PitchDetector` (YIN) + RMS + spectral flux
- Uniforms updated per frame via SharedArrayBuffer
- Single full-screen canvas, no UI yet

**Verification:** Run `pnpm --filter sing dev` and open the served URL. The dev server must be configured to emit `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` so `SharedArrayBuffer` is available (vanilla Vite does *not* set these — use `vite-plugin-cross-origin-isolation` or equivalent middleware; this is the matching half of the COOP/COEP risk listed below). Opening `index.html` via `file://` won't satisfy cross-origin isolation and the worklet→render path will silently fall back. Once served, sing into the mic, see the canvas react, measure audio→pixel latency with a clap test (<50ms target).

### Phase 3 — Preset loader

- Define preset artifact format (`preset.json` schema in `packages/audio-core/src/PresetSchema.ts` so both sides share it)
- Sing loads presets from a directory drop or URL
- Switch between presets via keyboard

### Phase 4 — Recording

- Audio: MediaRecorder on the mic MediaStream → WebM/Opus
- Telemetry: append to a `Float32Array` ring buffer in the worklet, flush to JSONL on session end
- Offline renderer (CLI): `pnpm --filter sing render <session-dir> --resolution 4k` re-runs the preset against the telemetry stream and outputs MP4 via ffmpeg

### Phase 5 — Sinter authoring refactor

**In `gui/src/components/` (Studio sing mode):**
- Remove the live in-Studio canvas sing playback
- Rename "Sing mode" to "Preset authoring" — turn-based, fine
- Add an "Export to Sing" action that writes a preset artifact
- Add a "Test in Sing" button that opens `packages/sing` with the artifact preloaded

### Phase 6 — Session Inbox in Sinter

- New screen in Studio: drop a session directory, see telemetry waveform, listen to audio, watch the re-rendered visual
- Archive ingestion: voice features become semantic-search vectors; preset-transition patterns feed Taste; long-held presets weighted higher
- Compost: short, abandoned segments digest into seed material

## What Sinter Keeps, Removes, Adds

**Keeps:**
- `src/audio/` becomes a re-export of `@liminal/audio-core` — no public API breakage
- Voice profile → domain routing (now reframed as preset *authoring*)
- Evaluate-repair loop (still useful for generating preset sketches)
- All cognitive organs (Cortex, Gardener, Archive, Compost, Taste, Dreaming)

**Removes:**
- In-Studio live sing canvas (it was the hybrid that caused the impasse)
- Real-time audio reactivity wired into Studio's preview iframe
- Audio bootstrap path inside Studio's iframe sandbox (`gui/src/components/*` audio code)

**Adds:**
- Preset authoring flow in Studio
- Session Inbox + re-render preview
- Post-session learning pipeline (telemetry → Archive/Compost/Taste)

## Critical Files

**To be modified during Phase 1–2:**
- `src/audio/*.ts` (moved to `packages/audio-core/src/`)
- `src/audio/index.ts` (becomes re-export shim)
- `package.json` (add workspace dep)
- `pnpm-workspace.yaml` (add `packages/*`)

**To be created:**
- `packages/audio-core/package.json`
- `packages/audio-core/src/VoiceFeatureStream.ts` (AudioWorklet wrapper around existing detectors)
- `packages/audio-core/src/PresetSchema.ts` (shared types for preset + session formats)
- `packages/sing/package.json`
- `packages/sing/index.html`
- `packages/sing/src/main.ts`
- `packages/sing/src/audio/worklet.ts` (runs `PitchDetector` etc.)
- `packages/sing/src/render/pipeline.ts` (GLSL execution)
- `packages/sing/src/recording/SessionRecorder.ts`

**To be refactored during Phase 5:**
- `gui/src/components/` sing-related panels (rename, retarget to authoring)
- `gui/server.js` endpoint for `seed-canvas` → renamed to `seed-preset`

**To be added during Phase 6:**
- `src/sing/SessionIngester.ts` — reads session logs, hands to Archive/Compost/Taste
- `gui/src/components/SessionInbox.tsx`

## Reused Existing Code

- All of `src/audio/` (pitch detection, formant, mic capture) — moves wholesale to audio-core
- `src/archive/` — session-derived material lands here unchanged
- `src/compost/` — short/abandoned segments feed in unchanged
- `src/learning/` — taste model trains on preset-dwell-time signal
- Existing generators (`src/generators/glsl/`, `three/`, `p5/`, `hydra/`) — Sinter uses them to *author* preset sketches; Sing runs them deterministically

## Verification

End-to-end success criteria, in order:

1. **Phase 1 passes:** `pnpm build && pnpm test` after audio-core extraction shows zero regressions; `pnpm test:coverage` ratchet not breached.
2. **Phase 2 latency:** Clap test in Sing — clap-to-pixel <50ms measured with a phone slow-mo recording the laptop screen and clap simultaneously. (Industry standard verification.)
3. **Phase 3 portability:** Author a preset in Sinter, copy preset directory to a fresh machine with only Sing installed, open the HTML file, sing — same visual result.
4. **Phase 4 offline render:** Record a 60-second session; re-render at 4K; compare frame-by-frame parity against live recording on key beats.
5. **Phase 5 Studio cleanup:** Studio no longer ships an in-iframe live sing canvas. `git grep` for the removed code paths returns zero hits. `pnpm gui` boots cleanly.
6. **Phase 6 learning loop:** Run two sessions; verify Archive shows new entries derived from the sessions; verify Taste model preference vector shifted measurably (cosine distance to previous model > 0.01).

Across all phases: pre-commit hook passes, coverage ratchet holds or improves, no orphaned files.

## Open Risks (flag before starting)

- **AudioWorklet + SharedArrayBuffer requires COOP/COEP headers** when served from a dev server — Vite needs the right plugin. Easy, but a known foot-gun.
- **MediaRecorder on Safari** is patchy; primary target should be Chromium for performance reliability.
- **GPU on integrated graphics** may not hold 60fps at 1080p for the heaviest GLSL presets. The offline-render path is a fallback for high-quality output regardless.
- **Audio permission persistence** — browsers re-prompt on every fresh load if not served from a stable origin. For stage use, a Tauri wrapper later would solve this; pure-web is the right v1.

## Decision Log (conversation that produced this plan)

- User intuition: "starting to think this should be its own separate app or a separate interface or a separate layer or something that connects to sinter instead of being part of it." Confirmed correct.
- Primary use case: **live performance + recording** (audio + screen capture).
- Latency target: **<50ms (instrument-feel)** — locks deterministic runtime; rules out LLM-in-loop.
- Sinter's role: **authoring only, plus post-session analysis** — closes the cognitive-organs loop without coupling runtimes.
- Architecture options considered:
  - A. Two apps, shared library — **chosen**
  - B. Two frontends, one backend — rejected (still pulls backend design two ways)
  - C. Sing-as-output to an external runtime (e.g., TouchDesigner) — rejected (loses the integrated cognitive-organ loop)
