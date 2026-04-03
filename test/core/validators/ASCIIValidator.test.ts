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
});
