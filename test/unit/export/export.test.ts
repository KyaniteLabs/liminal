import { describe, it, expect } from 'vitest';
import { VideoExporter } from '../../../src/export/VideoExporter.js';

// ===========================================================================
// VideoExporter
// ===========================================================================

describe('VideoExporter', () => {
  describe('buildConvertArgs', () => {
    it('builds mp4 conversion args with h264', () => {
      const exporter = new VideoExporter();
      const args = exporter.buildConvertArgs('input.mov', 'output.mp4', 'mp4');
      expect(args).toEqual(['-i', 'input.mov', '-y', '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', 'output.mp4']);
    });

    it('builds webm conversion args with vp9', () => {
      const exporter = new VideoExporter();
      const args = exporter.buildConvertArgs('input.mov', 'output.webm', 'webm');
      expect(args).toEqual(['-i', 'input.mov', '-y', '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', 'output.webm']);
    });

    it('builds gif conversion args with palette', () => {
      const exporter = new VideoExporter();
      const args = exporter.buildConvertArgs('input.mov', 'output.gif', 'gif');
      expect(args[0]).toBe('-i');
      expect(args[1]).toBe('input.mov');
      expect(args).toContain('-y');
      expect(args.some(a => a.includes('fps=15'))).toBe(true);
      expect(args[args.length - 1]).toBe('output.gif');
    });

    it('uses default ffmpeg path', () => {
      const exporter = new VideoExporter();
      expect(exporter).toBeInstanceOf(VideoExporter);
    });

    it('accepts custom ffmpeg path', () => {
      const exporter = new VideoExporter({ ffmpegPath: '/usr/local/bin/ffmpeg' });
      expect(exporter).toBeInstanceOf(VideoExporter);
    });
  });

  describe('buildResizeArgs', () => {
    it('builds resize args with correct dimensions', () => {
      const exporter = new VideoExporter();
      const args = exporter.buildResizeArgs('input.mov', 'output.mov', 1920, 1080);
      expect(args[0]).toBe('-i');
      expect(args[1]).toBe('input.mov');
      expect(args.some(a => a.includes('scale=1920:1080'))).toBe(true);
      expect(args.some(a => a.includes('force_original_aspect_ratio=decrease'))).toBe(true);
      expect(args[args.length - 1]).toBe('output.mov');
    });

    it('builds frame extraction args with fps filter', () => {
      const exporter = new VideoExporter();
      const args = exporter.buildExtractFramesArgs('video.mp4', '/tmp/frames', 30);
      expect(args[0]).toBe('-i');
      expect(args[1]).toBe('video.mp4');
      expect(args).toContain('fps=30');
      expect(args.some(a => a.includes('frame_%05d.png'))).toBe(true);
    });

    it('builds frames-to-video args with framerate', () => {
      const exporter = new VideoExporter();
      const args = exporter.buildFramesToVideoArgs('/tmp/frames', 'output.mp4', 30);
      expect(args[0]).toBe('-framerate');
      expect(args[1]).toBe('30');
      expect(args).toContain('libx264');
      expect(args).toContain('yuv420p');
      expect(args[args.length - 1]).toBe('output.mp4');
    });
  });
});
