/**
 * LIR Token Factory
 *
 * Pure factory functions to create LIR tokens from parsed data.
 * These functions handle ID generation, metrics calculation, and
 * ensure all token properties are properly initialized.
 */

import type {
  LIRCodeToken,
  LIRDocToken,
  LIRTextToken,
  SymbolKind,
} from './types.js';

/**
 * Default maximum number of symbols to process per file
 */
const DEFAULT_MAX_SYMBOLS_PER_FILE = 200;

/**
 * Generate a deterministic ID from input data
 *
 * Uses a simple hash function to create consistent IDs for the same input.
 * Identical inputs will always produce the same ID.
 */
function generateId(...parts: (string | number | object)[]): string {
  const str = parts
    .map((part) => {
      if (typeof part === 'object') {
        return JSON.stringify(part);
      }
      return String(part);
    })
    .join('|');

  // Simple hash function for deterministic IDs
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use only the hash for deterministic IDs (no timestamp)
  // This ensures identical inputs produce identical IDs
  return Math.abs(hash).toString(36);
}

/**
 * Count lines of code (excluding empty lines and comments)
 */
function countLOC(source: string, _language: string): number {
  const lines = source.split('\n');
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and simple comment lines
    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith('*')) {
      count++;
    }
  }

  return count;
}

/**
 * Estimate cyclomatic complexity from source code
 */
function estimateComplexity(source: string): number {
  // Count decision points: if, for, while, case, catch, &&, ||
  const decisionPoints = (
    source.match(/\b(if|for|while|case|catch|&&|\|\|)\b/g) || []
  ).length;

  return decisionPoints + 1; // Complexity = decision points + 1
}

/**
 * Count words in a string
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extract headings from markdown/text content
 */
export function extractHeadings(content: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match markdown headings: #, ##, ###, etc.
    const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2],
      });
    }
  }

  return headings;
}

/**
 * Extract code blocks from markdown/text content
 */
export function extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
  const codeBlocks: Array<{ language: string; code: string }> = [];
  // Match markdown code blocks: ```language code ```
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }

  return codeBlocks;
}

/**
 * Count paragraphs in text content
 */
export function countParagraphs(content: string): number {
  return content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

/**
 * Create a LIR code token from parsed symbol data
 *
 * @param source - Full source code content
 * @param language - Programming language identifier
 * @param symbols - Array of parsed symbols from the source
 * @param imports - Array of import statement module names
 * @param relationships - Relationship data (calls, imports, exports, etc.)
 * @param maxSymbolsPerFile - Maximum symbols to process (default: 200)
 * @returns A valid LIRCodeToken
 */
export function createCodeToken(
  source: string,
  language: string,
  symbols: Array<{
    name: string;
    kind: SymbolKind;
    signature: string;
    summary: string;
    source: string;
    location: {
      file: string;
      startLine: number;
      endLine: number;
    };
  }>,
  imports: string[],
  relationships: {
    calls: string[];
    imports: string[];
    exports: string[];
    extends: string[];
    importGraph: Array<{
      callee: string;
      module: string;
    }>;
  },
  maxSymbolsPerFile: number = DEFAULT_MAX_SYMBOLS_PER_FILE,
): LIRCodeToken {
  // Cap symbols at maxSymbolsPerFile
  const cappedSymbols = symbols.slice(0, maxSymbolsPerFile);

  // Use the first symbol (or create a synthetic one if no symbols)
  const primarySymbol = cappedSymbols[0] || {
    name: 'unknown',
    kind: 'function' as SymbolKind,
    signature: 'unknown()',
    summary: 'Unknown symbol',
    source,
    location: {
      file: 'unknown',
      startLine: 1,
      endLine: source.split('\n').length,
    },
  };

  const id = generateId(
    primarySymbol.name,
    primarySymbol.signature,
    language,
    primarySymbol.location.file,
  );

  const loc = countLOC(source, language);
  const cyclomaticComplexity = estimateComplexity(source);

  const token: LIRCodeToken = {
    type: 'code',
    id,
    domain: 'general',
    layer: 'application',
    metadata: {},
    tags: [],
    name: primarySymbol.name,
    kind: primarySymbol.kind,
    signature: primarySymbol.signature,
    summary: primarySymbol.summary,
    source: primarySymbol.source,
    language,
    location: primarySymbol.location,
    relationships: {
      calls: relationships.calls,
      imports: relationships.imports,
      exports: relationships.exports,
      extends: relationships.extends,
      importGraph: relationships.importGraph,
    },
    metrics: {
      loc,
      cyclomaticComplexity,
      paramCount: extractParamCount(primarySymbol.signature),
      importCount: imports.length,
      exportCount: relationships.exports.length,
      callCount: relationships.calls.length,
      classDepth: 0, // Would need AST analysis to compute accurately
      nestingDepth: estimateNestingDepth(primarySymbol.source),
    },
  };

  return token;
}

/**
 * Extract parameter count from a function signature
 */
function extractParamCount(signature: string): number {
  const match = signature.match(/\(([^)]*)\)/);
  if (!match) return 0;

  const params = match[1].trim();
  if (!params) return 0;

  // Simple split by comma - not perfect but works for most cases
  return params.split(',').length;
}

