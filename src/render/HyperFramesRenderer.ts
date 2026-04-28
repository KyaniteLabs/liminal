import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { VideoRenderer, VideoRenderOptions, VideoRenderResult } from './VideoRenderer.js';

const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

interface AssetDescriptor {
  path: string;
  type: 'video' | 'image' | 'audio';
  startAt: number;
  duration: number;
}

export interface HyperFramesRenderOptions extends VideoRenderOptions {
  assets?: AssetDescriptor[];
}

function toFileUrl(absolutePath: string): string {
  if (absolutePath.startsWith('file://') || absolutePath.startsWith('http://') || absolutePath.startsWith('https://')) {
    return absolutePath;
  }
  return `file://${absolutePath}`;
}

function buildAssetInjectionScript(assets: AssetDescriptor[]): string {
  const elements: string[] = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const src = toFileUrl(asset.path);
    const attrs = `data-start="${asset.startAt}" data-duration="${asset.duration}" data-track-index="${i}"`;

    if (asset.type === 'video') {
      elements.push(`<video src="${src}" ${attrs} style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></video>`);
    } else if (asset.type === 'image') {
      elements.push(`<img src="${src}" ${attrs} style="position:absolute;top:0;left:0;max-width:100%;max-height:100%;pointer-events:none;">`);
    } else if (asset.type === 'audio') {
      elements.push(`<audio src="${src}" ${attrs}></audio>`);
    }
  }

  return [
    '<div id="liminal-injected-assets" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;">',
    ...elements,
    '</div>',
  ].join('\n');
}

function injectAssetsIntoHtml(html: string, assets: AssetDescriptor[]): string {
  const script = buildAssetInjectionScript(assets);

  if (html.includes('</body>')) {
    return html.replace('</body>', `${script}\n</body>`);
  }

  return html + '\n' + script;
}

export class HyperFramesRenderer implements VideoRenderer {
  private tempBaseDir: string;

  constructor(options?: { tempDir?: string }) {
    this.tempBaseDir = options?.tempDir ?? os.tmpdir();
  }

  async writeComposition(code: string): Promise<string> {
    const compDir = path.join(
      this.tempBaseDir,
      `hyperframes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );

    await fs.mkdir(compDir, { recursive: true });
    await fs.writeFile(path.join(compDir, 'index.html'), code);

    return compDir;
  }

  async cleanup(dir: string): Promise<void> {
    await fs.rm(dir, { recursive: true, force: true });
  }

  async render(
    code: string,
    outputPath: string,
    opts: HyperFramesRenderOptions = {}
  ): Promise<VideoRenderResult> {
    const fps = opts.fps ?? DEFAULT_FPS;
    const width = opts.width ?? DEFAULT_WIDTH;
    const height = opts.height ?? DEFAULT_HEIGHT;
    const quality = 'standard';

    let html = code;
    if (opts.assets && opts.assets.length > 0) {
      html = injectAssetsIntoHtml(html, opts.assets);
    }

    let compDir: string | undefined;
    try {
      compDir = await this.writeComposition(html);

      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let createRenderJob: (config: any) => any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let executeRenderJob: (job: any, ...args: any[]) => Promise<any>;
      try {
        // Dynamic import via variable prevents TS from following into broken @hyperframes/engine types
        const producerModule = '@hyperframes/producer';
        const mod = await import(producerModule);
        createRenderJob = mod.createRenderJob;
        executeRenderJob = mod.executeRenderJob;
        if (!createRenderJob || !executeRenderJob) {
          throw new Error('createRenderJob/executeRenderJob not exported');
        }
      } catch {
        throw new Error(
          'HyperFrames rendering requires @hyperframes/producer. Install with: pnpm add @hyperframes/producer'
        );
      }

      const job = createRenderJob({
        input: path.join(compDir, 'index.html'),
        output: outputPath,
        fps,
        width,
        height,
        quality,
        duration: opts.duration,
      });

      const result = await executeRenderJob(job, compDir, outputPath);

      const ext = path.extname(outputPath).slice(1) as 'mp4' | 'webm' | 'mov';
      const duration = opts.duration ?? (result?.duration ?? 0);

      return {
        outputPath,
        duration,
        width,
        height,
        format: ext || 'mp4',
      };
    } finally {
      if (compDir) {
        await this.cleanup(compDir);
      }
    }
  }
}
