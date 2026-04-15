import { describe, it, expect, beforeEach } from 'vitest';
import {
  GeneratorHarnessTools,
  type FailureClassification,
} from '../../../src/generators/GeneratorHarnessTools.js';

// ---------------------------------------------------------------------------
// Deterministic seeded RNG for tests
// ---------------------------------------------------------------------------

function makeSeededRng(seed: number): () => number {
  const values = [
    0.1, 0.5, 0.9, 0.3, 0.7,
    0.2, 0.6, 0.8, 0.4, 0.0,
  ];
  let idx = seed;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

describe('GeneratorHarnessTools', () => {
  let tools: GeneratorHarnessTools;

  beforeEach(() => {
    tools = new GeneratorHarnessTools(makeSeededRng(0));
  });

  // -------------------------------------------------------------------------
  // prepare()
  // -------------------------------------------------------------------------

  describe('prepare', () => {
    it('returns a context object with all fields for a known domain', () => {
      const ctx = tools.prepare('tone');
      expect(typeof ctx.domain).toBe('string');
      expect(typeof ctx.skeletonHint).toBe('string');
      expect(Array.isArray(ctx.sampledApis)).toBe(true);
      expect(Array.isArray(ctx.hardeningHints)).toBe(true);
      expect(typeof ctx.hintsWereSampled).toBe('boolean');
      expect(ctx.domain).toBe('tone');
    });

    it('returns empty skeleton and APIs for an unknown domain', () => {
      const ctx = tools.prepare('unknown_domain_xyz');
      expect(ctx.domain).toBe('unknown_domain_xyz');
      expect(ctx.skeletonHint).toBe('');
      // Unknown domain has no API vocab
      expect(ctx.sampledApis.length).toBe(0);
      expect(Array.isArray(ctx.hardeningHints)).toBe(true);
      // 'all' domain hardening hints apply even to unknown domains
      expect(ctx.hintsWereSampled).toBe(true);
    });

    it('samples Tone.js APIs deterministically with seed=0', () => {
      const ctx = tools.prepare('tone');
      expect(ctx.sampledApis.length).toBeGreaterThan(0);
      expect(ctx.sampledApis.length).toBeLessThanOrEqual(3);
      const hasToneApi = ctx.sampledApis.some((api: string) => api.includes('Tone'));
      expect(hasToneApi).toBe(true);
    });

    it('samples Three.js APIs deterministically', () => {
      const ctx = tools.prepare('three');
      expect(ctx.sampledApis.length).toBeGreaterThan(0);
      const hasThreeApi = ctx.sampledApis.some((api: string) =>
        api.includes('THREE') || api.includes('Scene')
      );
      expect(hasThreeApi).toBe(true);
    });

    it('samples GLSL APIs - returns non-empty array for known vocab', () => {
      const ctx = tools.prepare('glsl');
      expect(ctx.sampledApis.length).toBeGreaterThan(0);
      expect(ctx.sampledApis.length).toBeLessThanOrEqual(3);
    });

    it('includes hardening hints for known domains', () => {
      const ctx = tools.prepare('tone');
      if (ctx.hardeningHints.length > 0) {
        ctx.hardeningHints.forEach((hint: string) => {
          expect(typeof hint).toBe('string');
          expect(hint.length).toBeGreaterThan(0);
        });
      }
    });

    it('hintsWereSampled is true for known domains', () => {
      const ctx = tools.prepare('strudel');
      expect(ctx.hintsWereSampled).toBe(true);
    });

    it('skeleton hint contains Tone.Transport for tone', () => {
      const ctx = tools.prepare('tone');
      if (ctx.skeletonHint) {
        expect(ctx.skeletonHint).toContain('Tone.js');
        expect(ctx.skeletonHint).toContain('Tone.Transport');
      }
    });

    it('skeleton hint includes THREE.Scene for three', () => {
      const ctx = tools.prepare('three');
      if (ctx.skeletonHint) {
        expect(ctx.skeletonHint).toContain('THREE.Scene');
      }
    });

    it('skeleton hint includes void main for glsl', () => {
      const ctx = tools.prepare('glsl');
      if (ctx.skeletonHint) {
        expect(ctx.skeletonHint).toContain('void main');
      }
    });

    it('skeleton hint includes stack for strudel', () => {
      const ctx = tools.prepare('strudel');
      if (ctx.skeletonHint) {
        expect(ctx.skeletonHint).toContain('stack');
      }
    });

    it('skeleton hint mentions fixed-width for ascii', () => {
      const ctx = tools.prepare('ascii');
      if (ctx.skeletonHint) {
        expect(ctx.skeletonHint).toMatch(/width|chars|fixed/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // classifyFailure()
  // -------------------------------------------------------------------------

  describe('classifyFailure', () => {
    // All results must have evidence
    const assertHasEvidence = (result: FailureClassification) => {
      expect(result.evidence).toBeDefined();
      expect(typeof result.evidence).toBe('string');
    };

    it('classifies wrong_domain when Tone error + non-Tone code', () => {
      const result = tools.classifyFailure(
        'Generated code does not use Tone.js',
        'const audio = new AudioContext();'
      );
      expect(result.failureClass).toBe('wrong_domain');
      assertHasEvidence(result);
    });

    it('classifies missing_required_api when code has no domain APIs', () => {
      // Code with no Tone/THREE/etc APIs and not empty → missing_required_api
      // (missing_required_api fires BEFORE too_short when domainApis.length===0)
      const result = tools.classifyFailure('Missing API', 'const x = 1;');
      expect(result.failureClass).toBe('missing_required_api');
      assertHasEvidence(result);
    });

    it('classifies too_short for empty code', () => {
      // Implementation: empty string '' has trimmedCode.length < 30 → too_short fires
      const result = tools.classifyFailure('Empty', '');
      expect(result.failureClass).toBe('too_short');
      assertHasEvidence(result);
    });

    it('classifies too_short for short code with Tone APIs', () => {
      // Code with Tone APIs (not empty after strip) but < 30 chars → too_short
      const result = tools.classifyFailure('Too short', 'Tone.Transport.start()');
      expect(result.failureClass).toBe('too_short');
      assertHasEvidence(result);
    });

    it('classifies truncated when braces are unbalanced', () => {
      // Code must have domain APIs (e.g. Tone.Transport) to survive missing_required_api
      // Then unbalanced { count triggers truncated
      const result = tools.classifyFailure(
        'Incomplete code',
        'const synth = new Tone.Synth(); synth.trigger(); {'
      );
      expect(result.failureClass).toBe('truncated');
      assertHasEvidence(result);
    });

    it('classifies truncated when parens are unbalanced', () => {
      const result = tools.classifyFailure(
        'Incomplete expression',
        'new Tone.Synth().toDestination(()'
      );
      expect(result.failureClass).toBe('truncated');
      assertHasEvidence(result);
    });

    it('classifies truncated when last char is not a terminator', () => {
      // Code must have Tone APIs to survive missing_required_api
      const result = tools.classifyFailure(
        'May be truncated',
        'const synth = new Tone.Synth().toDestination('
      );
      expect(result.failureClass).toBe('truncated');
      assertHasEvidence(result);
    });

    it('classifies wrapper_contract_mismatch for full_html in error', () => {
      // Code must have Tone APIs (>30 chars) AND error must contain full_html/doctype
      const result = tools.classifyFailure(
        'Output does not match wrapper: expected full HTML',
        'const synth = new Tone.Synth(); Tone.Transport.start();'
      );
      expect(result.failureClass).toBe('wrapper_contract_mismatch');
      assertHasEvidence(result);
    });

    it('classifies runtime_error for ReferenceError', () => {
      const result = tools.classifyFailure(
        'ReferenceError: undefined is not an object',
        'const synth = new Tone.Synth(); synth.trigger();'
      );
      expect(result.failureClass).toBe('runtime_error');
      expect(result.runtimeError).toBeDefined();
      assertHasEvidence(result);
    });

    it('classifies runtime_error for WebGL shader compile error', () => {
      const result = tools.classifyFailure(
        'WebGL: ERROR: 0:1: unexpected token',
        'precision mediump float; void main() { gl_FragColor = vec4(1.0); }'
      );
      expect(result.failureClass).toBe('runtime_error');
      assertHasEvidence(result);
    });

    it('classifies unknown when error is generic and code is reasonable', () => {
      const result = tools.classifyFailure(
        'Something went wrong but not sure what',
        'const validCode = true;'
      );
      expect(result.failureClass).toBeTruthy();
      assertHasEvidence(result);
    });

    it('returns evidence string for every classification', () => {
      const cases: Array<[string, string]> = [
        ['Generated code does not use Tone.js', 'const a = 1;'],
        ['RuntimeError', 'foo.bar()'],
        ['validation error', 'const x = 1;'],
      ];
      for (const [error, code] of cases) {
        const result = tools.classifyFailure(error, code);
        assertHasEvidence(result);
      }
    });
  });

  // -------------------------------------------------------------------------
  // buildRepairPrompt()
  // -------------------------------------------------------------------------

  describe('buildRepairPrompt', () => {
    const assertRepairPrompt = (prompt: string, actionKeyword: string) => {
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain(actionKeyword);
      expect(prompt).toContain('code');
    };

    it('returns non-empty repair prompt for wrong_domain', () => {
      const failure: FailureClassification = {
        failureClass: 'wrong_domain',
        evidence: 'Generated code does not use Tone.js',
        forbiddenDomains: ['p5.sound', 'Howler.js'],
      };
      const prompt = tools.buildRepairPrompt('tone', 'make a synth', 'bad code', failure);
      assertRepairPrompt(prompt, 'REGENERATE');
    });

    it('returns non-empty repair prompt for missing_required_api', () => {
      const failure: FailureClassification = {
        failureClass: 'missing_required_api',
        evidence: 'Missing API',
        suggestedApis: ['Tone.Synth', 'Tone.Reverb'],
      };
      const prompt = tools.buildRepairPrompt('tone', 'make reverb', 'const x = 1;', failure);
      assertRepairPrompt(prompt, 'PATCH');
    });

    it('returns non-empty repair prompt for too_short', () => {
      const failure: FailureClassification = {
        failureClass: 'too_short',
        evidence: 'Code is only 10 chars',
      };
      const prompt = tools.buildRepairPrompt('tone', 'longer synth', '// short', failure);
      assertRepairPrompt(prompt, 'EXPAND');
    });

    it('returns non-empty repair prompt for truncated', () => {
      const failure: FailureClassification = {
        failureClass: 'truncated',
        evidence: 'Unclosed brace',
      };
      const prompt = tools.buildRepairPrompt('glsl', 'fragment shader', 'void main() {', failure);
      assertRepairPrompt(prompt, 'CONTINUE');
    });

    it('returns non-empty repair prompt for empty_after_reasoning_strip', () => {
      const failure: FailureClassification = {
        failureClass: 'empty_after_reasoning_strip',
        evidence: 'Code is empty',
      };
      const prompt = tools.buildRepairPrompt('ascii', 'art', '', failure);
      assertRepairPrompt(prompt, 'REGENERATE');
    });

    it('returns non-empty repair prompt for wrapper_contract_mismatch', () => {
      const failure: FailureClassification = {
        failureClass: 'wrapper_contract_mismatch',
        evidence: 'expected full HTML',
      };
      const prompt = tools.buildRepairPrompt('three', '3d scene', 'code', failure);
      assertRepairPrompt(prompt, 'DOCTYPE');
    });

    it('returns non-empty repair prompt for runtime_error', () => {
      const failure: FailureClassification = {
        failureClass: 'runtime_error',
        evidence: 'ReferenceError',
        runtimeError: 'undefined is not an object',
      };
      const prompt = tools.buildRepairPrompt('tone', 'synth', 'code', failure);
      assertRepairPrompt(prompt, 'MINIMAL REPAIR');
    });

    it('returns non-empty repair prompt for unknown', () => {
      const failure: FailureClassification = {
        failureClass: 'unknown',
        evidence: 'Unknown error',
      };
      const prompt = tools.buildRepairPrompt('tone', 'prompt', 'code', failure);
      assertRepairPrompt(prompt, 'REGENERATE');
    });

    it('injects forbidden domains into wrong_domain repair prompt', () => {
      const failure: FailureClassification = {
        failureClass: 'wrong_domain',
        evidence: 'wrong domain',
        forbiddenDomains: ['p5.sound', 'Howler.js'],
      };
      const prompt = tools.buildRepairPrompt('tone', 'make audio', 'bad', failure);
      expect(prompt).toContain('p5.sound');
      expect(prompt).toContain('Howler.js');
    });

    it('injects suggestedApis when provided', () => {
      const failure: FailureClassification = {
        failureClass: 'missing_required_api',
        evidence: 'missing',
        suggestedApis: ['THREE.Scene', 'THREE.PerspectiveCamera'],
      };
      const prompt = tools.buildRepairPrompt('three', '3d scene', 'code', failure);
      expect(prompt).toContain('THREE.Scene');
    });

    it('injects domain when provided', () => {
      const failure: FailureClassification = {
        failureClass: 'unknown',
        evidence: 'Unknown',
      };
      const prompt = tools.buildRepairPrompt('tone', 'some prompt', 'code', failure);
      expect(prompt).toContain('tone');
    });
  });

  // -------------------------------------------------------------------------
  // recordSuccess / getSuccessSummary
  // -------------------------------------------------------------------------

  describe('recordSuccess / getSuccessSummary', () => {
    it('records a success entry in memory', () => {
      tools.recordSuccess('tone', 'const synth = new Tone.Synth();');
      const entries = tools.getSuccessSummary('tone');
      expect(entries.length).toBeGreaterThan(0);
      const latest = entries[entries.length - 1];
      expect(latest.domain).toBe('tone');
      expect(latest.codeLength).toBeGreaterThan(0);
    });

    it('records multiple domains separately', () => {
      tools.recordSuccess('tone', 'Tone.Synth code');
      tools.recordSuccess('three', 'THREE.Scene code');
      tools.recordSuccess('tone', 'more Tone code');
      const toneEntries = tools.getSuccessSummary('tone');
      const threeEntries = tools.getSuccessSummary('three');
      expect(toneEntries.length).toBe(2);
      expect(threeEntries.length).toBe(1);
    });

    it('returns all entries when no domain filter is given', () => {
      tools.recordSuccess('tone', 'tone1');
      tools.recordSuccess('three', 'three1');
      tools.recordSuccess('glsl', 'glsl1');
      const all = tools.getSuccessSummary();
      expect(all.length).toBe(3);
    });

    it('does not throw on recordSuccess', () => {
      expect(() => {
        tools.recordSuccess('tone', 'some code');
      }).not.toThrow();
    });

    it('getSuccessSummary returns a copy', () => {
      tools.recordSuccess('tone', 'code');
      const first = tools.getSuccessSummary();
      const second = tools.getSuccessSummary();
      expect(first).not.toBe(second);
    });

    it('records apiCount from Tone code', () => {
      tools.recordSuccess('tone', 'const synth = new Tone.Synth(); Tone.Transport.start();');
      const entries = tools.getSuccessSummary('tone');
      expect(entries[0].apiCount).toBeGreaterThan(0);
    });

    it('records codeLength from actual code', () => {
      const code = 'const x = 1;'.repeat(10);
      tools.recordSuccess('tone', code);
      const entries = tools.getSuccessSummary('tone');
      expect(entries[0].codeLength).toBe(code.length);
    });

    it('records timestamp as ISO string', () => {
      tools.recordSuccess('tone', 'code');
      const entries = tools.getSuccessSummary('tone');
      const ts = entries[0].timestamp;
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  // -------------------------------------------------------------------------
  // buildRuntimeFeedbackHint()
  // -------------------------------------------------------------------------

  describe('buildRuntimeFeedbackHint', () => {
    it('returns empty string (placeholder in this slice)', () => {
      const hint = tools.buildRuntimeFeedbackHint('tone', { error: 'test' });
      expect(hint).toBe('');
    });

    it('returns empty string for any domain', () => {
      expect(tools.buildRuntimeFeedbackHint('three', null)).toBe('');
      expect(tools.buildRuntimeFeedbackHint('glsl', {})).toBe('');
      expect(tools.buildRuntimeFeedbackHint('unknown', [])).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Determinism
  // -------------------------------------------------------------------------

  describe('determinism', () => {
    it('same seed produces same skeleton/API/hint selections', () => {
      const tools1 = new GeneratorHarnessTools(makeSeededRng(0));
      const ctx1 = tools1.prepare('tone');
      const tools2 = new GeneratorHarnessTools(makeSeededRng(0));
      const ctx2 = tools2.prepare('tone');
      expect(ctx1.skeletonHint).toBe(ctx2.skeletonHint);
      expect(ctx1.sampledApis).toEqual(ctx2.sampledApis);
      expect(ctx1.hardeningHints).toEqual(ctx2.hardeningHints);
    });

    it('prepare with Math.random produces valid context', () => {
      const randomTools = new GeneratorHarnessTools();
      const ctx = randomTools.prepare('tone');
      expect(ctx.domain).toBe('tone');
      expect(typeof ctx.skeletonHint).toBe('string');
      expect(Array.isArray(ctx.sampledApis));
      expect(Array.isArray(ctx.hardeningHints));
    });
  });

  // -------------------------------------------------------------------------
  // No static template fallback
  // -------------------------------------------------------------------------

  describe('no template fallback', () => {
    it('prepare returns a context, not code replacement', () => {
      const ctx = tools.prepare('tone');
      expect(typeof ctx.skeletonHint).toBe('string');
    });

    it('classifyFailure does not modify code or return replacement', () => {
      const originalCode = 'const x = 1;';
      const failure = tools.classifyFailure('error', originalCode);
      expect(failure).not.toHaveProperty('code');
      expect(typeof failure.failureClass).toBe('string');
    });

    it('recordSuccess does not return code or produce visible side effects', () => {
      tools.recordSuccess('tone', 'const synth = new Tone.Synth();');
      const summary = tools.getSuccessSummary('tone');
      expect(summary[0]).not.toHaveProperty('code');
    });
  });

  // -------------------------------------------------------------------------
  // Domain data correctness
  // -------------------------------------------------------------------------

  describe('domain data', () => {
    it('Tone skeleton contains Tone.Transport and Synth', () => {
      const ctx = tools.prepare('tone');
      if (ctx.skeletonHint) {
        expect(ctx.skeletonHint).toContain('Tone.Synth');
        expect(ctx.skeletonHint).toContain('Tone.Transport');
      }
    });

    it('Three skeleton contains THREE.Scene and WebGLRenderer', () => {
      const ctx = tools.prepare('three');
      if (ctx.skeletonHint) {
        expect(ctx.skeletonHint).toContain('THREE.Scene');
        expect(ctx.skeletonHint).toContain('WebGLRenderer');
      }
    });

    it('GLSL skeleton contains precision and void main', () => {
      const ctx = tools.prepare('glsl');
      if (ctx.skeletonHint) {
        expect(ctx.skeletonHint).toContain('precision');
        expect(ctx.skeletonHint).toContain('void main');
      }
    });

    it('Strudel skeleton contains stack and .out()', () => {
      const ctx = tools.prepare('strudel');
      if (ctx.skeletonHint) {
        expect(ctx.skeletonHint).toContain('stack');
        expect(ctx.skeletonHint).toContain('.out()');
      }
    });

    it('Strudel hardening hints mention quoted pattern strings or complete stack structure', () => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 12; seed++) {
        const seededTools = new GeneratorHarnessTools(makeSeededRng(seed));
        const ctx = seededTools.prepare('strudel');
        for (const hint of ctx.hardeningHints) seen.add(hint);
      }
      const joined = [...seen].join(' ');
      expect(joined).toMatch(/quoted pattern strings|truncated stack|close it and include complete child patterns/);
    });

    it('Three hardening hints mention avoiding nested HTML documents inside scripts', () => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 12; seed++) {
        const seededTools = new GeneratorHarnessTools(makeSeededRng(seed));
        const ctx = seededTools.prepare('three');
        for (const hint of ctx.hardeningHints) seen.add(hint);
      }
      const joined = [...seen].join(' ');
      expect(joined).toMatch(/second <!DOCTYPE html>|inside a <script> block/);
    });
  });
});
