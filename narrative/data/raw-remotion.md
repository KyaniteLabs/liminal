# Remotion & Script-to-Animation Mining

## Liminal's Video Pipeline

 Remotion is one of Liminal's 9 creative domains (alongside p5.js, GLSL, Three.js, Strudel, Hydra, Tone.js, HTML, and ASCII art). The system treats video as a first-class creative medium -- not a rendering afterthought but but but its its own domain with dedicated generators, renderers, exporters, and compositing tools.

### Architecture Overview

The video pipeline has four layers:

1. **Generation Layer** -- `RemotionGenerator` (extends `TierBasedGenerator`) takes a natural language prompt and generates React/Remotion component code. Falls back to 4 template types if no LLM is available.

2. **Rendering Layer** -- `RemotionRenderer` scaffolds a temporary Remotion project on disk (package.json, tsconfig.json, src/index.ts with `registerRoot()`), bundles it via `@remotion/bundler`, and renders to MP4 via `@remotion/renderer`.

3. **Export Layer** -- `VideoExporter` wraps FFmpeg for format conversion (mp4/webm/gif), resize, audio merging, frame extraction. `Exporter.exportVideo()` dispatches to either `RemotionRenderer` (for `domain='remotion'`) or `CanvasRecorder` (for p5/shader/three).

4. **Compositing Layer** -- `Compositor` layers multiple outputs (video, audio, image, code) using FFmpeg filter graphs or and can generate Remotion multi-layer compositions.

**Package dependencies:**
- `remotion@4.0.441`
- `@remotion/bundler@4.0.441`
- `@remotion/renderer@4.0.441`
- `@remotion/cli@4.0.441`
- `react@18.3.1`, `react-dom@18.3.1`

### Pipeline Flow

```
User Prompt
    |
    v
RalphLoop (detects domain='remotion' via keywords)
    |
    v
RemotionGenerator.generate()
  - Uses PromptLibrary.render('remotion.generate', {prompt, fps, duration, width, height})
  - Falls back to selectRemotionTemplate(prompt) if no LLM
    |
    v
Generated React/Remotion Component Code (.tsx)
    |
    v
RemotionRenderer.writeEntryPoint(code)
  - Creates temp project dir with package.json, tsconfig.json, src/index.ts
  - Wraps user code with registerRoot() and Composition registration
    |
    v
RemotionRenderer.renderToVideo()
  - @remotion/bundler.bundle() -> webpack bundle
  - @remotion/renderer.selectComposition() -> get composition config
  - @remotion/renderer.renderMedia() -> MP4 output
    |
    v
VideoExporter (optional post-processing: convert, resize, add audio)
    |
    v
Compositor (optional: layer multiple outputs with blend modes)
```

### Generation: Dual-Path Design

The RemotionGenerator follows Liminal's tier-based pattern:
- **With LLM**: Sends the prompt through `PromptLibrary.render('remotion.generate')` with specialized system prompt that constrains the LLM to produce valid Remotion code
- **Without LLM** (offline/fallback): `selectRemotionTemplate()` keyword-matches the prompt to one of 4 self-contained template components

### Four Template Fallback Types

Defined in `src/generators/remotion/RemotionTemplates.ts`:

| Template | Keywords | Visual Style |
|----------|----------|-------------|
| `particle-animation` | particle, galaxy, star, dust, float, orbit, sparkle | 80 particles with hue-shifting, glow effects, pulsing sizes on dark background |
| `text-reveal` | text, typo, letter, word, reveal, title, caption, headline | Multi-line text with per-character spring animations, progressive hue shifts |
| `geometric-patterns` | geometric, shape, pattern, grid, circle, square, polygon | 6x6 grid with distance-based phase offsets, border animations, breathing scale |
| `gradient-loop` | gradient, color, blend, smooth, transition, ambient (default) | Four-color palette with lerp blending, rotating linear gradient, radial pulse overlays, film grain texture |

All templates use Remotion's core APIs:
 `useCurrentFrame()`, `interpolate()`, `AbsoluteFill`, `spring()`.

### The Remotion Prompt System

 `src/prompts/remotion.ts`

Two registered prompts:

