import { Tool, type ToolResult } from './types.js';

export type ToolCatalogPhase =
  | 'inspect'
  | 'edit'
  | 'validate'
  | 'render'
  | 'evaluate'
  | 'verify'
  | 'recover'
  | 'general';

export interface ToolCatalogEntry {
  name: string;
  purpose: string;
  phases: ToolCatalogPhase[];
  domains: string[];
  keywords: string[];
  boostKeywords?: string[];
  args: string[];
  prerequisites?: string[];
  example: string;
}

export interface ToolSearchParams {
  query: string;
  domain?: string;
  phase?: ToolCatalogPhase | string;
  maxResults?: number;
  includeSelf?: boolean;
  allowedTools?: string[];
}

export interface ToolSearchResult {
  query: string;
  domain?: string;
  phase?: string;
  results: Array<ToolCatalogEntry & {
    confidence: number;
    reason: string;
  }>;
}

const CATALOG: ToolCatalogEntry[] = [
  {
    name: 'validate_syntax',
    purpose: 'Validate generated JavaScript or TypeScript syntax before returning code.',
    phases: ['validate', 'recover'],
    domains: ['p5', 'three', 'hydra', 'tone', 'strudel', 'html', 'svg', 'general'],
    keywords: ['syntax', 'parse', 'runtime', 'error', 'validate', 'javascript', 'typescript', 'code', 'catch'],
    boostKeywords: ['runtime', 'error', 'catch', 'validate', 'preview'],
    args: ['code', 'filename'],
    example: 'validate_syntax({ code, filename: "sketch.js" })',
  },
  {
    name: 'check_imports',
    purpose: 'Check whether generated imports match the target creative domain.',
    phases: ['validate', 'recover'],
    domains: ['p5', 'three', 'glsl', 'hydra', 'tone', 'strudel', 'html', 'svg', 'general'],
    keywords: ['imports', 'dependency', 'domain', 'three', 'p5', 'hydra', 'allowed', 'library'],
    boostKeywords: ['three', 'p5', 'hydra', 'library', 'import'],
    args: ['code', 'domain'],
    example: 'check_imports({ code, domain: "three" })',
  },
  {
    name: 'submit_code',
    purpose: 'Submit final generated artifact/source code once it is complete.',
    phases: ['general'],
    domains: ['p5', 'three', 'glsl', 'hydra', 'tone', 'strudel', 'html', 'svg', 'general'],
    keywords: ['submit', 'final', 'complete', 'artifact', 'source'],
    args: ['code', 'language'],
    example: 'submit_code({ code, language: "three" })',
  },
  {
    name: 'readFile',
    purpose: 'Read a repository file or targeted excerpt.',
    phases: ['inspect', 'recover'],
    domains: ['repo', 'general'],
    keywords: ['read', 'inspect', 'file', 'source', 'excerpt', 'symbol'],
    args: ['path', 'maxLines', 'pattern', 'symbol'],
    example: 'readFile({ path: "src/core/RalphLoop.ts", pattern: "run(" })',
  },
  {
    name: 'search',
    purpose: 'Search repository text with ripgrep-style pattern matching.',
    phases: ['inspect'],
    domains: ['repo', 'general'],
    keywords: ['search', 'grep', 'find', 'pattern', 'symbol', 'usage'],
    args: ['pattern', 'path', 'glob', 'maxResults'],
    example: 'search({ pattern: "PreviewServer", path: "src" })',
  },
  {
    name: 'searchCode',
    purpose: 'Search code-oriented surfaces for implementation symbols and relationships.',
    phases: ['inspect'],
    domains: ['repo', 'general'],
    keywords: ['code', 'symbol', 'implementation', 'relationship', 'usage'],
    args: ['query', 'path'],
    example: 'searchCode({ query: "generator tools" })',
  },
  {
    name: 'applyEdit',
    purpose: 'Apply a targeted code edit using exact search/replace text.',
    phases: ['edit', 'recover'],
    domains: ['repo', 'general'],
    keywords: ['edit', 'patch', 'replace', 'fix', 'modify'],
    args: ['path', 'oldString', 'newString'],
    example: 'applyEdit({ path, oldString, newString })',
  },
  {
    name: 'runBuild',
    purpose: 'Run the repository build as a broad verification gate.',
    phases: ['verify'],
    domains: ['repo', 'general'],
    keywords: ['build', 'compile', 'tsc', 'verify', 'gate'],
    args: ['timeoutMs'],
    example: 'runBuild({ timeoutMs: 120000 })',
  },
  {
    name: 'runFocusedTests',
    purpose: 'Run a focused test target for a changed file or behavior.',
    phases: ['verify'],
    domains: ['repo', 'general'],
    keywords: ['test', 'vitest', 'focused', 'unit', 'regression'],
    args: ['pattern', 'timeoutMs'],
    example: 'runFocusedTests({ pattern: "test/unit/gui-workbench-state.test.ts" })',
  },
  {
    name: 'typeCheck',
    purpose: 'Run TypeScript type checking.',
    phases: ['verify'],
    domains: ['repo', 'general'],
    keywords: ['typecheck', 'typescript', 'types', 'tsc'],
    args: ['timeoutMs'],
    example: 'typeCheck({ timeoutMs: 120000 })',
  },
  {
    name: 'runLint',
    purpose: 'Run lint checks for source hygiene.',
    phases: ['verify'],
    domains: ['repo', 'general'],
    keywords: ['lint', 'eslint', 'hygiene', 'style'],
    args: ['timeoutMs'],
    example: 'runLint({ timeoutMs: 120000 })',
  },
  {
    name: 'search_tools',
    purpose: 'Search the local tool catalog. Hidden from normal results to avoid recursion.',
    phases: ['inspect', 'general'],
    domains: ['repo', 'general'],
    keywords: ['tool', 'catalog', 'search', 'capability'],
    args: ['query', 'domain', 'phase', 'maxResults'],
    example: 'search_tools({ query: "validate three code", domain: "three" })',
  },
];

