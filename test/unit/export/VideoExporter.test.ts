import { describe, it, expect } from 'vitest';
import { VideoExporter } from '../../../src/export/VideoExporter.js';

describe('VideoExporter', () => {
  it('builds correct FFmpeg args for MP4 to GIF conversion', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildConvertArgs('/input.mp4', '/output.gif', 'gif');
    expect(args).toContain('-i');
    expect(args).toContain('/input.mp4');
    expect(args).toContain('/output.gif');
  });

  it('builds correct FFmpeg args for resize', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildResizeArgs('/input.mp4', '/output.mp4', 1080, 1920);
    expect(args).toEqual(expect.arrayContaining([expect.stringContaining('scale')]));
  });

  it('builds FFmpeg args for adding audio track', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildAddAudioArgs('/input.mp4', '/audio.mp3', '/output.mp4');
    expect(args).toContain('-i');
    expect(args.filter(a => a === '-i').length).toBeGreaterThanOrEqual(2);
  });

  it('throws descriptive error when FFmpeg not found', async () => {
    const exporter = new VideoExporter({ ffmpegPath: '/nonexistent/ffmpeg' });
    await expect(exporter.convert('/in.mp4', '/out.gif', 'gif'))
      .rejects.toThrow('FFmpeg');
  });

  it('builds args for frames to video', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildFramesToVideoArgs('/frames/', '/output.mp4', 30);
    expect(args).toContain('-framerate');
    expect(args).toContain('30');
  });

  it('builds args for extracting frames', () => {
    const exporter = new VideoExporter();
    const args = exporter.buildExtractFramesArgs('/input.mp4', '/frames/', 24);
    expect(args).toContain('-i');
    expect(args).toContain('/input.mp4');
    // fps is embedded inside the -vf filter string, e.g. 'fps=24'
    expect(args).toEqual(expect.arrayContaining([expect.stringContaining('fps=24')]));
    expect(args).toEqual(expect.arrayContaining([expect.stringContaining('/frames/')]));
  });
});
