import { describe, expect, it } from 'vitest';

import { RevideoValidator } from '../../../src/core/validators/RevideoValidator.js';

describe('RevideoValidator', () => {
  it('rejects p5.js contamination', () => {
    const result = RevideoValidator.validate(`
      function setup() { createCanvas(1920, 1080); }
      function draw() { background(0); }
    `);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Revideo code must not use p5.js APIs such as createCanvas, setup(), or draw()');
  });
});