const cache = new Map<string, ToolSearchResult>();

export function searchToolCatalog(params: ToolSearchParams): ToolSearchResult {
  const normalized = normalizeParams(params);
  const cacheKey = JSON.stringify(normalized);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const tokens = tokenize(normalized.query);
  const scored = CATALOG
    .filter((entry) => normalized.includeSelf || entry.name !== 'search_tools')
    .filter((entry) => normalized.allowedTools.length === 0 || normalized.allowedTools.includes(entry.name))
    .map((entry) => scoreEntry(entry, tokens, normalized))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, normalized.maxResults)
    .map(({ entry, score, reasons }) => ({
      ...entry,
      confidence: Math.min(0.99, Number((score / 10).toFixed(2))),
      reason: reasons.join('; '),
    }));

  const result: ToolSearchResult = {
    query: normalized.query,
    domain: normalized.domain,
    phase: normalized.phase,
    results: scored,
  };
  cache.set(cacheKey, result);
  return result;
}

function normalizeParams(params: ToolSearchParams): Required<Pick<ToolSearchParams, 'query' | 'maxResults' | 'includeSelf'>> & Pick<ToolSearchParams, 'domain' | 'phase'> & { allowedTools: string[] } {
  return {
    query: String(params.query || '').trim(),
    domain: params.domain ? String(params.domain).toLowerCase() : undefined,
    phase: params.phase ? String(params.phase).toLowerCase() : undefined,
    maxResults: Math.max(1, Math.min(10, Number(params.maxResults) || 5)),
    includeSelf: Boolean(params.includeSelf),
    allowedTools: Array.isArray(params.allowedTools) ? params.allowedTools.map(String) : [],
  };
}

function scoreEntry(
  entry: ToolCatalogEntry,
  tokens: string[],
  params: ReturnType<typeof normalizeParams>,
): { entry: ToolCatalogEntry; score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (params.domain && entry.domains.includes(params.domain)) {
    score += 3;
    reasons.push(`matches domain ${params.domain}`);
  }
  if (params.phase && entry.phases.includes(params.phase as ToolCatalogPhase)) {
    score += 3;
    reasons.push(`matches phase ${params.phase}`);
  }

  const haystack = [
    entry.name,
    entry.purpose,
    ...entry.keywords,
    ...entry.domains,
    ...entry.phases,
  ].join(' ').toLowerCase();
  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  if (matchedTokens.length > 0) {
    score += matchedTokens.length;
    reasons.push(`matched ${matchedTokens.slice(0, 4).join(', ')}`);
  }

  if (entry.boostKeywords?.some((keyword) => tokens.includes(keyword))) {
    score += 2;
    reasons.push('matched boost keywords');
  }

  return { entry, score, reasons };
}

function tokenize(value: string): string[] {
  return [...new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, ' ')
      .split(/\s+/)
      .map((token) => token.replace(/\.js$/, ''))
      .filter((token) => token.length >= 2),
  )];
}

export class ToolCatalogTool extends Tool {
  readonly name = 'searchTools';
  readonly description = 'Search the local tool catalog without using an LLM';

  execute(params: unknown): Promise<ToolResult<ToolSearchResult>> {
    const raw = params as Partial<ToolSearchParams> | null | undefined;
    if (!raw?.query || typeof raw.query !== 'string') {
      return Promise.resolve({ success: false, error: 'searchTools requires params.query to be a non-empty string' });
    }
    return Promise.resolve({
      success: true,
      data: searchToolCatalog(raw as ToolSearchParams),
    });
  }
}

export const toolCatalogTool = new ToolCatalogTool();
