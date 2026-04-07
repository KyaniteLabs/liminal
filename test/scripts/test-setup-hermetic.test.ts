import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('test/setup hermetic environment', () => {
  it('redirects HOME to a temporary test directory and provisions liminal dirs', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.LIMINAL_TEST).toBe('1');
    expect(process.env.HOME).toContain('liminal-test-home-');

    const home = process.env.HOME!;
    const liminalDir = path.join(home, '.liminal');

    expect(fs.existsSync(liminalDir)).toBe(true);
    expect(fs.existsSync(path.join(liminalDir, 'failures'))).toBe(true);
    expect(fs.existsSync(path.join(liminalDir, 'memory'))).toBe(true);
    expect(fs.existsSync(path.join(liminalDir, 'reasoning'))).toBe(true);
    expect(fs.existsSync(path.join(liminalDir, 'routing'))).toBe(true);
    expect(fs.existsSync(path.join(liminalDir, 'thinking-traces'))).toBe(true);
    expect(fs.existsSync(path.join(liminalDir, 'tool-telemetry'))).toBe(true);
  });

  it('clears live llm environment variables in the default test lane', () => {
    expect(process.env.LIMINAL_LLM_PROVIDER).toBeUndefined();
    expect(process.env.LIMINAL_LLM_API_KEY).toBeUndefined();
    expect(process.env.LIMINAL_LLM_BASE_URL).toBeUndefined();
    expect(process.env.LIMINAL_LLM_MODEL).toBeUndefined();
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
    expect(process.env.MINIMAX_API_KEY).toBeUndefined();
  });
});
