import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AestheticCritic } from '../../../src/aesthetic/AestheticCritic.js';

describe('aesthetic config contract', () => {
  it('documents --aesthetic as creative preference presets and --aesthetic-config as a JSON path', () => {
    const cli = readFileSync('bin/liminal', 'utf8');

    expect(cli).toContain('--aesthetic <preset>        Creative preference preset (minimalist|vibrant|cinematic|playful|free)');
    expect(cli).toContain('--aesthetic-config <path>  Path to aesthetic/perception config JSON');
    expect(cli).toContain('loadAestheticConfig(flags.aestheticConfig)');
    expect(cli).not.toContain('Aesthetic guardrail preset (lenient|moderate|strict)');
  });

  it('applies named presets before caller constraint overrides', () => {
    const critic = new AestheticCritic();
    const colorfulCode = `
      fill('#ff0000'); fill('#00ff00'); fill('#0000ff');
      fill('#ffff00'); fill('#ff00ff'); fill('#00ffff');
    `;

    const minimalist = critic.critique(colorfulCode, { preset: 'minimalist' } as any);
    const overridden = critic.critique(colorfulCode, {
      preset: 'minimalist',
      constraints: { color: { maxColors: 10 } },
    } as any);

    expect(minimalist.violations.some(v => v.message.includes('exceeding max of 2'))).toBe(true);
    expect(overridden.violations.some(v => v.message.includes('exceeding max of 2'))).toBe(false);
  });
});
