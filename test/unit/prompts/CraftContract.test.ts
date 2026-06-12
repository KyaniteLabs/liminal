import { describe, expect, it } from 'vitest';
import {
  CRAFT_CONTRACT,
  CRAFT_CONTRACT_COMPACT,
  SVG_CRAFT_CONTRACT,
  SVG_CRAFT_CONTRACT_COMPACT,
  HYDRA_CRAFT_CONTRACT,
  HYDRA_CRAFT_CONTRACT_COMPACT,
} from '../../../src/prompts/CraftContract';
import { PromptBuilder } from '../../../src/llm/PromptBuilder';
import { HydraValidator } from '../../../src/core/validators/HydraValidator';

describe('CraftContract', () => {
  it('full contract demands every 0.9-band dimension', () => {
    for (const dim of ['COMPOSITION', 'DEPTH', 'LIGHT', 'PALETTE', 'MOTION', 'NEGATIVE SPACE', 'FINISH']) {
      expect(CRAFT_CONTRACT).toContain(dim);
    }
  });

  it('compact contract stays under a third of the full length', () => {
    expect(CRAFT_CONTRACT_COMPACT.length).toBeLessThan(CRAFT_CONTRACT.length / 3 + 50);
  });
});

describe('CraftContract — SVG', () => {
  it('SVG full contract demands raw <svg> root, no fences, no prose', () => {
    expect(SVG_CRAFT_CONTRACT).toContain('<svg');
    expect(SVG_CRAFT_CONTRACT).toContain('</svg>');
    expect(SVG_CRAFT_CONTRACT).toContain('No markdown fences');
  });

  it('SVG compact contract is shorter and still anchors the root format', () => {
    expect(SVG_CRAFT_CONTRACT_COMPACT.length).toBeLessThan(SVG_CRAFT_CONTRACT.length);
    expect(SVG_CRAFT_CONTRACT_COMPACT).toContain('</svg>');
  });
});

/**
 * REPRO EVIDENCE — novel hydra prompts that an LLM is likely to emit (or that
 * already failed overnight, see ~/.sinter/failures/1781265823171-d607emr4j.json).
 * The Hydra validator's substring check rejects ANY code containing `.sin(`,
 * including valid `Math.sin(time)` calls inside arrow functions. This block
 * captures the exact raw generated code and validator error that motivated
 * the craft-contract fix; if these repros ever stop failing, the validator
 * has been weakened and the protection this contract relies on is gone.
 */
describe('Hydra REPRO — novel prompts validate (raw code → exact validator error)', () => {
  it('repro #1: failure-record code (bioluminescent anemones) is REJECTED with .sin( error', () => {
    const codeFromFailureRecord = `gradient(0.2).color(0.01, 0.04, 0.08).brightness(0.7).layer(shape(99, 0.6, 0.001).scale(1, 0.35).repeat(12, 1).rotate(() => Math.sin(time * 0.4) * 0.15 + time * 0.05).color(0.05, 0.65, 0.55).modulate(noise(3, 0.25), 0.35)).blend(osc(4, 0.08, 1.5).color(0.02, 0.35, 0.45).kaleid(8).rotate(() => -time * 0.03).scale(1, 1.2), 0.32).modulate(voronoi(4, 0.18, 0.1), 0.22).saturate(1.25).contrast(1.45).brightness(0.82).out(o0); render(o0);`;
    const r = HydraValidator.validate(codeFromFailureRecord);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('.sin('))).toBe(true);
  });

  it('repro #2: novel "murmuration ribbons over slate water" prompt with Math.sin is REJECTED', () => {
    const codeForNovelPrompt = `osc(20, 0.05, 1.2).color(0.05, 0.2, 0.4).modulate(noise(2, 0.1).rotate(0.1), 0.4).rotate(0.05, 0.1).scrollX(() => Math.sin(time * 0.2) * 0.1).scale(1.1).modulate(voronoi(3, 0.2), 0.15).saturate(0.9).contrast(1.3).brightness(0.75).out(o0); render(o0);`;
    const r = HydraValidator.validate(codeForNovelPrompt);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('.sin('))).toBe(true);
  });

  it('repro #3: chained .sin() / .cos() / .tan() methods are REJECTED', () => {
    for (const method of ['sin', 'cos', 'tan', 'sqrt', 'abs', 'pow']) {
      const code = `osc(20, 0.05, 1.2).${method}(0.5).out(o0); render(o0);`;
      const r = HydraValidator.validate(code);
      expect(r.valid, `chained .${method}(0.5) should be rejected`).toBe(false);
      expect(r.errors.some((e) => e.includes(`.${method}(`))).toBe(true);
    }
  });

  it('counter-evidence: a code that follows the new contract PASSES (no Math, no chained math methods, ends with .out(o0) and render(o0))', () => {
    const code = `solid(0.05, 0.1, 0.2).layer(osc(8, 0.05, 1.5).color(0.6, 0.8, 1.0).kaleid(4).rotate(0, 0.05).modulate(noise(3, 0.1), 0.3)).modulate(voronoi(4, 0.2, 0.1), 0.2).contrast(1.4).brightness(0.85).out(o0); render(o0);`;
    const r = HydraValidator.validate(code);
    expect(r.valid).toBe(true);
  });
});

