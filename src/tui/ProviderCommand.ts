import type { ProviderType } from '../harness/MultiProviderConfig.js';

export type ProviderCommandStyle = 'emoji' | 'plain';

export interface ProviderCommandResult {
  response: string;
  logMessage?: string;
}

function configuredStatus(style: ProviderCommandStyle, configured: boolean): string {
  if (style === 'emoji') return configured ? '✅' : '⚪';
  return configured ? '[ok]' : '[--]';
}

function activeMarker(style: ProviderCommandStyle): string {
  return style === 'emoji' ? ' ← active' : ' <-- active';
}

export async function renderProviderList(style: ProviderCommandStyle): Promise<string> {
  const { PROVIDER_TEMPLATES, listConfiguredProviders } = await import('../harness/MultiProviderConfig.js');
  const { metaHarness } = await import('../harness/MetaHarnessIntegration.js');
  const configured = listConfiguredProviders();
  const current = metaHarness.getStatus()?.activeProvider || 'unknown';
  const lines = ['Providers:'];
  for (const [key, tmpl] of Object.entries(PROVIDER_TEMPLATES)) {
    const provider = key as ProviderType;
    const isConfigured = configured.includes(provider);
    const marker = key === current ? activeMarker(style) : '';
    const status = configuredStatus(style, isConfigured);
    lines.push(`  ${status} ${key.padEnd(12)} ${tmpl.name.padEnd(14)} ${tmpl.model}${marker}`);
  }
  lines.push('');
  lines.push(style === 'emoji'
    ? 'Usage: /provider <name>       — switch to a configured provider'
    : 'Usage: /provider <name>       -- switch to a configured provider');
  lines.push(style === 'emoji'
    ? '       /provider <url> <model> — switch to custom endpoint'
    : '       /provider <url> <model> -- switch to custom endpoint');
  return lines.join('\n');
}

export async function handleProviderCommand(args: string[], style: ProviderCommandStyle): Promise<ProviderCommandResult> {
  const { apiKeyEnvNamesForProvider, providerRequiresApiKey } = await import('../config/ProviderRuntime.js');
  const { PROVIDER_TEMPLATES, getProviderConfig } = await import('../harness/MultiProviderConfig.js');
  const { metaHarness } = await import('../harness/MetaHarnessIntegration.js');

  if (!args[0] || args[0] === 'list' || args[0] === 'ls') {
    return { response: await renderProviderList(style) };
  }

  const provider = args[0] as ProviderType;
  const template = PROVIDER_TEMPLATES[provider];
  if (template) {
    const config = getProviderConfig(provider);
    if (!config?.apiKey && providerRequiresApiKey(provider)) {
      const envName = apiKeyEnvNamesForProvider(provider)[0] || 'LLM_API_KEY';
      const subject = style === 'emoji' ? `⚠️  ${template.name}` : template.name;
      return {
        response: `${subject} not configured. Set the API key first:\n  export ${envName}=your-key`,
      };
    }
    if (!config) {
      return { response: `Unknown provider "${args[0]}". Run /provider list to see options.` };
    }
    metaHarness.switchProvider(config.baseUrl, config.model, config.apiKey);
    const switched = `Switched to ${template.name}: ${config.model} @ ${config.baseUrl}`;
    return {
      response: style === 'emoji' ? `✅ ${switched}` : switched,
      logMessage: `Switched to ${template.name}: ${config.model}`,
    };
  }

  if (args[0]?.startsWith('http') && args[1]) {
    const [url, model, apiKey] = args;
    metaHarness.switchProvider(url, model, apiKey);
    const switched = `Switched to custom: ${model} @ ${url}`;
    return {
      response: style === 'emoji' ? `✅ ${switched}` : switched,
      logMessage: `Switched to custom: ${model}`,
    };
  }

  return { response: `Unknown provider "${args[0]}". Run /provider list to see options.` };
}
