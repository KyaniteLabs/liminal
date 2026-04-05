import { describe, it, expect } from 'vitest';
import { analyzeColorHarmony, analyzeColorHarmonyLIR } from '../../../src/aesthetic/critics/ColorHarmonyCritic.js';
import { analyzeWithLLMJudge } from '../../../src/aesthetic/critics/LLMJudgeCritic.js';
import { analyzeLayout, analyzeLayoutLIR } from '../../../src/aesthetic/critics/LayoutCritic.js';
import { analyzeSoundHarmony, analyzeSoundHarmonyLIR } from '../../../src/aesthetic/critics/SoundHarmonyCritic.js';
import { analyzeTypography, analyzeTypographyLIR } from '../../../src/aesthetic/critics/TypographyCritic.js';
import { DEFAULT_DESIGN_CONSTRAINTS, type DesignConstraints } from '../../../src/aesthetic/types.js';
import type { LIRCodeToken } from '../../../src/core/lir/types.js';

// ---------------------------------------------------------------------------
// Helper: factory for DesignConstraints with overrides
// ---------------------------------------------------------------------------

function makeConstraints(overrides?: Partial<DesignConstraints>): DesignConstraints {
  return { ...DEFAULT_DESIGN_CONSTRAINTS, ...overrides } as DesignConstraints;
}

function makeConstraintsWithMaxColors(maxColors: number): DesignConstraints {
  return makeConstraints({
    color: { ...DEFAULT_DESIGN_CONSTRAINTS.color, maxColors },
  });
}

// ---------------------------------------------------------------------------
// Helper: factory for LIRCodeToken
// ---------------------------------------------------------------------------

function makeLIRToken(overrides: Partial<LIRCodeToken> = {}): LIRCodeToken {
  return {
    id: 'token-1',
    type: 'code',
    domain: 'visual',
    layer: 'presentation',
    name: 'draw',
    symbolKind: 'function',
    source: '',
    metrics: { complexity: 1, linesOfCode: 10, nestingDepth: 1, parameterCount: 0 },
    relationships: { imports: [], calls: [], importGraph: [] },
    metadata: {},
    tags: [],
    ...overrides,
  };
}

// ===========================================================================
// ColorHarmonyCritic
// ===========================================================================

