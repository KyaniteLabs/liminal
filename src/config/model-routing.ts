/**
 * Model Routing Configuration
 *
 * Defines preferred models per domain based on quality audits.
 * Each domain has preferred models, models to avoid, minimum size requirements,
 * detailed rankings, and prompt hints.
 */

export const MODEL_IDS = {
  MINIMAX_M2_7: 'minimax-m2.7',
  MINIMAX_M2_5: 'minimax-m2.5',
  QWEN_35_9B: 'qwen3.5-9b',
  QWEN_CODER_40B: 'qwen3-coder-40b',
  GEMMA_3_4B: 'gemma3-4b',
  KIMI_K2_5: 'kimi-k2.5',
} as const;

export type ModelId = (typeof MODEL_IDS)[keyof typeof MODEL_IDS];

export interface ModelRanking {
  id: ModelId;
  quality: number;
  speed: number;
  reliability: number;
  avgTimeSeconds: number;
  avgSizeBytes: number;
  issues: string[];
}

export interface DomainRouting {
  preferred: ModelId[];
  avoid: ModelId[];
  minSize: number;
  rankings: ModelRanking[];
  promptHints: string[];
}

export const DOMAIN_ROUTING: Record<string, DomainRouting> = {
  p5: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.QWEN_35_9B,
    ],
    avoid: [],
    minSize: 1000,
    rankings: [
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 9, speed: 10, reliability: 10, avgTimeSeconds: 18, avgSizeBytes: 4175, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 9, speed: 9, reliability: 10, avgTimeSeconds: 20, avgSizeBytes: 4200, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 8, speed: 9, reliability: 9, avgTimeSeconds: 22, avgSizeBytes: 4100, issues: [] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 8, speed: 8, reliability: 8, avgTimeSeconds: 25, avgSizeBytes: 4000, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 7, speed: 10, reliability: 8, avgTimeSeconds: 15, avgSizeBytes: 3800, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 6, speed: 9, reliability: 7, avgTimeSeconds: 20, avgSizeBytes: 3900, issues: [] },
    ],
    promptHints: ['Use p5.js functions for creative coding', 'Include setup() and draw() functions'],
  },
  glsl: {
    preferred: [
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.QWEN_35_9B,
    ],
    avoid: [],
    minSize: 800,
    rankings: [
      { id: MODEL_IDS.KIMI_K2_5, quality: 9, speed: 9, reliability: 9, avgTimeSeconds: 20, avgSizeBytes: 3500, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 9, speed: 9, reliability: 9, avgTimeSeconds: 21, avgSizeBytes: 3600, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 8, speed: 10, reliability: 9, avgTimeSeconds: 17, avgSizeBytes: 3400, issues: [] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 8, speed: 8, reliability: 8, avgTimeSeconds: 24, avgSizeBytes: 3300, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 7, speed: 10, reliability: 8, avgTimeSeconds: 14, avgSizeBytes: 3100, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 6, speed: 9, reliability: 7, avgTimeSeconds: 19, avgSizeBytes: 3200, issues: [] },
    ],
    promptHints: ['Use GLSL shader syntax', 'Include void main() function', 'Set gl_FragColor'],
  },
  three: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.KIMI_K2_5,
    ],
    avoid: [MODEL_IDS.QWEN_35_9B],
    minSize: 1000,
    rankings: [
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 9, speed: 9, reliability: 10, avgTimeSeconds: 23, avgSizeBytes: 4500, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 8, speed: 10, reliability: 9, avgTimeSeconds: 19, avgSizeBytes: 4300, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 7, speed: 10, reliability: 8, avgTimeSeconds: 16, avgSizeBytes: 3900, issues: [] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 7, speed: 8, reliability: 7, avgTimeSeconds: 26, avgSizeBytes: 3800, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 6, speed: 8, reliability: 7, avgTimeSeconds: 25, avgSizeBytes: 3700, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 1, speed: 5, reliability: 3, avgTimeSeconds: 30, avgSizeBytes: 66, issues: ['❌ FAILED - 66b empty output'] },
    ],
    promptHints: ['Use Three.js library', 'Create scene, camera, and renderer'],
  },
  hydra: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.GEMMA_3_4B,
    ],
    avoid: [
      MODEL_IDS.QWEN_35_9B,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.KIMI_K2_5,
    ],
    minSize: 200,
    rankings: [
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 8, speed: 9, reliability: 8, avgTimeSeconds: 22, avgSizeBytes: 3000, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 7, speed: 10, reliability: 7, avgTimeSeconds: 15, avgSizeBytes: 2800, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 3, speed: 5, reliability: 3, avgTimeSeconds: 28, avgSizeBytes: 200, issues: ['❌ High failure rate'] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 3, speed: 5, reliability: 3, avgTimeSeconds: 29, avgSizeBytes: 250, issues: ['❌ High failure rate'] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 3, speed: 6, reliability: 3, avgTimeSeconds: 24, avgSizeBytes: 220, issues: ['❌ High failure rate'] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 2, speed: 5, reliability: 2, avgTimeSeconds: 27, avgSizeBytes: 180, issues: ['❌ High failure rate'] },
    ],
    promptHints: ['⚠️ 50% failure rate - use minimax-m2.7 or gemma3-4b only', 'Use Hydra synth functions'],
  },
  strudel: {
    preferred: [
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.QWEN_35_9B,
    ],
    avoid: [],
    minSize: 100,
    rankings: [
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 9, speed: 8, reliability: 9, avgTimeSeconds: 20, avgSizeBytes: 2500, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 8, speed: 9, reliability: 8, avgTimeSeconds: 19, avgSizeBytes: 2600, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 8, speed: 10, reliability: 8, avgTimeSeconds: 17, avgSizeBytes: 2400, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 7, speed: 9, reliability: 8, avgTimeSeconds: 21, avgSizeBytes: 2300, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 7, speed: 10, reliability: 7, avgTimeSeconds: 14, avgSizeBytes: 2100, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 5, speed: 8, reliability: 6, avgTimeSeconds: 18, avgSizeBytes: 2200, issues: [] },
    ],
    promptHints: ['Use Strudel pattern functions', 'Define rhythmic patterns'],
  },
  remotion: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.QWEN_35_9B,
    ],
    avoid: [],
    minSize: 800,
    rankings: [
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 9, speed: 9, reliability: 10, avgTimeSeconds: 24, avgSizeBytes: 5000, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 8, speed: 10, reliability: 9, avgTimeSeconds: 20, avgSizeBytes: 4800, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 8, speed: 9, reliability: 9, avgTimeSeconds: 23, avgSizeBytes: 4700, issues: [] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 8, speed: 8, reliability: 8, avgTimeSeconds: 27, avgSizeBytes: 4600, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 7, speed: 10, reliability: 8, avgTimeSeconds: 17, avgSizeBytes: 4200, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 6, speed: 9, reliability: 7, avgTimeSeconds: 22, avgSizeBytes: 4300, issues: [] },
    ],
    promptHints: ['Use Remotion components', 'Define video composition'],
  },
  html: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.QWEN_35_9B,
    ],
    avoid: [],
    minSize: 600,
    rankings: [
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 9, speed: 9, reliability: 10, avgTimeSeconds: 21, avgSizeBytes: 4000, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 8, speed: 10, reliability: 9, avgTimeSeconds: 18, avgSizeBytes: 3800, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 8, speed: 9, reliability: 9, avgTimeSeconds: 22, avgSizeBytes: 3700, issues: [] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 8, speed: 8, reliability: 8, avgTimeSeconds: 25, avgSizeBytes: 3600, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 7, speed: 10, reliability: 8, avgTimeSeconds: 15, avgSizeBytes: 3300, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 6, speed: 9, reliability: 7, avgTimeSeconds: 20, avgSizeBytes: 3400, issues: [] },
    ],
    promptHints: ['Create valid HTML structure', 'Include proper DOCTYPE'],
  },
  ascii: {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,
      MODEL_IDS.MINIMAX_M2_5,
      MODEL_IDS.KIMI_K2_5,
      MODEL_IDS.QWEN_CODER_40B,
      MODEL_IDS.GEMMA_3_4B,
      MODEL_IDS.QWEN_35_9B,
    ],
    avoid: [],
    minSize: 1500,
    rankings: [
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 9, speed: 9, reliability: 10, avgTimeSeconds: 23, avgSizeBytes: 5500, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 8, speed: 10, reliability: 9, avgTimeSeconds: 19, avgSizeBytes: 5300, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 8, speed: 9, reliability: 9, avgTimeSeconds: 24, avgSizeBytes: 5200, issues: [] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 8, speed: 8, reliability: 8, avgTimeSeconds: 28, avgSizeBytes: 5100, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 7, speed: 10, reliability: 8, avgTimeSeconds: 18, avgSizeBytes: 4700, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 6, speed: 9, reliability: 7, avgTimeSeconds: 23, avgSizeBytes: 4800, issues: [] },
    ],
    promptHints: ['Use ASCII art patterns', 'Consider character density'],
  },
};

