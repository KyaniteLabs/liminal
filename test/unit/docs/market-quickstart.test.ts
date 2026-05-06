import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('market quickstart docs', () => {
  it('gives a human the exact ready-to-show commands without narrowing creative domains', () => {
    const readme = readRepoFile('README.md');

    expect(readme).toContain('## Ready-to-show market path');
    expect(readme).toContain('liminal "a luminous blue-green particle garden"');
    expect(readme).toContain('pnpm run proof:live-provider-smoke -- --provider=glm --timeout-ms=120000');
    expect(readme).toContain('pnpm exec tsx scripts/proof/creative-copilot-proof.ts --provider=glm --all --timeout-ms=120000 --max-tokens=4096 --out=.omx/proof/market-all-domain-sweep');
    expect(readme).toContain('liminal market status');
    expect(readme).toContain('p5, SVG, GLSL, Three.js, Hydra, Strudel, Tone.js, Revideo, HyperFrames, ASCII, Kinetic, and TextGen');
    expect(readme).toContain('HyperFrames saves HTML/GSAP composition artifacts, and Revideo code artifacts are generated; native rendered video/still capture is a separate follow-up.');
  });
});
