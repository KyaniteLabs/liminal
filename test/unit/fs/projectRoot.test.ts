import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveSinterProjectRoot } from '../../../src/fs/projectRoot.js';

describe('resolveSinterProjectRoot', () => {
  // The global test setup sets SINTER_PROJECT_ROOT, so snapshot and restore it
  // around each case to keep these assertions deterministic.
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.SINTER_PROJECT_ROOT;
  });

  afterEach(() => {
    if (saved !== undefined) {
      process.env.SINTER_PROJECT_ROOT = saved;
    } else {
      delete process.env.SINTER_PROJECT_ROOT;
    }
  });

  it('returns the SINTER_PROJECT_ROOT override verbatim when set', () => {
    process.env.SINTER_PROJECT_ROOT = '/tmp/some-sinter-root';
    expect(resolveSinterProjectRoot()).toBe('/tmp/some-sinter-root');
  });

  it('trims surrounding whitespace from the override', () => {
    process.env.SINTER_PROJECT_ROOT = '  /tmp/padded-root  ';
    expect(resolveSinterProjectRoot()).toBe('/tmp/padded-root');
  });

  it('falls back to process.cwd() when the override is unset', () => {
    delete process.env.SINTER_PROJECT_ROOT;
    expect(resolveSinterProjectRoot()).toBe(process.cwd());
  });

  it('falls back to process.cwd() when the override is empty', () => {
    process.env.SINTER_PROJECT_ROOT = '';
    expect(resolveSinterProjectRoot()).toBe(process.cwd());
  });

  it('falls back to process.cwd() when the override is only whitespace', () => {
    process.env.SINTER_PROJECT_ROOT = '   ';
    expect(resolveSinterProjectRoot()).toBe(process.cwd());
  });
});
