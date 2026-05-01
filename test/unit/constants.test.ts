import { describe, expect, it } from 'vitest';
import { SERVICE_DEFAULTS } from '../../src/constants.js';
import { PROVIDER_DEFAULTS } from '../../src/config/ProviderRuntime.js';

describe('SERVICE_DEFAULTS provider compatibility values', () => {
  it('redirects legacy provider URLs to ProviderRuntime defaults', () => {
    expect(SERVICE_DEFAULTS.LOCAL_LLM_URL).toBe(PROVIDER_DEFAULTS.lmstudio.baseUrl);
    expect(SERVICE_DEFAULTS.OLLAMA_URL).toBe(PROVIDER_DEFAULTS.ollama.baseUrl);
    expect(SERVICE_DEFAULTS.MINIMAX_URL).toBe(PROVIDER_DEFAULTS.minimax.baseUrl);
  });

  it('keeps DEFAULT_MODEL as the LLMClient auto-detect sentinel', () => {
    expect(SERVICE_DEFAULTS.DEFAULT_MODEL).toBe('auto');
  });
});
