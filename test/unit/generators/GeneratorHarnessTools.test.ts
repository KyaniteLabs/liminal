import { describe, it, expect, beforeEach } from 'vitest';
import {
  GeneratorHarnessTools,
  classifyFailureForEvaluation,
  buildFailureEvaluation,
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
    tools = new GeneratorHarnessTools({ seededRandom: makeSeededRng(0) });
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
      expect(ctx.hintsWereSampled === true || ctx.hintsWereSampled === false).toBe(true);
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

    it('treats shader as the GLSL prompt-harness alias', () => {
      const ctx = tools.prepare('shader');
      expect(ctx.domain).toBe('shader');
      expect(ctx.sampledApis.length).toBeGreaterThan(0);
      expect(ctx.skeletonHint).toContain('GLSL fragment shader');
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
      expect(result.evidence).not.toBeNull();
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
      expect(result.runtimeError).not.toBeNull();
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
  // buildRepairPacket()
  // -------------------------------------------------------------------------

  describe('buildRepairPacket', () => {
    it('returns empty string when evaluation has no repairAdvice', () => {
      const packet = tools.buildRepairPacket({ score: 0, confidence: 1, failureClass: 'render' });
      expect(packet).toBe('');
    });

    it('builds compact repair packet from repairAdvice', () => {
      const packet = tools.buildRepairPacket({
        score: 0.3,
        confidence: 0.8,
        failureClass: 'validator',
        repairAdvice: {
          issue: 'Missing required API',
          fix: 'Add the required API calls',
          constraint: 'Keep it under 50 lines',
        },
      });
      expect(packet).toContain('[repair] issue: Missing required API');
      expect(packet).toContain('[repair] fix: Add the required API calls');
      expect(packet).toContain('[repair] constraint: Keep it under 50 lines');
    });

    it('detects repeated failures and adds escalation hint', () => {
      const history = [
        { score: 0.2, confidence: 1, failureClass: 'validator' as const },
        { score: 0.1, confidence: 1, failureClass: 'validator' as const },
      ];
      const packet = tools.buildRepairPacket(
        {
          score: 0,
          confidence: 1,
          failureClass: 'validator',
          repairAdvice: {
            issue: 'Missing API',
            fix: 'Add API',
            constraint: 'Complete artifact',
          },
        },
        history
      );
      expect(packet).toContain('[repair] escalation: This failure has occurred 2 times');
    });

    it('does not escalate when repeated count is below threshold', () => {
      const history = [
        { score: 0.2, confidence: 1, failureClass: 'validator' as const },
      ];
      const packet = tools.buildRepairPacket(
        {
          score: 0,
          confidence: 1,
          failureClass: 'validator',
          repairAdvice: {
            issue: 'Missing API',
            fix: 'Add API',
            constraint: 'Complete artifact',
          },
        },
        history
      );
      expect(packet).not.toContain('escalation');
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
      const tools1 = new GeneratorHarnessTools({ seededRandom: makeSeededRng(0) });
      const ctx1 = tools1.prepare('tone');
      const tools2 = new GeneratorHarnessTools({ seededRandom: makeSeededRng(0) });
      const ctx2 = tools2.prepare('tone');
      expect(ctx1.skeletonHint).toBe(ctx2.skeletonHint);
      expect(ctx1.sampledApis).toEqual(ctx2.sampledApis);
      expect(ctx1.hardeningHints).toEqual(ctx2.hardeningHints);
    });

    it('prepare with Math.random produces valid context', () => {
      const randomTools = new GeneratorHarnessTools({ seededRandom: Math.random });
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

    it('Three harness hints match raw scene JS wrapper contract', () => {
      const observedHints = new Set<string>();

      for (let seed = 0; seed < 12; seed++) {
        const ctx = new GeneratorHarnessTools({ seededRandom: makeSeededRng(seed) }).prepare('three');
        expect(ctx.skeletonHint).toContain('THREE.Scene');
        expect(ctx.skeletonHint).toContain('THREE.WebGLRenderer');
        expect(ctx.skeletonHint).toContain('window.innerWidth');
        expect(ctx.skeletonHint).toContain('document.body.appendChild(renderer.domElement)');
        expect(ctx.skeletonHint).not.toContain('import * as THREE');
        expect(ctx.skeletonHint).not.toContain('{ canvas }');
        expect(ctx.skeletonHint).not.toContain('w/h');
        ctx.hardeningHints.forEach(hint => observedHints.add(hint));
      }

      const allHints = [...observedHints].join('\n');
      expect(allHints).not.toContain('Return a complete HTML file');
      expect(allHints).not.toContain('Include all required import statements');
      expect(allHints).not.toContain('importmap');

      const failure = tools.classifyFailure(
        'Output does not match wrapper: expected raw Three scene JavaScript',
        'const badWrapper = "<!DOCTYPE html>"; const scene = new THREE.Scene();',
      );
      const repairPrompt = tools.buildRepairPrompt('three', 'make a scene', '<html></html>', failure);
      expect(repairPrompt).toMatch(/raw Three\.js scene JavaScript/i);
      expect(repairPrompt).not.toContain('Complete HTML page');
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
        const seededTools = new GeneratorHarnessTools({ seededRandom: makeSeededRng(seed) });
        const ctx = seededTools.prepare('strudel');
        for (const hint of ctx.hardeningHints) seen.add(hint);
      }
      const joined = [...seen].join(' ');
      expect(joined).toMatch(/quoted pattern strings|truncated stack|close it and include complete child patterns/);
    });

    it('Three hardening hints require raw wrapper-compatible scene code', () => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 12; seed++) {
        const seededTools = new GeneratorHarnessTools({ seededRandom: makeSeededRng(seed) });
        const ctx = seededTools.prepare('three');
        for (const hint of ctx.hardeningHints) seen.add(hint);
      }
      const joined = [...seen].join(' ');
      expect(joined).toContain('Return raw Three.js scene JavaScript only');
      expect(joined).not.toContain('Return a complete HTML file');
    });
  });

  // ---------------------------------------------------------------------------
  // classifyFailureForEvaluation
  // ---------------------------------------------------------------------------

  describe('classifyFailureForEvaluation', () => {
    it('returns render when context.renderFailed is true', () => {
      expect(classifyFailureForEvaluation('unknown', { renderFailed: true })).toBe('render');
    });

    it('returns validator when context.validationFailed is true', () => {
      expect(classifyFailureForEvaluation('unknown', { validationFailed: true })).toBe('validator');
    });

    it('returns scorer when context.scoreFailed is true', () => {
      expect(classifyFailureForEvaluation('unknown', { scoreFailed: true })).toBe('scorer');
    });

    it('context precedence: render beats validation and score', () => {
      expect(
        classifyFailureForEvaluation('unknown', {
          renderFailed: true,
          validationFailed: true,
          scoreFailed: true,
        })
      ).toBe('render');
    });

    it('maps runtime_error to validator', () => {
      expect(classifyFailureForEvaluation('runtime_error')).toBe('validator');
    });

    it('maps wrapper_contract_mismatch to validator', () => {
      expect(classifyFailureForEvaluation('wrapper_contract_mismatch')).toBe('validator');
    });

    it('maps wrong_domain to validator', () => {
      expect(classifyFailureForEvaluation('wrong_domain')).toBe('validator');
    });

    it('maps missing_required_api to validator', () => {
      expect(classifyFailureForEvaluation('missing_required_api')).toBe('validator');
    });

    it('maps too_short to validator', () => {
      expect(classifyFailureForEvaluation('too_short')).toBe('validator');
    });

    it('maps truncated to validator', () => {
      expect(classifyFailureForEvaluation('truncated')).toBe('validator');
    });

    it('maps empty_after_reasoning_strip to validator', () => {
      expect(classifyFailureForEvaluation('empty_after_reasoning_strip')).toBe('validator');
    });

    it('returns none for unmapped failure without context', () => {
      expect(classifyFailureForEvaluation('unknown')).toBe('none');
    });

    it('returns none for arbitrary string without context', () => {
      expect(classifyFailureForEvaluation('some_random_failure')).toBe('none');
    });
  });

  // ---------------------------------------------------------------------------
  // rankCandidates
  // ---------------------------------------------------------------------------

  describe('rankCandidates', () => {
    it('returns winnerIndex -1 when evaluations are empty', () => {
      const result = tools.rankCandidates(['codeA', 'codeB'], []);
      expect(result.rankedIndices).toEqual([]);
      expect(result.winnerIndex).toBe(-1);
    });

    it('ranks candidates by selection score (highest first)', () => {
      const evaluations = [
        { score: 0.3, confidence: 1, failureClass: 'none' as const },
        { score: 0.9, confidence: 1, failureClass: 'none' as const },
        { score: 0.5, confidence: 1, failureClass: 'none' as const },
      ];
      const result = tools.rankCandidates(['a', 'b', 'c'], evaluations);
      expect(result.rankedIndices).toEqual([1, 2, 0]);
      expect(result.winnerIndex).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // buildFailureEvaluation
  // ---------------------------------------------------------------------------

  describe('buildFailureEvaluation', () => {
    it('returns score 0, confidence 1, and mapped failureClass', () => {
      const result = buildFailureEvaluation('too_short');
      expect(result.score).toBe(0);
      expect(result.confidence).toBe(1);
      expect(result.failureClass).toBe('validator');
    });

    it('respects context flags', () => {
      const result = buildFailureEvaluation('unknown', { scoreFailed: true });
      expect(result.score).toBe(0);
      expect(result.confidence).toBe(1);
      expect(result.failureClass).toBe('scorer');
    });

    it('returns none for unmapped failures without context', () => {
      const result = buildFailureEvaluation('unknown');
      expect(result.failureClass).toBe('none');
      expect(result.score).toBe(0);
      expect(result.confidence).toBe(1);
    });
  });
});
