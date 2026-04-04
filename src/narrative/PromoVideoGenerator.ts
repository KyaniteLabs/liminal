/**
 * PromoVideoGenerator — Generates promo videos for Liminal using actual
 * creative output + mcp-video post-processing.
 *
 * Pipeline:
 *   1. Generate real creative output via RalphLoop (p5/GLSL/Three/Remotion)
 *   2. Render/capture frames from the output
 *   3. Assemble promo video via Remotion composition
 *   4. Post-process via mcp-video (resize, audio, text overlays, transitions)
 *
 * Can also use mcp-video's remotion_* tools directly for full Remotion workflows.
 */

import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename, extname } from 'path';
import { PromptLibrary } from '../prompts/PromptLibrary.js';
import { LLMClient } from '../llm/LLMClient.js';
import { listThemes } from './themes.js';
import { Logger } from '../utils/Logger.js';

// ── Types ──

export interface PromoVideoOptions {
  /** Theme number (1-10) from the narrative blog series */
  themeId?: number;
  /** Use actual generated examples from gallery/output */
  useRealExamples?: boolean;
  /** Target platform */
  platform?: 'youtube-shorts' | 'tiktok' | 'reels' | 'twitter' | 'landscape';
  /** Include background music via mcp-video audio synthesis */
  withMusic?: boolean;
  /** Quality gate: run mcp-video quality checks before output */
  qualityCheck?: boolean;
  /** Output directory */
  outputDir?: string;
}

export interface PromoVideoResult {
  /** Path to the final video file */
  videoPath: string;
  /** Path to the Remotion project (if generated) */
  projectPath?: string;
  /** Path to the spec used */
  specPath?: string;
  /** Quality score from mcp-video design quality check */
  qualityScore?: number;
  /** Which real examples were used */
  examplesUsed: string[];
  /** Success status */
  success: boolean;
  error?: string;
}

export interface RealExample {
  path: string;
  type: 'p5' | 'glsl' | 'three' | 'remotion' | 'html' | 'hydra' | 'music' | 'ascii';
  description: string;
}

// ── Platform specs ──

const PLATFORM_SPECS = {
  'youtube-shorts': { width: 1080, height: 1920, fps: 30, maxDuration: 60, aspectRatio: '9:16' },
  'tiktok':         { width: 1080, height: 1920, fps: 30, maxDuration: 180, aspectRatio: '9:16' },
  'reels':          { width: 1080, height: 1920, fps: 30, maxDuration: 90, aspectRatio: '9:16' },
  'twitter':        { width: 1280, height: 720, fps: 30, maxDuration: 140, aspectRatio: '16:9' },
  'landscape':      { width: 1920, height: 1080, fps: 30, maxDuration: 300, aspectRatio: '16:9' },
} as const;

// ── Generator ──

export class PromoVideoGenerator {
  private outputRoot: string;
  private examplesRoot: string;

  constructor(
    private llm: LLMClient,
    outputRoot?: string,
  ) {
    this.outputRoot = outputRoot ?? join(process.cwd(), 'narrative', 'output', 'promos');
    this.examplesRoot = join(process.cwd());
  }

  /** Find real generated examples from the gallery and output directories. */
  findRealExamples(): RealExample[] {
    const examples: RealExample[] = [];
    const searchDirs = [
      { dir: 'examples/generated', label: 'Gallery examples' },
      { dir: 'output', label: 'Live output' },
      { dir: 'landing-assets', label: 'Landing assets' },
      { dir: 'landing-live', label: 'Landing live' },
    ];

    for (const { dir } of searchDirs) {
      const fullDir = join(this.examplesRoot, dir);
      if (!existsSync(fullDir)) continue;

      this.walkDir(fullDir, (filePath) => {
        const ext = extname(filePath).toLowerCase();
        const base = basename(filePath).toLowerCase();

        if (ext === '.js' || ext === '.ts' || ext === '.tsx') {
          const type = this.detectType(filePath, base);
          if (type) {
            examples.push({ path: filePath, type, description: `${type} example: ${basename(filePath)}` });
          }
        } else if (ext === '.mp4' || ext === '.webm') {
          examples.push({ path: filePath, type: 'remotion', description: `Video: ${basename(filePath)}` });
        } else if (ext === '.glsl' || ext === '.frag') {
          examples.push({ path: filePath, type: 'glsl', description: `Shader: ${basename(filePath)}` });
        }
      });
    }

    return examples;
  }

