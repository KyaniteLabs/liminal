/**
 * LIR Token Factory - Creates LIR tokens from parsed data
 */

import type { LIRCodeToken, LIRDocToken, LIRTextToken } from './types.js';

function generateId(source: string): string {
  // Simple hash-based ID generation for deterministic IDs
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `lir-${Math.abs(hash).toString(36)}`;
}

interface CodeSymbol {
  name: string;
  kind: 'function' | 'class' | 'method' | 'interface' | 'variable' | 'property' | 'enum' | 'type';
  signature: string;
  summary: string;
  source: string;
  location: {
    file: string;
    startLine: number;
    endLine: number;
  };
}

interface Relationships {
  calls: string[];
  imports: string[];
  exports: string[];
  extends: string[];
  importGraph: Array<{ callee: string; module: string }>;
}

export function createCodeToken(
  source: string,
  language: string,
  symbols: CodeSymbol[],
  imports: string[],
  relationships: Relationships
): LIRCodeToken {
  const id = generateId(source);
  const mainSymbol = symbols[0] || {
    name: 'anonymous',
    kind: 'function' as const,
    signature: '()',
    summary: '',
    source,
    location: { file: '', startLine: 1, endLine: 1 },
  };

  // Calculate simple metrics
  const loc = source.split('\n').filter(line => line.trim().length > 0).length;
  const cyclomaticComplexity = (source.match(/if|while|for|switch|catch|\?/g) || []).length + 1;

  return {
    id,
    type: 'code',
    name: mainSymbol.name,
    kind: mainSymbol.kind,
    signature: mainSymbol.signature,
    summary: mainSymbol.summary,
    source,
    language,
    domain: '',
    layer: '',
    metadata: {},
    tags: [],
    location: mainSymbol.location,
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
      paramCount: (mainSymbol.signature.match(/,/g) || []).length + 1,
      importCount: imports.length,
      exportCount: relationships.exports.length,
      callCount: relationships.calls.length,
      classDepth: 0,
      nestingDepth: 0,
    },
  };
}

interface DocHierarchy {
  parent: string | null;
  children: string[];
  path: string[];
}

interface DocSection {
  heading: string;
  level: number;
  content: string;
  hierarchy: DocHierarchy;
  codeReferences: string[];
  metrics: {
    wordCount: number;
    codeBlockCount: number;
    linkCount: number;
    depth: number;
  };
}

export function createDocToken(
  source: string,
  sections: DocSection[]
): LIRDocToken {
  // Use the first section as the main token data
  const mainSection = sections[0] || {
    heading: 'Untitled',
    level: 1,
    content: '',
    hierarchy: { parent: null, children: [], path: [] },
    codeReferences: [],
    metrics: { wordCount: 0, codeBlockCount: 0, linkCount: 0, depth: 0 },
  };

  const id = generateId(source + mainSection.heading);

  return {
    id,
    type: 'doc',
    heading: mainSection.heading,
    level: mainSection.level,
    summary: mainSection.content.split('\n')[0] || '',
    content: mainSection.content,
    hierarchy: {
      parent: mainSection.hierarchy.parent,
      children: mainSection.hierarchy.children,
      path: mainSection.hierarchy.path,
    },
    codeReferences: mainSection.codeReferences,
    domain: '',
    layer: '',
    metadata: {},
    tags: [],
    metrics: {
      wordCount: mainSection.metrics.wordCount,
      codeBlockCount: mainSection.metrics.codeBlockCount,
      linkCount: mainSection.metrics.linkCount,
      depth: mainSection.metrics.depth,
    },
  };
}

export function createTextToken(source: string, content: string): LIRTextToken {
  const id = generateId(source + content);

  // Extract headings
  const headings: Array<{ level: number; text: string }> = [];
  const headingMatches = content.matchAll(/^(#{1,6})\s+(.+)$/gm);
  for (const match of headingMatches) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
    });
  }

  // Extract code blocks
  const codeBlocks: Array<{ language: string; code: string }> = [];
  const codeBlockMatches = content.matchAll(/```(\w+)?\n([\s\S]*?)```/g);
  for (const match of codeBlockMatches) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }

  // Calculate metrics
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  const paragraphCount = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

  return {
    id,
    type: 'text',
    content,
    structure: {
      headings,
      codeBlocks,
    },
    domain: '',
    layer: '',
    metadata: {},
    tags: [],
    metrics: {
      wordCount,
      paragraphCount,
      headingCount: headings.length,
    },
  };
}
