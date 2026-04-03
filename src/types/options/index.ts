/**
 * Options types index
 *
 * Central export for all options-related type definitions.
 */

export type {
  RenderOptions,
  RecordingOptions,
  PreviewOptions,
  CanvasDimensions,
  RecordingFormat,
} from './RenderOptions.js';

export {
  DEFAULT_RENDER_OPTIONS,
  normalizeRenderOptions,
} from './RenderOptions.js';

export type {
  DebugOptions,
  LogLevel,
} from './DebugOptions.js';

export {
  DEFAULT_DEBUG_OPTIONS,
  normalizeDebugOptions,
  shouldLog,
} from './DebugOptions.js';
