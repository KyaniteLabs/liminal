export interface OpenRouterModelAlias {
  alias: string;
  model: string;
  label: string;
}

export const OPENROUTER_MODEL_CATALOG: OpenRouterModelAlias[] = [
  {
    alias: 'claude',
    model: 'anthropic/claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
  },
  {
    alias: 'gemini-pro',
    model: 'google/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
  },
  {
    alias: 'gemini-fast',
    model: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
  },
  {
    alias: 'gpt-mini',
    model: 'openai/gpt-5-mini',
    label: 'GPT-5 Mini',
  },
  {
    alias: 'glm',
    model: 'z-ai/glm-5.1',
    label: 'GLM 5.1',
  },
];

export function resolveOpenRouterModelAlias(input?: string): OpenRouterModelAlias | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  return OPENROUTER_MODEL_CATALOG.find((entry) => entry.alias === normalized || entry.model.toLowerCase() === normalized) || null;
}
