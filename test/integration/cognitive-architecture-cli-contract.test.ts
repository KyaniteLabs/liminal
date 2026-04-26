import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('cognitive architecture CLI contract', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const bin = () => fs.readFileSync(path.join(repoRoot, 'bin/liminal'), 'utf8');

  it('advertises the cognition report as the finish-line contract receipt', () => {
    const content = bin();
    expect(content).toContain('report cognition');
    expect(content).toContain('Show creative body and cognitive architecture atlas');
  });

  it('wires report cognition to the CognitiveArchitectureAtlas formatter', () => {
    const content = bin();
    expect(content).toContain("cmd === 'report' && cmdArgs[0] === 'cognition'");
    expect(content).toContain('CognitiveArchitectureAtlas');
    expect(content).toContain('atlas.format(atlas.build())');
  });
});
