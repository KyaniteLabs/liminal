/**
 * KeyframeAnimation Tests - TDD Approach
 *
 * Tests for keyframe animation system with interpolation and easing.
 * Following RED-GREEN-REFACTOR TDD cycle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KeyframeAnimation,
  Keyframe,
  Animation,
  EasingFunction,
} from '../../../src/composition/KeyframeAnimation.js';
import { LayerConfig } from '../../../src/composition/types.js';

describe('KeyframeAnimation', () => {
  let animator: KeyframeAnimation;

  beforeEach(() => {
    animator = new KeyframeAnimation();
    // Define RAF globally for tests
    if (typeof global.requestAnimationFrame === 'undefined') {
      global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
        return setTimeout(() => cb(Date.now()), 16) as unknown as number;
      });
      global.cancelAnimationFrame = vi.fn((id: number) => {
        clearTimeout(id);
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAnimation', () => {
    it('should create an animation with valid keyframes', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);

      expect(animation.id).not.toBeNull();
      expect(animation.layerId).toBe('layer1');
      expect(animation.duration).toBe(1000);
      expect(animation.keyframes).toHaveLength(2);
      expect(animation.loop).toBe(false);
      expect(animation.autoplay).toBe(false);
    });

    it('should create an animation with loop and autoplay options', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { scale: 0.5 } },
        { time: 1, properties: { scale: 1.5 } },
      ];

      const animation = animator.createAnimation('layer1', 2000, keyframes, {
        loop: true,
        autoplay: true,
      });

      expect(animation.loop).toBe(true);
      expect(animation.autoplay).toBe(true);
    });

    it('should sort keyframes by time', () => {
      const keyframes: Keyframe[] = [
        { time: 1, properties: { opacity: 1 } },
        { time: 0, properties: { opacity: 0 } },
        { time: 0.5, properties: { opacity: 0.5 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);

      expect(animation.keyframes[0].time).toBe(0);
      expect(animation.keyframes[1].time).toBe(0.5);
      expect(animation.keyframes[2].time).toBe(1);
    });

    it('should throw error for empty keyframes', () => {
      expect(() => animator.createAnimation('layer1', 1000, [])).toThrow(
        'At least 2 keyframes are required'
      );
    });

    it('should throw error for single keyframe', () => {
      const keyframes: Keyframe[] = [{ time: 0, properties: { opacity: 0 } }];

      expect(() => animator.createAnimation('layer1', 1000, keyframes)).toThrow(
        'At least 2 keyframes are required'
      );
    });

    it('should throw error for keyframe time outside 0-1 range', () => {
      const keyframes: Keyframe[] = [
        { time: -0.1, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      expect(() => animator.createAnimation('layer1', 1000, keyframes)).toThrow(
        'Keyframe time must be between 0 and 1'
      );
    });

    it('should throw error for keyframe time greater than 1', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1.5, properties: { opacity: 1 } },
      ];

      expect(() => animator.createAnimation('layer1', 1000, keyframes)).toThrow(
        'Keyframe time must be between 0 and 1'
      );
    });
  });

  describe('applyEasing', () => {
    it('should return same value for linear easing', () => {
      expect(animator.applyEasing(0, 'linear')).toBe(0);
      expect(animator.applyEasing(0.5, 'linear')).toBe(0.5);
      expect(animator.applyEasing(1, 'linear')).toBe(1);
    });

    it('should apply ease-in (acceleration)', () => {
      const t = 0.5;
      const eased = animator.applyEasing(t, 'ease-in');
      // ease-in should be less than linear at 0.5
      expect(eased).toBeLessThan(t);
      expect(eased).toBeGreaterThan(0);
    });

    it('should apply ease-out (deceleration)', () => {
      const t = 0.5;
      const eased = animator.applyEasing(t, 'ease-out');
      // ease-out should be greater than linear at 0.5
      expect(eased).toBeGreaterThan(t);
      expect(eased).toBeLessThan(1);
    });

    it('should apply ease-in-out (both)', () => {
      const t = 0.25;
      const eased = animator.applyEasing(t, 'ease-in-out');
      // At 0.25, ease-in-out should be less than linear
      expect(eased).toBeLessThan(t);
    });

    it('should apply bounce easing', () => {
      const eased = animator.applyEasing(1, 'bounce');
      // Bounce at t=1 should be 1
      expect(eased).toBeCloseTo(1, 5);
    });

    it('should apply elastic easing', () => {
      const eased = animator.applyEasing(0, 'elastic');
      // Elastic at t=0 should be 0
      expect(eased).toBeCloseTo(0, 5);
    });

    it('should apply back-in easing (overshoot)', () => {
      const eased = animator.applyEasing(0.5, 'back-in');
      // back-in should go negative initially
      expect(eased).not.toBeNull();
    });

    it('should apply back-out easing (overshoot)', () => {
      const eased = animator.applyEasing(0.5, 'back-out');
      expect(eased).not.toBeNull();
      expect(eased).toBeGreaterThan(0.5);
    });

    it('should throw error for unknown easing function', () => {
      expect(() => animator.applyEasing(0.5, 'unknown' as EasingFunction)).toThrow(
        'Unknown easing function: unknown'
      );
    });

    it('should handle edge cases for t=0 and t=1', () => {
      const easings: EasingFunction[] = [
        'linear',
        'ease',
        'ease-in',
        'ease-out',
        'ease-in-out',
        'bounce',
        'elastic',
        'back-in',
        'back-out',
      ];

      for (const easing of easings) {
        expect(animator.applyEasing(0, easing)).toBeCloseTo(0, 5);
        expect(animator.applyEasing(1, easing)).toBeCloseTo(1, 5);
      }
    });
  });

  describe('interpolate', () => {
    it('should interpolate between two keyframes', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result = animator.interpolate(animation, 0.5);

      expect(result.opacity).toBe(0.5);
    });

    it('should interpolate position', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { position: { x: 0, y: 0 } } },
        { time: 1, properties: { position: { x: 100, y: 200 } } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result = animator.interpolate(animation, 0.5);

      expect(result.position).toEqual({ x: 50, y: 100 });
    });

    it('should interpolate scale', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { scale: 1 } },
        { time: 1, properties: { scale: 2 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result = animator.interpolate(animation, 0.25);

      expect(result.scale).toBe(1.25);
    });

    it('should interpolate multiple properties', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0, scale: 0.5 } },
        { time: 1, properties: { opacity: 1, scale: 1.5 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result = animator.interpolate(animation, 0.5);

      expect(result.opacity).toBe(0.5);
      expect(result.scale).toBe(1);
    });

    it('should find correct keyframe segment', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 0.25, properties: { opacity: 0.25 } },
        { time: 0.75, properties: { opacity: 0.75 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);

      expect(animator.interpolate(animation, 0.1).opacity).toBe(0.1);
      expect(animator.interpolate(animation, 0.5).opacity).toBe(0.5);
      expect(animator.interpolate(animation, 0.9).opacity).toBe(0.9);
    });

    it('should apply easing from keyframe', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 }, easing: 'ease-in' },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result = animator.interpolate(animation, 0.5);

      // With ease-in, the value at 0.5 should be less than 0.5
      expect(result.opacity).toBeLessThan(0.5);
    });

    it('should return first keyframe at t=0', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0, scale: 0.5 } },
        { time: 1, properties: { opacity: 1, scale: 1.5 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result = animator.interpolate(animation, 0);

      expect(result.opacity).toBe(0);
      expect(result.scale).toBe(0.5);
    });

    it('should return last keyframe at t=1', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0, scale: 0.5 } },
        { time: 1, properties: { opacity: 1, scale: 1.5 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result = animator.interpolate(animation, 1);

      expect(result.opacity).toBe(1);
      expect(result.scale).toBe(1.5);
    });

    it('should handle time outside 0-1 range', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);

      expect(animator.interpolate(animation, -0.5).opacity).toBe(0);
      expect(animator.interpolate(animation, 1.5).opacity).toBe(1);
    });

    it('should handle partial position updates', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { position: { x: 0, y: 0 } } },
        { time: 1, properties: { position: { x: 100, y: 0 } } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result = animator.interpolate(animation, 0.5);

      expect(result.position).toEqual({ x: 50, y: 0 });
    });

    it('should handle zIndex interpolation', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { zIndex: 0 } },
        { time: 1, properties: { zIndex: 10 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result = animator.interpolate(animation, 0.5);

      expect(result.zIndex).toBe(5);
    });
  });

  describe('generateCSS', () => {
    it('should generate CSS @keyframes rule', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const css = animator.generateCSS(animation);

      expect(css).toContain('@keyframes');
      expect(css).toContain('0%');
      expect(css).toContain('100%');
      expect(css).toContain('opacity: 0');
      expect(css).toContain('opacity: 1');
    });

    it('should include animation properties', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0, scale: 0.5 } },
        { time: 1, properties: { opacity: 1, scale: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 2000, keyframes, {
        loop: true,
      });
      const css = animator.generateCSS(animation);

      expect(css).toContain('animation-name');
      expect(css).toContain('animation-duration: 2000ms');
      expect(css).toContain('animation-iteration-count: infinite');
    });

    it('should generate multiple keyframe percentages', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 0.25, properties: { opacity: 0.5 } },
        { time: 0.75, properties: { opacity: 0.8 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const css = animator.generateCSS(animation);

      expect(css).toContain('0%');
      expect(css).toContain('25%');
      expect(css).toContain('75%');
      expect(css).toContain('100%');
    });

    it('should handle position as transform', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { position: { x: 0, y: 0 } } },
        { time: 1, properties: { position: { x: 100, y: 200 } } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const css = animator.generateCSS(animation);

      expect(css).toContain('transform');
      expect(css).toContain('translate');
    });

    it('should handle scale as transform', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { scale: 0.5 } },
        { time: 1, properties: { scale: 1.5 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const css = animator.generateCSS(animation);

      expect(css).toContain('transform');
      expect(css).toContain('scale');
    });
  });

  describe('generateJS', () => {
    it('should generate JavaScript animation code', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const js = animator.generateJS(animation);

      expect(js).toContain('function');
      expect(js).toContain('requestAnimationFrame');
      expect(js).toContain('opacity');
    });

    it('should include easing function in JS output', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 }, easing: 'ease-in' },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const js = animator.generateJS(animation);

      expect(js).toContain('ease-in');
    });

    it('should include loop logic when enabled', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes, {
        loop: true,
      });
      const js = animator.generateJS(animation);

      expect(js).toMatch(/loop|shouldLoop/i);
    });

    it('should generate keyframe data structure', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0, scale: 0.5 } },
        { time: 0.5, properties: { opacity: 0.5, scale: 1 } },
        { time: 1, properties: { opacity: 1, scale: 1.5 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const js = animator.generateJS(animation);

      expect(js).toContain('keyframes');
      expect(js).toContain('0');
      expect(js).toContain('0.5');
      expect(js).toContain('1');
    });
  });

  describe('play/pause/stop', () => {
    it('should start playing animation', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      
      // Mock requestAnimationFrame
      const rafSpy = vi.spyOn(global, 'requestAnimationFrame').mockReturnValue(1);
      
      animator.play(animation);
      
      expect(rafSpy).toHaveBeenCalled();
      
      rafSpy.mockRestore();
    });

    it('should pause animation', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      
      const rafSpy = vi.spyOn(global, 'requestAnimationFrame').mockReturnValue(1);
      const cafSpy = vi.spyOn(global, 'cancelAnimationFrame');
      
      animator.play(animation);
      animator.pause(animation);
      
      expect(cafSpy).toHaveBeenCalled();
      
      rafSpy.mockRestore();
      cafSpy.mockRestore();
    });

    it('should stop animation and reset', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      
      const rafSpy = vi.spyOn(global, 'requestAnimationFrame').mockReturnValue(1);
      const cafSpy = vi.spyOn(global, 'cancelAnimationFrame');
      
      animator.play(animation);
      animator.stop(animation);
      
      expect(cafSpy).toHaveBeenCalled();
      
      rafSpy.mockRestore();
      cafSpy.mockRestore();
    });

    it('should handle play without browser APIs', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      
      // Should not throw even without RAF
      expect(() => animator.play(animation)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle keyframes with same time', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 0, properties: { opacity: 0.5 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      
      // Should use the last keyframe at time 0
      const result = animator.interpolate(animation, 0);
      expect(result.opacity).toBe(0.5);
    });

    it('should handle empty properties', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 0.5, properties: {} },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result = animator.interpolate(animation, 0.5);

      // Empty properties should not affect interpolation
      expect(result.opacity).not.toBeNull();
    });

    it('should handle blendMode interpolation', () => {
      // Blend mode shouldn't interpolate, should snap at keyframe
      const keyframes: Keyframe[] = [
        { time: 0, properties: { blendMode: 'normal' as const } },
        { time: 1, properties: { blendMode: 'multiply' as const } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      const result1 = animator.interpolate(animation, 0.4);
      const result2 = animator.interpolate(animation, 0.6);

      expect(result1.blendMode).toBe('normal');
      expect(result2.blendMode).toBe('multiply');
    });

    it('should handle rapid play/pause/stop calls', () => {
      const keyframes: Keyframe[] = [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ];

      const animation = animator.createAnimation('layer1', 1000, keyframes);
      
      const rafSpy = vi.spyOn(global, 'requestAnimationFrame').mockReturnValue(1);
      
      // Should not throw with rapid calls
      expect(() => {
        animator.play(animation);
        animator.pause(animation);
        animator.play(animation);
        animator.stop(animation);
        animator.play(animation);
      }).not.toThrow();
      
      rafSpy.mockRestore();
    });
  });
});
