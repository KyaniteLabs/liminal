import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

interface RenderCliIO {
  exists(path: string): boolean;
  readText(path: string): string;
  stdout(message: string): void;
  stderr(message: string): void;
}

const nodeIO: RenderCliIO = {
  exists: existsSync,
  readText: (path) => readFileSync(path, 'utf-8'),
  stdout: console.log,
  stderr: console.error,
};

export function runRenderCli(argv: readonly string[] = process.argv.slice(2), io: RenderCliIO = nodeIO): number {
  const sessionDir = argv[0];
  if (!sessionDir) {
    io.stderr('Usage: pnpm --filter sing render <session-dir> --resolution 4k');
    return 1;
  }

  const telemetryPath = join(sessionDir, 'telemetry.jsonl');
  const audioPath = join(sessionDir, 'audio.webm');

  if (!io.exists(telemetryPath)) {
    io.stderr(`Missing telemetry stream: ${telemetryPath}`);
    return 1;
  }

  const rows = io.readText(telemetryPath).trim().split('\n').filter(Boolean);
  const audio = io.exists(audioPath) ? audioPath : null;
  io.stderr([
    'offline MP4 render not yet implemented',
    `session=${sessionDir}`,
    `telemetryRows=${rows.length}`,
    `audio=${audio ?? 'missing'}`,
  ].join('; '));
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runRenderCli();
}
