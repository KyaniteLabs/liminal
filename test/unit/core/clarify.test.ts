// test/unit/core/clarify.test.ts
import { describe, it, expect } from 'vitest';
import type { ClarifyResult } from '../../../src/core/clarify.js';

describe('ClarifyResult', () => {
  it('has correct shape for clarification needed', () => {
    const result: ClarifyResult = {
      needsClarification: true,
      clarifyingQuestions: [
        {
          question: 'What domain?',
          options: ['P5.js sketch', 'Three.js 3D scene', 'HTML/CSS page', 'Hydra video synth'],
          default: 'P5.js sketch',
        },
      ],
      suggestions: ['p5', 'three', 'html', 'hydra'],
    };
    expect(result.needsClarification).toBe(true);
    expect(result.clarifyingQuestions[0].options.length).toBeGreaterThan(1);
  });

  it('has correct shape for generation result', () => {
    const result = {
      needsClarification: false,
      code: 'console.log("hello")',
    };
    expect(result.needsClarification).toBe(false);
    expect(result.code).toBeDefined();
  });
});
