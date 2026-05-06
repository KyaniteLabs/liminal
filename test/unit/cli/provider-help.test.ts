import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = path.join(repoRoot, 'bin', 'liminal');

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
