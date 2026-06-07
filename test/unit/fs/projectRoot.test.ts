import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveSinterProjectRoot } from '../../../src/fs/projectRoot.js';

describe('resolveSinterProjectRoot', () => {
  // The global test setup sets SINTER_PROJECT_ROOT, so snapshot and restore both
  // brand prefixes around each case to keep these assertions deterministic.
  let savedSinter: string | undefined;
  let savedLiminal: string | undefined;

  beforeEach(() => {
    savedSinter = process.env.SINTER_PROJECT_ROOT;
    savedLiminal = process.env.LIMINAL_PROJECT_ROOT;
    delete process.env.SINTER_PROJECT_ROOT;
    delete process.env.LIMINAL_PROJECT_ROOT;
  });

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value !== undefined) process.env[key] = value;
      else delete process.env[key];
    };
    restore('SINTER_PROJECT_ROOT', savedSinter);
    restore('LIMINAL_PROJECT_ROOT', savedLiminal);
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

  it('honors the legacy LIMINAL_PROJECT_ROOT when SINTER_PROJECT_ROOT is unset', () => {
    process.env.LIMINAL_PROJECT_ROOT = '/tmp/legacy-root';
    expect(resolveSinterProjectRoot()).toBe('/tmp/legacy-root');
  });

  it('prefers SINTER_PROJECT_ROOT over the legacy LIMINAL_PROJECT_ROOT', () => {
    process.env.SINTER_PROJECT_ROOT = '/tmp/canonical-root';
    process.env.LIMINAL_PROJECT_ROOT = '/tmp/legacy-root';
    expect(resolveSinterProjectRoot()).toBe('/tmp/canonical-root');
  });
});