**`remotion.generate`** -- Primary generation prompt. System prompt defines:
- Output ONLY valid TypeScript/React code, NO markdown fences
- Must use `AbsoluteFill`, `useCurrentFrame()`, `interpolate()`, `spring()`
- Frame-based timing only NEVER Date.now() or setTimeout)
- Must export a named component matching the composition name
- Default: 150 frames at 30fps, 1920x1080

**`remotion.improve`** -- Iterative improvement prompt. Takes previous code + feedback, maintains structure.

### Domain Routing: How Liminal Detects Video Intent

 `src/generators/registerGenerators.ts`

The `remotionEntry` routes via `RemotionGenerator.canHandle()`:
- **0.9 confidence**: prompt contains "remotion"
- **0.8 confidence**: prompt contains "video", "animation", "motion graphics", "title sequence", "intro video"
- **0.0 confidence**: everything else (falls through to other generators)

`RalphLoop` also has direct keyword detection at line 339:
```typescript
if (promptLower.includes('remotion') || promptLower.includes('video') || 
    promptLower.includes('motion graphics') || promptLower.includes('title sequence')) 
    domain = 'remotion';
```

Model routing (`src/config/model-routing.ts`) prefers MiniMax-M2.7 and Qwen3.5-9B for Remotion generation.

 The domain is scored for creative quality requiring the best available models.

### RemotionRenderer: Code-to-Video Pipeline
 `src/render/RemotionRenderer.ts`

The renderer performs three key operations:

1. **`writeEntryPoint(code)`** -- Creates a temporary Remotion project:
   - Generates `src/index.ts` that inlines user code and wraps it with `registerRoot()`
   - Generates `package.json` with remotion + react dependencies
   - Generates `tsconfig.json` with JSX support
   - Returns project directory path

2. **`renderToVideo(options)`** -- Full render pipeline:
   - Validates project directory and entry point exist
   - `bundle()` via @remotion/bundler (webpack)
   - `selectComposition()` to discover the registered composition
   - `renderMedia()` to produce the final MP4

3. **`getCompositionConfig(options)`** -- Utility for building composition config objects

Default render settings: 30fps, 150 frames (5 seconds), 1920x1080, h264 codec.

### VideoExporter: FFmpeg Wrapper
 `src/export/VideoExporter.ts`

Provides format conversion and manipulation:
- **`convert(input, output, format)`** -- MP4/WebM/GIF conversion
- **`resize(input, output, width, height)`** -- Scale with aspect ratio preservation
- **`addAudio(video, audio, output)`** -- Merge audio track (AAC 192k)
- **`extractFrames(input, outputDir, fps)`** -- Video to PNG sequence
- **`framesToVideo(framesDir, output, fps)`** -- PNG sequence to video

All operations use path sanitization via `PathSanitizer` for security.

### CanvasRecorder: Browser-Based Capture
 `src/render/CanvasRecorder.ts`

For non-Remotion domains (p5, shader, three), captures animation frames using Puppeteer:
- Launches headless browser at configured viewport
- Loads domain-wrapped code via HTMLWrapper
- Steps through frames at configured fps
- Captures canvas screenshots per frame
- Stitches PNG sequence into MP4 via VideoExporter

### Compositor: Multi-Layer Compositing
 `src/composite/Compositor.ts`

The most architecturally interesting component. Supports two parallel compositing paths:

**FFmpeg Path** -- For file-based layers:
- `buildFilterGraph(spec)` -- Generates FFmpeg filter_complex string
- `buildCompositeArgs(spec, outputPath)` -- Full FFmpeg command args
- `composite(spec, outputPath)` -- Executes FFmpeg

**Remotion Path** -- For code-based layers:
- `generateRemotionComposition(spec)` -- Generates a Remotion component that uses `<Img>`, `<Video>`, and CSS `mix-blend-mode` to combine layers

CompositionSpec supports:
```typescript
{
  width: number, height: number, fps: number, duration: number,
  layers: CompositionLayer[],  // video, audio, image, or code
  background?: string
}
```

Each layer has: type, source, blend mode (normal/screen/multiply/overlay/soft-light/difference), opacity, position, dimensions, and optional volume/offset.

 Code layers carry their domain and generated code.

