import { describe, expect, it } from 'vitest';
import {
  MODEL_CHOICES,
  findModelChoice,
  resolveChoiceByAlias,
  resolveOpenRouterChoice,
  resolveProviderToken,
} from '../../../src/tui-bridge/ModelPickerCatalog.js';
import { PROVIDER_DEFAULTS } from '../../../src/config/ProviderRuntime.js';

describe('ModelPickerCatalog', () => {
  it('keeps provider default choices tied to ProviderRuntime', () => {
    expect(findModelChoice('minimax', 'm27')).toMatchObject({
      provider: 'minimax',
      model: PROVIDER_DEFAULTS.minimax.model,
    });
    expect(findModelChoice('glm', '5v')).toMatchObject({
      provider: 'glm',
      model: PROVIDER_DEFAULTS.glm.model,
    });
    expect(findModelChoice('lmstudio', 'local')).toMatchObject({
      provider: 'lmstudio',
      model: PROVIDER_DEFAULTS.lmstudio.model,
    });
  });

  it('resolves provider aliases and model aliases through the catalog seam', () => {
    expect(resolveProviderToken('gpt')).toBe('openai');
    expect(resolveChoiceByAlias('gpt54mini')).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-mini',
    });
    expect(resolveOpenRouterChoice('gemini-pro')).toMatchObject({
      provider: 'openrouter',
      model: 'google/gemini-3.1-pro-preview',
    });
  });

  it('publishes picker choices without duplicate provider/model pairs', () => {
    const keys = MODEL_CHOICES.map(choice => `${choice.provider}/${choice.model}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
