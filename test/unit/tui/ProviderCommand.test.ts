import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetStatus, mockSwitchProvider, mockGetProviderConfig, mockListConfiguredProviders } = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
  mockSwitchProvider: vi.fn(),
  mockGetProviderConfig: vi.fn(),
  mockListConfiguredProviders: vi.fn(),
}));

vi.mock('../../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: {
    getStatus: mockGetStatus,
    switchProvider: mockSwitchProvider,
  },
}));

vi.mock('../../../src/harness/MultiProviderConfig.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/harness/MultiProviderConfig.js')>();
  return {
    ...actual,
    getProviderConfig: mockGetProviderConfig,
    listConfiguredProviders: mockListConfiguredProviders,
  };
});

import { handleProviderCommand, renderProviderList } from '../../../src/tui/ProviderCommand.js';
import { PROVIDER_DEFAULTS } from '../../../src/config/ProviderRuntime.js';

describe('ProviderCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatus.mockReturnValue({ activeProvider: 'glm' });
    mockListConfiguredProviders.mockReturnValue(['glm', 'lmstudio']);
  });

  it('renders emoji and plain provider lists from one presenter', async () => {
    const emoji = await renderProviderList('emoji');
    const plain = await renderProviderList('plain');

    expect(emoji).toContain('✅ glm');
    expect(emoji).toContain('← active');
    expect(emoji).toContain('— switch to a configured provider');
    expect(plain).toContain('[ok] glm');
    expect(plain).toContain('<-- active');
    expect(plain).toContain('-- switch to a configured provider');
  });

  it('uses canonical provider key names for missing-key guidance', async () => {
    mockGetProviderConfig.mockReturnValue({
      provider: 'glm',
      name: PROVIDER_DEFAULTS.glm.label,
      baseUrl: PROVIDER_DEFAULTS.glm.baseUrl,
      model: PROVIDER_DEFAULTS.glm.model,
      apiStyle: PROVIDER_DEFAULTS.glm.apiStyle,
      temperature: PROVIDER_DEFAULTS.glm.temperature,
      maxTokens: PROVIDER_DEFAULTS.glm.maxTokens,
    });

    const result = await handleProviderCommand(['glm'], 'plain');
    expect(result.response).toContain('export GLM_API_KEY=your-key');
    expect(mockSwitchProvider).not.toHaveBeenCalled();
  });

  it('switches configured providers and returns a reusable log message', async () => {
    mockGetProviderConfig.mockReturnValue({
      provider: 'lmstudio',
      name: PROVIDER_DEFAULTS.lmstudio.label,
      baseUrl: PROVIDER_DEFAULTS.lmstudio.baseUrl,
      model: PROVIDER_DEFAULTS.lmstudio.model,
      apiStyle: PROVIDER_DEFAULTS.lmstudio.apiStyle,
      temperature: PROVIDER_DEFAULTS.lmstudio.temperature,
      maxTokens: PROVIDER_DEFAULTS.lmstudio.maxTokens,
    });

    const result = await handleProviderCommand(['lmstudio'], 'plain');
    expect(result.response).toContain(`Switched to LM Studio: ${PROVIDER_DEFAULTS.lmstudio.model}`);
    expect(result.logMessage).toBe(`Switched to LM Studio: ${PROVIDER_DEFAULTS.lmstudio.model}`);
    expect(mockSwitchProvider).toHaveBeenCalledWith(
      PROVIDER_DEFAULTS.lmstudio.baseUrl,
      PROVIDER_DEFAULTS.lmstudio.model,
      undefined,
    );
  });
});
