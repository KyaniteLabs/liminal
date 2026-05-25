# Sing Camera Movement Runtime

Last updated: 2026-05-25

Sing can optionally use local camera movement as a performance control source.
It is disabled until the performer presses `Start cam`.

## Runtime Contract

- camera permission denial must leave Sing usable
- camera frames stay local in the browser
- no camera frames are uploaded, recorded, or added to session exports
- movement analysis runs in a worker
- worker stalls clear movement uniforms instead of blocking render
- render/audio/recording must keep working without camera

## Movement Features

The worker estimates coarse motion from downsampled frame differences:

- `u_movement` — normalized motion energy
- `u_movement_x` — motion center x, 0 to 1
- `u_movement_y` — motion center y, 0 to 1
- `u_distance` — bounding-box size proxy, 0 to 1

These uniforms are optional. Presets that do not declare them continue to render
from voice features only.

## Privacy Notes

The prototype uses `getUserMedia({ video, audio: false })` only after a button
press. It creates a hidden local video element, downsamples frames into an
in-memory canvas, and sends only that frame data to a same-origin worker. No
image data is persisted.