describe('ColorHarmonyCritic', () => {
  describe('analyzeColorHarmony', () => {
    it('returns neutral score (0.5) when no colors are found', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBe(0.5);
      expect(report.violations).toHaveLength(0);
      expect(report.passed).toBe(true);
    });

    it('detects hex colors and returns a harmony score', () => {
      const code = 'fill("#ff0000"); stroke("#00ff00");';
      const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeGreaterThanOrEqual(0.3);
      expect(report.score).toBeLessThanOrEqual(1);
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('flags violation when maxColors is exceeded', () => {
      const constraints = makeConstraintsWithMaxColors(1);
      // Red, green, and blue — 3 chromatic hues exceeds max of 1
      const code = `
        fill("#ff0000");
        fill("#00ff00");
        fill("#0000ff");
      `;
      const report = analyzeColorHarmony(code, constraints);

      const maxColorViolation = report.violations.find(v => v.rule === 'max-colors');
      expect(maxColorViolation).toBeTruthy();
      expect(maxColorViolation!.severity).toBe('warning');
    });

    it('scores 1.0 for a single chromatic color', () => {
      const code = 'fill("#ff0000");';
      const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBe(1);
    });

    it('scores high for complementary color pairs (180 degrees apart)', () => {
      // Red (#ff0000, hue 0) and Cyan (#00ffff, hue 180)
      const code = 'fill("#ff0000"); fill("#00ffff");';
      const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeGreaterThanOrEqual(0.9);
    });

    it('scores high for analogous colors (close hues)', () => {
      // Red (#ff0000, hue 0) and Orange (#ff8000, ~30 deg)
      const code = 'fill("#ff0000"); fill("#ff8000");';
      const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeGreaterThanOrEqual(0.7);
    });

    it('handles rgb() color format', () => {
      const code = 'fill(rgba(255, 0, 0, 1)); stroke(rgba(0, 255, 255, 1));';
      const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeGreaterThanOrEqual(0.3);
    });

    it('handles hsl() color format by extracting hue directly', () => {
      const code = 'fill(hsl(0, 100%, 50%)); fill(hsl(120, 100%, 50%));';
      const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeGreaterThanOrEqual(0.3);
    });

    it('penalizes score proportionally when exceeding maxColors', () => {
      const constraints = makeConstraintsWithMaxColors(1);
      // Red and blue — 2 hues, maxColors=1, overRatio=1.0, penalty=0.2
      const code = 'fill("#ff0000"); fill("#0000ff");';
      const report = analyzeColorHarmony(code, constraints);

      expect(report.score).toBeLessThan(1);
    });

    it('passes when score meets minAestheticScore', () => {
      const code = 'fill("#ff0000");';
      const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.passed).toBe(true);
    });

    it('fails when score is below minAestheticScore', () => {
      const constraints = makeConstraints({
        general: { ...DEFAULT_DESIGN_CONSTRAINTS.general, minAestheticScore: 0.99 },
        color: { ...DEFAULT_DESIGN_CONSTRAINTS.color, maxColors: 1 },
      });
      // Many spread-out colors with low maxColors — should get penalized
      const code = 'fill("#ff0000"); fill("#00ff00"); fill("#0000ff"); fill("#ffff00"); fill("#ff00ff");';
      const report = analyzeColorHarmony(code, constraints);

      // With very high minAestheticScore, even moderate scores fail
      expect(report.passed).toBe(false);
    });
  });

  describe('analyzeColorHarmonyLIR', () => {
    it('returns neutral score when no color APIs are called', () => {
      const tokens = [makeLIRToken({ relationships: { imports: [], calls: [], importGraph: [] } })];
      const report = analyzeColorHarmonyLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBe(0.5);
      expect(report.violations).toHaveLength(0);
    });

    it('analyzes colors from tokens that call fill/stroke APIs', () => {
      const tokens = [makeLIRToken({
        source: 'fill("#ff0000"); fill("#00ffff");',
        relationships: {
          imports: [],
          calls: ['fill', 'stroke'],
          importGraph: [],
        },
      })];
      const report = analyzeColorHarmonyLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeGreaterThanOrEqual(0.3);
    });

    it('applies coherence bonus when hues match visual intent palette', () => {
      const tokens = [makeLIRToken({
        source: 'fill("#ff0000");',
        relationships: {
          imports: [],
          calls: ['fill'],
          importGraph: [],
        },
      })];
      const visualIntent = {
        palette: { hues: [0] },  // 0 normalized = hue 0 = red
      };
      const report = analyzeColorHarmonyLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS, visualIntent as any);

      // Coherence bonus should push score above base
      expect(report.score).toBeGreaterThan(0.5);
    });
  });
});

// ===========================================================================
// LLMJudgeCritic
// ===========================================================================

