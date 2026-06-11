import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { runRenderCli } from '../src/recording/render-cli.js';

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('sing render CLI', () => {
  it('fails with usage when no session directory is provided', () => {
    const result = run([]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(['Usage: pnpm --filter sing render <session-dir> --resolution 4k']);
    expect(result.stdout).toEqual([]);
  });

  it('fails when the session telemetry stream is missing', () => {
    const sessionDir = tempSession();
    const result = run([sessionDir]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual([`Missing telemetry stream: ${join(sessionDir, 'telemetry.jsonl')}`]);
    expect(result.stdout).toEqual([]);
  });

  it('refuses the valid-session path loudly until offline MP4 rendering exists', () => {
    const sessionDir = tempSession();
    writeFileSync(join(sessionDir, 'telemetry.jsonl'), '{"rms":0.1}\n{"rms":0.2}\n');
    writeFileSync(join(sessionDir, 'audio.webm'), 'audio');

    const result = run([sessionDir, '--resolution', '4k']);

    expect(result.code).toBe(1);
    expect(result.stdout).toEqual([]);
    expect(result.stderr).toEqual([
      `offline MP4 render not yet implemented; session=${sessionDir}; telemetryRows=2; audio=${join(sessionDir, 'audio.webm')}`,
    ]);
  });
});

function tempSession(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sing-render-cli-'));
  tmpDirs.push(dir);
  return dir;
}

function run(argv: string[]): { code: number; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = runRenderCli(argv, {
    exists: (path) => existsSync(path),
    readText: (path) => readFileSync(path, 'utf-8'),
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });
  return { code, stdout, stderr };
}
