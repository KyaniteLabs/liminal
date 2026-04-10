/**
 * RevideoRenderer - Scaffolds and renders Revideo compositions to video
 *
 * Wraps the Revideo rendering API to produce MP4 from generated
 * Revideo scene code. Creates a temporary project structure and renders
 * using Revideo's programmatic API.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/** Shape of a composition config */
export interface RevideoCompositionConfig {
  id: string;
  fps: number;
  durationInSeconds: number;
  width: number;
  height: number;
}

/** Options for the RevideoRenderer constructor */
interface RevideoRendererOptions {
  tempDir?: string;
}

/** Options for renderToVideo */
interface RenderToVideoOptions {
  projectDir: string;
  outputPath: string;
  codec?: string;
}

/** Default composition settings */
const DEFAULT_FPS = 30;
const DEFAULT_DURATION_SECONDS = 5;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_CODEC = 'h264';

export class RevideoRenderer {
  private readonly tempDir: string;

  constructor(options: RevideoRendererOptions = {}) {
    this.tempDir = options.tempDir ?? os.tmpdir();
  }

  /**
   * Parse the exported scene name from generated code.
   */
  private parseSceneName(code: string): string | null {
    const defaultExportMatch = code.match(/export\s+default\s+(\w+)/);
    if (defaultExportMatch) return defaultExportMatch[1];

    const constMatch = code.match(/export\s+const\s+(\w+)/);
    if (constMatch) return constMatch[1];

    return null;
  }

  /**
   * Generate the project configuration file.
   */
  private generateProjectConfig(code: string): string {
    const _sceneName = this.parseSceneName(code) ?? 'Scene';

    return `import {makeProject} from '@revideo/core';
import scene from './scene';

export default makeProject({
  scenes: [scene],
  settings: {
    shared: {
      size: {width: 1920, height: 1080},
    },
  },
});
`;
  }

  /**
   * Generate a minimal package.json for the Revideo project.
   */
  private generatePackageJson(): string {
    return JSON.stringify(
      {
        name: 'revideo-render-project',
        version: '1.0.0',
        private: true,
        type: 'module',
        dependencies: {
          '@revideo/core': '^0.1.0',
          '@revideo/2d': '^0.1.0',
          '@revideo/renderer': '^0.1.0',
        },
      },
      null,
      2
    );
  }

  /**
   * Generate a tsconfig.json with proper module settings.
   */
  private generateTsConfig(): string {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ES2022',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          jsxImportSource: '@revideo/2d',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          allowSyntheticDefaultImports: true,
        },
        include: ['src/**/*'],
      },
      null,
      2
    );
  }

  /**
   * Write a complete Revideo project to disk with the given scene code.
   */
  async writeEntryPoint(code: string): Promise<string> {
    const projectDir = path.join(
      this.tempDir,
      `revideo-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    const srcDir = path.join(projectDir, 'src');

    await fs.mkdir(srcDir, { recursive: true });

    await fs.writeFile(
      path.join(srcDir, 'scene.ts'),
      code,
      'utf-8'
    );

    await fs.writeFile(
      path.join(srcDir, 'project.ts'),
      this.generateProjectConfig(code),
      'utf-8'
    );

    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      this.generatePackageJson(),
      'utf-8'
    );

    await fs.writeFile(
      path.join(projectDir, 'tsconfig.json'),
      this.generateTsConfig(),
      'utf-8'
    );

    return projectDir;
  }

  /**
   * Render a Revideo project to a video file.
   *
   * Note: This is a placeholder implementation. Actual Revideo rendering
   * would require the Revideo renderer package to be installed and configured.
   * For now, this creates the project structure and returns the path.
   */
  async renderToVideo(options: RenderToVideoOptions): Promise<string> {
    const { projectDir, outputPath, codec = DEFAULT_CODEC } = options;

    try {
      await fs.access(projectDir);
    } catch {
      throw new Error(
        `Revideo project directory does not exist: ${projectDir}. ` +
          `Call writeEntryPoint() first to scaffold a project.`
      );
    }

    const entryPoint = path.join(projectDir, 'src', 'project.ts');

    try {
      await fs.access(entryPoint);
    } catch {
      throw new Error(
        `Entry point does not exist: ${entryPoint}. ` +
          `The project directory may be corrupted.`
      );
    }

    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Placeholder: Revideo rendering would be done here
    // For now, create a placeholder file indicating rendering is not yet implemented
    await fs.writeFile(
      outputPath + '.placeholder',
      `Revideo rendering placeholder.\nCodec: ${codec}\nProject: ${projectDir}\n`,
      'utf-8'
    );

    return outputPath;
  }

  /**
   * Build a composition config object.
   */
  getCompositionConfig(options: Partial<RevideoCompositionConfig> = {}): RevideoCompositionConfig {
    return {
      id: options.id ?? 'generated',
      fps: options.fps ?? DEFAULT_FPS,
      durationInSeconds: options.durationInSeconds ?? DEFAULT_DURATION_SECONDS,
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? DEFAULT_HEIGHT,
    };
  }
}
