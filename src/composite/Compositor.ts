import { execFile } from 'child_process';
import { promisify } from 'util';
import { 
  validateFilePath, 
  PathSanitizationError 
} from '../security/PathSanitizer.js';

const execFileAsync = promisify(execFile);

export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'soft-light' | 'difference';

export interface CompositionLayer {
  type: 'video' | 'audio' | 'image' | 'code';
  source?: string;          // file path for video/audio/image
  domain?: string;          // for type='code': p5, shader, three, remotion
  code?: string;            // for type='code': the generated code
  blend?: BlendMode;
  opacity?: number;         // 0-1
  volume?: number;          // for audio layers
  offset?: number;          // start time offset in seconds
  x?: number;               // position offset
  y?: number;
  width?: number;           // layer dimensions
  height?: number;
}

export interface CompositionSpec {
  width: number;
  height: number;
  fps: number;
  duration: number;
  layers: CompositionLayer[];
  background?: string;
}

export class Compositor {
  validateSpec(spec: CompositionSpec): void {
    if (!spec.layers || spec.layers.length === 0) {
      throw new Error('Composition spec requires at least one layer');
    }
    if (spec.width <= 0 || spec.height <= 0) {
      throw new Error('Composition spec requires positive width and height');
    }
    if (spec.fps <= 0 || spec.duration <= 0) {
      throw new Error('Composition spec requires positive fps and duration');
    }
  }

  blendToCSS(mode?: BlendMode): string {
    return mode ?? 'normal';
  }

  /**
   * Build FFmpeg filter_complex string for multi-layer compositing.
   */
  buildFilterGraph(spec: CompositionSpec): string {
    this.validateSpec(spec);

    const videoLayers = spec.layers.filter(l => l.type === 'video' || l.type === 'image');
    const filters: string[] = [];

    if (videoLayers.length === 0) return '';

    // First layer: scale to output size
    filters.push(`[0:v]scale=${spec.width}:${spec.height}:force_original_aspect_ratio=decrease,pad=${spec.width}:${spec.height}:(ow-iw)/2:(oh-ih)/2[base]`);

    // Overlay subsequent video layers
    for (let i = 1; i < videoLayers.length; i++) {
      const layer = videoLayers[i];
      const inputIdx = spec.layers.indexOf(layer);
      const opacity = layer.opacity ?? 1.0;
      const x = layer.x ?? 0;
      const y = layer.y ?? 0;
      const prevLabel = i === 1 ? 'base' : `v${i - 1}`;
      const currLabel = `v${i}`;

      // Scale layer, apply opacity, overlay
      filters.push(`[${inputIdx}:v]scale=${spec.width}:${spec.height}:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=${opacity}[${currLabel}_scaled]`);
      filters.push(`[${prevLabel}][${currLabel}_scaled]overlay=${x}:${y}[${currLabel}]`);
    }

    return filters.join(';');
  }

  /**
   * Build full FFmpeg command arguments for compositing.
   */
  buildCompositeArgs(spec: CompositionSpec, outputPath: string): string[] {
    this.validateSpec(spec);

    const args: string[] = ['-y'];

    // Add inputs for all layers
    for (const layer of spec.layers) {
      if (layer.source) {
        args.push('-i', layer.source);
      }
    }

    const videoLayers = spec.layers.filter(l => l.type === 'video' || l.type === 'image');
    const audioLayers = spec.layers.filter(l => l.type === 'audio');

    if (videoLayers.length > 1) {
      const filterGraph = this.buildFilterGraph(spec);
      args.push('-filter_complex', filterGraph);
      const lastVideoLabel = `v${videoLayers.length - 1}`;
      args.push('-map', `[${lastVideoLabel}]`);
    } else if (videoLayers.length === 1) {
      args.push('-map', '0:v');
    }

    // Handle audio
    if (audioLayers.length > 0) {
      const audioLayer = audioLayers[0];
      const audioIdx = spec.layers.indexOf(audioLayer);
      args.push('-map', `${audioIdx}:a`);
      if (audioLayer.volume !== undefined && audioLayer.volume !== 1.0) {
        args.push('-af', `volume=${audioLayer.volume}`);
      }
    }

    args.push('-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p');
    args.push('-t', String(spec.duration));
    args.push(outputPath);

    return args;
  }

  /**
   * Generate a Remotion composition that layers multiple visual elements.
   * This produces a React/Remotion component that uses <Img>, <Video>, and
   * CSS mix-blend-mode to combine layers.
   */
  generateRemotionComposition(spec: CompositionSpec): string {
    this.validateSpec(spec);

    const layers = spec.layers
      .filter(l => l.type !== 'audio')
      .map((layer) => {
        const blend = this.blendToCSS(layer.blend);
        const opacity = layer.opacity ?? 1.0;
        const x = layer.x ?? 0;
        const y = layer.y ?? 0;

        if (layer.type === 'image') {
          return `      <Img
        src="${layer.source}"
        style={{
          position: 'absolute',
          top: ${y},
          left: ${x},
          width: ${layer.width ?? spec.width},
          height: ${layer.height ?? spec.height},
          objectFit: 'cover',
          mixBlendMode: '${blend}',
          opacity: ${opacity},
        }}
      />`;
        }
        if (layer.type === 'video') {
          return `      <Video
        src="${layer.source}"
        style={{
          position: 'absolute',
          top: ${y},
          left: ${x},
          width: ${layer.width ?? spec.width},
          height: ${layer.height ?? spec.height},
          objectFit: 'cover',
          mixBlendMode: '${blend}',
          opacity: ${opacity},
        }}
      />`;
        }
        // code type - render as a colored placeholder rectangle
        return `      <div
        style={{
          position: 'absolute',
          top: ${y},
          left: ${x},
          width: ${layer.width ?? spec.width},
          height: ${layer.height ?? spec.height},
          mixBlendMode: '${blend}',
          opacity: ${opacity},
        }}
      />`;
      });

    return `import React from 'react';
import {useCurrentFrame, AbsoluteFill, Img, Video} from 'remotion';

export const CompositeComposition: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{backgroundColor: '${spec.background ?? '#000'}', width: ${spec.width}, height: ${spec.height}}}>
${layers.join('\n')}
    </AbsoluteFill>
  );
};`;
  }

  /**
   * Execute the composite operation via FFmpeg.
   */
  async composite(spec: CompositionSpec, outputPath: string): Promise<string> {
    this.validateSpec(spec);
    
    // Sanitize output path
    const sanitizedOutput = validateFilePath(outputPath, process.cwd());
    
    // Sanitize all layer source paths
    for (const layer of spec.layers) {
      if (layer.source) {
        validateFilePath(layer.source, process.cwd());
      }
    }
    
    const args = this.buildCompositeArgs(spec, sanitizedOutput);

    try {
      await execFileAsync('ffmpeg', args, { timeout: 300000 });
      return sanitizedOutput;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'ENOENT') {
        throw new Error('FFmpeg not found. Install FFmpeg and ensure it is on PATH.');
      }
      throw new Error(`Compositing failed: ${err.message}`, { cause: error });
    }
  }
}

export { PathSanitizationError };
