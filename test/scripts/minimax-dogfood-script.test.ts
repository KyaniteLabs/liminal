import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts', 'dogfood', 'dogfood-minimax-m27.ts');

describe('MiniMax dogfood script', () => {
  it('uses current source paths and provider template endpoint', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain("from '../../src/index.js'");
    expect(source).toContain("from '../../src/guardrails/RuntimeHealthMonitor.js'");
    expect(source).toContain("from '../../src/harness/MultiProviderConfig.js'");
    expect(source).toContain('PROVIDER_TEMPLATES.minimax');
    expect(source).not.toContain('https://api.minimaxi.chat/v1');
    expect(source).not.toContain("from '../src/");
  });
});

