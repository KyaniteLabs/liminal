import { describe, it, expect } from 'vitest';
import { promptToGeneratorParams } from '../../../src/utils/promptToGeneratorParams.js';

describe('promptToGeneratorParams', () => {
  it('returns default palette for empty prompt', () => {
    const result = promptToGeneratorParams('');
    expect(result.palette).toBe('default');
  });

  it('returns default palette for generic prompt', () => {
    const result = promptToGeneratorParams('something random');
    expect(result.palette).toBe('default');
  });

  it('detects cool palette from blue keywords', () => {
    expect(promptToGeneratorParams('a blue sky').palette).toBe('cool');
    expect(promptToGeneratorParams('deep ocean waves').palette).toBe('cool');
    expect(promptToGeneratorParams('cyan light').palette).toBe('cool');
    expect(promptToGeneratorParams('purple haze').palette).toBe('cool');
    expect(promptToGeneratorParams('cold winter').palette).toBe('cool');
  });

  it('detects warm palette from red/orange keywords', () => {
    expect(promptToGeneratorParams('red sunset').palette).toBe('warm');
    expect(promptToGeneratorParams('orange fire').palette).toBe('warm');
    expect(promptToGeneratorParams('yellow sun').palette).toBe('warm');
    expect(promptToGeneratorParams('warm evening').palette).toBe('warm');
    expect(promptToGeneratorParams('fire and flames').palette).toBe('warm');
  });

  it('detects monochrome palette from grayscale keywords', () => {
    expect(promptToGeneratorParams('black and white').palette).toBe('monochrome');
    expect(promptToGeneratorParams('gray tones').palette).toBe('monochrome');
    expect(promptToGeneratorParams('grey scale').palette).toBe('monochrome');
    expect(promptToGeneratorParams('monochrome pattern').palette).toBe('monochrome');
  });

  it('detects slow speed from calm keywords', () => {
    const result = promptToGeneratorParams('calm ocean');
    expect(result.speed).toBe(0.8);
    expect(result.timeStep).toBe(0.05);
  });

  it('detects slow speed from peaceful keyword', () => {
    const result = promptToGeneratorParams('peaceful morning');
    expect(result.speed).toBe(0.8);
  });

  it('detects slow speed from gentle keyword', () => {
    const result = promptToGeneratorParams('gentle breeze');
    expect(result.speed).toBe(0.8);
  });

  it('detects slow speed from slow keyword', () => {
    const result = promptToGeneratorParams('slow movement');
    expect(result.speed).toBe(0.8);
  });

  it('detects fast speed from fast keywords', () => {
    const result = promptToGeneratorParams('fast motion');
    expect(result.speed).toBe(4);
    expect(result.timeStep).toBe(0.2);
  });

  it('detects fast speed from rapid keyword', () => {
    const result = promptToGeneratorParams('rapid change');
    expect(result.speed).toBe(4);
  });

  it('detects fast speed from energetic keyword', () => {
    const result = promptToGeneratorParams('energetic dance');
    expect(result.speed).toBe(4);
  });

  it('detects flow field parameters', () => {
    const result = promptToGeneratorParams('flow field visualization');
    expect(result.particleCount).toBe(500);
    expect(result.scale).toBe(0.005);
    expect(result.trailAlpha).toBe(10);
  });

  it('detects particle flow parameters', () => {
    const result = promptToGeneratorParams('particles flow');
    expect(result.particleCount).toBe(500);
  });

  it('combines palette and speed detection', () => {
    const result = promptToGeneratorParams('calm blue ocean');
    expect(result.palette).toBe('cool');
    expect(result.speed).toBe(0.8);
  });

  it('combines warm palette with fast speed', () => {
    const result = promptToGeneratorParams('fast red fire');
    expect(result.palette).toBe('warm');
    expect(result.speed).toBe(4);
  });

  it('handles case-insensitive matching', () => {
    const result = promptToGeneratorParams('BLUE OCEAN FAST');
    expect(result.palette).toBe('cool');
    expect(result.speed).toBe(4);
  });

  it('converts non-string input to string', () => {
    const result = promptToGeneratorParams('42' as any);
    expect(result.palette).toBe('default');
  });
});
