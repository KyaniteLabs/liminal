import { describe, it, expect } from 'vitest';
import { StrudelValidator } from '../../../src/core/validators/StrudelValidator.js';

describe('StrudelValidator', () => {
  describe('validate', () => {
    it('should validate valid Strudel code with s() pattern', () => {
      const code = `
$: s("bd sd")
$: s("hh*4")
$: note("c3 eb3 g3").s("sawtooth")
bpm(120)
      `;

      const result = StrudelValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid Strudel code with stack()', () => {
      const code = `
stack(
  s("bd*2, sd"),
  note("c3 eb3 g3 bb3").s("sawtooth"),
  s("hh*8").gain(0.5)
).slow(2)
      `;

      const result = StrudelValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid Strudel code with sound()', () => {
      const code = `
$: sound("bd sd cp")
$: note("c4 e4 g4")
      `;

      const result = StrudelValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject code without pattern functions', () => {
      const code = `
const x = 100;
console.log(x);
      `;

      const result = StrudelValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Strudel code must contain pattern functions: s(), note(), stack(), or sound()');
    });

    it('should reject empty code', () => {
      const result = StrudelValidator.validate('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should reject code with non-ASCII characters', () => {
      const code = `
$: s("鼓 鈸")
$: note("c3")
      `;

      const result = StrudelValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Strudel code contains non-ASCII characters');
    });

    it('should validate Strudel code with transformations', () => {
      const code = `
$: s("bd*4")
  .slow(2)
  .gain(0.8)
  .sometimes(x => x.rev())

$: note("c3 eb3 g3")
  .s("sawtooth")
  .decay(0.2)
      `;

      const result = StrudelValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unmatched parentheses', () => {
      const code = `
$: s("bd sd"
$: note("c3"
      `;

      const result = StrudelValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unmatched parentheses'))).toBe(true);
    });

    it('should validate complex Strudel composition', () => {
      const code = `
stack(
  s("bd*2").fast(2),
  note("<[c3 e3 g3] [a2 c3 e3]>")
    .s("triangle")
    .cutoff(800)
    .resonance(10),
  s("~ cp").gain(0.7)
)
.bpm(130)
      `;

      const result = StrudelValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept whitespace-only code as empty', () => {
      const result = StrudelValidator.validate('   \n\t  ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });
  });

  describe('getMinSize', () => {
    it('should return 100 bytes as minimum size', () => {
      expect(StrudelValidator.getMinSize()).toBe(100);
    });
  });
});
