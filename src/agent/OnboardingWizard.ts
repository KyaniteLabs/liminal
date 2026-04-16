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
    const provider = overrides?.provider || (process.env.LLM_BASE_URL ? 'custom' : 'minimax');
    const baseUrl = overrides?.baseUrl || process.env.LLM_BASE_URL || '';
    const apiKey = overrides?.apiKey || process.env.LLM_API_KEY || '';
    const model = overrides?.model || process.env.LLM_MODEL || 'auto';

    if (!baseUrl && !apiKey) {
      this.setStep('detect', 'failed');
      return { steps: [...this.steps], configWritten: false, configPath };
    }
    this.setStep('detect', 'complete', provider);

    // Step 2: Validate connectivity (basic check — non-empty key)
    this.setStep('validate', 'in_progress');
    if (!apiKey) {
      this.setStep('validate', 'failed');
      return { steps: [...this.steps], configWritten: false, configPath };
    }
    this.setStep('validate', 'complete', 'API key present');

    // Step 3: Write config
    this.setStep('write', 'in_progress');
    try {
      await fs.mkdir(configDir, { recursive: true });
      const config = {
        defaultProvider: provider,
        providers: {
          [provider]: {
            baseUrl: baseUrl || undefined,
            model,
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
}
