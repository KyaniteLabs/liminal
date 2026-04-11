import { describe, it, expect, afterEach, test } from 'vitest';
/**
 * requestImprovement API tests.
 * When LLM is unconfigured, API returns template fallback; no sandbox or safety limits (other subagents).
 */

import { requestImprovement } from '../../src/improvement/requestImprovement.js';

const validP5Code = `function setup() {
  createCanvas(800, 600);
}
function draw() {
  background(220);
  ellipse(width/2, height/2, 50, 50);
}`;

describe('requestImprovement', () => {
  afterEach(() => {
    delete process.env.LIMINAL_LLM_API_KEY;
    delete process.env.ATELIER_LLM_API_KEY;
    delete process.env.ATELIER_LLM_BASE_URL;
  });

  test('requestImprovement(validP5Code) returns object with code string when unconfigured', async () => {
    const result = await requestImprovement(validP5Code);
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
    expect(typeof result.improved).toBe('boolean');
  });

  test('returned code is valid p5.js (contains setup and createCanvas)', async () => {
    const result = await requestImprovement(validP5Code);
    expect(result.code).toMatch(/function\s+setup\s*\(/);
    expect(result.code).toMatch(/createCanvas\s*\(/);
  });

  test('accepts optional state and still returns code', async () => {
    const result = await requestImprovement(validP5Code, {});
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
  });

  test('returns improved=false and error when LLM not configured', async () => {
    const result = await requestImprovement(validP5Code);
    expect(result.improved).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});
