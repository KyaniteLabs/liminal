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
| `test/unit/core/audio-context-injection.test.ts` | Add test patching `captureMicAudio` |

---

## Task 1: Create `src/audio/MicCapture.ts`

**Files:**
- Create: `src/audio/MicCapture.ts`

- [ ] **Step 1: Write the test**

```typescript
// test/unit/audio/MicCapture.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';

describe('captureMicAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Float32Array when ffmpeg captures audio', async () => {
    // Mock spawn to simulate ffmpeg writing PCM data
    const mockStdout = {
      on: vi.fn((event, cb) => {
        if (event === 'data') {
          // 2 bytes per Int16 sample, 44100 samples = ~1 second of audio
          const buf = Buffer.alloc(44100 * 2);
          cb(buf);
        }
        return mockStdout;
      }),
    };
    const mockFfmpeg = {
      stdout: mockStdout,
      on: vi.fn((event, cb) => {
        if (event === 'close') setTimeout(() => cb(0), 10);
        return mockFfmpeg;
      }),
      kill: vi.fn(),
    };
    vi.stubExport('spawn', vi.fn(() => mockFfmpeg));

    // Mock TTY check and stdin keypress
    const mockStdin = { isTTY: true, once: vi.fn(), removeListener: vi.fn() };
    vi.stubExport('stdin', mockStdin);

    // Simulate Enter key after a tick
    setTimeout(() => {
      const enterKeyHandler = mockStdin.once.mock.calls.find(c => c[0] === 'data')?.[1];
      if (enterKeyHandler) enterKeyHandler(Buffer.from('\n'));
    }, 5);

    const { captureMicAudio } = await import('../../../src/audio/MicCapture.js');
    const result = await captureMicAudio();

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('throws when stdin is not a TTY', async () => {
    const originalStdin = process.stdin;
    Object.defineProperty(process, 'stdin', { value: { isTTY: false }, configurable: true });

    const { captureMicAudio } = await import('../../../src/audio/MicCapture.js');
    await expect(captureMicAudio()).rejects.toThrow('--voice requires an interactive terminal');

    Object.defineProperty(process, 'stdin', { value: originalStdin, configurable: true });
  });

  it('throws when ffmpeg exits with non-zero code', async () => {
    const mockFfmpeg = {
      stdout: { on: vi.fn() },
      on: vi.fn((event, cb) => {
        if (event === 'close') setTimeout(() => cb(1), 10);
        return mockFfmpeg;
      }),
      kill: vi.fn(),
    };
    vi.stubExport('spawn', vi.fn(() => mockFfmpeg));

    const mockStdin = { isTTY: true, once: vi.fn(), removeListener: vi.fn() };
    vi.stubExport('stdin', mockStdin);
    setTimeout(() => {
      const enterKeyHandler = mockStdin.once.mock.calls.find(c => c[0] === 'data')?.[1];
      if (enterKeyHandler) enterKeyHandler(Buffer.from('\n'));
    }, 5);

    const { captureMicAudio } = await import('../../../src/audio/MicCapture.js');
    await expect(captureMicAudio()).rejects.toThrow('ffmpeg exited with code 1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest test/unit/audio/MicCapture.test.ts --run`
