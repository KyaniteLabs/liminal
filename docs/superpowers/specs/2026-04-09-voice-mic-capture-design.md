# Voice Mic Capture — Design Spec

**Date:** 2026-04-09
**Status:** Approved

## Overview

A new `src/audio/MicCapture.ts` module that captures microphone audio via ffmpeg and returns a `Float32Array` ready for `AudioAnalyzer`. Reuses the same conversion pipeline as the existing file-based path (s16le PCM → Int16 → Float32).

## Architecture

### New file: `src/audio/MicCapture.ts`

Exports one async function:

```typescript
export async function captureMicAudio(): Promise<Float32Array>
```

**Behavior:**
1. Detect platform (`darwin` → AVFoundation, `linux` → ALSA)
2. Spawn `ffmpeg` streaming from mic device (`-f avfoundation -i ":0"` on macOS, `-f alsa -i default` on Linux)
3. Print prompt to stdout: `Recording... Press ENTER to stop.`
4. Listen for `Enter` keypress on stdin
5. On Enter: send `SIGTERM` to ffmpeg, collect all `Buffer` chunks from stdout
6. Convert Int16 PCM → Float32 and return
7. **Hard fail** if: ffmpeg not installed, mic device unavailable, or ffmpeg exits non-zero

**PCM format:** s16le, mono, 44100 Hz (matches `AudioAnalyzer` default sampleRate)
**Timeout:** 60 seconds max (safety valve; user should press Enter to stop)
**stdin requirement:** Must be a TTY — reject non-interactive invocations with clear error

### RalphLoop Change

In `RalphLoop.ts`, after the `voiceFile` block (around line 124), add:

```typescript
// Mic-driven visual mapping
if (normalizedOptions.voice && !normalizedOptions.visualMappingParams) {
  const { captureMicAudio } = await import('../audio/MicCapture.js');
  const { AudioAnalyzer } = await import('../audio/index.js');
  const float32 = await captureMicAudio();
  const analyzer = new AudioAnalyzer();
  const result = analyzer.analyze(float32);
  normalizedOptions.visualMappingParams = analyzer.getVisualMapping(result);
}
```

This slots directly into the same `visualMappingParams` path that `voiceFile` already populates — downstream code sees no difference.

### LoopConfig Type Doc Update

In `LoopConfig.ts`, update the `voice?: boolean` doc comment to:

> "Enable voice-driven visual mapping via microphone capture. Press Enter to start/stop recording."

## Error Handling

| Condition | Behavior |
|-----------|----------|
| ffmpeg not installed | Hard fail: `"ffmpeg is required for --voice. Install with: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)"` |
| Mic device not found | Hard fail: `"No microphone found. Check your audio device and permissions."` |
| Non-TTY stdin | Hard fail: `"--voice requires an interactive terminal (cannot use with piped input)"` |
| Timeout (60s) | Hard fail: `"Microphone recording timed out after 60 seconds"` |
| ffmpeg exits non-zero | Hard fail: `"ffmpeg exited with code N"` |

## Files

| File | Change |
|------|--------|
| `src/audio/MicCapture.ts` | New — mic capture utility |
| `src/audio/index.ts` | Export `captureMicAudio` |
| `src/core/RalphLoop.ts` | Add `voice` block after `voiceFile` block |
| `src/core/LoopConfig.ts` | Update doc comment for `voice` |
| `test/unit/core/audio-context-injection.test.ts` | Add test for `voice === true` path |

## Testing Strategy

The `test/unit/core/audio-context-injection.test.ts` file patches `captureMicAudio` with a synthetic `Float32Array` to test the integration path without requiring a real microphone. Unit tests for `MicCapture` itself verify platform detection and error handling in isolation (mocked child_process and stdin).
