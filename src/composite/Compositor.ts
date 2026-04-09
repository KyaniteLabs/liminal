/**
 * Compositor - Build FFmpeg filter graphs and Remotion compositions
 */

export interface VideoLayer {
  type: 'video';
  source: string;
  blend: BlendMode;
  opacity: number;
  x?: number;
  y?: number;
}

export interface ImageLayer {
  type: 'image';
  source: string;
  blend: BlendMode;
  opacity: number;
  x?: number;
  y?: number;
}

export interface AudioLayer {
  type: 'audio';
  source: string;
  volume?: number;
}

export type CompositionLayer = VideoLayer | ImageLayer | AudioLayer;

export type BlendMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'soft-light'
  | 'difference';

export interface CompositionSpec {
  width: number;
  height: number;
  fps: number;
  duration: number;
  layers: CompositionLayer[];
}

export class Compositor {
  buildFilterGraph(spec: CompositionSpec): string {
    this.validateSpec(spec);

    const visualLayers = spec.layers.filter(
      l => l.type === 'video' || l.type === 'image'
    );

    if (visualLayers.length < 2) {
      return '[0:v]copy';
    }

    // Build overlay chain
    let filterGraph = '[0:v]';

    for (let i = 1; i < visualLayers.length; i++) {
      const layer = visualLayers[i];
      const opacity = layer.opacity ?? 1.0;
      const x = layer.x ?? 0;
      const y = layer.y ?? 0;

      filterGraph += `[${i}:v]overlay=${x}:${y}:format=auto`;

      if (i < visualLayers.length - 1) {
        filterGraph += '[tmp];[tmp]';
      }
    }

    return filterGraph;
  }

  buildCompositeArgs(spec: CompositionSpec, outputPath: string): string[] {
    this.validateSpec(spec);

    const args: string[] = [];

    // Add inputs for each layer
    for (const layer of spec.layers) {
      args.push('-i', layer.source);
    }

    // Add filter complex if multiple visual layers
    const visualLayers = spec.layers.filter(
      l => l.type === 'video' || l.type === 'image'
    );

    if (visualLayers.length > 1) {
      args.push('-filter_complex', this.buildFilterGraph(spec));
    }

    // Add audio mix if there are audio layers
    const audioLayers = spec.layers.filter(l => l.type === 'audio');
    if (audioLayers.length > 0) {
      const amixInputs = audioLayers.map((_, i) => `[${spec.layers.length - audioLayers.length + i}:a]`).join('');
      args.push('-filter_complex', `${amixInputs}amix=inputs=${audioLayers.length}:duration=longest`);
    }

    // Output settings
    args.push('-pix_fmt', 'yuv420p');
    args.push('-y', outputPath);

    return args;
  }

  validateSpec(spec: CompositionSpec): void {
    if (spec.layers.length === 0) {
      throw new Error('Composition spec requires at least one layer');
    }

    if (spec.width <= 0 || spec.height <= 0 || spec.fps <= 0 || spec.duration <= 0) {
      throw new Error('Width, height, fps, and duration must be positive');
    }
  }

  generateRemotionComposition(spec: CompositionSpec): string {
    this.validateSpec(spec);

    const visualLayers = spec.layers.filter(
      l => l.type === 'video' || l.type === 'image'
    );

    const layerComponents = visualLayers.map((layer, i) => {
      const blendMode = this.blendToCSS(layer.blend);
      const x = layer.x ?? 0;
      const y = layer.y ?? 0;

      if (layer.type === 'image') {
        return `
          <Img
            src="${layer.source}"
            style={{
              mixBlendMode: '${blendMode}',
              opacity: ${layer.opacity},
              transform: 'translate(${x}px, ${y}px)',
            }}
          />`;
      } else {
        return `
          <Video
            src="${layer.source}"
            style={{
              mixBlendMode: '${blendMode}',
              opacity: ${layer.opacity},
              transform: 'translate(${x}px, ${y}px)',
            }}
          />`;
      }
    }).join('');

    return `import { useCurrentFrame, AbsoluteFill, Img, Video } from 'remotion';

export const Composition = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ width: ${spec.width}, height: ${spec.height} }}>
      ${layerComponents}
    </AbsoluteFill>
  );
};`;
  }

  blendToCSS(blend: BlendMode): string {
    const cssBlendMap: Record<BlendMode, string> = {
      normal: 'normal',
      screen: 'screen',
      multiply: 'multiply',
      overlay: 'overlay',
      'soft-light': 'soft-light',
      difference: 'difference',
    };

    return cssBlendMap[blend] || 'normal';
  }
}
