import {
  PROVIDER_ALIASES,
  PROVIDER_DEFAULTS,
  isRuntimeProviderKey,
  type RuntimeProviderKey,
} from '../config/ProviderRuntime.js';
import { OPENROUTER_MODEL_CATALOG, resolveOpenRouterModelAlias } from './OpenRouterModelCatalog.js';

export type ModelProviderKey = RuntimeProviderKey;

export interface ModelChoice {
  provider: ModelProviderKey;
  label: string;
  model: string;
  aliases: string[];
}

export const MODEL_CHOICES: ModelChoice[] = [
  { provider: 'openai', label: 'GPT-5.4 mini', model: 'gpt-5.4-mini', aliases: ['gpt-5.4-mini', 'gpt54mini', '5.4-mini', 'mini'] },
  { provider: 'openai', label: 'GPT-5.4', model: 'gpt-5.4', aliases: ['gpt-5.4', 'gpt54', '5.4'] },
  { provider: 'openai', label: 'GPT-5.4 nano', model: 'gpt-5.4-nano', aliases: ['gpt-5.4-nano', 'gpt54nano', 'nano'] },
  { provider: 'minimax', label: 'MiniMax M2.7', model: PROVIDER_DEFAULTS.minimax.model, aliases: ['m27', 'm2.7', 'minimax-m27'] },
  { provider: 'minimax', label: 'MiniMax M2.5', model: 'MiniMax-M2.5', aliases: ['m25', 'm2.5', 'minimax-m25'] },
  { provider: 'glm', label: 'GLM 5V Turbo', model: PROVIDER_DEFAULTS.glm.model, aliases: ['glm-5v-turbo', 'glm5v', '5v', 'glm-vision'] },
  { provider: 'glm', label: 'GLM 5.1', model: 'glm-5.1', aliases: ['glm-5.1', 'glm51'] },
  { provider: 'lmstudio', label: 'LM Studio local', model: PROVIDER_DEFAULTS.lmstudio.model, aliases: ['local', 'lmstudio'] },
  { provider: 'ollama', label: 'Ollama llama3.2', model: PROVIDER_DEFAULTS.ollama.model, aliases: ['llama3.2', 'ollama'] },
  { provider: 'kimi', label: 'Kimi K2P5', model: PROVIDER_DEFAULTS.kimi.model, aliases: ['k2p5', 'kimi'] },
  ...OPENROUTER_MODEL_CATALOG.map((entry): ModelChoice => ({
    provider: 'openrouter',
    label: entry.label,
    model: entry.model,
    aliases: [entry.alias, entry.model],
  })),
];

export function resolveProviderToken(value: string | undefined): RuntimeProviderKey | undefined {
  if (!value) return undefined;
  return PROVIDER_ALIASES[value] ?? (isRuntimeProviderKey(value) ? value : undefined);
}

export function resolveOpenRouterChoice(selection: string): ModelChoice | null {
  const openRouterAlias = resolveOpenRouterModelAlias(selection);
  if (!openRouterAlias) return null;
  return {
    provider: 'openrouter',
    label: openRouterAlias.label,
    model: openRouterAlias.model,
    aliases: [openRouterAlias.alias],
  };
}

export function findModelChoice(provider: RuntimeProviderKey, selection: string): ModelChoice | null {
  const normalized = selection.toLowerCase();
  return MODEL_CHOICES.find((choice) =>
    choice.provider === provider &&
    (choice.model.toLowerCase() === normalized ||
      choice.aliases.some((alias) => alias.toLowerCase() === normalized)),
  ) ?? null;
}

export function resolveChoiceByAlias(selection: string): ModelChoice | null {
  const normalized = selection.toLowerCase().trim();
  return MODEL_CHOICES.find((choice) =>
    choice.model.toLowerCase() === normalized ||
    choice.aliases.some((alias) => alias.toLowerCase() === normalized),
  ) ?? null;
}
