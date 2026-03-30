# Video Generation + Compositing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add video generation (Remotion), video export (FFmpeg), and cross-domain compositing so Liminal can generate, combine, and layer any output type into a cohesive video.

**Architecture:** Three new capabilities: (1) a `remotion` domain that generates React/Remotion video compositions, (2) a video export pipeline that converts any Liminal output (p5, shader, three) to video via Puppeteer + FFmpeg, and (3) a compositor that layers multiple Liminal outputs (visual + audio) into a single polished piece using FFmpeg filter graphs and Remotion multi-track composition.

**Tech Stack:** Remotion (`@remotion/renderer`, `@remotion/bundler`), FFmpeg (subprocess), React, Puppeteer (existing)

---

## Phase 1: Foundation (Remotion Domain)

### Task 1: Add dependencies and domain types

**Files:**
- Modify: `package.json`
- Modify: `src/chat/types.ts` (line ~97)
- Modify: `src/utils/htmlWrapper.ts` (line ~6)
- Modify: `src/prompts/index.ts`

**Step 1: Install Remotion + React dependencies**

Run:
```bash
npm install remotion @remotion/renderer @remotion/bundler @remotion/cli react react-dom
npm install -D @types/react @types/react-dom
```

**Step 2: Add `'remotion'` to domain type unions**

In `src/chat/types.ts`, change:
```ts
export type Domain = 'p5' | 'shader' | 'three' | 'music' | 'hydra' | 'strudel';
```
to:
```ts
export type Domain = 'p5' | 'shader' | 'three' | 'music' | 'hydra' | 'strudel' | 'remotion';
```

In `src/utils/htmlWrapper.ts`, add `'remotion'` to the Domain union type.

**Step 3: Add side-effect import for remotion prompts**

In `src/prompts/index.ts`, add:
```ts
import './remotion.js';
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: May fail until prompts file is created (next task). That's OK — just verify the type changes are valid.

**Step 5: Commit**

```bash
git add package.json package-lock.json src/chat/types.ts src/utils/htmlWrapper.ts src/prompts/index.ts
git commit -m "feat: add remotion domain types and dependencies"
```

---

### Task 2: Create Remotion prompt templates

**Files:**
- Create: `src/prompts/remotion.ts`
- Test: `test/unit/prompts/remotion.test.ts`

**Step 1: Write the failing test**

Create `test/unit/prompts/remotion.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PromptLibrary } from '../../../src/prompts/index.js';

