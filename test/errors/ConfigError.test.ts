import { describe, it, expect } from 'vitest';
import { ConfigError } from '../../src/errors/ConfigError';
import { LiminalError } from '../../src/errors/base';

describe('ConfigError', () => {
  it('should create a ConfigError with message and code', () => {
    const error = new ConfigError('Invalid configuration');

    expect(error.message).toBe('Invalid configuration');
    expect(error.code).toBe('ERR_CONFIG');
    expect(error.name).toBe('ConfigError');
  });

  it('should create a ConfigError with context', () => {
    const context = { configPath: '/path/to/config', key: 'apiKey' };
    const error = new ConfigError('Missing required key', context);

    expect(error.message).toBe('Missing required key');
    expect(error.context).toEqual(context);
  });

  it('should be an instance of LiminalError and Error', () => {
    const error = new ConfigError('Test');

    expect(error).toBeInstanceOf(LiminalError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ConfigError);
  });

  it('should have default code ERR_CONFIG', () => {
    const error = new ConfigError('Test error');
    expect(error.code).toBe('ERR_CONFIG');
  });

  it('should allow custom code', () => {
    const error = new ConfigError('Test error', { code: 'ERR_CUSTOM_CONFIG' });
    expect(error.code).toBe('ERR_CUSTOM_CONFIG');
  });
});