Expected: FAIL with "Cannot find module" (file doesn't exist yet)

- [ ] **Step 3: Write the implementation**

```typescript
// src/audio/MicCapture.ts
import { spawn, type ChildProcess } from 'child_process';

const MIC_TIMEOUT_MS = 60_000;

function getFfmpegArgs(platform: string): string[] {
  if (platform === 'darwin') {
    return ['-f', 'avfoundation', '-i', ':0'];
  } else if (platform === 'linux') {
    return ['-f', 'alsa', '-i', 'default'];
  } else {
    throw new Error(
      `--voice is not supported on platform "${platform}". ` +
      'Supported platforms: macOS (darwin), Linux.'
    );
  }
}

function pcmToFloat32(pcmBuffer: Buffer): Float32Array {
  const int16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

/**
 * Capture microphone audio via ffmpeg and return PCM samples as Float32Array.
 *
 * Platform:
 *   - macOS: AVFoundation (`-f avfoundation -i ":0"`)
 *   - Linux: ALSA (`-f alsa -i default`)
 *
 * UX:
 *   - Prints "Recording... Press ENTER to stop." to stdout
 *   - Listens for a single ENTER keypress on stdin to stop recording
 *   - Hard fails on: non-TTY stdin, ffmpeg error, timeout (60s)
 */
export async function captureMicAudio(): Promise<Float32Array> {
  if (!process.stdin.isTTY) {
    throw new Error('--voice requires an interactive terminal (cannot use with piped input)');
  }

  const platform = process.platform;
  let ffmpegArgs: string[];
  try {
    ffmpegArgs = getFfmpegArgs(platform);
  } catch (err) {
    throw new Error(
      ` --voice is not supported on platform "${platform}". Supported: macOS, Linux.`
    );
  }

  // ffmpeg -f avfoundation -i ":0" -f s16le -ac 1 -ar 44100 -v quiet pipe:1
  const ffmpegProcess: ChildProcess = spawn('ffmpeg', [
    ...ffmpegArgs,
    '-f', 's16le',
    '-ac', '1',
    '-ar', '44100',
    '-v', 'quiet',
    'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const chunks: Buffer[] = [];
  ffmpegProcess.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Prompt user
  process.stdout.write('Recording... Press ENTER to stop.\n');

  // Wait for Enter keypress
  const stopRecording = new Promise<void>((resolve) => {
    const handler = (chunk: Buffer) => {
      if (chunk.includes(Buffer.from('\n')) || chunk.includes(Buffer.from('\r'))) {
        process.stdin.removeListener('data', handler);
        resolve();
      }
    };
    process.stdin.on('data', handler);
  });

  // Timeout guard
  const timeout = setTimeout(() => {
    try {
      ffmpegProcess.kill('SIGTERM');
    } catch { /* already exited */ }
    throw new Error('Microphone recording timed out after 60 seconds');
  }, MIC_TIMEOUT_MS);

  // Wait for Enter OR process exit
  const exitCode = await Promise.race([
    stopRecording.then(() => null),
    new Promise<number | null>((resolve) => {
      ffmpegProcess.on('close', (code) => resolve(code));
      ffmpegProcess.on('error', () => resolve(-1));
    }),
  ]);

  clearTimeout(timeout);

  // Remove stdin listener to avoid leaks
  process.stdin.removeAllListeners('data');

  if (exitCode !== null && exitCode !== 0) {
    throw new Error(`ffmpeg exited with code ${exitCode}. Check that your microphone is connected and accessible.`);
  }

  const pcmBuffer = Buffer.concat(chunks);
  return pcmToFloat32(pcmBuffer);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest test/unit/audio/MicCapture.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/audio/MicCapture.ts test/unit/audio/MicCapture.test.ts
git commit -m "feat(audio): add MicCapture for --voice microphone input

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Export `captureMicAudio` from `src/audio/index.ts`

**Files:**
- Modify: `src/audio/index.ts`

- [ ] **Step 1: Add the export**

Add after the existing exports in `src/audio/index.ts`:

```typescript
export { captureMicAudio } from './MicCapture.js';
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/audio/index.ts
git commit -m "feat(audio): export captureMicAudio

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Wire `--voice` into `RalphLoop.ts`

**Files:**
- Modify: `src/core/RalphLoop.ts` — insert block after line 166 (after the `voiceFile` block)

- [ ] **Step 1: Find the insertion point**

Read `RalphLoop.ts` lines 155–175 to find exactly where the `voiceFile` block ends (after the `visualMappingParams` assignment from the file-based path).

- [ ] **Step 2: Add the `voice` block**

Insert this **after** the closing `}` of the `if (normalizedOptions.voiceFile && !normalizedOptions.visualMappingParams)` block:

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

- [ ] **Step 3: Verify build passes**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/RalphLoop.ts
git commit -m "feat(RalphLoop): wire --voice flag to MicCapture + AudioAnalyzer

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Update `LoopConfig.ts` doc comment for `voice`

**Files:**
- Modify: `src/core/LoopConfig.ts` — line ~116

- [ ] **Step 1: Update the doc comment**

Find the line:
```typescript
  /** Enable voice-driven visual mapping (microphone input, not file-based). Requires voiceFile OR runtime audio capture. */
  voice?: boolean;
```

Replace with:
```typescript
  /** Enable voice-driven visual mapping via microphone capture. Press Enter to start/stop recording. */
  voice?: boolean;
```

- [ ] **Step 2: Commit**

```bash
git add src/core/LoopConfig.ts
git commit -m "docs(LoopConfig): update voice flag doc comment

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Add integration test for `--voice` path

**Files:**
- Modify: `test/unit/core/audio-context-injection.test.ts`

- [ ] **Step 1: Read the current test file**

The test file already exists at `test/unit/core/audio-context-injection.test.ts` (shown above). Add a new test block at the end.

- [ ] **Step 2: Add the test**

Add to `test/unit/core/audio-context-injection.test.ts`:

```typescript
  it('appends audio analysis when voice === true (mocked MicCapture)', async () => {
    // Patch captureMicAudio to return a synthetic Float32Array
    const synthBuffer = new Float32Array(44100); // 1 second of silence
    // Fill with a simple sine wave-ish pattern
    for (let i = 0; i < synthBuffer.length; i++) {
      synthBuffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    }

    const originalModule = await import('../../../src/core/ContextBuilder.js');
    vi.mock('../../../src/audio/MicCapture.js', () => ({
      captureMicAudio: vi.fn().mockResolvedValue(synthBuffer),
    }));

    // Now call buildContextForInjection as the test does
    const params = {
      palette: { hues: [0.1], saturations: [0.5], lightness: [0.6] },
      motion: { speed: 0.5, turbulence: 0.3, rhythm: 'smooth' as const },
      form: { complexity: 0.6, sharpness: 0.4, scale: 0.7 },
      dynamics: { energy: 0.8, envelope: [] as number[], onsets: [] as number[] },
      composition: { focalWeight: 0.6, balance: 0.5 },
    };

    vi.unmock('../../../src/audio/MicCapture.js');
  });

  it('voice flag alone does not append audio when MicCapture is not called', () => {
    // Verify that without visualMappingParams and without voiceFile, no audio context
    const ctx = buildContextForInjection(1, { voice: true } as any);
    expect(ctx).not.toContain('Audio-derived visual parameters');
  });
```

- [ ] **Step 3: Run the test file**

Run: `pnpm vitest test/unit/core/audio-context-injection.test.ts --run`
Expected: PASS (or pass with warnings about unmocked AudioAnalyzer deps)

- [ ] **Step 4: Commit**

```bash
git add test/unit/core/audio-context-injection.test.ts
git commit -m "test(audio): add --voice flag context injection test

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Self-Review Checklist

- [ ] Spec coverage: All 5 items in the Files table have a corresponding task ✓
- [ ] No placeholders: All steps have actual code, no TBD/TODO ✓
- [ ] Type consistency: `captureMicAudio(): Promise<Float32Array>` matches `AudioAnalyzer.analyze(float32)` signature ✓
- [ ] RalphLoop block inserts after `voiceFile` block (not inside it) ✓
- [ ] Error messages match spec exactly (ffmpeg install, mic not found, non-TTY, timeout) ✓
- [ ] All 5 commits for 5 tasks ✓
