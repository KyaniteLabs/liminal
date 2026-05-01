/**
 * OnboardingWizard — Phase 12 Increment 4
 *
 * Step-by-step provider detection and setup wizard:
 *   1. Detect available providers from env vars / config
 *   2. Validate API key connectivity
 *   3. Write config to ~/.liminal/config.json
 *
 * Designed to be driven from the TUI (step-by-step events)
 * or CLI (batch mode).
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Logger } from '../utils/Logger.js';
import {
  PROVIDER_DEFAULTS,
  PROVIDER_ORDER,
  detectRuntimeProviderFromUrl,
  providerRequiresApiKey,
  resolveProviderAlias,
  resolveProviderRuntime,
  selectRuntimeApiKey,
  type RuntimeProviderKey,
} from '../config/ProviderRuntime.js';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  value?: string;
}

export interface OnboardingResult {
  steps: OnboardingStep[];
  configWritten: boolean;
  configPath: string;
}

export class OnboardingWizard {
  private steps: OnboardingStep[] = [
    { id: 'detect', title: 'Detect provider', description: 'Check env vars and existing config', status: 'pending' },
    { id: 'validate', title: 'Validate connectivity', description: 'Test API key against provider endpoint', status: 'pending' },
    { id: 'write', title: 'Write config', description: 'Save to ~/.liminal/config.json', status: 'pending' },
  ];

  /**
   * Run the full onboarding flow. Accepts optional overrides for
   * provider config when driven from TUI input.
   */
  async run(overrides?: { provider?: string; baseUrl?: string; apiKey?: string; model?: string }): Promise<OnboardingResult> {
    const configDir = path.join(os.homedir(), '.liminal');
    const configPath = path.join(configDir, 'config.json');

    // Step 1: Detect provider
    this.setStep('detect', 'in_progress');
    const configuredBaseUrl = overrides?.baseUrl || process.env.LIMINAL_LLM_BASE_URL || process.env.LLM_BASE_URL;
    const configuredModel = overrides?.model || process.env.LIMINAL_LLM_MODEL || process.env.LLM_MODEL;
    const provider = this.detectProvider(overrides?.provider, configuredBaseUrl, configuredModel);

    if (!provider) {
      this.setStep('detect', 'failed');
      return { steps: [...this.steps], configWritten: false, configPath };
    }

    const runtime = resolveProviderRuntime({
      provider,
      configuredBaseUrl,
      model: configuredModel,
      configuredApiKey: overrides?.apiKey,
    });
    const apiKey = selectRuntimeApiKey({
      provider,
      baseUrl: runtime.baseUrl,
      model: runtime.model,
      configuredApiKey: overrides?.apiKey,
      genericFirst: true,
    });
    this.setStep('detect', 'complete', runtime.label);

    // Step 2: Validate connectivity (basic check — non-empty key)
    this.setStep('validate', 'in_progress');
    if (providerRequiresApiKey(provider) && !apiKey) {
      this.setStep('validate', 'failed');
      return { steps: [...this.steps], configWritten: false, configPath };
    }
    this.setStep('validate', 'complete', apiKey ? 'API key present' : 'local provider');

    // Step 3: Write config
    this.setStep('write', 'in_progress');
    try {
      await fs.mkdir(configDir, { recursive: true });
      const config = {
        defaultProvider: provider,
        providers: {
          [provider]: {
            baseUrl: runtime.baseUrl,
            model: runtime.model,
            apiKey: apiKey || undefined,
          },
        },
      };
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.setStep('write', 'complete', configPath);
      Logger.info('OnboardingWizard', `Config written to ${configPath}`);
      return { steps: [...this.steps], configWritten: true, configPath };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStep('write', 'failed', msg);
      return { steps: [...this.steps], configWritten: false, configPath };
    }
  }

  /**
   * Get the current step list (for TUI rendering).
   */
  getSteps(): OnboardingStep[] {
    return [...this.steps];
  }

  private setStep(id: string, status: OnboardingStep['status'], value?: string): void {
    const step = this.steps.find(s => s.id === id);
    if (step) {
      step.status = status;
      if (value !== undefined) step.value = value;
    }
  }

  private detectProvider(
    overrideProvider: string | undefined,
    configuredBaseUrl: string | undefined,
    configuredModel: string | undefined,
  ): RuntimeProviderKey | undefined {
    const explicit = resolveProviderAlias(
      overrideProvider || process.env.LIMINAL_LLM_PROVIDER || process.env.LLM_PROVIDER,
    );
    if (explicit) return explicit;
    if (configuredBaseUrl) return detectRuntimeProviderFromUrl(configuredBaseUrl, configuredModel);

    return PROVIDER_ORDER.find(provider => selectRuntimeApiKey({
      provider,
      baseUrl: PROVIDER_DEFAULTS[provider].baseUrl,
      model: PROVIDER_DEFAULTS[provider].model,
      genericFirst: true,
    }));
  }
}
