# Camera / Movement Prototype - 2026-05-24

## Status

Implemented as a safe v1 browser prototype in `packages/sing`.

## What Landed

Runtime files:

```text
packages/sing/src/movement/features.ts
packages/sing/src/movement/pose-worker.ts
packages/sing/src/main.ts
packages/sing/index.html
packages/sing/src/style.css
```

Tests:

```text
test/unit/sing/movement.test.ts
test/unit/sing/render-pipeline.test.ts
test/unit/sing/teleprompter.test.ts
```

## Architecture

Camera frames are sampled from `getUserMedia()` into a worker:

```text
camera stream
-> ImageBitmap sampler
-> pose-worker
-> coarse movement reducer
-> shader uniforms / skeleton overlay / telemetry
```

The first implementation does not add MediaPipe or any new dependency. The
worker performs a coarse local pixel-motion analysis so the render loop can be
validated before adopting heavier pose detection.

## Render Safety

The renderer never waits for worker output. If the worker stalls, the previous
movement features decay:

```text
movementEnergy -> 0
stillness -> 1
gestureOnset -> false
```

The main render loop keeps using voice features and the latest movement state.

## Controls

The Sing UI now includes:

- start/stop camera
- show/hide skeleton overlay
- calibrate neutral pose
- movement sensitivity slider
- privacy indicator

Camera permission denial is handled with:

```text
Camera access is blocked. Instrument can still run with voice/controllers.
```

## Shader Uniforms

The render pipeline exposes movement values as optional uniforms:

```text
u_body_x
u_body_y
u_distance
u_left_hand
u_right_hand
u_hands_apart
u_torso_angle
u_head_tilt
u_movement
u_stillness
u_gesture
```

Existing presets continue to work because these uniforms are optional.

## Privacy Boundary

Default behavior:

- camera frames are processed locally
- frames are not uploaded
- raw video is not recorded
- movement features may be logged only into the local session telemetry when
  recording is active
- the camera can be stopped independently of the microphone

## Verification

Focused verification run:

```bash
pnpm vitest run test/unit/sing/movement.test.ts test/unit/sing/render-pipeline.test.ts test/unit/sing/teleprompter.test.ts --coverage=false
pnpm --filter sing typecheck
```

Result:

```text
3 test files passed
14 tests passed
sing typecheck passed
```
