import { describe, it, expect } from 'vitest';
import { VideoExporter } from '../../../src/export/VideoExporter.js';

describe('VideoExporter', () => {
  describe('constructor', () => {
    it('uses default ffmpeg path when not specified', () => {
      const exporter = new VideoExporter();
      const args = exporter.buildConvertArgs('in.mov', 'out.mp4', 'mp4');
      expect(args[0]).toBe('-i');
    });

    it('accepts custom ffmpeg path', () => {
      const exporter = new VideoExporter({ ffmpegPath: '/custom/ffmpeg' });
      expect(exporter).toBeDefined();
    });
  });

  describe('buildConvertArgs', () => {
    it('builds mp4 args with libx264', () => {
      const args = new VideoExporter().buildConvertArgs('input.mov', 'output.mp4', 'mp4');
      expect(args).toContain('-i');
      expect(args).toContain('input.mov');
      expect(args).toContain('-y');
      expect(args).toContain('libx264');
      expect(args).toContain('output.mp4');
    });

    it('builds gif args with palette pipeline', () => {
      const args = new VideoExporter().buildConvertArgs('input.mov', 'output.gif', 'gif');
      // fps=15 is embedded in a longer -vf value
      expect(args.some(a => a.includes('fps=15'))).toBe(true);
      expect(args.some(a => a.includes('paletteuse'))).toBe(true);
      expect(args).toContain('output.gif');
    });

    it('builds webm args with libvpx-vp9', () => {
      const args = new VideoExporter().buildConvertArgs('input.mov', 'output.webm', 'webm');
      expect(args).toContain('libvpx-vp9');
      expect(args).toContain('-crf');
      expect(args).toContain('30');
      expect(args).toContain('output.webm');
    });

    it('defaults to mp4 for unknown format', () => {
      const args = new VideoExporter().buildConvertArgs('in', 'out', 'avi');
      expect(args).toContain('libx264');
    });
  });

  describe('buildResizeArgs', () => {
    it('builds resize args with correct dimensions', () => {
      const args = new VideoExporter().buildResizeArgs('in.mp4', 'out.mp4', 1920, 1080);
      expect(args).toContain('-i');
      expect(args).toContain('in.mp4');
      expect(args).toContain('-y');
      expect(args.some(a => a.includes('1920:1080'))).toBe(true);
      expect(args).toContain('-c:a');
      expect(args).toContain('copy');
      expect(args).toContain('out.mp4');
    });
  });

  describe('buildAddAudioArgs', () => {
    it('builds add-audio args with shortest flag', () => {
      const args = new VideoExporter().buildAddAudioArgs('vid.mp4', 'aud.mp3', 'out.mp4');
      expect(args).toContain('-i');
      expect(args).toContain('vid.mp4');
      expect(args).toContain('aud.mp3');
      expect(args).toContain('-shortest');
      expect(args).toContain('-map');
      expect(args).toContain('0:v:0');
      expect(args).toContain('1:a:0');
      expect(args).toContain('out.mp4');
    });
  });

  describe('buildExtractFramesArgs', () => {
    it('builds extract-frames args with fps', () => {
      const args = new VideoExporter().buildExtractFramesArgs('video.mp4', '/tmp/frames', 30);
      expect(args).toContain('-i');
      expect(args).toContain('video.mp4');
      expect(args.some(a => a.includes('fps=30'))).toBe(true);
      expect(args.some(a => a.includes('frame_%05d.png'))).toBe(true);
    });
  });

  describe('buildFramesToVideoArgs', () => {
    it('builds frames-to-video args with framerate', () => {
      const args = new VideoExporter().buildFramesToVideoArgs('/tmp/frames', 'output.mp4', 24);
      expect(args).toContain('-framerate');
      expect(args).toContain('24');
      expect(args).toContain('libx264');
      expect(args).toContain('yuv420p');
      expect(args).toContain('output.mp4');
    });
  });
});
