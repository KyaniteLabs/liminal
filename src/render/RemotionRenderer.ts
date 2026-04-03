/**
 * RemotionRenderer - Scaffolds, bundles, and renders Remotion compositions to video
 *
 * Wraps @remotion/bundler and @remotion/renderer to produce MP4 from generated
 * Remotion component code. Creates a temporary Remotion project structure, bundles
 * it via webpack, then renders frames to a video file.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
/** Shape of a composition config returned by getCompositionConfig */
export interface CompositionConfig {
  id: string;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
}

/** Options for the RemotionRenderer constructor */
interface RemotionRendererOptions {
  /** Directory where temporary Remotion projects will be scaffolded. Defaults to os.tmpdir(). */
  tempDir?: string;
}

/** Options for the composition config */
interface CompositionConfigOptions {
  id: string;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
}

/** Options for renderToVideo */
interface RenderToVideoOptions {
  /** Path to the scaffolded Remotion project directory */
  projectDir: string;
  /** Path where the output video will be written */
  outputPath: string;
  /** Video codec. Defaults to 'h264' */
  codec?: string;
}

/** Default composition settings */
const DEFAULT_FPS = 30;
const DEFAULT_DURATION_FRAMES = 150;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_CODEC = 'h264';

export class RemotionRenderer {
  private readonly tempDir: string;

  constructor(options: RemotionRendererOptions = {}) {
    this.tempDir = options.tempDir ?? os.tmpdir();
  }

  /**
   * Parse the exported component name from generated code.
   * Looks for `export const Name` or `export default function Name` patterns.
   */
  private parseComponentName(code: string): string | null {
    // Match: export const ComponentName
    const constMatch = code.match(/export\s+const\s+(\w+)/);
    if (constMatch) return constMatch[1];

    // Match: export default function ComponentName
    const defaultFnMatch = code.match(/export\s+default\s+function\s+(\w+)/);
    if (defaultFnMatch) return defaultFnMatch[1];

    // Match: export function ComponentName
    const fnMatch = code.match(/export\s+function\s+(\w+)/);
    if (fnMatch) return fnMatch[1];

    return null;
  }

  /**
   * Generate the entry point content that wraps user code with Remotion root registration.
   */
  private generateEntryPoint(code: string): string {
    const componentName = this.parseComponentName(code);
    const fallbackId = componentName ?? 'GeneratedComposition';

    // The user's code is inlined. We reference the exported component by name.
    const componentLine = componentName
      ? `component={${componentName}}`
      : `component={() => null}`;

    return `import React from 'react';
import { Composition, registerRoot } from 'remotion';

// --- Generated component code ---
${code}
// --- End generated code ---

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${fallbackId}"
      ${componentLine}
      durationInFrames={${DEFAULT_DURATION_FRAMES}}
      fps={${DEFAULT_FPS}}
      width={${DEFAULT_WIDTH}}
      height={${DEFAULT_HEIGHT}}
    />
  );
};

registerRoot(RemotionRoot);
`;
  }

  /**
   * Generate a minimal package.json for the Remotion project.
   */
  private generatePackageJson(): string {
    return JSON.stringify(
      {
        name: 'remotion-render-project',
        version: '1.0.0',
        private: true,
        dependencies: {
          remotion: '^4.0.0',
          react: '^18.3.0',
          'react-dom': '^18.3.0',
        },
      },
      null,
      2
    );
  }

  /**
   * Generate a tsconfig.json with JSX support.
   */
  private generateTsConfig(): string {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ES2022',
          moduleResolution: 'bundler',
          jsx: 'react',
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
   * Write a complete Remotion project to disk with the given component code.
   * Creates package.json, tsconfig.json, and src/index.ts.
   *
   * @param code - The generated Remotion component code (must export a React component)
   * @returns The project directory path
   */
  async writeEntryPoint(code: string): Promise<string> {
    const projectDir = path.join(
      this.tempDir,
      `remotion-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    const srcDir = path.join(projectDir, 'src');

    await fs.mkdir(srcDir, { recursive: true });

    await fs.writeFile(
      path.join(srcDir, 'index.ts'),
      this.generateEntryPoint(code),
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
   * Bundle and render a Remotion project to a video file.
   *
   * @param options - Render options including project dir, output path, and optional codec
   * @returns The output file path
   * @throws Error if the project directory does not exist
   */
  async renderToVideo(options: RenderToVideoOptions): Promise<string> {
    const { projectDir, outputPath, codec = DEFAULT_CODEC } = options;

    // Validate project directory exists
    try {
      await fs.access(projectDir);
    } catch {
      throw new Error(
        `Remotion project directory does not exist: ${projectDir}. ` +
          `Call writeEntryPoint() first to scaffold a project.`
      );
    }

    const entryPoint = path.join(projectDir, 'src', 'index.ts');

    // Validate entry point exists
    try {
      await fs.access(entryPoint);
    } catch {
      throw new Error(
        `Entry point does not exist: ${entryPoint}. ` +
          `The project directory may be corrupted.`
      );
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Bundle the project using @remotion/bundler
    const bundleLocation = await bundle({
      entryPoint,
      onProgress: (progress: number) => {
        // Bundling progress - intentionally silent for now
        void progress;
      },
    });

    // Select the composition to render
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'GeneratedComposition',
    });

    // Render to video
    await renderMedia({
      serveUrl: bundleLocation,
      composition,
      codec: codec as any,
      outputLocation: outputPath,
      onProgress: ({ progress }: { progress: number }) => {
        // Rendering progress - intentionally silent for now
        void progress;
      },
    });

    return outputPath;
  }

  /**
   * Build a composition config object. Useful for testing and for passing
   * to Remotion APIs that need a VideoConfig.
   */
  getCompositionConfig(options: CompositionConfigOptions): CompositionConfig {
    return {
      id: options.id,
      fps: options.fps,
      durationInFrames: options.durationInFrames,
      width: options.width,
      height: options.height,
    };
  }
}
