import { spawn, ChildProcess } from 'child_process';

const GRACE_PERIOD_MS = 5_000;

/** Platform-specific ffmpeg input arguments. */
function getFfmpegArgs(platform: string): string[] {
  if (platform === 'darwin') {
    return ['-f', 'avfoundation', '-i', ':0'];
  }
  if (platform === 'linux') {
    return ['-f', 'alsa', '-i', 'default'];
  }
  throw new Error(
    `--voice is not supported on platform "${platform}". Supported platforms: macOS, Linux.`
  );
}

/**
 * Convert signed 16-bit little-endian PCM buffer to Float32 audio samples.
 * Each Int16 sample maps to [-1.0, 1.0].
 */
function pcmToFloat32(pcmBuffer: Buffer): Float32Array {
  const samples = pcmBuffer.length / 2;
  const float32 = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    // Read little-endian Int16 and normalise to [-1, 1]
    const int16 = pcmBuffer.readInt16LE(i * 2);
    float32[i] = int16 / 32768;
  }
  return float32;
}

/**
 * Capture audio from the default microphone using ffmpeg.
 *
 * Blocks until the user presses Enter, then terminates ffmpeg and returns
 * the recorded samples as a Float32Array (mono, 44.1 kHz, values in [-1, 1]).
 *
 * @throws {Error} If stdin is not a TTY, the platform is unsupported,
 *                ffmpeg exits with a non-zero code, or the recording times out.
 */
export async function captureMicAudio(): Promise<Float32Array> {
  const platform = process.platform;

  if (!process.stdin.isTTY) {
    throw new Error(
      '--voice requires an interactive terminal (cannot use with piped input)'
    );
  }

  const ffmpegArgs = [
    ...getFfmpegArgs(platform),
    '-f', 's16le',
    '-ac', '1',
    '-ar', '44100',
    '-v', 'quiet',
    'pipe:1',
  ];

  process.stdout.write('Recording... Press ENTER to stop.\n');

  const ffmpegProcess: ChildProcess = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const chunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  ffmpegProcess.stderr?.on('data', (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  return new Promise<Float32Array>((resolve, reject) => {
    const clearTimer = () => clearTimeout(timeoutId);

    // 60-second recording timeout
    const timeoutId = setTimeout(() => {
      ffmpegProcess.kill('SIGTERM');
      reject(new Error('Microphone recording timed out after 60 seconds'));
    }, 60_000);

    // 5-second grace period before SIGKILL
    const killWithSigkill = () => {
      try {
        ffmpegProcess.kill('SIGKILL');
      } catch {
        // Process may already have exited
      }
    };

    // Resolve on Enter keypress
    const onEnter = (data: Buffer) => {
      const str = data.toString();
      if (str.includes('\n') || str.includes('\r')) {
        process.stdin.removeListener('data', onEnter);
        ffmpegProcess.kill('SIGTERM');
        // SIGKILL fallback after 5s if ffmpeg doesn't exit cleanly
        setTimeout(killWithSigkill, GRACE_PERIOD_MS);
      }
    };

    process.stdin.on('data', onEnter);

    ffmpegProcess.on('close', (code: number | null) => {
      process.stdin.removeListener('data', onEnter);
      clearTimer();
      if (code === null) {
        // Signal kill path — code is null when process was killed
        const audio = pcmToFloat32(Buffer.concat(chunks));
        resolve(audio);
        return;
      }
      if (code === 0) {
        const audio = pcmToFloat32(Buffer.concat(chunks));
        resolve(audio);
      } else {
        const stderrLine = Buffer.concat(stderrChunks).toString('utf8').split('\n')[0] ?? '';
        const stderrSuffix = stderrLine ? ` ${stderrLine}.` : '';
        reject(
          new Error(
            `ffmpeg exited with code ${code}.${stderrSuffix} Check that your microphone is connected and accessible.`
          )
        );
      }
    });

    ffmpegProcess.on('error', (err: Error) => {
      process.stdin.removeListener('data', onEnter);
      clearTimer();
      reject(err);
    });
  });
}