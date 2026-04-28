import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { VideoRenderer, VideoRenderOptions, VideoRenderResult } from './VideoRenderer.js';

const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

export interface CompositionConfig {
  id: string;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
}

export class RevideoRenderer implements VideoRenderer {
  private tempDir: string;

  constructor(options?: { tempDir?: string }) {
    this.tempDir = options?.tempDir ?? os.tmpdir();
  }

  async writeProject(code: string): Promise<string> {
    const projectDir = path.join(
      this.tempDir,
      `revideo-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );

    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });

    await fs.writeFile(path.join(projectDir, 'src', 'scene.tsx'), code);

    await fs.writeFile(
      path.join(projectDir, 'src', 'project.ts'),
      [
        "import { makeProject } from '@revideo/core';",
        "import scene from './scene.js';",
        "export default makeProject({ name: 'liminal-render', scenes: [scene] });",
      ].join('\n')
    );

    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify(
        {
          name: 'liminal-render-project',
          type: 'module',
          dependencies: {
            '@revideo/core': '^0.10.4',
            '@revideo/2d': '^0.10.4',
            '@revideo/renderer': '^0.10.4',
            '@revideo/ffmpeg': '^0.10.4',
          },
        },
        null,
        2
      )
    );

    await fs.writeFile(
      path.join(projectDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            jsxImportSource: '@revideo/2d/lib',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
        },
        null,
        2
      )
    );

    try {
      execSync('npm install --loglevel=error', {
        cwd: projectDir,
        stdio: 'pipe',
        timeout: 120_000,
      });
    } catch (err) {
      await fs.rm(projectDir, { recursive: true, force: true }).catch(() => {});
      throw new Error(`Failed to install Revideo project dependencies: ${err instanceof Error ? err.message : String(err)}`);
    }

    return projectDir;
  }

  async render(code: string, outputPath: string, opts: VideoRenderOptions = {}): Promise<VideoRenderResult> {
    const fps = opts.fps ?? DEFAULT_FPS;
    const width = opts.width ?? DEFAULT_WIDTH;
    const height = opts.height ?? DEFAULT_HEIGHT;

    let projectDir: string | undefined;
    try {
      projectDir = await this.writeProject(code);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renderVideoFn: (config: any) => Promise<any> = await (async () => {
        try {
          const mod = await import('@revideo/renderer');
          return mod.renderVideo;
        } catch {
          throw new Error(
            'Revideo rendering requires @revideo/renderer. Install with: pnpm add @revideo/renderer'
          );
        }
      })();

      await renderVideoFn({
        projectFile: path.join(projectDir, 'src', 'project.ts'),
        settings: {
          outFile: outputPath,
          workers: 1,
          puppeteer: { args: ['--no-sandbox'] },
          fps,
          width,
          height,
        },
      });

      const config = this.getCompositionConfig(code, fps);
      const ext = path.extname(outputPath).slice(1) as 'mp4' | 'webm' | 'mov';

      return {
        outputPath,
        duration: config.durationInFrames / fps,
        width,
        height,
        format: ext || 'mp4',
      };
    } finally {
      if (projectDir) {
        await fs.rm(projectDir, { recursive: true, force: true });
      }
    }
  }

  getCompositionConfig(code: string, fps: number = DEFAULT_FPS): CompositionConfig {
    const waitForValues = [...code.matchAll(/yield\*\s*waitFor\((\d+(?:\.\d+)?)\)/g)]
      .map((m) => parseFloat(m[1]));
    const durationValues = [...code.matchAll(/\.duration\((\d+(?:\.\d+)?)\)/g)]
      .map((m) => parseFloat(m[1]));
    const totalSeconds = waitForValues.reduce((a, b) => a + b, 0)
      + durationValues.reduce((a, b) => a + b, 0);
    const durationInFrames = totalSeconds > 0
      ? Math.ceil(totalSeconds * fps)
      : fps * 10;

    const rectMatch = code.match(/Rect[^>]*width=\{(\d+)\}[^>]*height=\{(\d+)\}/);
    const viewMatch = code.match(/view\.fill\([^)]*\)/);
    let width = DEFAULT_WIDTH;
    let height = DEFAULT_HEIGHT;
    if (rectMatch) {
      width = parseInt(rectMatch[1], 10);
      height = parseInt(rectMatch[2], 10);
    } else if (!viewMatch) {
      const sizeMatch = code.match(/size\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (sizeMatch) {
        width = parseInt(sizeMatch[1], 10);
        height = parseInt(sizeMatch[2], 10);
      }
    }

    return {
      id: 'GeneratedScene',
      fps,
      durationInFrames,
      width,
      height,
    };
  }
}
