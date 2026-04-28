/**
 * VideoRenderer - shared interface for all video rendering backends.
 *
 * Both RevideoRenderer and HyperFramesRenderer implement this interface.
 * The Exporter dispatches to the correct implementation based on domain.
 */

export interface VideoRenderOptions {
  fps?: number;
  duration?: number;
  width?: number;
  height?: number;
}

export interface VideoRenderResult {
  outputPath: string;
  duration: number;
  width: number;
  height: number;
  format: 'mp4' | 'webm' | 'mov';
}

export interface VideoRenderer {
  render(code: string, outputPath: string, opts: VideoRenderOptions): Promise<VideoRenderResult>;
}
