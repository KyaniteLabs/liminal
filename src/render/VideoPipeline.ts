import fs from 'fs';
import path from 'path';
import os from 'os';
import { VideoRenderResult, VideoRenderOptions } from './VideoRenderer.js';
import { RevideoRenderer } from './RevideoRenderer.js';
import { HyperFramesRenderer, HyperFramesRenderOptions } from './HyperFramesRenderer.js';

export interface PipelineStep {
  type: 'revideo' | 'hyperframes';
  code: string;
  options?: Record<string, unknown>;
}

export class VideoPipeline {
  async execute(
    steps: PipelineStep[],
    outputPath: string,
    baseOpts?: VideoRenderOptions
  ): Promise<VideoRenderResult> {
    if (steps.length === 0) {
      throw new Error('VideoPipeline requires at least one step');
    }

    const tempFiles: string[] = [];
    let previousResult: VideoRenderResult | undefined;

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isLast = i === steps.length - 1;
        const stepOutputPath = isLast
          ? outputPath
          : path.join(os.tmpdir(), `liminal-pipeline-${Date.now()}-${i}.mp4`);

        if (!isLast) {
          tempFiles.push(stepOutputPath);
        }

        const mergedOpts: VideoRenderOptions = { ...baseOpts, ...step.options };

        if (step.type === 'revideo') {
          const renderer = new RevideoRenderer();
          previousResult = await renderer.render(step.code, stepOutputPath, mergedOpts);
        } else if (step.type === 'hyperframes') {
          const hyperOpts: HyperFramesRenderOptions = { ...mergedOpts };

          if (previousResult && i > 0 && steps[i - 1].type === 'revideo') {
            hyperOpts.assets = [
              {
                path: previousResult.outputPath,
                type: 'video',
                startAt: 0,
                duration: previousResult.duration,
              },
            ];
          }

          const renderer = new HyperFramesRenderer();
          previousResult = await renderer.render(step.code, stepOutputPath, hyperOpts);
        } else {
          throw new Error(`Unknown pipeline step type: ${step.type}`);
        }
      }

      if (!previousResult) {
        throw new Error('VideoPipeline produced no result');
      }

      return previousResult;
    } finally {
      for (const tempFile of tempFiles) {
        try {
          await fs.promises.unlink(tempFile);
        } catch {
          // best-effort cleanup — temp files may already be gone
        }
      }
    }
  }
}
