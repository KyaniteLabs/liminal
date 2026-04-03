/**
 * BlogToVideoPipeline — Automated blog-theme-to-Remotion-video pipeline.
 *
 * Stage 1: Theme → Script  (via blog.script prompt + LLM)
 * Stage 2: Script → Spec   (via blog.spec prompt + LLM)
 * Stage 3: Spec → Video    (delegates to existing Remotion pipeline)
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PromptLibrary } from '../prompts/PromptLibrary.js';
import { LLMClient } from '../llm/LLMClient.js';
import { getTheme } from './themes.js';

// ── Types ──

export interface PipelineOptions {
  resolution?: string;
  fps?: number;
  brandColors?: string;
  brandFonts?: string;
}

export interface PipelineResult {
  theme: string;
  scriptPath: string;
  specPath: string;
  videoPath?: string;
  success: boolean;
  error?: string;
}

const DEFAULT_OPTIONS: Required<PipelineOptions> = {
  resolution: '1920x1080',
  fps: 30,
  brandColors: 'Primary: #6366f1 (indigo), Secondary: #0f172a (slate-900), Accent: #f59e0b (amber)',
  brandFonts: 'Heading: Inter Bold 700, Body: Inter Regular 400',
};

// ── Pipeline ──

export class BlogToVideoPipeline {
  private outputRoot: string;

  constructor(
    private llm: LLMClient,
    outputRoot?: string,
  ) {
    this.outputRoot = outputRoot ?? join(process.cwd(), 'narrative', 'output');
  }

  /** Stage 1: Generate a video script from a blog theme. */
  async generateScript(themeId: number): Promise<{ script: string; path: string }> {
    const theme = getTheme(themeId);
    if (!theme) throw new Error(`Theme ${themeId} not found. Available: 1-10`);

    const rendered = PromptLibrary.render('blog.script', {
      theme: theme.coreMetaphor,
      era: theme.era,
      keyQuotes: theme.keyQuotes.join('\n'),
      dataPoints: theme.dataPoints.join('\n'),
      template: theme.template,
      format: theme.format,
      platform: theme.platform,
    });

    const result = await this.llm.generate(rendered.system, rendered.user);
    const script = result.code;
    if (!result.success || !script) throw new Error('Script generation failed');

    const dir = this.ensureOutputDir(theme.slug);
    const scriptPath = join(dir, 'script.md');
    writeFileSync(scriptPath, script, 'utf-8');

    return { script, path: scriptPath };
  }

  /** Stage 2: Generate an animation spec from a script. */
  async generateSpec(
    script: string,
    themeSlug: string,
    options?: PipelineOptions,
  ): Promise<{ spec: string; path: string }> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const rendered = PromptLibrary.render('blog.spec', {
      script,
      resolution: opts.resolution,
      fps: String(opts.fps),
      brandColors: opts.brandColors,
      brandFonts: opts.brandFonts,
    });

    const result = await this.llm.generate(rendered.system, rendered.user);
    const spec = result.code;
    if (!result.success || !spec) throw new Error('Spec generation failed');

    const dir = this.ensureOutputDir(themeSlug);
    const specPath = join(dir, 'spec.md');
    writeFileSync(specPath, spec, 'utf-8');

    return { spec, path: specPath };
  }

  /** Load a previously generated script from disk. */
  loadScript(themeSlug: string): string {
    const scriptPath = join(this.outputRoot, `theme-${themeSlug}`, 'script.md');
    if (!existsSync(scriptPath)) throw new Error(`No script found at ${scriptPath}`);
    return readFileSync(scriptPath, 'utf-8');
  }

  /** Run the full pipeline: Theme → Script → Spec → Video. */
  async runFullPipeline(themeId: number, options?: PipelineOptions): Promise<PipelineResult> {
    const theme = getTheme(themeId);
    if (!theme) throw new Error(`Theme ${themeId} not found. Available: 1-10`);

    try {
      // Stage 1: Theme → Script
      const { script, path: scriptPath } = await this.generateScript(themeId);

      // Stage 2: Script → Spec
      const { path: specPath } = await this.generateSpec(script, theme.slug, options);

      // Stage 3 is the existing Remotion pipeline — return spec for now.
      // The RemotionGenerator + RemotionRenderer can be called separately
      // with the spec content as input.
      return {
        theme: theme.title,
        scriptPath,
        specPath,
        success: true,
      };
    } catch (error) {
      return {
        theme: theme.title,
        scriptPath: '',
        specPath: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ── Helpers ──

  private ensureOutputDir(slug: string): string {
    const dir = join(this.outputRoot, `theme-${slug}`);
    mkdirSync(dir, { recursive: true });
    return dir;
  }
}