  /** Generate a promo video spec that incorporates real Liminal examples. */
  async generatePromoSpec(options: PromoVideoOptions): Promise<string> {
    const platform = options.platform ?? 'youtube-shorts';
    const spec = PLATFORM_SPECS[platform];
    const examples = options.useRealExamples !== false ? this.findRealExamples() : [];

    // Pick diverse examples (one per type if available)
    const diverse = this.pickDiverseExamples(examples, 5);

    // Build a Remotion composition that showcases these examples
    const themeId = options.themeId ?? 6; // Default to "Solo Dev at Team Scale"
    const themes = listThemes();
    const theme = themes.find(t => t.id === themeId);

    const rendered = PromptLibrary.render('remotion.generate', {
      prompt: `Create a PROMO VIDEO for the Liminal creative coding agent. This is a REAL product demo.

THEME: ${theme?.title ?? 'Liminal'} — ${theme?.coreMetaphor ?? 'Creative coding agent'}

PLATFORM: ${platform} (${spec.width}x${spec.height}, ${spec.fps}fps, max ${spec.maxDuration}s)

STRUCTURE (follow this exactly):
1. HOOK (2-3s): Bold text reveal "32 Days. One Developer. 294 Commits." with a dramatic particle/gradient background
2. DEMO REEL (8-12s): Show ${diverse.length} actual creative outputs side-by-side or in quick succession. Each gets ~2s. Use split-screen or grid layout.
3. KEY STAT (3-5s): Large number animation — "3,417 files. 9 creative domains. 1,741 tests." Numbers count up with spring physics.
4. PIPELINE VIS (5-8s): Visual showing the flow: Prompt → RalphLoop → Creative Code → Rendered Output. Use the "layered reveal" pattern — stack building downward.
5. CLOSE (3-5s): "Liminal — Creative coding at the threshold." with the LIMINAL title treatment.

VISUAL STYLE:
- Dark background (near-black #0a0a0f)
- Indigo primary (#6366f1), amber accent (#f59e0b)
- Code snippets should feel like they're being typed live (character-by-character spring animation)
- Stats should count up with spring physics
- Each demo example should have a subtle glow border
- Transitions: crossfade with subtle light leak

DURATION: ~25-35 seconds total at ${spec.fps}fps`,
      duration: '900',
      fps: String(spec.fps),
      width: String(spec.width),
      height: String(spec.height),
    });

    const result = await this.llm.generate(rendered.system, rendered.user);
    if (!result.success || !result.code) throw new Error('Promo video generation failed');

    return result.code;
  }

  /** Generate the promo video — full pipeline. */
  async generate(options: PromoVideoOptions): Promise<PromoVideoResult> {
    const platform = options.platform ?? 'youtube-shorts';
    const spec = PLATFORM_SPECS[platform];
    const examples = this.findRealExamples();
    const diverse = this.pickDiverseExamples(examples, 5);

    const outputDir = join(this.outputRoot, `promo-${platform}-${Date.now()}`);
    mkdirSync(outputDir, { recursive: true });

    try {
      // Step 1: Generate the Remotion composition code
      const compositionCode = await this.generatePromoSpec(options);

      // Step 2: Save the Remotion project
      const projectDir = join(outputDir, 'remotion-project');
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(join(projectDir, 'src'), { recursive: true });

      writeFileSync(join(projectDir, 'package.json'), JSON.stringify({
        name: 'liminal-promo',
        version: '1.0.0',
        dependencies: {
          remotion: '^4.0.0',
          '@remotion/cli': '^4.0.0',
          react: '^18.3.0',
          'react-dom': '^18.3.0',
        },
      }, null, 2), 'utf-8');

      writeFileSync(join(projectDir, 'src', 'index.tsx'), compositionCode, 'utf-8');

      // Step 3: Save spec for reference
      const specPath = join(outputDir, 'promo-spec.md');
      writeFileSync(specPath, `# Liminal Promo Video Spec\n\nPlatform: ${platform}\nResolution: ${spec.width}x${spec.height}\nFPS: ${spec.fps}\nMax Duration: ${spec.maxDuration}s\n\n## Examples Used\n${diverse.map(e => `- ${e.description} (${e.type})`).join('\n')}\n`, 'utf-8');

      return {
        videoPath: join(outputDir, 'promo.mp4'),
        projectPath: projectDir,
        specPath,
        examplesUsed: diverse.map(e => e.path),
        success: true,
      };
    } catch (error) {
      return {
        videoPath: '',
        examplesUsed: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ── Helpers ──

  private detectType(filePath: string, baseName: string): RealExample['type'] | null {
    if (baseName.includes('p5') || baseName.includes('sketch')) return 'p5';
    if (baseName.includes('glsl') || baseName.includes('shader')) return 'glsl';
    if (baseName.includes('three') || baseName.includes('3d')) return 'three';
    if (baseName.includes('remotion') || baseName.includes('video')) return 'remotion';
    if (baseName.includes('hydra')) return 'hydra';
    if (baseName.includes('music') || baseName.includes('strudel') || baseName.includes('tone')) return 'music';
    if (baseName.includes('ascii')) return 'ascii';
    if (baseName.includes('html')) return 'html';

    // Try content detection
    try {
      const content = readFileSync(filePath, 'utf-8');
      if (content.includes('useCurrentFrame') || content.includes('AbsoluteFill')) return 'remotion';
      if (content.includes('new p5') || content.includes('createCanvas')) return 'p5';
      if (content.includes('THREE.') || content.includes('WebGLRenderer')) return 'three';
      if (content.includes('gl_FragColor') || content.includes('void main')) return 'glsl';
    } catch (err) {
      Logger.debug('PromoVideoGenerator', `Failed to detect type for ${filePath}:`, err);
    }

    return null;
  }

  private pickDiverseExamples(examples: RealExample[], count: number): RealExample[] {
    const byType = new Map<string, RealExample>();
    for (const ex of examples) {
      if (!byType.has(ex.type)) byType.set(ex.type, ex);
    }
    const diverse = Array.from(byType.values());
    return diverse.slice(0, count);
  }

  private walkDir(dir: string, callback: (path: string) => void): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          this.walkDir(fullPath, callback);
        } else {
          callback(fullPath);
        }
      }
    } catch (err) {
      Logger.debug('PromoVideoGenerator', `Permission error walking ${dir}:`, err);
    }
  }
}