describe('CraftContract — Hydra (repro-first evidence: validator rejects these substrings)', () => {
  it('hydra full contract forbids Math.* and the validator-rejected substrings', () => {
    expect(HYDRA_CRAFT_CONTRACT).toContain('NEVER use Math.*');
    for (const forbidden of ['.sin(', '.cos(', '.tan(', '.sqrt(', '.abs(', '.pow(', '.saturation(', '.feedback(', '.kaleidoscope(', '.colorShift(', '.post(', '.screen(', '.output(']) {
      expect(HYDRA_CRAFT_CONTRACT).toContain(forbidden);
    }
  });

  it('hydra full contract demands sources, animation args, .out(o0), render(o0)', () => {
    expect(HYDRA_CRAFT_CONTRACT).toContain('osc(freq, sync, offset)');
    expect(HYDRA_CRAFT_CONTRACT).toContain('noise(scale, offset)');
    expect(HYDRA_CRAFT_CONTRACT).toContain('.out(o0)');
    expect(HYDRA_CRAFT_CONTRACT).toContain('render(o0)');
  });

  it('hydra full contract forbids camera/screen input (s0.initCam, s0.initScreen, src(s0))', () => {
    expect(HYDRA_CRAFT_CONTRACT).toContain('s0.initCam()');
    expect(HYDRA_CRAFT_CONTRACT).toContain('s0.initScreen()');
    expect(HYDRA_CRAFT_CONTRACT).toContain('src(s0)');
  });

  it('hydra compact contract is shorter and still enforces the substrings ban', () => {
    expect(HYDRA_CRAFT_CONTRACT_COMPACT.length).toBeLessThan(HYDRA_CRAFT_CONTRACT.length);
    expect(HYDRA_CRAFT_CONTRACT_COMPACT).toContain('Math.*');
    expect(HYDRA_CRAFT_CONTRACT_COMPACT).toContain('.out(o0)');
    expect(HYDRA_CRAFT_CONTRACT_COMPACT).toContain('render(o0)');
  });
});

describe('PromptBuilder.contractFor — single routing point', () => {
  it('routes svg domain to SVG contracts (full vs compact by tier)', () => {
    expect(PromptBuilder.contractFor('svg', 'flagship')).toBe(SVG_CRAFT_CONTRACT);
    expect(PromptBuilder.contractFor('svg', 'medium')).toBe(SVG_CRAFT_CONTRACT);
    expect(PromptBuilder.contractFor('svg', 'local')).toBe(SVG_CRAFT_CONTRACT_COMPACT);
    expect(PromptBuilder.contractFor('svg', 'tiny')).toBe(SVG_CRAFT_CONTRACT_COMPACT);
  });

  it('routes hydra domain to HYDRA contracts (full vs compact by tier)', () => {
    expect(PromptBuilder.contractFor('hydra', 'flagship')).toBe(HYDRA_CRAFT_CONTRACT);
    expect(PromptBuilder.contractFor('hydra', 'medium')).toBe(HYDRA_CRAFT_CONTRACT);
    expect(PromptBuilder.contractFor('hydra', 'local')).toBe(HYDRA_CRAFT_CONTRACT_COMPACT);
    expect(PromptBuilder.contractFor('hydra', 'tiny')).toBe(HYDRA_CRAFT_CONTRACT_COMPACT);
  });

  it('falls back to the generic CRAFT_CONTRACT for every other domain (unchanged behavior)', () => {
    for (const tier of ['flagship', 'medium', 'local', 'tiny'] as const) {
      expect(PromptBuilder.contractFor('p5', tier)).toBe(
        tier === 'local' || tier === 'tiny' ? CRAFT_CONTRACT_COMPACT : CRAFT_CONTRACT,
      );
      expect(PromptBuilder.contractFor('shader', tier)).toBe(
        tier === 'local' || tier === 'tiny' ? CRAFT_CONTRACT_COMPACT : CRAFT_CONTRACT,
      );
      expect(PromptBuilder.contractFor('three', tier)).toBe(
        tier === 'local' || tier === 'tiny' ? CRAFT_CONTRACT_COMPACT : CRAFT_CONTRACT,
      );
      expect(PromptBuilder.contractFor('tone', tier)).toBe(
        tier === 'local' || tier === 'tiny' ? CRAFT_CONTRACT_COMPACT : CRAFT_CONTRACT,
      );
      expect(PromptBuilder.contractFor('strudel', tier)).toBe(
        tier === 'local' || tier === 'tiny' ? CRAFT_CONTRACT_COMPACT : CRAFT_CONTRACT,
      );
      expect(PromptBuilder.contractFor('processing', tier)).toBe(
        tier === 'local' || tier === 'tiny' ? CRAFT_CONTRACT_COMPACT : CRAFT_CONTRACT,
      );
    }
  });

  it('is case-insensitive and tolerant of whitespace on the domain', () => {
    expect(PromptBuilder.contractFor('SVG', 'flagship')).toBe(SVG_CRAFT_CONTRACT);
    expect(PromptBuilder.contractFor('  Hydra ', 'tiny')).toBe(HYDRA_CRAFT_CONTRACT_COMPACT);
    expect(PromptBuilder.contractFor('HYDRA', 'medium')).toBe(HYDRA_CRAFT_CONTRACT);
  });

  it('treats undefined / empty domain as the generic fallback (unchanged behavior)', () => {
    expect(PromptBuilder.contractFor(undefined, 'flagship')).toBe(CRAFT_CONTRACT);
    expect(PromptBuilder.contractFor('', 'tiny')).toBe(CRAFT_CONTRACT_COMPACT);
  });
});

