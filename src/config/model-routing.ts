export const MODEL_IDS = {
  MINIMAX_M2_7: 'minimax-m2.7',
  MINIMAX_M2_5: 'minimax-m2.5',
  QWEN_35_9B: 'qwen3.5-9b',
  QWEN_CODER_40B: 'qwen3-coder-40b',
  GEMMA_3_4B: 'gemma3-4b',
  KIMI_K2_5: 'kimi-k2.5',
} as const;

export type ModelId = typeof MODEL_IDS[keyof typeof MODEL_IDS];
export type RoutedDomain = 'ascii' | 'glsl' | 'html' | 'hydra' | 'p5' | 'revideo' | 'strudel' | 'three';

export interface ModelRanking {
  id: ModelId;
  quality: number;
  speed: number;
  reliability: number;
  avgTimeSeconds: number;
  avgSizeBytes: number;
  issues: string[];
}

export interface DomainModelRouting {
  preferred: ModelId[];
  avoid: ModelId[];
  minSize: number;
  rankings: ModelRanking[];
  promptHints: string[];
}

const ALL_MODELS = Object.values(MODEL_IDS);

export const DOMAIN_ROUTING: Record<RoutedDomain, DomainModelRouting> = {
  p5: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.QWEN_35_9B,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.GEMMA_3_4B,
    ],
    avoid: [],
    minSize: 1000,
    rankings: [
      ranking(MODEL_IDS.MINIMAX_M2_5, 9, 10, 10, 18, 4175),
      ranking(MODEL_IDS.MINIMAX_M2_7, 9, 8, 9, 47, 3388),
      ranking(MODEL_IDS.KIMI_K2_5, 8, 7, 8, 56, 5114),
      ranking(MODEL_IDS.QWEN_35_9B, 8, 5, 8, 109, 3075),
      ranking(MODEL_IDS.QWEN_CODER_40B, 7, 8, 8, 28, 2070),
      ranking(MODEL_IDS.GEMMA_3_4B, 7, 9, 8, 26, 1929),
    ],
    promptHints: ['Ask for complete setup() and draw() functions with visible motion.'],
  },
  glsl: {
    preferred: [
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.QWEN_35_9B,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.MINIMAX_M2_5,
    ],
    avoid: [],
    minSize: 800,
    rankings: [
      ranking(MODEL_IDS.KIMI_K2_5, 9, 7, 9, 55, 1785),
      ranking(MODEL_IDS.MINIMAX_M2_7, 9, 8, 9, 30, 2282),
      ranking(MODEL_IDS.QWEN_CODER_40B, 8, 8, 8, 30, 1999),
      ranking(MODEL_IDS.QWEN_35_9B, 8, 5, 8, 118, 2718),
      ranking(MODEL_IDS.GEMMA_3_4B, 7, 9, 8, 14, 880),
      ranking(MODEL_IDS.MINIMAX_M2_5, 7, 10, 7, 10, 715),
    ],
    promptHints: ['Ask for a complete fragment shader with precision, u_time, and u_resolution.'],
  },
  three: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.QWEN_35_9B,
    ],
    avoid: [MODEL_IDS.QWEN_35_9B],
    minSize: 1000,
    rankings: [
      ranking(MODEL_IDS.MINIMAX_M2_7, 9, 8, 9, 37, 6753),
      ranking(MODEL_IDS.MINIMAX_M2_5, 8, 9, 8, 34, 6959),
      ranking(MODEL_IDS.KIMI_K2_5, 8, 7, 8, 54, 3822),
      ranking(MODEL_IDS.QWEN_CODER_40B, 7, 8, 8, 34, 3635),
      ranking(MODEL_IDS.GEMMA_3_4B, 7, 9, 8, 25, 2361),
      ranking(MODEL_IDS.QWEN_35_9B, 1, 4, 3, 90, 66, ['FAILED - 66b empty output']),
    ],
    promptHints: ['Ask for scene, camera, renderer, animation loop, and resize handling.'],
  },
  hydra: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.QWEN_35_9B,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.KIMI_K2_5,
    ],
    avoid: [
      MODEL_IDS.QWEN_35_9B,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.KIMI_K2_5,
    ],
    minSize: 200,
    rankings: [
      ranking(MODEL_IDS.MINIMAX_M2_7, 8, 8, 8, 30, 1250),
      ranking(MODEL_IDS.GEMMA_3_4B, 7, 9, 7, 18, 940),
      ranking(MODEL_IDS.QWEN_35_9B, 3, 5, 3, 90, 80, ['50% failure rate in audit']),
      ranking(MODEL_IDS.QWEN_CODER_40B, 3, 7, 3, 32, 110, ['50% failure rate in audit']),
      ranking(MODEL_IDS.MINIMAX_M2_5, 4, 10, 4, 12, 120, ['50% failure rate in audit']),
      ranking(MODEL_IDS.KIMI_K2_5, 3, 7, 3, 52, 100, ['50% failure rate in audit']),
    ],
    promptHints: ['Hydra has a 50% failure rate on several models; ask for concise chainable osc/noise output.'],
  },
  strudel: {
    preferred: [
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.QWEN_35_9B,
    ],
    avoid: [],
    minSize: 100,
    rankings: [
      ranking(MODEL_IDS.QWEN_CODER_40B, 9, 8, 9, 29, 1200),
      ranking(MODEL_IDS.GEMMA_3_4B, 8, 9, 8, 20, 900),
      ranking(MODEL_IDS.KIMI_K2_5, 8, 7, 8, 48, 1100),
      ranking(MODEL_IDS.MINIMAX_M2_7, 7, 8, 7, 35, 1000),
      ranking(MODEL_IDS.MINIMAX_M2_5, 7, 10, 7, 15, 850),
      ranking(MODEL_IDS.QWEN_35_9B, 6, 5, 6, 95, 780),
    ],
    promptHints: ['Ask for Strudel-native patterns and avoid generic Web Audio code.'],
  },
  revideo: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.QWEN_35_9B,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.MINIMAX_M2_5,
    ],
    avoid: [],
    minSize: 800,
    rankings: defaultRankings(),
    promptHints: ['Ask for Revideo 2D scene code, not Remotion or React hooks.'],
  },
  html: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.QWEN_35_9B,
    ],
    avoid: [],
    minSize: 600,
    rankings: defaultRankings(),
    promptHints: ['Ask for complete semantic HTML, CSS, and accessible interaction states.'],
  },
  ascii: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.QWEN_35_9B,
    ],
    avoid: [],
    minSize: 1500,
    rankings: defaultRankings(),
    promptHints: ['Ask for multi-line ASCII composition with strong silhouette and spacing.'],
  },
};

