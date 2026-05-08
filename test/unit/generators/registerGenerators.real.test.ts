import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generatorRegistry } from '../../../src/generators/GeneratorRegistry.js';
import { registerAllGenerators } from '../../../src/generators/registerGenerators.js';

const SITE_COMPATIBLE_GENERATOR_NAMES = [
  'p5',
  'three',
  'shader',
  'hydra',
  'tone',
  'strudel',
  'svg',
  'html',
  'textgen',
  'kinetic',
  'ascii',
  'revideo',
  'hyperframes',
];

describe('registerAllGenerators real registry integration', () => {
  beforeEach(() => {
    generatorRegistry.clear();
  });

  afterEach(() => {
    generatorRegistry.clear();
  });

  it('keeps every full-liminal site domain backed by a real generator registry entry', async () => {
    await registerAllGenerators();

    const registeredNames = new Set(generatorRegistry.getAll().map((entry) => entry.name));
    const missingDomains = SITE_COMPATIBLE_GENERATOR_NAMES.filter((domain) => !registeredNames.has(domain));

    expect(missingDomains).toEqual([]);
  });
});
