import { describe, it, expect } from 'vitest';
import { CanvasRecorder, RecordingConfig } from '../../../src/render/CanvasRecorder.js';

describe('CanvasRecorder', () => {
  it('builds correct recording config from options', () => {
    const recorder = new CanvasRecorder({ fps: 30, duration: 5, width: 800, height: 600 });
    const config = recorder.getConfig();
    expect(config.fps).toBe(30);
    expect(config.totalFrames).toBe(150);
    expect(config.width).toBe(800);
    expect(config.height).toBe(600);
  });

  it('throws if duration or fps is invalid', () => {
    expect(() => new CanvasRecorder({ fps: 0, duration: 5, width: 800, height: 600 })).toThrow();
    expect(() => new CanvasRecorder({ fps: 30, duration: -1, width: 800, height: 600 })).toThrow();
    expect(() => new CanvasRecorder({ fps: -5, duration: 5, width: 800, height: 600 })).toThrow();
  });

  it('throws if width or height is invalid', () => {
    expect(() => new CanvasRecorder({ fps: 30, duration: 5, width: 0, height: 600 })).toThrow();
    expect(() => new CanvasRecorder({ fps: 30, duration: 5, width: 800, height: -1 })).toThrow();
  });

  it('calculates total frames correctly', () => {
    const r1 = new CanvasRecorder({ fps: 24, duration: 10, width: 1920, height: 1080 });
    expect(r1.getConfig().totalFrames).toBe(240);

    const r2 = new CanvasRecorder({ fps: 60, duration: 3, width: 800, height: 600 });
    expect(r2.getConfig().totalFrames).toBe(180);
  });

  it('generates frame capture script for p5.js canvas', () => {
    const recorder = new CanvasRecorder({ fps: 30, duration: 5, width: 800, height: 600 });
    const script = recorder.buildFrameCaptureScript('p5');
    expect(script).toContain('toDataURL');
    expect(script).toContain('canvas');
  });

  it('generates frame capture script for shader canvas', () => {
    const recorder = new CanvasRecorder({ fps: 30, duration: 5, width: 800, height: 600 });
    const script = recorder.buildFrameCaptureScript('shader');
    expect(script).toContain('toDataURL');
    expect(script).toContain('canvas');
  });

  it('returns a frozen copy of config', () => {
    const recorder = new CanvasRecorder({ fps: 30, duration: 5, width: 800, height: 600 });
    const config = recorder.getConfig();
    config.fps = 999;
    const config2 = recorder.getConfig();
    expect(config2.fps).toBe(30);
  });
});
