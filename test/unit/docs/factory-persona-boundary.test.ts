import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SkillLoader } from '../../../src/harness/skills/SkillLoader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const factoryRoot = resolve(repoRoot, 'docs/agents/factory-artists');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolute = resolve(dir, entry);
    return statSync(absolute).isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

describe('Factory persona guidance boundary', () => {
  it('keeps imported persona and RAG material explicitly reference-only, not runtime skills', async () => {
    const guidance = readRepoFile('docs/agents/factory-artists/README.md');
    const rag = readRepoFile('docs/agents/factory-artists/rag/README.md');
    const audit = readRepoFile('docs/audits/final-qa-2026-05-06/README.md');
    const loader = new SkillLoader([factoryRoot]);

    expect(guidance).toContain('reference material only');
    expect(guidance).toContain('not `SKILL.md` skills');
    expect(guidance).toContain('not loaded by `SkillLoader`');
    expect(guidance).toContain('Do not wire these files into `src/prompts/`, swarm personas, or Studio behavior.');

    expect(rag).toContain('reference-only source manifests');
    expect(rag).toContain('not a runtime RAG index');
    expect(rag).toContain('not loaded by `SkillLoader`');
    expect(rag).toContain('not an ingestion pipeline');

    expect(audit).toContain('read-only expert lenses');
    expect(audit).toContain('does not wire personas into runtime behavior, prompts, Studio, TUI, or audit automation');

    expect(existsSync(resolve(factoryRoot, 'SKILL.md'))).toBe(false);
    expect(walkFiles(factoryRoot).some((file) => file.endsWith('/SKILL.md'))).toBe(false);
    expect(await loader.loadSkill('rag')).toBeNull();
    expect(await loader.listSkills()).toEqual([]);
  });
});
