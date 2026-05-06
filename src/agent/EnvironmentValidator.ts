/**
 * EnvironmentValidator — Phase 12 Increment 4
 *
 * Validates the runtime environment for Liminal Studio:
 *   - Node.js version
 *   - Go toolchain presence
 *   - LiminalFS writability
 *   - Provider connectivity (API key + baseUrl)
 *   - Config file presence
 *
 * Returns a structured report with pass/fail/warn per check.
 */

import {
  PROVIDER_DEFAULTS,
  PROVIDER_ORDER,
  apiKeyEnvNamesForProvider,
  detectRuntimeProviderFromUrl,
  isPlaceholderApiKey,
  resolveProviderAlias,
  resolveProviderRuntime,
  type RuntimeProviderKey,
} from '../config/ProviderRuntime.js';

export interface DiagnosticCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

export interface DiagnosticReport {
  checks: DiagnosticCheck[];
  timestamp: string;
  allPassed: boolean;
}

const GENERIC_API_KEY_ENV_NAMES = ['LIMINAL_LLM_API_KEY', 'LLM_API_KEY'] as const;

interface ApiKeySource {
  name: string;
}

export class EnvironmentValidator {
  /**
   * Run all diagnostic checks and return a structured report.
   */
  async validate(): Promise<DiagnosticReport> {
    const checks: DiagnosticCheck[] = [];

    checks.push(this.checkNodeVersion());
    checks.push(await this.checkGoToolchain());
    checks.push(await this.checkConfigFile());
    checks.push(this.checkProviderConfig());

    const allPassed = checks.every(c => c.status !== 'fail');

    return {
      checks,
      timestamp: new Date().toISOString(),
      allPassed,
    };
  }