export function getBestModel(domain: string): ModelId {
  return getRouting(domain)?.preferred[0] ?? MODEL_IDS.MINIMAX_M2_5;
}

export function getPreferredModels(domain: string): ModelId[] {
  return [...(getRouting(domain)?.preferred ?? ALL_MODELS)];
}

export function shouldAvoidModel(domain: string, model: string): boolean {
  return getRouting(domain)?.avoid.includes(model as ModelId) ?? false;
}

export function getMinSizeForDomain(domain: string): number {
  return getRouting(domain)?.minSize ?? 500;
}

export function getModelRanking(domain: string, model: string): ModelRanking | undefined {
  return getRouting(domain)?.rankings.find((rankingEntry) => rankingEntry.id === model);
}

export function getPromptHints(domain: string): string[] {
  return [...(getRouting(domain)?.promptHints ?? [])];
}

function getRouting(domain: string): DomainModelRouting | undefined {
  return DOMAIN_ROUTING[domain.toLowerCase() as RoutedDomain];
}

function ranking(
  id: ModelId,
  quality: number,
  speed: number,
  reliability: number,
  avgTimeSeconds: number,
  avgSizeBytes: number,
  issues: string[] = [],
): ModelRanking {
  return { id, quality, speed, reliability, avgTimeSeconds, avgSizeBytes, issues };
}

function defaultRankings(): ModelRanking[] {
  return [
    ranking(MODEL_IDS.MINIMAX_M2_7, 8, 8, 8, 30, 1800),
    ranking(MODEL_IDS.MINIMAX_M2_5, 7, 10, 7, 15, 1200),
    ranking(MODEL_IDS.QWEN_35_9B, 6, 5, 6, 95, 1000),
    ranking(MODEL_IDS.QWEN_CODER_40B, 8, 8, 8, 30, 1600),
    ranking(MODEL_IDS.GEMMA_3_4B, 7, 9, 7, 20, 900),
    ranking(MODEL_IDS.KIMI_K2_5, 8, 7, 8, 50, 1700),
  ];
}
