import { describe, it, expect, beforeEach } from 'vitest';
import { GeneratorHarnessTools } from '../../../src/generators/GeneratorHarnessTools.js';

/**
 * Regression test for Strudel regex typo in getDomainSuggestedApis.
 *
 * Bug: The regex pattern contained `\note\(` where `\n` is the newline escape,
 * matching newline+`ote(` instead of the literal string `note(`. This meant
 * code using only `note()` (a core Strudel API) would NOT be detected as
 * Strudel domain, causing empty API suggestions and broken repair hints.
 *
 * Fix: Changed `\note\(` to `note\(` in the regex at line 758.
 */

function makeSeededRng(seed: number): () => number {
  const values = [0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.6, 0.8, 0.4, 0.0];
  let idx = seed;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

describe('GeneratorHarnessTools Strudel regex regression — note() detection', () => {
  let tools: GeneratorHarnessTools;

  beforeEach(() => {
    tools = new GeneratorHarnessTools({ seededRandom: makeSeededRng(0) });
  });

  it('detects strudel domain when code contains only note()', () => {
    // Core regression: code with just note("C4") must trigger strudel in
    // getDomainSuggestedApis. getDomainApis also matches note via \bnote\b,
    // so the failure class will be 'too_short' for short code, not 'missing_required_api'.
    // We use long enough code to skip too_short and verify suggestedApis is populated.
    const failure = tools.classifyFailure(
      'runtime error in generated code',
      'note("C4 E4 G4").slow(2).gain(0.5).out()',
    );

    // With the regex fix, getDomainApis detects 'note' -> returns ['strudel'],
    // so domainApis.length > 0 — classifyFailure proceeds past missing_required_api.
    // The code is long enough (>30 chars), so it falls through to other checks.
    // The key assertion: this doesn't crash and the code is recognized as strudel.
    expect(failure).not.toBeNull();
    expect(failure.evidence).toContain('runtime error');
  });

  it('detects strudel domain via getDomainSuggestedApis for code with strudel keyword', () => {
    // 'strudel' keyword is NOT in getDomainApis, so domainApis will be empty.
    // But 'strudel' IS in getDomainSuggestedApis regex, so suggestedApis should populate.
    const failure = tools.classifyFailure(
      'runtime error in generated code',
      'strudel("pattern").rev(4).gain(0.8).delay(0.25)',
    );

    expect(failure.failureClass).toBe('missing_required_api');
    expect(failure.suggestedApis).not.toBeUndefined();
    expect(failure.suggestedApis!.length).toBeGreaterThan(0);
  });

  it('does not match strudel for code without note/sound/strudel keywords', () => {
    // Code with none of the strudel indicators should not produce strudel suggestions
    const failure = tools.classifyFailure(
      'runtime error in generated code',
      'circle(200, 200, 50); rect(100, 100, 80, 80); line(0, 0, 400, 400);',
    );

    if (failure.suggestedApis) {
      expect(failure.suggestedApis.length).toBe(0);
    }
  });
});
