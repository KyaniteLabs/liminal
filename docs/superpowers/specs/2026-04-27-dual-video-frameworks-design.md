# Dual Video Frameworks Design — Revideo Fix + HyperFrames Integration

**Date:** 2026-04-27
**Issue:** #384
**Status:** Implemented (PR #391, merged 2026-04-28)

## Summary

Fix the broken Revideo rendering pipeline and add HyperFrames as a second video domain. Both coexist with clear lane separation: Revideo for generative motion, HyperFrames for asset compositing. A layered pipeline allows Revideo output to become HyperFrames input.

## Problem Statement

1. **Revideo rendering is non-functional.** `RevideoRenderer.renderToVideo()` calls `npx revideo render` which does not exist (only `revideo serve` and `revideo editor`). The temp project never installs dependencies. `getCompositionConfig()` hardcodes 300 frames ignoring actual code.
2. **No asset compositing domain.** Liminal can generate generative animations (Revideo) but cannot assemble images, clips, titles, and audio into polished videos. HyperFrames fills this gap.
3. **No layering.** There is no way to render a generative animation then composite it with overlays.

## Architecture

### Flow

```
User prompt
  → registerGenerators (canHandle routing)
    → RevideoGenerator OR HyperFramesGenerator
      → generates code artifact
        → Exporter.exportVideo(domain)
          → RevideoRenderer or HyperFramesRenderer (both implement VideoRenderer)
            → MP4 file
        OR
        → VideoPipeline (multi-step)
          → Step 1: RevideoRenderer → raw MP4
          → Step 2: HyperFramesRenderer composites raw MP4 + overlays → final MP4
```

### Shared Interface

```ts
interface VideoRenderResult {
  outputPath: string;
  duration: number;
  width: number;
  height: number;
  format: 'mp4' | 'webm' | 'mov';
}

interface VideoRenderer {
  render(code: string, outputPath: string, opts: VideoRenderOptions): Promise<VideoRenderResult>;
}
```

### Generator Routing Separation

No prompt may score high for both generators simultaneously:

| Prompt pattern | Revideo | HyperFrames | Winner |
|---|---|---|---|
| "particle system animation" | 0.80 | 0 | Revideo |
| "generative motion graphics" | 0.80 | 0 | Revideo |
| "data visualization animation" | 0.80 | 0 | Revideo |
| "revideo scene" | 0.95 | 0 | Revideo |
| "promo video from images" | 0 | 0.90 | HyperFrames |
| "slideshow with music" | 0 | 0.90 | HyperFrames |
| "title card overlay on video" | 0 | 0.85 | HyperFrames |
| "hyperframes composition" | 0 | 0.95 | HyperFrames |
| "video with images and clips" | 0 | 0.80 | HyperFrames |
| "video" (ambiguous) | 0.80 | 0 | Revideo (default) |
| "animation with particles, then add titles" | 0.80 | 0.85 | Pipeline |

## Part A: Revideo Rendering Fix

### What Changes

**File:** `src/render/RevideoRenderer.ts` — full rewrite

Replace CLI shell-out with in-process `renderVideo()` from `@revideo/renderer`.

**Current bugs fixed:**
1. `npx revideo render` → `renderVideo({ projectFile })` (the CLI command doesn't exist)
2. No `npm install` in temp project → proper project scaffold with dependency resolution
3. Hardcoded 300 frames → parse `yield* waitFor(N)` and duration calls from actual code

### New Implementation

```ts
import { renderVideo } from '@revideo/renderer';

class RevideoRenderer implements VideoRenderer {
  async render(code: string, outputPath: string, opts): Promise<VideoRenderResult> {
    const projectDir = await this.writeProject(code);
    const result = await renderVideo({
      projectFile: path.join(projectDir, 'src/project.ts'),
      settings: {
        outFile: outputPath,
        workers: 1,
        puppeteer: { args: ['--no-sandbox'] },
      },
    });
    const config = this.getCompositionConfig(code);
    return { outputPath, ...config, format: 'mp4' };
  }

  async writeProject(code: string): Promise<string> {
    // Creates proper Revideo project structure:
    //   projectDir/src/project.ts   — makeProject() wrapping the scene
    //   projectDir/src/scene.tsx    — the generated code
    //   projectDir/package.json     — with @revideo/* dependencies
    //   projectDir/tsconfig.json    — JSX config for @revideo/2d
    // Installs dependencies via npm install
  }

  getCompositionConfig(code: string): CompositionConfig {
    // Parse yield* waitFor(N) → sum durations
    // Parse Rect/view width/height → resolution
    // Fallback: 300 frames, 1920x1080, 30fps
  }
}
```

### Minimum Revideo Project Structure

```
temp-revideo-XXXX/
  package.json          — @revideo/core, @revideo/2d, @revideo/renderer, @revideo/ffmpeg
  tsconfig.json         — jsxImportSource: @revideo/2d/lib
  src/
    project.ts          — makeProject({ scenes: [defaultExport] })
    scene.tsx           — generated code (the user's scene)
```

### Dependencies

Added to `optionalDependencies` in package.json:
- `@revideo/renderer: ^0.10.4`
- `@revideo/core: ^0.10.4`
- `@revideo/2d: ^0.10.4`
- `@revideo/ffmpeg: ^0.10.4`

### Stale Artifacts

`src/composition/adapters/RemotionAdapter.ts` still validates Remotion-style code (`useCurrentFrame`, `AbsoluteFill`). **Out of scope for this implementation** — evaluate and update/deprecate in a follow-up PR.

## Part B: HyperFrames Integration

### New Files

1. **`src/generators/hyperframes/HyperFramesGenerator.ts`** — code generation
2. **`src/core/validators/HyperFramesValidator.ts`** — output validation
3. **`src/render/HyperFramesRenderer.ts`** — video rendering

### HyperFramesGenerator

Extends `TierBasedGenerator` with domain `'hyperframes'`.

**canHandle routing:**
```ts
canHandle(prompt: string): number {
  const lower = prompt.toLowerCase();
  if (/do not|don't|never.*hyperframes/.test(lower)) return 0;
  if (/\bhyperframes?\b/.test(lower)) return 0.95;
  if (/\b(promo|trailer|slideshow|presentation|title\s*card|subtitle|caption|social\s*media)\b/.test(lower)) return 0.90;
  if (/\b(composite|compose|assemble|overlay|watermark|intro|outro)\b/.test(lower)) return 0.85;
  if (/\b(video|animation)\b/ && /\b(images?|clips?|audio|music|narration)\b/) return 0.80;
  return 0;
}
```

**generate() prompt** targets HTML + GSAP + data-* attributes:
- Single HTML file output
- GSAP timeline with `{ paused: true }`
- Register on `window.__timelines[data-composition-id]`
- `class="clip"` on all timed elements
- `data-start`, `data-duration`, `data-track-index` on timed elements
- No React, Remotion, p5, or Revideo APIs

**wrapForGallery()** — renders the HTML as-is (it IS a browser document), unlike Revideo's escaped-code display.

### HyperFramesValidator

~40 lines. Checks:
- Has `<div data-composition-id="...">` structure
- Has `<script>` with `gsap.timeline({ paused: true })`
- Has `window.__timelines` assignment
- Has `class="clip"` on timed elements
- Blocks: `video.play()`, `audio.currentTime`, React, Remotion, p5, Revideo APIs
- Min size: 200 characters

### HyperFramesRenderer

Uses `@hyperframes/producer` in-process API:

```ts
import { createRenderJob, executeRenderJob } from '@hyperframes/producer';

class HyperFramesRenderer implements VideoRenderer {
  async render(code: string, outputPath: string, opts): Promise<VideoRenderResult> {
    const htmlPath = await this.writeComposition(code);
    const job = createRenderJob({
      input: htmlPath,
      output: outputPath,
      fps: opts.fps ?? 30,
      quality: 'standard',
    });
    const result = await executeRenderJob(job);
    return { outputPath, duration: result.duration, width: 1920, height: 1080, format: 'mp4' };
  }

  async writeComposition(code: string): Promise<string> {
    // Write code to temp/index.html
    // Return path
  }
}
```

**Asset injection** for layered pipeline:
```ts
interface HyperFramesRenderOptions extends VideoRenderOptions {
  assets?: Array<{
    path: string;
    type: 'video' | 'image' | 'audio';
    startAt: number;
    duration: number;
  }>;
}
```

When assets are provided, the renderer wraps the HTML composition with additional `<video>`/`<img>`/`<audio>` elements using the asset paths and timing.

### Dependencies

Added to `optionalDependencies`:
- `@hyperframes/producer: ^0.4.3`

## Layered Pipeline

### VideoPipeline Orchestrator

**File:** `src/render/VideoPipeline.ts`

Chains renderers so Revideo output becomes HyperFrames input:

```ts
interface PipelineStep {
  type: 'revideo' | 'hyperframes';
  code: string;
  options?: Record<string, unknown>;
}

class VideoPipeline {
  async execute(steps: PipelineStep[], outputPath: string): Promise<VideoRenderResult> {
    let intermediateResult: VideoRenderResult | undefined;
    for (const step of steps) {
      if (step.type === 'revideo') {
        intermediateResult = await new RevideoRenderer().render(step.code, tmpPath, step.options);
      } else if (step.type === 'hyperframes') {
        const assets = intermediateResult ? [{
          path: intermediateResult.outputPath,
          type: 'video',
          startAt: 0,
          duration: intermediateResult.duration,
        }] : undefined;
        intermediateResult = await new HyperFramesRenderer().render(
          step.code, finalPath, { ...step.options, assets }
        );
      }
    }
    return intermediateResult!;
  }
}
```

### Pipeline Routing

Prompts describing both generation and compositing get routed to the pipeline:
- "Generate a particle animation, then add title cards and background music"
- "Create a 3D scene, then overlay it with captions and transitions"

Detection: a `pipeline` confidence helper in `registerGenerators.ts` that returns >0.9 when the prompt contains BOTH generative keywords (particles, generative, algorithmic, etc.) AND compositing keywords (overlay, title, music, intro, etc.). When triggered, it creates a two-step pipeline rather than routing to a single generator. This is a thin routing layer, not a separate generator class — it delegates to the existing generators and renderers.

## Wiring Changes

### Exporter.ts

```ts
async exportVideo(code, outputPath, options) {
  if (options.domain === 'revideo') {
    renderer = new RevideoRenderer();
  } else if (options.domain === 'hyperframes') {
    renderer = new HyperFramesRenderer();
  } else {
    recorder = new CanvasRecorder(); // existing fallback for p5/shader/three
  }
}
```

### registerGenerators.ts

Add `hyperframesEntry` with `hyperframesConfidence()` helper. Register alongside `revideoEntry`.

### render/index.ts

Export `RevideoRenderer`, `HyperFramesRenderer`, `VideoRenderer`, `VideoPipeline`.

### package.json

```json
{
  "optionalDependencies": {
    "@revideo/renderer": "^0.10.4",
    "@revideo/core": "^0.10.4",
    "@revideo/2d": "^0.10.4",
    "@revideo/ffmpeg": "^0.10.4",
    "@hyperframes/producer": "^0.4.3"
  }
}
```

## Startup Capability Detection

**File:** `src/render/VideoCapabilityDetector.ts`

```ts
static detect(): { revideo: boolean; hyperframes: boolean } {
  let revideo = false;
  let hyperframes = false;
  try { require.resolve('@revideo/renderer'); revideo = true; } catch {}
  try { require.resolve('@hyperframes/producer'); hyperframes = true; } catch {}
  return { revideo, hyperframes };
}
```

Called once at startup. Logs available frameworks. The `Exporter` checks availability before rendering and throws a clear install instruction if missing.

## Test Strategy

| Module | Type | Tests |
|--------|------|-------|
| HyperFramesGenerator | Unit | `canHandle()` routing (12+ cases: promo, trailer, particles, ambiguous), prompt construction, output validation |
| HyperFramesValidator | Unit | Valid HTML composition, missing GSAP, missing data-composition-id, blocked patterns (video.play, React), min size |
| HyperFramesRenderer | Unit (mocked) | File writing, createRenderJob call, executeRenderJob call, error handling |
| RevideoRenderer (fix) | Unit (mocked) | Project structure creation, duration parsing from yield* waitFor(N), default fallback |
| VideoPipeline | Unit | Two-step pipeline (Revideo→HyperFrames), single-step, empty pipeline error |
| VideoCapabilityDetector | Unit | Both available, one available, none available |
| Exporter (hyperframes) | Integration | End-to-end with mocked producer, domain routing |
| Exporter (revideo fix) | Integration | End-to-end with mocked renderer, proper project creation |
| Routing overlap | Unit | Verify 20+ prompts have clear winners (no 0.7+ for both generators) |

## Verification (2026-04-28)

**Build:** `pnpm build` — clean, zero TS errors
**Tests:** 144 render-related tests pass (HyperFramesRenderer 6, RevideoRenderer 8, VideoPipeline 7, VideoCapabilityDetector 9, HyperFramesValidator 15, registerGenerators 35)

**Runtime verification:**
- `RevideoRenderer`: instantiates, `getCompositionConfig('yield* waitFor(2); yield* waitFor(3);', 30)` → duration=5s, fps=30, 1920x1080
- `HyperFramesRenderer`: instantiates, `render`/`writeComposition`/`cleanup` functional
- `VideoPipeline`: instantiates, `execute` chains steps
- `VideoCapabilityDetector`: revideo=true, hyperframes=false (simulated API)
- `HyperFramesValidator`: valid HTML passes, blocked patterns rejected
- `HyperFramesGenerator.canHandle`: promo=0.9, particles=0, hyperframes=0.95, slideshow=0.9

**Code review:** All P1/P2/critical items from Kilo Code Review addressed. CI passes (build, tests, docs, security audit).

## Out of Scope

- **CLI subcommand** (`liminal render`) — deferred to follow-up
- **Distributed rendering** (Revideo Lambda, HyperFrames Docker) — future work
- **RemotionAdapter rewrite** — done. Removed entirely in PR #396 along with all Remotion dead code.
- **Live preview server** for HyperFrames compositions — follow-up
- **HyperFrames agent skills** (`/hyperframes` slash command) — follow-up after rendering is stable
