import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = path.join(repoRoot, 'bin', 'sinter');

// Exact-string help lines for every top-level command/flag documented in the
// 2026-06-10 audit. These strings are taken verbatim from printHelp() in
// bin/sinter — if the help text changes, this test must be updated in lockstep.
const REQUIRED_HELP_LINES = [
  '  preferences <subcommand>  Preferences: export, stats, train, model',
  '  taste <train|eval>          Train or evaluate the taste model from preferences',
  '  dream run [strategy]        Run a dream recombination cycle over the archive',
  '  garden <subcommand>         Autonomous gardener: status, rebalance, start, stop, tend [budget]',
  '  emergence <score|probe>     Score or probe emergence for a text or file output',
  '  fs <artifacts|refs|runs>    Inspect Sinter content store: artifacts, refs, runs',
  '  --learn                     Feed generation results into the quality archive',
];

describe('liminal CLI provider setup help', () => {
  it('advertises the documented ProviderRuntime providers instead of legacy provider names', async () => {
    const { stdout } = await execFileAsync(process.execPath, [binPath, '--help'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DOTENV_CONFIG_QUIET: 'true',
      },
    });

    const providerLine = stdout.split('\n').find(line => line.includes('--provider <name>')) ?? '';
    expect(providerLine).toContain('lmstudio');
    expect(providerLine).toContain('ollama');
    expect(providerLine).toContain('openai');
    expect(providerLine).toContain('minimax');
    expect(providerLine).toContain('glm');
    expect(providerLine).toContain('openrouter');
    expect(providerLine).toContain('kimi');
    expect(providerLine).toContain('moonshot');
    expect(providerLine).not.toContain('inception');
  });

  it('keeps CLI provider shorthand wired to canonical runtime endpoints and provider env', async () => {
    const source = await fs.readFile(binPath, 'utf-8');

    expect(source).toMatch(/glm:\s*\{[\s\S]*?baseUrl:\s*['"]https:\/\/api\.z\.ai\/api\/anthropic['"]/);
    expect(source).toMatch(/minimax:\s*\{[\s\S]*?baseUrl:\s*['"]https:\/\/api\.minimax\.io\/anthropic['"]/);
    expect(source).toMatch(/openrouter:\s*\{[\s\S]*?baseUrl:\s*['"]https:\/\/openrouter\.ai\/api\/v1['"]/);
    expect(source).toMatch(/kimi:\s*\{[\s\S]*?baseUrl:\s*['"]https:\/\/api\.kimi\.com\/coding\/v1['"]/);
    expect(source).toMatch(/moonshot:\s*\{[\s\S]*?baseUrl:\s*['"]https:\/\/api\.moonshot\.ai\/v1['"]/);
    expect(source).toContain('process.env.LIMINAL_LLM_PROVIDER');
  });
});

describe('sinter CLI --help completeness', () => {
  it('documents garden, taste, preferences, dream, emergence, fs and --learn as exact help lines', async () => {
    const { stdout } = await execFileAsync(process.execPath, [binPath, '--help'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DOTENV_CONFIG_QUIET: 'true',
      },
    });

    for (const line of REQUIRED_HELP_LINES) {
      expect(stdout.split('\n')).toContain(line);
    }
  });
});
