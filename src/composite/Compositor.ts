/**
 * Compatibility stub for the removed video compositor path.
 *
 * This preserves a stable import surface for old CLI code and historical
 * callers while making the removal explicit at runtime.
 */

export type BlendMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'soft-light'
  | 'difference';

export type CompositionLayer =
  | {
      type: 'video' | 'image';
      source: string;
      blend?: BlendMode;
      opacity?: number;
      x?: number;
      y?: number;
    }
  | {
      type: 'audio';
      source: string;
      volume?: number;
    };

export interface CompositionSpec {
  width: number;
  height: number;
  fps: number;
  duration: number;
  layers: CompositionLayer[];
}

function removedError(action: string): Error {
  return new Error(
    `Video compositor support has been removed from the active product surface. ` +
      `${action} is no longer available in mainline.`
  );
}

export class Compositor {
  validateSpec(spec: CompositionSpec): void {
    if (!spec.layers.length) {
      throw new Error('Composition spec must include at least one layer');
    }
    if (spec.width <= 0 || spec.height <= 0 || spec.fps <= 0 || spec.duration <= 0) {
      throw new Error('Composition spec dimensions, fps, and duration must be positive');
    }
  }

  blendToCSS(blend: BlendMode): string {
    return blend;
  }

  buildFilterGraph(_spec: CompositionSpec): never {
    throw removedError('FFmpeg filter graph generation');
  }

  buildCompositeArgs(_spec: CompositionSpec, _outputPath: string): never {
    throw removedError('Video compositing');
  }

  generateVideoComposition(_spec: CompositionSpec): never {
    throw removedError('Video composition generation');
  }

  async composite(_spec: CompositionSpec, _outputPath: string): Promise<never> {
    throw removedError('Video compositing');
  }
}
