# Voice Mic Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--voice` flag support that captures microphone audio via ffmpeg and feeds it to `AudioAnalyzer` for visual mapping, matching the existing `--voice-file` pipeline.

**Architecture:** A new `MicCapture` utility spawns ffmpeg with platform-appropriate mic device input, streams PCM s16le data until Enter is pressed, converts to `Float32Array`, and returns it. RalphLoop calls this and pipes the result through `AudioAnalyzer` exactly as `--voice-file` does.

**Tech Stack:** Node.js `child_process.spawn`, ffmpeg, TypeScript. No new dependencies.

---

## File Map

| File | Role |
|------|------|
| `src/audio/MicCapture.ts` | New — ffmpeg mic capture, PCM→Float32 conversion |
| `src/audio/index.ts` | Add `captureMicAudio` export |
| `src/core/RalphLoop.ts` | Add `if (normalizedOptions.voice)` block after `voiceFile` block |
| `src/core/LoopConfig.ts` | Update doc comment for `voice` field |
| `test/unit/audio/MicCapture.test.ts` | Unit tests for MicCapture |
| `test/unit/core/audio-context-injection.test.ts` | Add test for `voice === true` path |

---

## Task 1: Create `src/audio/MicCapture.ts`

**Files:**
- Create: `src/audio/MicCapture.ts`
- Create: `test/unit/audio/MicCapture.test.ts`

### Implementation

`captureMicAudio(): Promise<Float32Array>`:
1. Check `process.stdin.isTTY` — throw if not TTY
2. Detect platform: `darwin` → `avfoundation :0`, `linux` → `alsa default`, else throw
3. Spawn ffmpeg: `['-f', '<driver>', '-i', '<device>', '-f', 's16le', '-ac', '1', '-ar', '44100', '-v', 'quiet', 'pipe:1']`
4. Write `"Recording... Press ENTER to stop.\n"` to stdout
5. Race stdin Enter keypress against ffmpeg close event
6. 60s timeout → SIGTERM → 5s grace → SIGKILL
7. Collect stdout chunks → Buffer → Int16Array → Float32Array (÷32768)
8. Hard fail on non-zero exit, stderr captured and included in error message

---

## Task 2: Export from `src/audio/index.ts`

Add:
```typescript
export { captureMicAudio } from './MicCapture.js';
```

---

## Task 3: Wire `--voice` into `RalphLoop.ts`

Insert after the `voiceFile` block:
```typescript
if (normalizedOptions.voice && !normalizedOptions.visualMappingParams) {
  const { captureMicAudio } = await import('../audio/MicCapture.js');
  const { AudioAnalyzer } = await import('../audio/index.js');
  const float32 = await captureMicAudio();
  const analyzer = new AudioAnalyzer();
  const result = analyzer.analyze(float32);
  normalizedOptions.visualMappingParams = analyzer.getVisualMapping(result) as unknown as Record<string, unknown>;
  Logger.info('RalphLoop', `Mic capture analysis complete: mapped audio features to visual params`);
}
```

---

## Task 4: Update `LoopConfig.ts` doc comment

```typescript
/** Enable voice-driven visual mapping via microphone capture. Press Enter to start/stop recording. */
voice?: boolean;
```

---

## Task 5: Add test for `voice === true` path

In `test/unit/core/audio-context-injection.test.ts`:
```typescript
it('does not append audio context when voice === true without visualMappingParams', () => {
  const ctx = buildContextForInjection(1, { voice: true } as any);
  expect(ctx).not.toContain('Audio-derived visual parameters');
});
```
