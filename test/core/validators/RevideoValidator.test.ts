import { describe, it, expect } from 'vitest';
import { RevideoValidator } from '../../../src/core/validators/RevideoValidator.js';

describe('RevideoValidator', () => {
  it('validates correct Revideo code', () => {
    const code = `import {makeScene, useTime} from '@revideo/core';
import {Circle} from '@revideo/2d';

export default makeScene(function* (view) {
  const time = useTime();
  view.add(<Circle width={100} fill="red" />);
  yield* time(2, 1);
});`;
    const result = RevideoValidator.validate(code);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails on empty code', () => {
    const result = RevideoValidator.validate('');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Code is empty');
  });

  it('fails when missing makeScene import', () => {
    const code = `import {Circle} from '@revideo/2d';
export default function() { return null; }`;
    const result = RevideoValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('makeScene'))).toBe(true);
  });

  it('fails when missing export default', () => {
    const code = `import {makeScene, useTime} from '@revideo/core';
const scene = makeScene(function* (view) { yield* time(1); });`;
    const result = RevideoValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('export default'))).toBe(true);
  });

  it('fails when missing useTime or createSignal', () => {
    const code = `import {makeScene} from '@revideo/core';
export default makeScene(function* (view) { view.add(null); });`;
    const result = RevideoValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('useTime') || e.includes('createSignal'))).toBe(true);
  });

  it('returns minimum size requirement', () => {
    expect(RevideoValidator.getMinSize()).toBe(400);
  });
});