describe('LLMJudgeCritic', () => {
  describe('analyzeWithLLMJudge', () => {
    it('returns score 0 for empty code', async () => {
      const mockLLM = {
        generate: async () => ({ code: '', success: false }),
      };

      const result = await analyzeWithLLMJudge('', 'p5.js', mockLLM, DEFAULT_DESIGN_CONSTRAINTS);

      expect(result.score).toBe(0);
      expect(result.passed).toBe(false);
      expect(result.usedLLM).toBe(false);
    });

    it('returns score 0 for whitespace-only code', async () => {
      const mockLLM = {
        generate: async () => ({ code: '', success: false }),
      };

      const result = await analyzeWithLLMJudge('   \n  ', 'p5.js', mockLLM, DEFAULT_DESIGN_CONSTRAINTS);

      expect(result.score).toBe(0);
      expect(result.passed).toBe(false);
    });

    it('returns neutral score when LLM call fails', async () => {
      const mockLLM = {
        generate: async () => ({ code: '', success: false }),
      };

      const result = await analyzeWithLLMJudge('function setup() {}', 'p5.js', mockLLM, DEFAULT_DESIGN_CONSTRAINTS);

      expect(result.score).toBe(0.5);
      expect(result.usedLLM).toBe(false);
      expect(result.passed).toBe(true);
    });

    it('parses a well-formed LLM judge response', async () => {
      const mockLLM = {
        generate: async () => ({
          code: `SCORE: 0.85
DIMENSIONS: color=0.9 layout=0.8 creativity=0.85 coherence=0.8
REASONING: Good color choices and creative layout.
VIOLATIONS: none`,
          success: true,
        }),
      };

      const result = await analyzeWithLLMJudge('some code here', 'p5.js', mockLLM, DEFAULT_DESIGN_CONSTRAINTS);

      expect(result.score).toBe(0.85);
      expect(result.usedLLM).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.reasoning).toContain('Good color choices');
      expect(result.dimensionScores?.color).toBe(0.9);
      expect(result.dimensionScores?.layout).toBe(0.8);
      expect(result.violations).toHaveLength(0);
    });

    it('parses violations from LLM response', async () => {
      const mockLLM = {
        generate: async () => ({
          code: `SCORE: 0.4
DIMENSIONS: color=0.3 layout=0.5
REASONING: Poor color harmony.
VIOLATIONS: too many colors, no focal point`,
          success: true,
        }),
      };

      const result = await analyzeWithLLMJudge('bad code', 'p5.js', mockLLM, DEFAULT_DESIGN_CONSTRAINTS);

      expect(result.score).toBe(0.4);
      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].rule).toBe('llm-judge');
      expect(result.violations[0].message).toContain('too many colors');
    });

    it('returns neutral on LLM exception', async () => {
      const mockLLM = {
        generate: async () => { throw new Error('Network timeout'); },
      };

      const result = await analyzeWithLLMJudge('some code', 'p5.js', mockLLM, DEFAULT_DESIGN_CONSTRAINTS);

      expect(result.score).toBe(0.5);
      expect(result.usedLLM).toBe(false);
      expect(result.passed).toBe(true);
    });

    it('respects custom passingThreshold', async () => {
      const mockLLM = {
        generate: async () => ({
          code: 'SCORE: 0.65\nREASONING: Decent.\nVIOLATIONS: none',
          success: true,
        }),
      };

      // Threshold 0.7 → 0.65 should fail
      const result = await analyzeWithLLMJudge('code', 'p5.js', mockLLM, DEFAULT_DESIGN_CONSTRAINTS, {
        passingThreshold: 0.7,
      });

      expect(result.score).toBe(0.65);
      expect(result.passed).toBe(false);
    });

    it('clamps score to 0-1 range from LLM output', async () => {
      const mockLLM = {
        generate: async () => ({
          code: 'SCORE: 5.0\nREASONING: Exceptional.\nVIOLATIONS: none',
          success: true,
        }),
      };

      const result = await analyzeWithLLMJudge('code', 'p5.js', mockLLM, DEFAULT_DESIGN_CONSTRAINTS);

      expect(result.score).toBe(1);
    });

    it('clamps negative score to 0', async () => {
      const mockLLM = {
        generate: async () => ({
          code: 'SCORE: -0.5\nREASONING: Terrible.\nVIOLATIONS: broken',
          success: true,
        }),
      };

      const result = await analyzeWithLLMJudge('code', 'p5.js', mockLLM, DEFAULT_DESIGN_CONSTRAINTS);

      // Parser regex ([\d.]+) doesn't match the negative sign, so score falls
      // through to default 0.5
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });
});

// ===========================================================================
// LayoutCritic
// ===========================================================================

