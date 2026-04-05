/**
 * Render module - Headless rendering and visual/audio quality scoring
 *
 * Exports:
 * - HeadlessRenderer: Render code in headless browser
 * - VisualScorer: Score visual output quality
 * - AudioScorer: Score audio output quality
 * - RenderAndScorePipeline: Combined pipeline for render-based scoring
 */

export { HeadlessRenderer, type RenderDomain, type RenderOptions, type RenderResult, type ScreenshotResult, type AudioCaptureResult } from './HeadlessRenderer.js';
export { VisualScorer, type VisualScoreResult, type VisualScorerOptions } from './VisualScorer.js';
export { AudioScorer, type AudioScoreResult, type AudioScorerOptions } from './AudioScorer.js';
export { 
  RenderAndScorePipeline, 
  type PipelineOptions, 
  type PipelineResult, 
  type ScoreBlendOptions 
} from './RenderAndScorePipeline.js';
export { Renderer } from './Renderer.js';
export { CanvasRecorder } from './CanvasRecorder.js';
export { PreviewServer } from './PreviewServer.js';

export { RemotionRenderer } from './RemotionRenderer.js';