describe('Remotion Prompts', () => {
  it('renders remotion.generate with prompt variable', () => {
    const result = PromptLibrary.render('remotion.generate', {
      prompt: 'cosmic particle animation',
      fps: 30,
      duration: 150,
      width: 1920,
      height: 1080,
    });
    expect(result.system).toContain('Remotion');
    expect(result.system).toContain('React');
    expect(result.user).toContain('cosmic particle animation');
  });

  it('renders remotion.improve with code and feedback', () => {
    const result = PromptLibrary.render('remotion.improve', {
      prompt: 'improve the colors',
      previousCode: 'export const MyComp = () => <div/>',
      fps: 30,
      duration: 150,
      width: 1920,
      height: 1080,
    });
    expect(result.system).toContain('Remotion');
    expect(result.user).toContain('improve the colors');
    expect(result.user).toContain('previousCode');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/prompts/remotion.test.ts`
Expected: FAIL — prompt `remotion.generate` not found

**Step 3: Create the prompt file**

Create `src/prompts/remotion.ts`:
```ts
import { PromptLibrary } from './PromptLibrary.js';

PromptLibrary.register({
  id: 'remotion.generate',
  version: '1.0.0',
  category: 'generator',
  systemPrompt: `You are a senior Remotion developer specializing in programmatic video and motion graphics.

Generate a complete React/Remotion composition based on the user's description.

CONSTRAINTS:
- CRITICAL: Output ONLY valid TypeScript/React code — NO markdown fences, NO explanatory text
- CRITICAL: Start directly with import statements
- Use absoluteFill for full-screen compositions
- Use useCurrentFrame() for animation timing, NOT requestAnimationFrame
- Use interpolate() and spring() for smooth animations
- Use <Video> component for video clips, <Img> for images, <Audio> for audio
- All colors must be valid CSS color strings

OUTPUT FORMAT:
- A single Remotion composition component
- Must include: import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion'
- Must export a named component matching the composition name
- Must accept props matching Remotion schema ({fps, durationInFrames, width, height})

ANIMATION RULES:
- Use frame-based timing via useCurrentFrame(), never Date.now() or setTimeout
- Use interpolate(frame, [startFrame, endFrame], [outputStart, outputEnd]) for smooth transitions
- Use spring({frame, fps}) for physics-based animations
- Duration is ${duration} frames at ${fps}fps
- Canvas size: ${width}x${height}

STRUCTURE:
import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const MyComposition: React.FC = () => {
  const frame = useCurrentFrame();
  // animation logic here
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {/* visual elements */}
    </AbsoluteFill>
  );
};`,
  userPromptTemplate: 'Create a Remotion video composition: ${prompt}',
  tags: ['generator', 'remotion', 'video', 'code-only', 'no-markdown'],
  created: '2026-03-28',
  updated: '2026-03-28',
});

PromptLibrary.register({
  id: 'remotion.improve',
  version: '1.0.0',
  category: 'generator',
  systemPrompt: `You are improving an existing Remotion composition. The user wants changes while keeping the overall structure.

CONSTRAINTS:
- Output ONLY the improved TypeScript/React code
- Keep the same component name and export structure
- Use Remotion APIs: useCurrentFrame, interpolate, spring, AbsoluteFill
- Frame-based timing only (${fps}fps, ${duration} frames, ${width}x${height})`,
  userPromptTemplate: `Improve this Remotion composition based on: ${prompt}\n\nPrevious code:\n\`\`\`tsx\n${previousCode}\n\`\`\``,
  tags: ['generator', 'remotion', 'video', 'improvement'],
  created: '2026-03-28',
  updated: '2026-03-28',
});
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/prompts/remotion.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/prompts/remotion.ts test/unit/prompts/remotion.test.ts
git commit -m "feat: add Remotion prompt templates for video generation"
```

---

### Task 3: Create Remotion template fallbacks

**Files:**
- Create: `src/generators/remotion/RemotionTemplates.ts`
- Test: `test/unit/generators/RemotionTemplates.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { selectRemotionTemplate } from '../../../src/generators/remotion/RemotionTemplates.js';

describe('RemotionTemplates', () => {
  it('returns particle template for particle/galaxy keywords', () => {
    const code = selectRemotionTemplate('cosmic particle animation');
    expect(code).toContain('useCurrentFrame');
    expect(code).toContain('AbsoluteFill');
    expect(code).toContain('export');
  });

  it('returns text motion template for text/typography keywords', () => {
    const code = selectRemotionTemplate('animated text reveal');
    expect(code).toContain('useCurrentFrame');
    expect(code).toContain('interpolate');
  });

  it('returns geometric template for geometric/shape keywords', () => {
    const code = selectRemotionTemplate('geometric shapes rotating');
    expect(code).toContain('useCurrentFrame');
  });

  it('returns gradient template as default fallback', () => {
    const code = selectRemotionTemplate('something random');
    expect(code).toContain('useCurrentFrame');
    expect(code).toContain('AbsoluteFill');
  });

  it('all templates are valid React components with Remotion imports', () => {
    const prompts = ['particles', 'text motion', 'geometric', 'gradient', 'anything'];
    for (const p of prompts) {
      const code = selectRemotionTemplate(p);
      expect(code).toMatch(/import.*from ['"]remotion['"]/);
      expect(code).toMatch(/export (const|default)/);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/generators/RemotionTemplates.test.ts`
Expected: FAIL

**Step 3: Create template fallbacks**

Create `src/generators/remotion/RemotionTemplates.ts` with 4 templates (particle-animation, text-reveal, geometric-patterns, gradient-loop). Each is a self-contained React/Remotion component using `useCurrentFrame`, `interpolate`, `AbsoluteFill`. Include a `selectRemotionTemplate(prompt: string): string` function that keyword-matches like `selectThreeTemplate`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/generators/RemotionTemplates.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generators/remotion/RemotionTemplates.ts test/unit/generators/RemotionTemplates.test.ts
git commit -m "feat: add Remotion template fallbacks for offline generation"
```

---

### Task 4: Create RemotionGenerator

**Files:**
- Create: `src/generators/remotion/RemotionGenerator.ts`
- Test: `test/unit/generators/RemotionGenerator.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { RemotionGenerator } from '../../../src/generators/remotion/RemotionGenerator.js';

describe('RemotionGenerator', () => {
  it('canHandle returns 0.9 for remotion/video keywords', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('create a remotion video')).toBe(0.9);
    expect(gen.canHandle('animated video with particles')).toBe(0.8);
    expect(gen.canHandle('motion graphics title sequence')).toBe(0.8);
  });

  it('canHandle returns 0 for unrelated prompts', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('draw a circle with p5')).toBe(0);
    expect(gen.canHandle('GLSL shader with ray marching')).toBe(0);
  });

  it('generate returns template when no LLM configured', async () => {
    const gen = new RemotionGenerator();
    const code = await gen.generate('particle animation');
    expect(code).toContain('useCurrentFrame');
    expect(code).toContain('AbsoluteFill');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/generators/RemotionGenerator.test.ts`
Expected: FAIL

**Step 3: Create the generator**

Create `src/generators/remotion/RemotionGenerator.ts` following the exact pattern from `ThreeGenerator.ts`:
- Constructor accepts `LLMClient | Partial<LLMConfig>` (optional)
- `generate()` checks `LLMClient.isConfigured()`, falls back to `selectRemotionTemplate(prompt)` if not
- Uses `PromptLibrary.render('remotion.generate', { prompt, fps: 30, duration: 150, width: 1920, height: 1080 })`
- Returns the generated code string
- Also exports a standalone `canHandle(prompt: string): number` function for registration

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/generators/RemotionGenerator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generators/remotion/RemotionGenerator.ts test/unit/generators/RemotionGenerator.test.ts
git commit -m "feat: add RemotionGenerator with LLM-backed generation and template fallback"
```

---

### Task 5: Register RemotionGenerator in the registry

**Files:**
- Modify: `src/generators/registerGenerators.ts`
- Test: existing `test/unit/generators/registerGenerators.test.ts` (or create if needed)

**Step 1: Register the generator**

In `src/generators/registerGenerators.ts`, add the Remotion entry to `registerAllGenerators()`:
```ts
import { RemotionGenerator } from './remotion/RemotionGenerator.js';

// Inside registerAllGenerators():
const remotionGen = new RemotionGenerator();
entries.push({
  name: 'remotion',
  canHandle: (prompt) => {
    const lower = prompt.toLowerCase();
    if (/\b(remotion)\b/.test(lower)) return 0.9;
    if (/\b(video|animation|motion\s*graphics|title\s*sequence|intro\s*video)\b/.test(lower)) return 0.8;
    return 0;
  },
  generate: (prompt, params) => remotionGen.generate(prompt, params),
});
```

**Step 2: Verify dispatch works**

Run: `npx vitest run` (full suite — should still pass)
Expected: All existing tests pass

**Step 3: Commit**

```bash
git add src/generators/registerGenerators.ts
git commit -m "feat: register RemotionGenerator in the generator registry"
```

---

## Phase 2: Rendering Pipeline

### Task 6: Create RemotionRenderer

**Files:**
- Create: `src/render/RemotionRenderer.ts`
- Test: `test/unit/render/RemotionRenderer.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { RemotionRenderer } from '../../../src/render/RemotionRenderer.js';

describe('RemotionRenderer', () => {
  it('writes a Remotion entry point file from generated code', async () => {
    const renderer = new RemotionRenderer({ tempDir: '/tmp/test-remotion' });
    const entryPath = await renderer.writeEntryPoint('export const Comp = () => <div/>');
    expect(entryPath).toContain('index.ts');
  });

  it('renderToVideo throws descriptive error if remotion not installed', async () => {
    const renderer = new RemotionRenderer({ tempDir: '/tmp/test-remotion' });
    // This tests the error path without actually having remotion render
    await expect(renderer.renderToVideo({
      entryPoint: '/tmp/nonexistent/index.ts',
      outputPath: '/tmp/test-output.mp4',
    })).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/render/RemotionRenderer.test.ts`

**Step 3: Create RemotionRenderer**

Create `src/render/RemotionRenderer.ts`:
- `writeEntryPoint(code: string): Promise<string>` — writes a Remotion project entry point (Root + composition registration) wrapping the generated component code, returns path to `index.ts`
- `renderToVideo(options): Promise<string>` — uses `@remotion/bundler.bundle()` + `@remotion/renderer.selectComposition()` + `@remotion/renderer.renderMedia()` to produce an MP4
- Handles temp project scaffolding: writes `package.json`, `tsconfig.json`, entry point with `registerRoot()`
- Returns the output MP4 path

**Step 4: Run test**

Run: `npx vitest run test/unit/render/RemotionRenderer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/render/RemotionRenderer.ts test/unit/render/RemotionRenderer.test.ts
git commit -m "feat: add RemotionRenderer for bundling and rendering video compositions"
```

---

### Task 7: Create VideoExporter (FFmpeg wrapper)

**Files:**
- Create: `src/export/VideoExporter.ts`
- Test: `test/unit/export/VideoExporter.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { VideoExporter } from '../../../src/export/VideoExporter.js';

describe('VideoExporter', () => {
  it('builds correct FFmpeg args for MP4 to GIF conversion', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildConvertArgs('/input.mp4', '/output.gif', 'gif');
    expect(args).toContain('-i');
    expect(args).toContain('/input.mp4');
  });

  it('builds correct FFmpeg args for resize', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildResizeArgs('/input.mp4', '/output.mp4', 1080, 1920);
    expect(args).toEqual(expect.arrayContaining([expect.stringContaining('scale')]));
  });

  it('builds FFmpeg args for adding audio track', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildAddAudioArgs('/input.mp4', '/audio.mp3', '/output.mp4');
    expect(args).toContain('-i');
    expect(args.filter(a => a === '-i').length).toBeGreaterThanOrEqual(2);
  });

  it('throws descriptive error when FFmpeg not found', async () => {
    const exporter = new VideoExporter({ ffmpegPath: '/nonexistent/ffmpeg' });
    await expect(exporter.convert('/in.mp4', '/out.gif', 'gif'))
      .rejects.toThrow('FFmpeg');
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Create VideoExporter**

Create `src/export/VideoExporter.ts`:
- `convert(input, output, format)` — format conversion (mp4, webm, gif)
- `resize(input, output, width, height)` — resize video
- `addAudio(video, audio, output)` — merge audio track
- `extractFrames(input, outputDir, fps?)` — export PNG sequence
- `framesToVideo(framesDir, output, fps)` — PNG sequence to video
- Private `execFFmpeg(args)` — subprocess wrapper with error handling
- Private `build*Args()` methods — exposed for testing without subprocess execution
- Checks for FFmpeg availability via `which ffmpeg`

**Step 4: Run test**

Run: `npx vitest run test/unit/export/VideoExporter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/export/VideoExporter.ts test/unit/export/VideoExporter.test.ts
git commit -m "feat: add VideoExporter with FFmpeg subprocess wrapper"
```

---

### Task 8: Create CanvasRecorder for existing domains

**Files:**
- Create: `src/render/CanvasRecorder.ts`
- Test: `test/unit/render/CanvasRecorder.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { CanvasRecorder } from '../../../src/render/CanvasRecorder.js';

describe('CanvasRecorder', () => {
  it('builds correct recording config', () => {
    const recorder = new CanvasRecorder({ fps: 30, duration: 5, width: 800, height: 600 });
    const config = recorder.getConfig();
    expect(config.fps).toBe(30);
    expect(config.totalFrames).toBe(150);
    expect(config.width).toBe(800);
  });

  it('throws if duration or fps is invalid', () => {
    expect(() => new CanvasRecorder({ fps: 0, duration: 5, width: 800, height: 600 })).toThrow();
    expect(() => new CanvasRecorder({ fps: 30, duration: -1, width: 800, height: 600 })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Create CanvasRecorder**

Create `src/render/CanvasRecorder.ts`:
- Uses existing Puppeteer browser instance (shared with Renderer)
- `record(code: string, domain: Domain, outputPath: string): Promise<string>` — loads code in page, captures canvas frames via `page.evaluate()` + `canvas.toDataURL()`, writes PNGs to temp dir, then uses `VideoExporter.framesToVideo()` to produce MP4
- Handles p5.js, shader, and three.js domains via HTMLWrapper
- Respects fps, duration, viewport config

**Step 4: Run test**

**Step 5: Commit**

```bash
git add src/render/CanvasRecorder.ts test/unit/render/CanvasRecorder.test.ts
git commit -m "feat: add CanvasRecorder for exporting p5/shader/three as video"
```

---

### Task 9: Extend Exporter with video export method

**Files:**
- Modify: `src/export/Exporter.ts`
- Test: `test/unit/export/Exporter.test.ts`

**Step 1: Add `exportVideo` method to Exporter**

Add to the existing `Exporter` class:
```ts
async exportVideo(code: string, outputPath: string, options: VideoExportOptions): Promise<void> {
  const { domain, fps = 30, duration = 10, width = 1920, height = 1080 } = options;

  if (domain === 'remotion') {
    const renderer = new RemotionRenderer();
    const entryPath = await renderer.writeEntryPoint(code);
    await renderer.renderToVideo({ entryPoint: entryPath, outputPath, codec: 'h264' });
  } else {
    const recorder = new CanvasRecorder({ fps, duration, width, height });
    await recorder.record(code, domain, outputPath);
  }
}
```

**Step 2: Write test for the new method**

**Step 3: Run tests**

**Step 4: Commit**

```bash
git add src/export/Exporter.ts test/unit/export/Exporter.test.ts
git commit -m "feat: add exportVideo method supporting both Remotion and canvas recording"
```

---

## Phase 3: Compositing Layer

### Task 10: Create the Compositor

**Files:**
- Create: `src/composite/Compositor.ts`
- Test: `test/unit/composite/Compositor.test.ts`

This is the key component that combines and layers different Liminal outputs into one cohesive piece.

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Compositor, CompositionLayer, CompositionSpec } from '../../../src/composite/Compositor.js';

describe('Compositor', () => {
  it('builds FFmpeg filter graph for two visual layers', () => {
    const compositor = new Compositor();
    const spec: CompositionSpec = {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 10,
      layers: [
        { type: 'video', source: '/bg.mp4', blend: 'normal', opacity: 1.0 },
        { type: 'video', source: '/overlay.mp4', blend: 'screen', opacity: 0.7 },
      ],
    };
    const filterGraph = compositor.buildFilterGraph(spec);
    expect(filterGraph).toContain('overlay');
  });

  it('builds FFmpeg filter graph for visual + audio layers', () => {
    const compositor = new Compositor();
    const spec: CompositionSpec = {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 10,
      layers: [
        { type: 'video', source: '/visual.mp4', blend: 'normal', opacity: 1.0 },
        { type: 'audio', source: '/music.mp3', volume: 0.8 },
      ],
    };
    const args = compositor.buildCompositeArgs(spec, '/output.mp4');
    expect(args).toContain('-i');
  });

  it('validates spec requires at least one layer', () => {
    const compositor = new Compositor();
    expect(() => compositor.validateSpec({ width: 1920, height: 1080, fps: 30, duration: 10, layers: [] }))
      .toThrow('at least one layer');
  });

  it('generates Remotion multi-layer composition code', () => {
    const compositor = new Compositor();
    const spec: CompositionSpec = {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 10,
      layers: [
        { type: 'code', domain: 'p5', code: 'function setup() {}', blend: 'normal', opacity: 1.0 },
        { type: 'code', domain: 'shader', code: 'void main() {}', blend: 'multiply', opacity: 0.5 },
      ],
    };
    const remotionCode = compositor.generateRemotionComposition(spec);
    expect(remotionCode).toContain('useCurrentFrame');
    expect(remotionCode).toContain('AbsoluteFill');
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Create Compositor**

Create `src/composite/Compositor.ts`:

```ts
export interface CompositionLayer {
  type: 'video' | 'audio' | 'image' | 'code';
  source?: string;          // file path for video/audio/image
  domain?: string;          // for type='code': p5, shader, three, remotion
  code?: string;            // for type='code': the generated code
  blend?: 'normal' | 'screen' | 'multiply' | 'overlay' | 'soft-light' | 'difference';
  opacity?: number;         // 0-1
  volume?: number;          // for audio layers
  offset?: number;          // start time offset in seconds
  x?: number;               // position offset
  y?: number;
  width?: number;           // layer dimensions
  height?: number;
}

export interface CompositionSpec {
  width: number;
  height: number;
  fps: number;
  duration: number;
  layers: CompositionLayer[];
  background?: string;      // CSS color
  audioLayers?: CompositionLayer[];
}
```

The Compositor class provides:
- `buildFilterGraph(spec)` — generates FFmpeg filter complex string for multi-layer video compositing
- `buildCompositeArgs(spec, outputPath)` — generates full FFmpeg command arguments
- `composite(spec, outputPath)` — executes FFmpeg to produce the final video
- `generateRemotionComposition(spec)` — generates a Remotion component that layers code outputs using iframes/OffthreadDOM
- `validateSpec(spec)` — validates the composition spec

For blending visual layers, FFmpeg supports: `blend`, `overlay`, `blend=all_mode=screen`, etc.
For code layers, the Compositor either: (a) pre-renders each code layer via CanvasRecorder/RemotionRenderer to video files then composites, or (b) generates a single Remotion composition that embeds all layers.

**Step 4: Run test**

**Step 5: Commit**

```bash
git add src/composite/Compositor.ts test/unit/composite/Compositor.test.ts
git commit -m "feat: add Compositor for layering multiple Liminal outputs into video"
```

---

### Task 11: Create compositor CLI command

**Files:**
- Modify: `src/cli/index.ts` (or wherever CLI commands are registered)
- Create: `src/composite/cli.ts`

**Step 1: Add `liminal composite` command**

Wire a CLI command that:
1. Takes a composition spec JSON file as input
2. Loads the spec
3. Pre-renders any `code` layers via their domain renderer
4. Composites all layers via the Compositor
5. Outputs the final video

**Step 2: Test via CLI invocation**

**Step 3: Commit**

```bash
git add src/composite/cli.ts src/cli/
git commit -m "feat: add liminal composite CLI command"
```

---

## Phase 4: Integration & End-to-End

### Task 12: Wire video export into the Ralph Loop

**Files:**
- Modify: `src/core/RalphLoop.ts`
- Modify: `src/core/GenerationOrchestrator.ts`

**Step 1: Add video output support to the generation pipeline**

When domain is `'remotion'`:
1. Use `RemotionRenderer` instead of Puppeteer `Renderer` for the render step
2. Save MP4 to gallery alongside any screenshots
3. Feed MP4 path into scoring (or skip visual scoring for video)

When a `--video` flag is passed for any domain:
1. After generating the code, use `CanvasRecorder` to capture animation frames
2. Use `VideoExporter` to produce the final MP4

**Step 2: Write integration test**

**Step 3: Commit**

```bash
git commit -m "feat: wire video rendering into Ralph Loop for remotion domain and --video flag"
```

---

### Task 13: End-to-end verification

**Step 1: Test Remotion domain end-to-end**

```bash
# Generate a Remotion composition (offline/template fallback)
echo "create a remotion particle animation" | liminal chat --domain remotion --no-llm
```

**Step 2: Test video export for existing domain**

```bash
# Export a p5.js sketch as video
liminal export --input sketch.js --output video.mp4 --fps 30 --duration 10
```

**Step 3: Test compositing**

```bash
# Composite multiple outputs
liminal composite --spec composition.json --output final.mp4
```

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Final commit**

```bash
git add .
git commit -m "feat: video generation, export, and cross-domain compositing"
```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` — compiles clean
- [ ] `npx vitest run` — all tests pass
- [ ] `npx eslint src/` — no lint errors
- [ ] `liminal chat --domain remotion` — generates Remotion code
- [ ] `liminal export --output video.mp4` — exports p5/shader/three as video
- [ ] `liminal composite --spec spec.json` — layers multiple outputs into one video