### Exporter.exportVideo(): Unified Export API

 `src/export/Exporter.ts`

The `exportVideo(code, outputPath, options)` method provides a single entry point:
- For `domain === 'remotion'`: delegates to `RemotionRenderer`
- For all other domains: delegates to `CanvasRecorder`
- Both produce MP4 output

### Landing Assets: Dogfood Examples

 `landing-assets/`

- **`dogfood-remotion-title.js`** -- A production-quality Liminal title sequence with particle system, gradient-animated title text, corner accents, center glow pulse. 120 frames at 30fps, 1920x1080.
- **`dogfood-remotion-title.html`** -- HTML preview of the above composition
- **`dogfood-remotion-title.mp4`** -- Rendered video
- **`remotion-entry.tsx`** -- "DISSOLVE / Particle Effect" title sequence used in `render-remotion.sh`
- **`temp-templates/`** -- Gradient and lower-third templates (fallbacks from failed LLM generations)

### Model Evaluation Results

The `landing-live/` directory contains Remotion outputs from different models:
- **b-remotion-phi4** -- Phi-4 Mini generation
- **b-remotion-gemma** -- Gemma 3 4B generation
- **b-remotion-granite-1b** -- Granite 4 1B generation
- **b-remotion-granite-350m** -- Granite 4 350M generation

Generated examples in `examples/generated/` show model quality across providers:
- **Granite4-1b**: Basic component with `frame.value.map()` (hallucinated API)
- **Gemma3-4B**: Uses `Video`, `Text` components and `{duration}` prop (non-standard)
- **Phi4-Mini**: Imports custom components that don't exist
- **Qwen3.5-9B**: Clean, valid Remotion code with typing animation + subtitle fade
- **MiniMax-M2.5**: Clean implementation with typing text, cursor blink, subtitle fade-in
- **MiniMax-M2.7**: Multi-part sequential typing with cursor and subtitle
- **Kimi-K2.5**: Attempted typing animation with subtitle (less polished)

The best outputs (Qwen3.5-9B, MiniMax-M2.5, MiniMax-M2.7) produce valid, self-contained Remotion components. Smaller models (Granite, Gemma, Phi-4) hallucinate APIs or produce incomplete code. This validates the model routing preference for MiniMax-M2.7 on the Remotion domain.

### Design Philosophy

From the design plan (`docs/plans/2026-03-28-video-generation-design.md`):

> "**Goal:** Add video generation (Remotion), video export (FFmpeg), and cross-domain compositing so Liminal can generate, combine, and layer any output type into a cohesive video."

> "**Architecture:** Three new capabilities: (1) a `remotion` domain that generates React/Remotion video compositions, (2) a video export pipeline that converts any Liminal output (p5, shader, three) to video via Puppeteer + FFmpeg, and (3) a compositor that layers multiple Liminal outputs (visual + audio) into a single polished piece."

The design is spec-driven and phase-organized:
- Phase 1: Foundation (domain types, prompts, templates, generator, registration)
- Phase 2: Rendering Pipeline (RemotionRenderer, VideoExporter, CanvasRecorder, Exporter integration)
- Phase 3: Compositing Layer (Compositor with FFmpeg filter graphs and Remotion multi-track)
- Phase 4: Integration (wire into RalphLoop, end-to-end verification)

From SOUL.md, Remotion is listed as a core creative coding capability alongside p5.js, Three.js, GLSL, Hydra, and Strudel. From the Creative Domain Types doc:

> | **Video** | Remotion | Deep | Animated content, motion graphics | `.tsx` + video render |

Remotion is classified as "Deep" rigor (10-20 iterations, thorough depth), appropriate for complex video productions.

---

## Script-to-Animation Workspace

**Status: NOT FOUND**

The script-to-animation workspace was not found in any of the following locations:
- `/Users/simongonzalezdecruz/workspaces/liminal/` (no matches)
- `/Users/simongonzalezdecruz/workspaces/` (Glob denied outside project)
- No references to "script-to-animation" found anywhere in the Liminal codebase, docs, or mining plans

