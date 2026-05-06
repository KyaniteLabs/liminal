import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const launcherPath = path.join(repoRoot, 'scripts', 'start-bubbletea-tui.mjs');

describe('Bubble Tea launcher script', () => {
  it('does not contain merge conflict markers', () => {
    const source = readFileSync(launcherPath, 'utf8');

    expect(source).not.toMatch(/^(<<<<<<<|=======|>>>>>>>) /m);
  });

  it('is valid JavaScript syntax', () => {
    expect(() => {
      execFileSync(process.execPath, ['--check', launcherPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    }).not.toThrow();
  });

  it('defaults bridge route logs to info for operator diagnostics', () => {
    const source = readFileSync(launcherPath, 'utf8');

    expect(source).toContain("if (!process.env.LIMINAL_LOG_LEVEL) process.env.LIMINAL_LOG_LEVEL = 'info';");
    expect(source).toContain('Bridge log level: ${process.env.LIMINAL_LOG_LEVEL}');
    expect(source).toContain("const bridgeLogFile = path.join(ROOT, '.omx', 'logs', 'bubbletea-bridge.log');");
  });
});