/**
 * Estimate maximum nesting depth from source code
 */
function estimateNestingDepth(source: string): number {
  const lines = source.split('\n');
  let maxDepth = 0;

  for (const line of lines) {
    // Count indentation by tabs or spaces
    const trimmed = line.trimLeft();
    const indentSize = line.length - trimmed.length;
    const depth = Math.ceil(indentSize / 2); // Assume 2 spaces per level
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth;
}

/**
 * Create a LIR documentation token from parsed section data
 *
 * @param source - Source file path
 * @param sections - Array of parsed documentation sections
 * @returns A valid LIRDocToken
 */
export function createDocToken(
  source: string,
  sections: Array<{
    heading: string;
    level: number;
    content: string;
    hierarchy: {
      parent: string | null;
      children: string[];
      path: string[];
    };
    codeReferences: string[];
    metrics: {
      wordCount: number;
      codeBlockCount: number;
      linkCount: number;
      depth: number;
    };
  }>,
): LIRDocToken {
  // Use the first section
  const primarySection = sections[0] || {
    heading: 'Untitled',
    level: 1,
    content: '',
    hierarchy: {
      parent: null,
      children: [],
      path: [],
    },
    codeReferences: [],
    metrics: {
      wordCount: 0,
      codeBlockCount: 0,
      linkCount: 0,
      depth: 0,
    },
  };

  const id = generateId(source, primarySection.heading, primarySection.level);

  const token: LIRDocToken = {
    type: 'doc',
    id,
    domain: 'documentation',
    layer: 'content',
    metadata: {},
    tags: [],
    heading: primarySection.heading,
    level: primarySection.level,
    summary: primarySection.content.split('\n')[0].substring(0, 200),
    content: primarySection.content,
    hierarchy: primarySection.hierarchy,
    codeReferences: primarySection.codeReferences,
    metrics: primarySection.metrics,
  };

  return token;
}

/**
 * Create a LIR text token from plain text content
 *
 * Extracts structural elements (headings, code blocks) and computes metrics.
 *
 * @param source - Source file path or identifier
 * @param content - Plain text content
 * @returns A valid LIRTextToken
 */
export function createTextToken(
  source: string,
  content: string,
): LIRTextToken {
  const id = generateId(source, content);
  const headings = extractHeadings(content);
  const codeBlocks = extractCodeBlocks(content);

  const token: LIRTextToken = {
    type: 'text',
    id,
    domain: 'text',
    layer: 'content',
    metadata: {},
    tags: [],
    content,
    structure: {
      headings,
      codeBlocks,
    },
    metrics: {
      wordCount: countWords(content),
      paragraphCount: countParagraphs(content),
      headingCount: headings.length,
    },
  };

  return token;
}
