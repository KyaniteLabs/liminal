import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = process.cwd();

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(repoRoot, path), 'utf-8')) as Record<string, unknown>;
}

describe('Sing package split', () => {
  it('declares audio-core and sing as workspace packages', () => {
    const workspace = readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf-8');
    const rootPackage = readJson('package.json');
    const audioPackage = readJson('packages/audio-core/package.json');
    const singPackage = readJson('packages/sing/package.json');

    expect(workspace).toContain('packages/*');
    expect((rootPackage.dependencies as Record<string, string>)['@sinter/audio-core']).toBe('workspace:*');
    expect(audioPackage.name).toBe('@sinter/audio-core');
    expect(singPackage.name).toBe('sing');
    expect((singPackage.dependencies as Record<string, string>)['@sinter/audio-core']).toBe('workspace:*');
  });

  it('serves Sing with cross-origin isolation for SharedArrayBuffer', () => {
    const viteConfig = readFileSync(join(repoRoot, 'packages/sing/vite.config.ts'), 'utf-8');

    expect(viteConfig).toContain('Cross-Origin-Opener-Policy');
    expect(viteConfig).toContain('Cross-Origin-Embedder-Policy');
    expect(viteConfig).toContain('same-origin');
    expect(viteConfig).toContain('require-corp');
  });
});
