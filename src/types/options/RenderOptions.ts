/**
 * RenderOptions - Configuration for rendering, recording, and preview settings
 *
 * Extracted from LoopOptions to provide a dedicated configuration surface
 * for canvas dimensions, recording capabilities, and preview server settings.
 */

/**
 * Recording format options for canvas capture
 */
export type RecordingFormat = 'webm' | 'mp4' | 'gif';

/**
 * Configuration for recording canvas output
 */
export interface RecordingOptions {
  /** Whether recording is enabled */
  enabled?: boolean;
  /** Recording duration in seconds */
  duration?: number;
  /** Frames per second for recording */
  fps?: number;
  /** Output format for recording */
  format?: RecordingFormat;
}

/**
 * Configuration for preview server
 */
export interface PreviewOptions {
  /** Whether preview server is enabled */
  enabled?: boolean;
  /** Port for preview server */
  port?: number;
  /** Auto-open browser on start */
  autoOpen?: boolean;
}

/**
 * Canvas dimensions configuration
 */
export interface CanvasDimensions {
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
}

/**
 * Render options for canvas output, recording, and preview
 */
export interface RenderOptions {
  /** Canvas dimensions (width/height) */
  canvas?: CanvasDimensions;
  /** Recording configuration */
  recording?: RecordingOptions;
  /** Preview server configuration */
  preview?: PreviewOptions;
}

/**
 * Default render options
 */
export const DEFAULT_RENDER_OPTIONS: Required<
  Record<keyof RenderOptions, NonNullable<unknown>>
> & {
  canvas: Required<CanvasDimensions>;
  recording: Required<RecordingOptions>;
  preview: Required<PreviewOptions>;
} = {
  canvas: {
    width: 800,
    height: 600,
  },
  recording: {
    enabled: false,
    duration: 5,
    fps: 30,
    format: 'webm' as RecordingFormat,
  },
  preview: {
    enabled: false,
    port: 3000,
    autoOpen: true,
  },
};

/**
 * Normalize render options with defaults
 */
export function normalizeRenderOptions(
  options?: RenderOptions
): Required<
  Record<keyof RenderOptions, NonNullable<unknown>>
> & {
  canvas: Required<CanvasDimensions>;
  recording: Required<RecordingOptions>;
  preview: Required<PreviewOptions>;
} {
  return {
    canvas: {
      width: options?.canvas?.width ?? DEFAULT_RENDER_OPTIONS.canvas.width,
      height: options?.canvas?.height ?? DEFAULT_RENDER_OPTIONS.canvas.height,
    },
    recording: {
      enabled: options?.recording?.enabled ?? DEFAULT_RENDER_OPTIONS.recording.enabled,
      duration: options?.recording?.duration ?? DEFAULT_RENDER_OPTIONS.recording.duration,
      fps: options?.recording?.fps ?? DEFAULT_RENDER_OPTIONS.recording.fps,
      format: options?.recording?.format ?? DEFAULT_RENDER_OPTIONS.recording.format,
    },
    preview: {
      enabled: options?.preview?.enabled ?? DEFAULT_RENDER_OPTIONS.preview.enabled,
      port: options?.preview?.port ?? DEFAULT_RENDER_OPTIONS.preview.port,
      autoOpen: options?.preview?.autoOpen ?? DEFAULT_RENDER_OPTIONS.preview.autoOpen,
    },
  };
}