The GitHub repo mining plan (`docs/plans/2026-03-29-github-repo-mining.md`) references a "mcp-video" project as a source for video pipeline patterns, but no "script-to-animation" workspace was listed. The closest reference is:

> "Integration with video pipeline (`RemotionRenderer`, `VideoExporter`)" -- from the planned features section

**Possible locations to check manually:**
- `/Users/simongonzalezdecruz/Desktop/`
- `/Users/simongonzalezdecruz/Documents/`
- `/Users/simongonzalezdecruz/Projects/`
- Any private GitHub repos under `Pastorsimon1798/`

---

## Spec-Driven Remotion Patterns

### Pattern 1: Frame-Based Timing (The Core Abstraction)

All animation in Liminal's Remotion pipeline is frame-based, never time-based. This is enforced in the prompt system:

> "Use frame-based timing via useCurrentFrame(), never Date.now() or setTimeout"
> "Use interpolate(frame, [startFrame, endFrame], [outputStart, outputEnd]) for smooth transitions"

Example from MiniMax-M2.5 generation:
```tsx
const charsToShow = interpolate(frame, [0, fullText.length * typingSpeed], [0, fullText.length], {
  extrapolateRight: 'clamp',
});
```

### Pattern 2: Composition Registration (The Scaffold Pattern)

RemotionRenderer wraps any generated code in a standard scaffold:
```tsx
import React from 'react';
import { Composition, registerRoot } from 'remotion';

// --- Generated component code ---
${code}
// --- End generated code ---

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${componentName}"
      component={${componentName}}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

registerRoot(RemotionRoot);
```

### Pattern 3: Keyword-to-Template Routing (Fallback Pattern)

When no LLM is available, prompts are routed to templates by keyword matching:
```
particle|galaxy|star|dust    -> particle-animation
text|typo|letter|word|reveal  -> text-reveal
geometric|shape|pattern|grid -> geometric-patterns
gradient|color|blend|smooth  -> gradient-loop (also default)
```

### Pattern 4: Dual-Path Rendering (Domain Dispatch)

Exporter.exportVideo dispatches based on domain:
```
domain === 'remotion'  ->  RemotionRenderer (code -> bundle -> render -> MP4)
domain !== 'remotion'  ->  CanvasRecorder (code -> Puppeteer -> PNGs -> FFmpeg -> MP4)
```

### Pattern 5: Multi-Layer Compositing (The CompositionSpec Pattern)

The Compositor supports two parallel paths for combining outputs:

**FFmpeg path** (file-based layers):
```typescript
const spec: CompositionSpec = {
  width: 1920, height: 1080, fps: 30, duration: 10,
  layers: [
    { type: 'video', source: '/bg.mp4', blend: 'normal', opacity: 1.0 },
    { type: 'video', source: '/overlay.mp4', blend: 'screen', opacity: 0.7 },
    { type: 'audio', source: '/music.mp3', volume: 0.8 },
  ],
};
```

**Remotion path** (code-based layers):
```typescript
const spec: CompositionSpec = {
  layers: [
    { type: 'code', domain: 'p5', code: '...', blend: 'normal' },
    { type: 'code', domain: 'shader', code: '...', blend: 'multiply', opacity: 0.5 },
  ],
};
compositor.generateRemotionComposition(spec) // Returns Remotion component code
```

### Pattern 6: Model-Aware Quality Routing

Remotion generation is routed to the best models:
- Preferred: MiniMax-M2.7, Qwen3.5-9B
- Accepted but lower quality: MiniMax-M2.5, Qwen3-Coder-40B
- This reflects the domain's "Deep" rigor classification

### Pattern 7: Security-First Design

All file operations in the video pipeline use path sanitization:
- `validateFilePath(input, process.cwd())` in VideoExporter
- `validateFilePath(outputPath, process.cwd())` in Compositor
- `sanitizeFilename()` for directory names
- Content Security Policy headers in HTML preview files

---

## Key Quotes

> "Add video generation (Remotion), video export (FFmpeg), and cross-domain compositing so Liminal can generate, combine, and layer any output type into a cohesive video."
> -- `docs/plans/2026-03-28-video-generation-design.md`

