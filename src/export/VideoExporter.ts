import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

export interface VideoExporterOptions {
  ffmpegPath?: string;
  ffprobePath?: string;
}

export class VideoExporter {
  private ffmpegPath: string;

  constructor(options: VideoExporterOptions = {}) {
    this.ffmpegPath = options.ffmpegPath ?? 'ffmpeg';
  }

  async convert(input: string, output: string, format: 'mp4' | 'webm' | 'gif'): Promise<void> {
    const args = this.buildConvertArgs(input, output, format);
    await this.execFFmpeg(args);
  }

  async resize(input: string, output: string, width: number, height: number): Promise<void> {
    const args = this.buildResizeArgs(input, output, width, height);
    await this.execFFmpeg(args);
  }

  async addAudio(video: string, audio: string, output: string): Promise<void> {
    const args = this.buildAddAudioArgs(video, audio, output);
    await this.execFFmpeg(args);
  }

  async extractFrames(input: string, outputDir: string, fps: number = 24): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });
    const args = this.buildExtractFramesArgs(input, outputDir, fps);
    await this.execFFmpeg(args);
  }

  async framesToVideo(framesDir: string, output: string, fps: number): Promise<void> {
    const args = this.buildFramesToVideoArgs(framesDir, output, fps);
    await this.execFFmpeg(args);
  }

  // --- Build args methods (exposed for testing without subprocess) ---

  buildConvertArgs(input: string, output: string, format: string): string[] {
    const args = ['-i', input, '-y'];

    if (format === 'gif') {
      args.push(
        '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[s0][s1]',
        '-palettegen', '[s0][palette]',
        '-filter_complex', '[s1][palette]paletteuse',
      );
    } else if (format === 'webm') {
      args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0');
    } else {
      args.push('-c:v', 'libx264', '-crf', '23', '-preset', 'medium');
    }

    args.push(output);
    return args;
  }

  buildResizeArgs(input: string, output: string, width: number, height: number): string[] {
    return [
      '-i', input, '-y',
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:a', 'copy',
      output,
    ];
  }

  buildAddAudioArgs(video: string, audio: string, output: string): string[] {
    return [
      '-i', video, '-i', audio, '-y',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-map', '0:v:0', '-map', '1:a:0',
      '-shortest',
      output,
    ];
  }

  buildExtractFramesArgs(input: string, outputDir: string, fps: number): string[] {
    const pattern = path.join(outputDir, 'frame_%05d.png');
    return [
      '-i', input,
      '-vf', `fps=${fps}`,
      pattern,
    ];
  }

  buildFramesToVideoArgs(framesDir: string, output: string, fps: number): string[] {
    const pattern = path.join(framesDir, 'frame_%05d.png');
    return [
      '-framerate', String(fps),
      '-i', pattern,
      '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p',
      output,
    ];
  }

  // --- Private ---

  private async execFFmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execFileAsync(this.ffmpegPath, args, { timeout: 300000 });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'ENOENT') {
        throw new Error(`FFmpeg not found at '${this.ffmpegPath}'. Install FFmpeg and ensure it is on PATH.`);
      }
      throw new Error(`FFmpeg failed: ${err.message}`);
    }
  }
}
