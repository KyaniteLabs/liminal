import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRecorder } from '../../src/render/CanvasRecorder.js';
import fs from 'fs/promises';

describe('CanvasRecorder error handling', () => {
  let recorder: CanvasRecorder;

  beforeEach(() => {
    recorder = new CanvasRecorder({
      fps: 30,
      duration: 0.1,  // short duration for faster tests
      width: 100,
      height: 100
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw error when cleanup fails instead of swallowing', async () => {
    // Given: Mock fs.rm to throw an error during cleanup
    const cleanupError = new Error('Permission denied during cleanup');
    const rmSpy = vi.spyOn(fs, 'rm').mockImplementation(() => {
      return Promise.reject(cleanupError);
    });

    // Mock mkdtemp to return a valid path (so we get to cleanup)
    vi.spyOn(fs, 'mkdtemp').mockResolvedValue('/tmp/liminal-frames-test');

    // When: recording fails and cleanup also fails
    // The cleanup error should NOT be swallowed
    await expect(recorder.record('some code', 'p5', '/tmp/output.mp4'))
      .rejects
      .toThrow('Permission denied during cleanup');

    // Verify rm was called (cleanup was attempted)
    expect(rmSpy).toHaveBeenCalled();
  });

  it('should propagate cleanup errors with context', async () => {
    // Given: A specific cleanup error
    vi.spyOn(fs, 'rm').mockRejectedValue(new Error('Directory not empty'));
    vi.spyOn(fs, 'mkdtemp').mockResolvedValue('/tmp/liminal-frames-test');

    // When/Then: Error should be thrown, not silently caught
    await expect(recorder.record('code', 'p5', '/tmp/out.mp4'))
      .rejects
      .toThrow();
  });
});
