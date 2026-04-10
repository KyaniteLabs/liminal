import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../src/utils/Logger.js';

describe('Logger', () => {
  const originalEnv = process.env.LIMINAL_LOG_LEVEL;

  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.LIMINAL_LOG_LEVEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv !== undefined) {
      process.env.LIMINAL_LOG_LEVEL = originalEnv;
    } else {
      delete process.env.LIMINAL_LOG_LEVEL;
    }
  });

  it('defaults to warn level when no env var set', () => {
    Logger.warn('TestCtx', 'warn msg');
    Logger.error('TestCtx', 'error msg');
    Logger.debug('TestCtx', 'debug msg');
    Logger.info('TestCtx', 'info msg');

    expect(console.warn).toHaveBeenCalledWith('[TestCtx] warn msg');
    expect(console.error).toHaveBeenCalledWith('[TestCtx] error msg');
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it('respects LIMINAL_LOG_LEVEL=debug — logs everything', () => {
    process.env.LIMINAL_LOG_LEVEL = 'debug';
    Logger.debug('Ctx', 'd');
    Logger.info('Ctx', 'i');
    Logger.warn('Ctx', 'w');
    Logger.error('Ctx', 'e');

    expect(console.debug).toHaveBeenCalledWith('[Ctx] d');
    expect(console.log).toHaveBeenCalledWith('[Ctx] i');
    expect(console.warn).toHaveBeenCalledWith('[Ctx] w');
    expect(console.error).toHaveBeenCalledWith('[Ctx] e');
  });

  it('respects LIMINAL_LOG_LEVEL=error — only errors', () => {
    process.env.LIMINAL_LOG_LEVEL = 'error';
    Logger.debug('Ctx', 'd');
    Logger.info('Ctx', 'i');
    Logger.warn('Ctx', 'w');
    Logger.error('Ctx', 'e');

    expect(console.error).toHaveBeenCalledWith('[Ctx] e');
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('respects LIMINAL_LOG_LEVEL=info — logs info, warn, error', () => {
    process.env.LIMINAL_LOG_LEVEL = 'info';
    Logger.debug('Ctx', 'd');
    Logger.info('Ctx', 'i');
    Logger.warn('Ctx', 'w');
    Logger.error('Ctx', 'e');

    expect(console.log).toHaveBeenCalledWith('[Ctx] i');
    expect(console.warn).toHaveBeenCalledWith('[Ctx] w');
    expect(console.error).toHaveBeenCalledWith('[Ctx] e');
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('passes extra args through to console methods', () => {
    process.env.LIMINAL_LOG_LEVEL = 'debug';
    const obj = { key: 'value' };
    Logger.info('Ctx', 'msg', obj, 42);

    expect(console.log).toHaveBeenCalledWith('[Ctx] msg', obj, 42);
  });

  it('falls back to warn for invalid LIMINAL_LOG_LEVEL', () => {
    process.env.LIMINAL_LOG_LEVEL = 'invalid';
    Logger.warn('Ctx', 'w');
    Logger.debug('Ctx', 'd');

    expect(console.warn).toHaveBeenCalledWith('[Ctx] w');
    expect(console.debug).not.toHaveBeenCalled();
  });
});
