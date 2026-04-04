import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRecorder } from '../../src/render/CanvasRecorder.js';
import { Logger } from '../../src/utils/Logger.js';
import fs from 'fs/promises';

// Mock puppeteer to avoid launching a real browser
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        setViewport: vi.fn().mockResolvedValue(undefined),
        setContent: vi.fn().mockResolvedValue(undefined),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(undefined),
        $: vi.fn().mockResolvedValue({
          screenshot: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock VideoExporter to avoid needing ffmpeg
vi.mock('../../src/export/VideoExporter.js', () => {
  return {
    VideoExporter: class MockVideoExporter {
      framesToVideo = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe('CanvasRecorder error handling', () => {
  let recorder: CanvasRecorder;

  beforeEach(() => {
    recorder = new CanvasRecorder({
      fps: 30,
      duration: 0.1,
      width: 100,
      height: 100,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs cleanup error when fs.rm fails — recording still succeeds', async () => {
    const loggerSpy = vi.spyOn(Logger, 'error').mockImplementation(() => {});
    vi.spyOn(fs, 'mkdtemp').mockResolvedValue('/tmp/liminal-frames-test');
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'rm').mockRejectedValue(new Error('Permission denied during cleanup'));

    // Recording should succeed — cleanup errors are caught and logged
    const result = await recorder.record('function setup() { createCanvas(100,100); }', 'p5', '/tmp/output.mp4');
    expect(result).toBe('/tmp/output.mp4');

    // But the error should be logged
    expect(loggerSpy).toHaveBeenCalledWith(
      'CanvasRecorder',
      'Cleanup failed:',
      expect.stringContaining('Permission denied during cleanup')
    );
  });

  it('logs cleanup error with non-Error thrown value', async () => {
    const loggerSpy = vi.spyOn(Logger, 'error').mockImplementation(() => {});
    vi.spyOn(fs, 'mkdtemp').mockResolvedValue('/tmp/liminal-frames-test');
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'rm').mockRejectedValue('string error');

    const result = await recorder.record('function setup() { createCanvas(100,100); }', 'p5', '/tmp/out.mp4');
    expect(result).toBe('/tmp/out.mp4');

    expect(loggerSpy).toHaveBeenCalledWith(
      'CanvasRecorder',
      'Cleanup failed:',
      expect.stringContaining('string error')
    );
  });

  it('logs cleanup error when directory not empty', async () => {
    const loggerSpy = vi.spyOn(Logger, 'error').mockImplementation(() => {});
    vi.spyOn(fs, 'mkdtemp').mockResolvedValue('/tmp/liminal-frames-test');
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'rm').mockRejectedValue(new Error('Directory not empty'));

    const result = await recorder.record('function setup() { createCanvas(100,100); }', 'p5', '/tmp/out.mp4');
    expect(result).toBe('/tmp/out.mp4');

    expect(loggerSpy).toHaveBeenCalledWith(
      'CanvasRecorder',
      'Cleanup failed:',
      expect.stringContaining('Directory not empty')
    );
  });
});
