# Instrument / Sing Preservation Audit - 2026-05-24

## Purpose

Phase 5 required preserving existing Instrument/Sing work before any refactor,
rename, or repo split.

## Current Preserved Surface

The active branch contains the core Sing/Instrument work:

```text
packages/audio-core/
packages/sing/
gui/src/gui/audioSing.ts
gui/src/gui/singPreset.ts
gui/src/gui/singPreview.ts
gui/public/audio-sing-worklet.js
docs/SING_WORKSHOP_INSTRUMENT_SPLIT_PLAN.md
```

Test coverage includes:

```text
test/integration/sing-package.test.ts
test/unit/audio/audio-sing-worklet.test.ts
test/unit/sing/frame-conditioning.test.ts
test/unit/sing/preset-schema.test.ts
test/unit/sing/render-pipeline.test.ts
test/unit/sing/teleprompter.test.ts
test/unit/sing/teleprompter-benchmark.test.ts
test/unit/sing/voice-feature-stream.test.ts
```

## Rescued Mac Mini Evidence

Commit `35e4164c` preserved the Mac mini Sing cadence fix:

```text
gui/public/audio-sing-worklet.js
test/unit/audio/audio-sing-worklet.test.ts
```

The fix is present in this branch history and verified by a unit test that
loads the worklet and checks cadence behavior.

## New Work Built On Top

Commit `8209e81c` added the mock lyric teleprompter:

```text
packages/sing/src/teleprompter/phrases.ts
packages/sing/src/main.ts
packages/sing/src/style.css
packages/sing/src/recording/SessionRecorder.ts
test/unit/sing/teleprompter.test.ts
```

Commits `99d7fc9e`, `52e95df3`, and `9eea129d` added the phrase benchmark
harness, local OpenAI-compatible backend support, and a real local MLX
benchmark report.

The follow-up Phase 7 benchmark selected:

```text
/Users/simongonzalezdecruz/.lmstudio/models/LiquidAI/LFM2.5-350M-MLX-4bit
```

Its integration is optional and documented in:

```text
docs/audits/real-lyric-sidecar-integration-2026-05-24.md
```

## Real LFM Benchmark Verdict

The benchmark report is:

```text
docs/audits/sing-lfm2_5-mlx-local-benchmark-2026-05-24.md
docs/audits/sing-lfm2_5-mlx-local-benchmark-2026-05-24.json
```

The tested local `LFM2.5-1.2B-Instruct-MLX-8bit` model returned valid phrase
fragments, but it was rejected for runtime integration:

```text
average_first_phrase_ms: 1616.76
dropped_render_frames: 39
recommendation: rejected
```

Therefore the 1.2B candidate must not be wired into performance. The later 350M
candidate passed the first realtime benchmark and is the only selected model for
the optional Phase 8 sidecar.

## Repository Recommendation

Keep Instrument/Sing in this repo for now.

Do not create `KyaniteLabs/liminal-instrument` and do not rename
`packages/sing` until:

1. the preserved old `/Users/simongonzalezdecruz/Desktop/OMC/liminal`
   checkout backup is classified safely,
2. remaining local candidate paths are classified,
3. local-only Instrument/Sing commits are fully accounted for, and
4. the camera/movement prototype proves whether Instrument needs a separate
   runtime repo boundary.

The strongest current evidence supports Option C from the package plan:

```text
Keep packages/sing temporarily, rename later.
```