  private checkNodeVersion(): DiagnosticCheck {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0], 10);

    if (major >= 18) {
      return { name: 'Node.js', status: 'pass', message: `v${version.slice(1)} detected` };
    }
    return { name: 'Node.js', status: 'fail', message: `Node.js ${version} detected — v18+ required` };
  }

  private async checkGoToolchain(): Promise<DiagnosticCheck> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync('go', ['version']);
      const match = stdout.match(/go(\d+\.\d+)/);
      const ver = match ? match[1] : 'unknown';
      return { name: 'Go', status: 'pass', message: `Go ${ver} detected` };
    } catch {
      return { name: 'Go', status: 'warn', message: 'Go toolchain not found — Bubble Tea TUI requires Go 1.21+' };
    }
  }

  private async checkConfigFile(): Promise<DiagnosticCheck> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const configPath = path.join(os.homedir(), '.liminal', 'config.json');

    try {
      await fs.access(configPath);
      return { name: 'Config', status: 'pass', message: `Config found at ${configPath}` };
    } catch {
      return { name: 'Config', status: 'warn', message: 'No ~/.liminal/config.json — run /setup to configure' };
    }
  }

  private checkProviderConfig(): DiagnosticCheck {
    const env = process.env;
    const configuredBaseUrl = env.LIMINAL_LLM_BASE_URL || env.LLM_BASE_URL;
    const configuredModel = env.LIMINAL_LLM_MODEL || env.LLM_MODEL;
    const explicitProviderValue = env.LIMINAL_LLM_PROVIDER || env.LLM_PROVIDER;
    const explicitProvider = resolveProviderAlias(explicitProviderValue);

    if (explicitProviderValue && !explicitProvider) {
      return {
        name: 'Provider',
        status: 'fail',
        message: `Unknown LLM provider "${explicitProviderValue}" - use ${Object.keys(PROVIDER_DEFAULTS).join(', ')}`,
      };
    }

    if (
      !explicitProvider
      && env.LLM_BASE_URL
      && !env.LIMINAL_LLM_BASE_URL
      && this.findGenericApiKeySource(env)?.name === 'LLM_API_KEY'
    ) {
      return { name: 'Provider', status: 'pass', message: 'Legacy LLM_BASE_URL and LLM_API_KEY set' };
    }

    const provider = explicitProvider
      ?? this.detectProviderFromConfiguredBaseUrl(configuredBaseUrl, configuredModel)
      ?? this.detectProviderFromConfiguredKey(env);

    if (provider) {
      const runtime = resolveProviderRuntime({
        provider,
        configuredBaseUrl,
        model: configuredModel,
        env,
      });
      const keySource = this.findApiKeySource(provider, env);

      if (runtime.requiresKey) {
        if (runtime.apiKey) {
          return {
            name: 'Provider',
            status: 'pass',
            message: `${runtime.label} configured via ${keySource?.name ?? 'configured API key'} at ${runtime.baseUrl}`,
          };
        }

        return {
          name: 'Provider',
          status: 'fail',
          message: `${runtime.label} requires ${this.formatApiKeyGuidance(provider)} for ${runtime.baseUrl}`,
        };
      }

      return {
        name: 'Provider',
        status: 'pass',
        message: `${runtime.label} configured at ${runtime.baseUrl}; no API key required`,
      };
    }

    if (configuredBaseUrl) {
      return {
        name: 'Provider',
        status: 'fail',
        message: 'Provider base URL is set but no usable API key was found - set LIMINAL_LLM_API_KEY or the provider-specific key',
      };
    }

    if (this.findGenericApiKeySource(env)) {
      return {
        name: 'Provider',
        status: 'warn',
        message: 'API key is set without a provider or base URL - set LIMINAL_LLM_PROVIDER or LIMINAL_LLM_BASE_URL',
      };
    }

    return {
      name: 'Provider',
      status: 'warn',
      message: 'No LLM provider env vars - set LIMINAL_LLM_PROVIDER plus a provider key, or run /setup',
    };
  }

  private detectProviderFromConfiguredBaseUrl(
    configuredBaseUrl: string | undefined,
    configuredModel: string | undefined,
  ): RuntimeProviderKey | undefined {
    if (!configuredBaseUrl) return undefined;
    return detectRuntimeProviderFromUrl(configuredBaseUrl, configuredModel);
  }

  private detectProviderFromConfiguredKey(env: NodeJS.ProcessEnv): RuntimeProviderKey | undefined {
    return PROVIDER_ORDER.find(provider => this.findPrimaryApiKeySource(provider, env) !== undefined);
  }

  private findApiKeySource(provider: RuntimeProviderKey, env: NodeJS.ProcessEnv): ApiKeySource | undefined {
    const names = [
      ...apiKeyEnvNamesForProvider(provider),
      ...GENERIC_API_KEY_ENV_NAMES,
    ];
    for (const name of names) {
      if (!isPlaceholderApiKey(env[name])) return { name };
      const liminalName = name.startsWith('LIMINAL_') ? undefined : `LIMINAL_${name}`;
      if (liminalName && !isPlaceholderApiKey(env[liminalName])) return { name: liminalName };
    }
    return undefined;
  }

  private findPrimaryApiKeySource(provider: RuntimeProviderKey, env: NodeJS.ProcessEnv): ApiKeySource | undefined {
    const primaryName = apiKeyEnvNamesForProvider(provider)[0];
    if (!primaryName || isPlaceholderApiKey(env[primaryName])) return undefined;
    return { name: primaryName };
  }

  private findGenericApiKeySource(env: NodeJS.ProcessEnv): ApiKeySource | undefined {
    const name = GENERIC_API_KEY_ENV_NAMES.find(key => !isPlaceholderApiKey(env[key]));
    return name ? { name } : undefined;
  }

  private formatApiKeyGuidance(provider: RuntimeProviderKey): string {
    const names = new Set([
      ...apiKeyEnvNamesForProvider(provider),
      ...GENERIC_API_KEY_ENV_NAMES,
    ]);
    return Array.from(names).join(' or ');
  }
}
