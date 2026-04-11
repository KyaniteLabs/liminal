/**
 * RevideoRenderer - Headless video rendering via Revideo CLI
 *
 * Uses @revideo/core to produce video from makeScene() based compositions.
 * Creates a temporary project structure, then renders frames to a video file
 * via `npx revideo render`.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

export interface RevideoRendererOptions {
  tempDir?: string;
}

export interface CompositionConfig {
  id: string;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
}

export class RevideoRenderer {
  private tempDir: string;

  constructor(options: RevideoRendererOptions = {}) {
    this.tempDir = options.tempDir ?? os.tmpdir();
  }

  async writeEntryPoint(code: string): Promise<string> {
    const projectDir = path.join(
      this.tempDir,
      `revideo-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'scene.ts'), code);
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify(
        {
          name: 'revideo-render-project',
          Revideo: '^0.10.0',
          type: 'module',
        },
        null,
        2
      )
    );
    return projectDir;
  }

  async renderToVideo(opts: {
    projectDir: string;
    outputPath: string;
    fps?: number;
    width?: number;
    height?: number;
  }): Promise<void> {
    const {
      projectDir,
      outputPath,
      fps = DEFAULT_FPS,
      width = DEFAULT_WIDTH,
      height = DEFAULT_HEIGHT,
    } = opts;
    const entry = path.join(projectDir, 'scene.ts');
    return new Promise((resolve, reject) => {
      const proc = spawn(
        'npx',
        [
          'revideo',
          'render',
          entry,
          '--output',
          outputPath,
          '--fps',
          String(fps),
          '--width',
          String(width),
          '--height',
          String(height),
        ],
        {
          cwd: projectDir,
          stdio: 'pipe',
        }
      );
      let stderr = '';
      proc.stderr?.on('data', (c) => {
        stderr += c.toString();
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`revideo render failed: ${stderr}`));
      });
      proc.on('error', reject);
    });
  }

  getCompositionConfig(_code: string): CompositionConfig {
    return {
      id: 'GeneratedScene',
      fps: DEFAULT_FPS,
      durationInFrames: 300,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };
  }
}