export function getBestModel(domain: string): ModelId {
  const normalizedDomain = domain.toLowerCase();
  const routing = DOMAIN_ROUTING[normalizedDomain];
  if (routing && routing.preferred.length > 0) {
    return routing.preferred[0];
  }
  return MODEL_IDS.MINIMAX_M2_5;
}

export function getPreferredModels(domain: string): ModelId[] {
  const normalizedDomain = domain.toLowerCase();
  const routing = DOMAIN_ROUTING[normalizedDomain];
  if (routing && routing.preferred.length > 0) {
    return [...routing.preferred];
  }
  return Object.values(MODEL_IDS);
}

export function shouldAvoidModel(domain: string, modelId: ModelId): boolean {
  const normalizedDomain = domain.toLowerCase();
  const routing = DOMAIN_ROUTING[normalizedDomain];
  if (!routing) return false;
  return routing.avoid.includes(modelId);
}

export function getMinSizeForDomain(domain: string): number {
  const normalizedDomain = domain.toLowerCase();
  const routing = DOMAIN_ROUTING[normalizedDomain];
  if (routing) return routing.minSize;
  return 500;
}

export function getModelRanking(domain: string, modelId: string): ModelRanking | undefined {
  const normalizedDomain = domain.toLowerCase();
  const routing = DOMAIN_ROUTING[normalizedDomain];
  if (!routing) return undefined;
  return routing.rankings.find((r) => r.id === modelId);
}

export function getPromptHints(domain: string): string[] {
  const normalizedDomain = domain.toLowerCase();
  const routing = DOMAIN_ROUTING[normalizedDomain];
  if (routing) return [...routing.promptHints];
  return [];
}
