import { describe, it, expect } from 'vitest';
import { Compositor, CompositionLayer, CompositionSpec } from '../../../src/composite/Compositor.js';

describe('Compositor', () => {
  it('builds FFmpeg filter graph for two visual layers', () => {
    const compositor = new Compositor();
    const spec: CompositionSpec = {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 10,
      layers: [
        { type: 'video', source: '/bg.mp4', blend: 'normal', opacity: 1.0 },
        { type: 'video', source: '/overlay.mp4', blend: 'screen', opacity: 0.7 },
      ],
    };
    const filterGraph = compositor.buildFilterGraph(spec);
    expect(filterGraph).toContain('overlay');
  });

  it('builds FFmpeg args for visual + audio layers', () => {
    const compositor = new Compositor();
    const spec: CompositionSpec = {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 10,
      layers: [
        { type: 'video', source: '/visual.mp4', blend: 'normal', opacity: 1.0 },
        { type: 'audio', source: '/music.mp3', volume: 0.8 },
      ],
    };
    const args = compositor.buildCompositeArgs(spec, '/output.mp4');
    expect(args).toContain('-i');
    // Should have -i for each input
    expect(args.filter(a => a === '-i').length).toBeGreaterThanOrEqual(2);
  });

  it('validates spec requires at least one layer', () => {
    const compositor = new Compositor();
    expect(() => compositor.validateSpec({
      width: 1920, height: 1080, fps: 30, duration: 10, layers: [],
    })).toThrow('at least one layer');
  });

  it('validates spec width/height/fps/duration are positive', () => {
    const compositor = new Compositor();
    expect(() => compositor.validateSpec({
      width: 0, height: 1080, fps: 30, duration: 10, layers: [{ type: 'video', source: '/x.mp4' }],
    })).toThrow('positive');
  });

  it('generates Remotion multi-layer composition code', () => {
    const compositor = new Compositor();
    const spec: CompositionSpec = {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 10,
      layers: [
        { type: 'image', source: '/bg.png', blend: 'normal', opacity: 1.0 },
        { type: 'video', source: '/overlay.mp4', blend: 'screen', opacity: 0.7, x: 100, y: 50 },
      ],
    };
    const remotionCode = compositor.generateRemotionComposition(spec);
    expect(remotionCode).toContain('useCurrentFrame');
    expect(remotionCode).toContain('AbsoluteFill');
    expect(remotionCode).toContain('1920');
    expect(remotionCode).toContain('1080');
  });

  it('handles blend mode mapping to CSS mix-blend-mode', () => {
    const compositor = new Compositor();
    expect(compositor.blendToCSS('screen')).toBe('screen');
    expect(compositor.blendToCSS('multiply')).toBe('multiply');
    expect(compositor.blendToCSS('overlay')).toBe('overlay');
    expect(compositor.blendToCSS('normal')).toBe('normal');
    expect(compositor.blendToCSS('soft-light')).toBe('soft-light');
    expect(compositor.blendToCSS('difference')).toBe('difference');
  });
});
