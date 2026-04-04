import { describe, it, expect } from 'vitest';
/**
 * Sandbox tests - Safe execution of p5.js code in isolated environment
 *
 * TDD: runInSandbox(validP5Code) completes without escape;
 *      runInSandbox('while(true){}') times out.
 */

import { runInSandbox } from '../../src/sandbox/index.js';

const VALID_P5_CODE = `
function setup() {
  createCanvas(400, 400);
  background(220);
}
function draw() {
  ellipse(200, 200, 50, 50);
  noLoop();
}
`;

describe.skipIf(process.env.CI)('Sandbox runInSandbox', () => {
  describe('valid p5 sketch', () => {
    it('completes with completed: true and no host escape', async () => {
      const result = await runInSandbox(VALID_P5_CODE);

      expect(result.completed).toBe(true);
      expect(result.error).toBeUndefined();
      // No require/process in browser; sketch runs in isolated page
    }, 45000);

    it('accepts custom timeoutMs', async () => {
      const result = await runInSandbox(VALID_P5_CODE, { timeoutMs: 20000 });
      expect(result.completed).toBe(true);
    }, 25000);
  });

  describe('escape attempts (no Node/fs or process)', () => {
    it('code containing require("fs") does not escape sandbox', async () => {
      const code = `function setup(){ try { require('fs'); } catch(e) {} createCanvas(100,100); noLoop(); } function draw(){}`;
      const result = await runInSandbox(code, { timeoutMs: 10000 });
      expect(result).toHaveProperty('completed');
      // In browser require is undefined; host process must still be running
    }, 15000);

    it('code containing process.exit does not kill host', async () => {
      const code = `function setup(){ if (typeof process !== 'undefined') process.exit(1); createCanvas(100,100); noLoop(); } function draw(){}`;
      const result = await runInSandbox(code, { timeoutMs: 10000 });
      expect(result).toHaveProperty('completed');
      // process is undefined in browser; host must still be running (test completes)
    }, 15000);
  });

  describe('timeout', () => {
    it('infinite loop times out and returns completed: false', async () => {
      const result = await runInSandbox('while(true){}', { timeoutMs: 5000 });

      expect(result.completed).toBe(false);
      expect(result.error).toBeDefined();
      expect(String(result.error)).toMatch(/timeout|Timeout|exceeded/i);
    }, 20000);
  });
});
