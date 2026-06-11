import { describe, it, expect } from 'vitest';
import { ASCIIValidator } from '../../../src/core/validators/ASCIIValidator.js';

describe('ASCIIValidator', () => {
  describe('validate', () => {
    it('should validate simple ASCII art', () => {
      const code = `
   ___
  /   \
 |  o  |
  \___/
      `;

      const result = ASCIIValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ASCII art with box drawing characters', () => {
      const code = `
┌─────────────┐
│  Hello      │
│  World!     │
└─────────────┘
      `;

      const result = ASCIIValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ASCII art with block characters', () => {
      const code = `
███████╗
██╔════╝
█████╗  
██╔══╝  
███████╗
╚══════╝
      `;

      const result = ASCIIValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ASCII art with arrows', () => {
      const code = `
    ↑
    |
←───┼───→
    |
    ↓
      `;

      const result = ASCIIValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty code', () => {
      const result = ASCIIValidator.validate('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should reject code with invalid Unicode characters', () => {
      const code = `
Hello 世界
こんにちは
      `;

      const result = ASCIIValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
    });

    it('should reject code with emoji', () => {
      const code = `
Hello 😀
World 🌍
      `;

      const result = ASCIIValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
    });

    it('should reject extreme aspect ratio', () => {
      const code = '████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████';

      const result = ASCIIValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('extreme aspect ratio'))).toBe(true);
    });

    it('should reject very minimal art (fewer than 3 non-empty lines)', () => {
      const code = `
   ___
  /   \\
      `;
      const result = ASCIIValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('too minimal') && e.includes('non-empty lines'))).toBe(true);
    });

    it('should validate ASCII art face', () => {
      const code = `
  _____
 / o o \
|   <   |
|  \_/  |
 \_____/
      `;

      const result = ASCIIValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ASCII art pattern', () => {
      const code = `
+----+----+----+
|    |    |    |
+----+----+----+
|    |    |    |
+----+----+----+
      `;

      const result = ASCIIValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('detectASCII', () => {
    it('should detect ASCII art', () => {
      const code = `
   ___
  /   \
 |  o  |
  \___/
      `;

      expect(ASCIIValidator.detectASCII(code)).toBe(true);
    });

    it('should not detect JavaScript code as ASCII art', () => {
      const code = `
function setup() {
  createCanvas(400, 400);
  background(220);
}
      `;

      expect(ASCIIValidator.detectASCII(code)).toBe(false);
    });

    it('should not detect GLSL code as ASCII art', () => {
      const code = `
void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
      `;

      expect(ASCIIValidator.detectASCII(code)).toBe(false);
    });

    it('should detect simple text art', () => {
      const code = `
+---+ +---+ +---+
| A | | B | | C |
+---+ +---+ +---+
      `;

      expect(ASCIIValidator.detectASCII(code)).toBe(true);
    });
  });

  describe('getMinSize', () => {
    it('should return 50 bytes as minimum size', () => {
      expect(ASCIIValidator.getMinSize()).toBe(50);
    });
  });

  describe('sanitize', () => {
    it('maps near-miss Unicode art glyphs to their allowed cousins (the recurring daemon failure class)', () => {
      // Observed live 2026-06-11: '\u25C8' (U+25C8), '\u25C9' (U+25C9), '\u25E1' (U+25E1) failed whole generations.
      expect(ASCIIValidator.sanitize('\u25C8\u25C9\u25E1\u25E0\u25C6\u25C7\u25CE')).toBe('\u2666\u25CF_-\u2666\u2666\u25CB');
      const art = ASCIIValidator.sanitize('  \u25C8\u25C8\u25C8  \n \u25C9   \u25C9 \n  \u25E1\u25E1\u25E1  ');
      expect(ASCIIValidator.validate(art).valid).toBe(true);
    });

    it('strips diacritics to base ASCII letters', () => {
      expect(ASCIIValidator.sanitize('caf\u00E9 ni\u00F1o')).toBe('cafe nino');
    });

    it('replaces unknown symbols with a single-width asterisk, preserving line lengths', () => {
      const line = 'a\u2728b\u26A1c';
      const out = ASCIIValidator.sanitize(line);
      expect(out).toBe('a*b*c');
      expect([...out].length).toBe([...line].length);
    });

    it('leaves allowed extended art characters untouched', () => {
      const art = '\u250C\u2500\u2510\n\u2502\u2588\u2502\n\u2514\u2500\u2518 \u2605 \u25CF';
      expect(ASCIIValidator.sanitize(art)).toBe(art);
      expect(ASCIIValidator.validate(ASCIIValidator.sanitize(art)).valid).toBe(true);
    });
  });
});