> "You are a senior Remotion developer specializing in programmatic video and motion graphics. Generate a complete React/Remotion composition based on the user's description."
> -- `src/prompts/remotion.ts` (system prompt)

> "CRITICAL: Output ONLY valid TypeScript/React code -- NO markdown fences, NO explanatory text. CRITICAL: Start directly with import statements."
> -- `src/prompts/remotion.ts` (generation constraints)

> "Use frame-based timing via useCurrentFrame(), never Date.now() or setTimeout."
> -- `src/prompts/remotion.ts` (animation rules)

> "Remotion requires a bundler to render. This is the generated composition code."
> -- `landing-assets/dogfood-remotion-title.html` (preview note)

> "Video | Remotion | Deep | Animated content, motion graphics | .tsx + video render"
> -- `docs/CREATIVE_DOMAIN_TYPES.md`

> "Creative quality is inherently multi-perspectival. No single metric captures whether a piece of generative art is good."
> -- `docs/THE_BIBLE.md`

> "Generative approaches produce novel output from minimal seeds."
> -- `docs/THE_BIBLE.md`

> "Purpose (replication) arises without an explicit fitness function."
> -- `narrative/data/raw-philosophy.md` (from Aguera y Arcas research)

> "Liminal is a creative coding agent with self-improving capabilities. It generates p5.js sketches, GLSL shaders, Three.js scenes, music (Tone.js/Strudel), video (Remotion/Hydra), and more."
> -- `docs/THE_BIBLE.md`

---

## File Map

### Core Pipeline Files
| File | Purpose |
|------|---------|
| `src/generators/remotion/RemotionGenerator.ts` | Domain generator, extends TierBasedGenerator |
| `src/generators/remotion/RemotionTemplates.ts` | 4 template fallbacks with keyword routing |
| `src/prompts/remotion.ts` | PromptLibrary entries for generate + improve |
| `src/render/RemotionRenderer.ts` | Bundle + render to MP4 via @remotion/bundler + @remotion/renderer |
| `src/render/CanvasRecorder.ts` | Puppeteer-based frame capture for p5/shader/three |
| `src/export/VideoExporter.ts` | FFmpeg wrapper (convert, resize, addAudio, extractFrames, framesToVideo) |
| `src/export/Exporter.ts` | Unified export API (HTML/JS/ZIP/Video) with domain dispatch |
| `src/composite/Compositor.ts` | Multi-layer compositing (FFmpeg + Remotion paths) |
| `src/generators/registerGenerators.ts` | Generator registry with keyword-based routing |
| `src/core/RalphLoop.ts` | Domain detection for remotion keywords |

### Assets & Examples
| File | Purpose |
|------|---------|
| `landing-assets/remotion-entry.tsx` | DISSOLVE title sequence entry point |
| `landing-assets/dogfood-remotion-title.js` | LIMINAL title sequence component |
| `landing-assets/dogfood-remotion-title.mp4` | Rendered video |
| `scripts/render-remotion.sh` | CLI script to render Remotion compositions |
| `examples/generated/*/remotion/*/v1.js` | Model evaluation outputs (8 models) |
| `landing-live/b-remotion-*/` | Landing page demos per model |

### Test Files
| File | Purpose |
|------|---------|
| `test/unit/generators/RemotionGenerator.test.ts` | Generator unit tests |
| `test/unit/generators/RemotionTemplates.test.ts` | Template routing tests |
| `test/unit/prompts/remotion.test.ts` | Prompt rendering tests |
| `test/unit/render/RemotionRenderer.test.ts` | Renderer unit tests |
| `test/unit/composite/Compositor.test.ts` | Compositor unit tests |

### Design Documentation
| File | Purpose |
|------|---------|
| `docs/plans/2026-03-28-video-generation-design.md` | Full implementation plan (4 phases, 13 tasks) |
| `docs/CREATIVE_DOMAIN_TYPES.md` | Domain taxonomy (Video = Remotion, Deep rigor) |
| `docs/THE_BIBLE.md` | System architecture reference |
| `docs/ARCHITECTURE_QUICKREF.md` | Quick reference (1741 tests passing) |
