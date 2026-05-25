import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const sessionDir = process.argv[2];

if (!sessionDir) {
  console.error('Usage: pnpm --filter sing render <session-dir> --resolution 4k');
  process.exit(1);
}

const telemetryPath = join(sessionDir, 'telemetry.jsonl');
const audioPath = join(sessionDir, 'audio.webm');

if (!existsSync(telemetryPath)) {
  console.error(`Missing telemetry stream: ${telemetryPath}`);
  process.exit(1);
}

const rows = readFileSync(telemetryPath, 'utf-8').trim().split('\n').filter(Boolean);
console.log(JSON.stringify({
  ok: true,
  sessionDir,
  telemetryRows: rows.length,
  audio: existsSync(audioPath) ? audioPath : null,
  note: 'Offline MP4 rendering is wired to the Sing session contract; ffmpeg frame synthesis is the next implementation slice.',
}));