describe('PromptBuilder craft wiring', () => {
  const ctx = { userRequest: 'a tide pool', domain: 'p5' };

  it('flagship and medium tiers carry the full contract', () => {
    for (const model of ['claude-opus-4-5', 'gpt-5']) {
      const built = new PromptBuilder({ baseUrl: '', model }).build(ctx);
      expect(built.system).toContain('<craft_contract>');
      expect(built.system).toContain('COMPOSITION: one dominant focal point');
    }
  });

  it('local tier carries the compact contract', () => {
    const built = new PromptBuilder({ baseUrl: 'http://localhost:11434', model: 'llama3:8b' }).build(ctx);
    expect(built.system).toContain('<craft_contract>');
    expect(built.system).toContain('Exhibition grade required');
  });

  it('hydra domain routes to HYDRA_CRAFT_CONTRACT on flagship tier (NEW behavior)', () => {
    const built = new PromptBuilder({ baseUrl: '', model: 'claude-opus-4-5' }).build({
      userRequest: 'a murmuration of ribbons over slate water',
      domain: 'hydra',
    });
    expect(built.system).toContain('<craft_contract domain="hydra">');
    expect(built.system).toContain('NEVER use Math.*');
    expect(built.system).toContain('.out(o0)');
    expect(built.system).toContain('render(o0)');
  });

  it('hydra domain routes to HYDRA_CRAFT_CONTRACT_COMPACT on local tier (NEW behavior)', () => {
    const built = new PromptBuilder({ baseUrl: 'http://localhost:11434', model: 'llama3:8b' }).build({
      userRequest: 'bioluminescent anemones breathing with the cursor',
      domain: 'hydra',
    });
    expect(built.system).toContain('<craft_contract domain="hydra">');
    expect(built.system).toContain('Math.*');
  });

  it('svg domain still routes to SVG_CRAFT_CONTRACT on flagship tier (regression)', () => {
    const built = new PromptBuilder({ baseUrl: '', model: 'claude-opus-4-5' }).build({
      userRequest: 'a tide pool',
      domain: 'svg',
    });
    expect(built.system).toContain('<craft_contract domain="svg">');
    expect(built.system).toContain('<svg');
    expect(built.system).toContain('</svg>');
  });

  it('default domains (p5, shader, three) are UNCHANGED — still get the generic contract', () => {
    for (const domain of ['p5', 'shader', 'three', 'tone', 'strudel', 'processing']) {
      const built = new PromptBuilder({ baseUrl: '', model: 'claude-opus-4-5' }).build({
        userRequest: 'a tide pool',
        domain,
      });
      expect(built.system).toContain('COMPOSITION: one dominant focal point');
      expect(built.system).not.toContain('domain="hydra"');
      expect(built.system).not.toContain('domain="svg"');
    }
  });
});
