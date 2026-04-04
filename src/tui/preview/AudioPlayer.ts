/**
 * AudioPlayer - Play audio files in terminal
 * 
 * Cross-platform audio playback:
 * - macOS: afplay (built-in)
 * - Linux: aplay, mpg123, ffplay
 * - Windows: start command
 */

import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { formatError } from '../../utils/errors.js';
import { Logger } from '../../utils/Logger.js';

const execFileAsync = promisify(execFile);

export class AudioPlayer {
  private currentProcess: ReturnType<typeof spawn> | null = null;
  private platform: string;

  constructor() {
    this.platform = process.platform;
  }

  /**
   * Check if command exists
   */
  private async commandExists(cmd: string): Promise<boolean> {
    try {
      await execFileAsync('which', [cmd]);
      return true;
    } catch (err) {
      Logger.debug('AudioPlayer', `Command check failed for ${cmd}:`, err);
      return false;
    }
  }

  /**
   * Detect available audio player
   */
  async detectPlayer(): Promise<{ command: string; args: string[] } | null> {
    // macOS
    if (this.platform === 'darwin') {
      return { command: 'afplay', args: [] };
    }

    // Linux - try in order of preference
    if (this.platform === 'linux') {
      if (await this.commandExists('mpg123')) {
        return { command: 'mpg123', args: ['-q'] };
      }
      if (await this.commandExists('ffplay')) {
        return { command: 'ffplay', args: ['-nodisp', '-autoexit', '-loglevel', 'quiet'] };
      }
      if (await this.commandExists('aplay')) {
        return { command: 'aplay', args: ['-q'] };
      }
    }

    // Windows
    if (this.platform === 'win32') {
      return { command: 'start', args: [] };
    }

    return null;
  }

  /**
   * Play audio file
   */
  async play(filePath: string): Promise<{ success: boolean; error?: string }> {
    // Stop any currently playing audio
    this.stop();

    const player = await this.detectPlayer();
    if (!player) {
      return { success: false, error: 'No audio player found. Install mpg123 or ffplay.' };
    }

    try {
      if (this.platform === 'win32') {
        // Windows: use start command
        execFile('start', [filePath], { shell: true, windowsHide: true });
        return { success: true };
      }

      // Spawn player process
      const args = [...player.args, filePath];
      const proc = spawn(player.command, args, {
        detached: true,
        stdio: 'ignore',
      });

      this.currentProcess = proc;

      proc.on('error', (err) => {
        Logger.error('AudioPlayer', 'Audio playback error:', err);
      })

      // Clear reference when process exits so isPlaying() stays accurate
      proc.on('exit', () => {
        if (this.currentProcess === proc) {
          this.currentProcess = null;
        }
      });

      proc.unref();

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: formatError('AudioPlayer', error) 
      };
    }
  }

  /**
   * Stop currently playing audio
   */
  stop(): void {
    if (this.currentProcess) {
      try {
        // Kill the process group
        process.kill(-this.currentProcess.pid!, 'SIGTERM');
      } catch {
        // Process might already be dead
      }
      this.currentProcess = null;
    }
  }

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.currentProcess !== null;
  }

  /**
   * Get visual waveform representation
   */
  getWaveform(): string {
    const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    let waveform = '';
    
    // Generate animated-looking waveform
    for (let i = 0; i < 30; i++) {
      const barIndex = Math.floor(Math.random() * bars.length);
      waveform += bars[barIndex];
    }
    
    return waveform;
  }

  /**
   * Get file info
   */
  getAudioInfo(filePath: string): { name: string; format: string } {
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath);
    
    const formatMap: Record<string, string> = {
      '.mp3': 'MP3',
      '.wav': 'WAV',
      '.ogg': 'OGG',
      '.flac': 'FLAC',
      '.aac': 'AAC',
      '.m4a': 'M4A',
    };

    return {
      name,
      format: formatMap[ext] || ext.toUpperCase(),
    };
  }
}

export const audioPlayer = new AudioPlayer();