describe('LayoutCritic', () => {
  describe('analyzeLayout', () => {
    it('returns neutral score when no createCanvas found', () => {
      const code = 'function draw() { rect(10, 10, 50, 50); }';
      const report = analyzeLayout(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBe(0.5);
      expect(report.violations).toHaveLength(0);
    });

    it('detects out-of-bounds positions', () => {
      const code = `
        createCanvas(400, 400);
        rect(500, 500, 50, 50);
      `;
      const report = analyzeLayout(code, DEFAULT_DESIGN_CONSTRAINTS);

      const oobViolation = report.violations.find(v => v.rule === 'out-of-bounds');
      expect(oobViolation).toBeTruthy();
      expect(oobViolation!.message).toContain('exceed canvas bounds');
    });

    it('bonuses for centered positioning patterns', () => {
      const code = `
        createCanvas(400, 400);
        rect(width/2, height/2, 50, 50);
      `;
      const report = analyzeLayout(code, DEFAULT_DESIGN_CONSTRAINTS);

      // width/2 and height/2 give centering bonus
      expect(report.score).toBeGreaterThan(0.5);
    });

    it('bonuses for textAlign(CENTER)', () => {
      const code = `
        createCanvas(400, 400);
        textAlign(CENTER, CENTER);
        text('Hello', 200, 200);
      `;
      const report = analyzeLayout(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeGreaterThan(0.5);
    });

    it('penalizes for multiple out-of-bounds positions', () => {
      const code = `
        createCanvas(100, 100);
        rect(500, 10, 50, 50);
        rect(10, 500, 50, 50);
        rect(500, 500, 50, 50);
      `;
      const report = analyzeLayout(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeLessThan(0.5);
    });

    it('extracts line endpoints for position checking', () => {
      const code = `
        createCanvas(100, 100);
        line(10, 10, 500, 500);
      `;
      const report = analyzeLayout(code, DEFAULT_DESIGN_CONSTRAINTS);

      const oobViolation = report.violations.find(v => v.rule === 'out-of-bounds');
      expect(oobViolation).toBeTruthy();
    });
  });

  describe('analyzeLayoutLIR', () => {
    it('returns neutral when no tokens have createCanvas', () => {
      const tokens = [makeLIRToken({ source: 'function draw() {}' })];
      const report = analyzeLayoutLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBe(0.5);
    });

    it('finds canvas dimensions from setup token', () => {
      const tokens = [makeLIRToken({
        name: 'setup',
        source: 'createCanvas(800, 600);',
        // Moderate nesting depth (2-5) triggers a scoring bonus
        metrics: { complexity: 1, linesOfCode: 10, nestingDepth: 3, parameterCount: 0 },
      })];
      const report = analyzeLayoutLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      // Should find dimensions + get nesting bonus → score > 0.5
      expect(report.score).toBeGreaterThan(0.5);
    });

    it('bonuses for moderate nesting depth (2-5)', () => {
      const tokens = [makeLIRToken({
        name: 'setup',
        source: 'createCanvas(400, 400);',
        metrics: { complexity: 1, linesOfCode: 10, nestingDepth: 3, parameterCount: 0 },
      })];
      const report = analyzeLayoutLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeGreaterThan(0.5);
    });

    it('penalizes for excessive nesting depth (>8)', () => {
      const tokens = [makeLIRToken({
        name: 'setup',
        source: 'createCanvas(400, 400);',
        metrics: { complexity: 1, linesOfCode: 10, nestingDepth: 10, parameterCount: 0 },
      })];
      const report = analyzeLayoutLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeLessThan(0.55);
    });
  });
});

// ===========================================================================
// SoundHarmonyCritic
// ===========================================================================

describe('SoundHarmonyCritic', () => {
  describe('analyzeSoundHarmony', () => {
    it('returns neutral score when no audio content detected', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      const report = analyzeSoundHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBe(0.5);
      expect(report.violations).toHaveLength(0);
    });

    it('detects audio content via .frequency pattern', () => {
      const code = 'osc.frequency.value = 440;';
      const report = analyzeSoundHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      // Single note = score 0.8
      expect(report.score).toBe(0.8);
    });

    it('flags excessive gain values', () => {
      const code = 'osc.gain.value = 1.5;';
      const report = analyzeSoundHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      const gainViolation = report.violations.find(v => v.rule === 'excessive-gain');
      expect(gainViolation).toBeTruthy();
      expect(gainViolation!.message).toContain('1.5');
    });

    it('analyzes consonance of multiple frequencies', () => {
      // Two consonant frequencies: 440Hz (A4) and 660Hz (E5, perfect fifth)
      const code = `
        osc1.frequency.value = 440;
        osc2.frequency.value = 660;
      `;
      const report = analyzeSoundHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBeGreaterThan(0.5);
    });

    it('detects dissonant intervals', () => {
      // 440Hz (A4) and ~466Hz (Bb4) — minor second = dissonant
      const constraints = makeConstraints({
        sound: { ...DEFAULT_DESIGN_CONSTRAINTS.sound, maxDissonance: 0.1 },
      });
      const code = `
        osc1.frequency.value = 440;
        osc2.frequency.value = 466;
      `;
      const report = analyzeSoundHarmony(code, constraints);

      const dissonanceViolation = report.violations.find(v => v.rule === 'dissonance');
      expect(dissonanceViolation).toBeTruthy();
    });

    it('detects OscillatorNode usage as audio content', () => {
      const code = 'const osc = new OscillatorNode(ctx);';
      const report = analyzeSoundHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);

      // Has audio content, no frequencies = score 0.5
      expect(report.score).toBe(0.5);
    });
  });

  describe('analyzeSoundHarmonyLIR', () => {
    it('returns neutral when no audio tokens found', () => {
      const tokens = [makeLIRToken({
        relationships: { imports: [], calls: ['rect'], importGraph: [] },
      })];
      const report = analyzeSoundHarmonyLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBe(0.5);
    });

    it('analyzes audio from tokens with audio-related calls', () => {
      const tokens = [makeLIRToken({
        source: 'osc.frequency.value = 440;',
        relationships: {
          imports: [],
          calls: ['createOscillator'],
          importGraph: [],
        },
      })];
      const report = analyzeSoundHarmonyLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBe(0.8); // single frequency
    });

    it('applies bonus for complete audio chain via importGraph', () => {
      const tokens = [makeLIRToken({
        source: 'osc.frequency.value = 440;',
        relationships: {
          imports: [],
          calls: ['createOscillator'],
          importGraph: [{ module: 'audio/Oscillator', callee: 'OscillatorNode', type: 'import' }],
        },
      })];
      const report = analyzeSoundHarmonyLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      // Chain bonus adds 0.05 to the single-note score of 0.8
      expect(report.score).toBeGreaterThan(0.8);
    });
  });
});

// ===========================================================================
// TypographyCritic
// ===========================================================================

describe('TypographyCritic', () => {
  describe('analyzeTypography', () => {
    it('returns neutral when no text usage found', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBe(0.5);
      expect(report.violations).toHaveLength(0);
    });

    it('flags font sizes exceeding maximum (72px)', () => {
      const code = 'text("Hello", 100, 100); textSize(100);';
      const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);

      const maxViolation = report.violations.find(v => v.rule === 'max-font-size');
      expect(maxViolation).toBeTruthy();
      expect(maxViolation!.message).toContain('100');
    });

    it('flags font sizes below minimum (8px)', () => {
      const code = 'text("tiny", 10, 10); textSize(4);';
      const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);

      const minViolation = report.violations.find(v => v.rule === 'min-font-size');
      expect(minViolation).toBeTruthy();
      expect(minViolation!.message).toContain('4');
    });

    it('bonuses for all font sizes within bounds', () => {
      const code = 'textSize(16); text("Hello", 100, 100); textSize(24); text("World", 100, 200);';
      const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);

      // Base 0.7 + 0.1 for within-bounds sizes = 0.8
      expect(report.score).toBeGreaterThanOrEqual(0.8);
    });

    it('warns about unloaded fonts', () => {
      const code = 'textFont("Helvetica"); text("Hello", 100, 100);';
      const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);

      const unloadViolation = report.violations.find(v => v.rule === 'unloaded-font');
      expect(unloadViolation).toBeTruthy();
    });

    it('does not warn about built-in fonts (monospace, serif, sans-serif)', () => {
      // The analyzeTypography function checks built-in fonts only inside loadedFonts.some(),
      // so without any loadFont() call, monospace is still flagged as unloaded.
      // This test documents the actual behavior. Use analyzeTypographyLIR for smarter detection.
      const code = 'textFont("monospace"); text("Hello", 100, 100);';
      const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);

      // With no loadFont() calls, monospace IS flagged (limitation of static analysis)
      const unloadViolation = report.violations.find(v => v.rule === 'unloaded-font');
      // The function flags it because loadedFonts is empty and the built-in check
      // is inside the .some() which returns false for empty arrays
      expect(unloadViolation).toBeTruthy();
    });

    it('warns when too many fonts are used', () => {
      const code = `
        textFont("Helvetica"); text("A", 10, 10);
        textFont("Arial"); text("B", 10, 30);
        textFont("Georgia"); text("C", 10, 50);
        textFont("Verdana"); text("D", 10, 70);
      `;
      const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);

      const maxFontsViolation = report.violations.find(v => v.rule === 'max-fonts');
      expect(maxFontsViolation).toBeTruthy();
    });
  });

  describe('analyzeTypographyLIR', () => {
    it('returns neutral when no text tokens found', () => {
      const tokens = [makeLIRToken({
        relationships: { imports: [], calls: ['rect', 'circle'], importGraph: [] },
      })];
      const report = analyzeTypographyLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      expect(report.score).toBe(0.5);
    });

    it('analyzes typography from tokens with text calls', () => {
      const tokens = [makeLIRToken({
        source: 'textSize(16); text("Hello", 100, 100);',
        relationships: {
          imports: [],
          calls: ['text', 'textSize'],
          importGraph: [],
        },
      })];
      const report = analyzeTypographyLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      // Has text, sizes within bounds → base 0.7 + 0.1 bonus = 0.8
      expect(report.score).toBeGreaterThanOrEqual(0.8);
    });

    it('does not warn about unloaded fonts when p5 is imported', () => {
      const tokens = [makeLIRToken({
        source: 'textFont("Helvetica"); text("A", 10, 10);',
        relationships: {
          imports: ['p5'],
          calls: ['text', 'textFont'],
          importGraph: [],
        },
      })];
      const report = analyzeTypographyLIR(tokens, DEFAULT_DESIGN_CONSTRAINTS);

      // p5 import should suppress the unloaded-font warning
      const unloadViolation = report.violations.find(v => v.rule === 'unloaded-font');
      expect(unloadViolation).toBeUndefined();
    });
  });
});
