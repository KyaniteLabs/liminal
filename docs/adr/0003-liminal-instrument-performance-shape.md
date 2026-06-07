# ADR 0003 - Sinter Instrument Performance Shape

## Status

Accepted for this branch.

## Date

2026-05-24

## Context

The handoff clarifies that Sinter Instrument is not merely Sing. It is the
performance sibling of Sinter Sites:

```text
Sinter Instrument = Sinter tuned for live performance.
```

Studio creates aesthetic systems. Instrument makes them playable.

## Decision

Instrument must be a deterministic, local-first runtime for performing
Sinter-made aesthetic systems. AI may assist through optional sidecars, but it
must never block the hot loop.

## Input Families

Voice and singing:

```text
pitch_hz, pitch_confidence, rms, loudness, onset, sustain,
vibrato_rate, vibrato_depth, spectral_centroid, spectral_flux,
breathiness, sibilance, formants, voiced
```

Camera and movement:

```text
body_center_x, body_center_y, distance_to_camera, left_hand_height,
right_hand_height, hands_apart, torso_angle, head_tilt, movement_energy,
stillness, gesture_onset, face_presence, gaze_direction
```

Controllers:

```text
midi_cc, midi_note, osc_message, keyboard_key, gamepad_axis,
gamepad_button, touch_x, touch_y, tempo_clock, cue_trigger
```

Performance text:

```text
current_scene, recent_phrase, accepted_phrase, dismissed_phrase,
phrase_density, teleprompter_mode
```

## Hard Realtime Loop

```text
sensor input
-> local feature extraction
-> smoothing
-> mapping
-> render/audio engine
-> output frame
```

Targets:

```text
audio-to-pixel: <50ms when possible
render: 60fps
audio glitches: zero tolerated
LLM sidecar blocking: zero tolerated
offline mode: required
local-first: required
```

## Soft Sidecar Loops

The lyric sidecar may suggest short phrase fragments every few seconds. It may
time out, stall, or be disabled without affecting the performance.

The real LFM sidecar is currently blocked. The local MLX benchmark returned
valid fragments but failed the Phase 7 gate due latency and dropped render
frames.

## Camera / Movement Rule

Pose detection must run outside the rendering loop. Browser-based prototypes
should treat synchronous pose detection as main-thread risk and put detection in
a worker. Rendering may use stale pose features briefly; it must not wait for
pose output.

The first branch implementation uses a dependency-free worker-backed pixel
movement reducer. It exposes movement shader uniforms, privacy controls,
calibration, and a skeleton overlay without adding MediaPipe yet. This keeps the
realtime contract testable before a heavier pose model is adopted.

## Repository Rule

Keep `packages/sing` and `packages/audio-core` where they are until the
fragmentation audit is complete. Do not rename the package or create a separate
Instrument repo from partial evidence.
