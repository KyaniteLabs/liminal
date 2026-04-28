import { describe, it, expect } from 'vitest';
import {
  RenderOptions,
  RecordingOptions,
  PreviewOptions,
  CanvasDimensions,
  RecordingFormat,
  DEFAULT_RENDER_OPTIONS,
  normalizeRenderOptions,
} from '../../src/types/options/index.js';

describe('RenderOptions', () => {
  describe('Type compatibility', () => {
    it('should accept valid RenderOptions', () => {
      const options: RenderOptions = {
        canvas: { width: 1920, height: 1080 },
        recording: { enabled: true, duration: 10, fps: 60, format: 'mp4' },
        preview: { enabled: true, port: 8080, autoOpen: false },
      };

      expect(options.canvas?.width).toBe(1920);
      expect(options.canvas?.height).toBe(1080);
      expect(options.recording?.enabled).toBe(true);
      expect(options.recording?.format).toBe('mp4');
      expect(options.preview?.port).toBe(8080);
    });

    it('should accept partial RenderOptions', () => {
      const canvasOnly: RenderOptions = {
        canvas: { width: 100, height: 100 },
      };
      expect(canvasOnly.canvas?.width).toBe(100);
      expect(canvasOnly.recording).toBeUndefined();

      const recordingOnly: RenderOptions = {
        recording: { enabled: true },
      };
      expect(recordingOnly.recording?.enabled).toBe(true);
      expect(recordingOnly.canvas).toBeUndefined();
    });

    it('should accept empty RenderOptions', () => {
      const empty: RenderOptions = {};
      expect(empty).not.toBeNull();
    });
  });

  describe('RecordingFormat', () => {
    it('should accept valid recording formats', () => {
      const formats: RecordingFormat[] = ['webm', 'mp4', 'gif'];
      formats.forEach((format) => {
        const options: RecordingOptions = { format };
        expect(options.format).toBe(format);
      });
    });
  });

  describe('CanvasDimensions', () => {
    it('should accept valid dimensions', () => {
      const dims: CanvasDimensions = { width: 800, height: 600 };
      expect(dims.width).toBe(800);
      expect(dims.height).toBe(600);
    });

    it('should accept partial dimensions', () => {
      const widthOnly: CanvasDimensions = { width: 1024 };
      expect(widthOnly.width).toBe(1024);
      expect(widthOnly.height).toBeUndefined();
    });
  });

  describe('PreviewOptions', () => {
    it('should accept valid preview options', () => {
      const preview: PreviewOptions = {
        enabled: true,
        port: 3000,
        autoOpen: true,
      };
      expect(preview.enabled).toBe(true);
      expect(preview.port).toBe(3000);
      expect(preview.autoOpen).toBe(true);
    });
  });

  describe('DEFAULT_RENDER_OPTIONS', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_RENDER_OPTIONS.canvas.width).toBe(800);
      expect(DEFAULT_RENDER_OPTIONS.canvas.height).toBe(600);
      expect(DEFAULT_RENDER_OPTIONS.recording.enabled).toBe(false);
      expect(DEFAULT_RENDER_OPTIONS.recording.duration).toBe(5);
      expect(DEFAULT_RENDER_OPTIONS.recording.fps).toBe(30);
      expect(DEFAULT_RENDER_OPTIONS.recording.format).toBe('webm');
      expect(DEFAULT_RENDER_OPTIONS.preview.enabled).toBe(false);
      expect(DEFAULT_RENDER_OPTIONS.preview.port).toBe(3000);
      expect(DEFAULT_RENDER_OPTIONS.preview.autoOpen).toBe(true);
    });
  });

  describe('normalizeRenderOptions', () => {
    it('should return defaults when given undefined', () => {
      const normalized = normalizeRenderOptions(undefined);
      expect(normalized).toEqual(DEFAULT_RENDER_OPTIONS);
    });

    it('should return defaults when given empty object', () => {
      const normalized = normalizeRenderOptions({});
      expect(normalized).toEqual(DEFAULT_RENDER_OPTIONS);
    });

    it('should merge partial options with defaults', () => {
      const normalized = normalizeRenderOptions({
        canvas: { width: 1920 },
        recording: { enabled: true },
      });

      // Custom values
      expect(normalized.canvas.width).toBe(1920);
      expect(normalized.recording.enabled).toBe(true);

      // Default values for unspecified
      expect(normalized.canvas.height).toBe(600);
      expect(normalized.recording.duration).toBe(5);
      expect(normalized.preview.enabled).toBe(false);
    });

    it('should fully override nested objects', () => {
      const normalized = normalizeRenderOptions({
        canvas: { width: 100 },
      });

      // width is specified
      expect(normalized.canvas.width).toBe(100);
      // height should fall back to default (not undefined)
      expect(normalized.canvas.height).toBe(600);
    });

    it('should accept all recording formats', () => {
      const formats: RecordingFormat[] = ['webm', 'mp4', 'gif'];
      formats.forEach((format) => {
        const normalized = normalizeRenderOptions({
          recording: { format },
        });
        expect(normalized.recording.format).toBe(format);
      });
    });
  });
});
