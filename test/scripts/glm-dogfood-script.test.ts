import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts', 'dogfood-glm.ts');

describe('GLM dogfood script', () => {
  it('uses current provider template config and no hardcoded credentials', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain("from '../src/llm/LLMClient.js'");
    expect(source).toContain("from '../src/harness/MultiProviderConfig.js'");
    expect(source).toContain('PROVIDER_TEMPLATES.glm');
    expect(source).toContain('process.env.GLM_API_KEY');
    expect(source).toContain('providers?.glm?.apiKey');
    expect(source).not.toContain('api/coding/paas/v4');
    expect(source).not.toMatch(/[A-Za-z0-9]{32}\.[A-Za-z0-9]{16}/);
  });
});
