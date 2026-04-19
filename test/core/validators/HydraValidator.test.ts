import { describe, it, expect } from 'vitest';
import { HydraValidator } from '../../../src/core/validators/HydraValidator.js';

describe('HydraValidator', () => {
  describe('validate', () => {
    it('should validate valid Hydra code with osc()', () => {
      const code = `osc(10, 0.1, 0.5).out()`;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid Hydra code with gradient()', () => {
      const code = `gradient(0.5).color(1, 0, 0).out()`;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid Hydra code with noise()', () => {
      const code = `noise(3, 0.1).color(0.5, 0.8, 1).out()`;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Hydra code with multiple outputs', () => {
      const code = `
osc(10).out(o0)
noise(5).out(o1)
gradient().out(o2)
solid().out(o3)
render()
      `;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Hydra code with src() and modulate()', () => {
      const code = `
s0.initCam()
src(s0).modulate(osc(5, 0.1)).out()
      `;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject code without .out()', () => {
      const code = `osc(10, 0.1, 0.5)`;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hydra code MUST end with .out() to render');
    });

    it('should reject code without source function', () => {
      const code = `.color(1, 0, 0).out()`;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hydra code should use a source function: osc(), src(), noise(), shape(), gradient(), solid(), voronoi()');
    });

    it('should reject empty code', () => {
      const result = HydraValidator.validate('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should reject code with invalid methods', () => {
      const code = `osc(10).sin(2).out()`;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hydra code contains invalid method: .sin( - use math functions differently in Hydra');
    });

    it('should reject code with .cos() method', () => {
      const code = `osc(10).cos(2).out()`;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hydra code contains invalid method: .cos( - use math functions differently in Hydra');
    });

    it('should reject runtime-unsupported hydra method aliases', () => {
      const result = HydraValidator.validate('osc(2).saturation(1.2).feedback(0.9).kaleidoscope(8).out()');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hydra code contains invalid method: .saturation( - use math functions differently in Hydra');
      expect(result.errors).toContain('Hydra code contains invalid method: .feedback( - use math functions differently in Hydra');
      expect(result.errors).toContain('Hydra code contains invalid method: .kaleidoscope( - use math functions differently in Hydra');
    });

    it('should reject p5-style loop calls', () => {
      const result = HydraValidator.validate('osc(2).out(); loop()');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hydra code contains invalid function: loop() - use Hydra chains and .out(), not p5-style loop control');
    });

    it('should validate complex Hydra composition', () => {
      const code = `
osc(60, 0.1, 0.8)
  .rotate(0.5)
  .scale(1.5)
  .color(1, 0.2, 0.5)
  .modulate(noise(3))
  .out()

shape(4, 0.5)
  .rotate(() => time * 0.1)
  .out(o1)

src(o0)
  .blend(src(o1))
  .out(o2)

render()
      `;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Hydra code with voronoi()', () => {
      const code = `voronoi(5, 0.3, 0.1).color(0.2, 0.8, 1).out()`;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Hydra code with shape()', () => {
      const code = `shape(3, 0.5, 0.01).color(1, 0.5, 0).repeat(3, 3).out()`;

      const result = HydraValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getMinSize', () => {
    it('should return 150 bytes as minimum size', () => {
      expect(HydraValidator.getMinSize()).toBe(150);
    });
  });
});
