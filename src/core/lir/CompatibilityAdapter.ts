/**
 * LIR Compatibility Adapter
 *
 * Bidirectional converters for transforming raw strings into LIR tokens
 * and vice versa. This adapter handles legacy string data flowing through
 * the system, providing bridge functionality between string-based and
 * token-based representations.
 *
 * Since we're converting from raw strings (not parsed AST), the LIR tokens
 * created will have minimal data — just source, language detection, and
 * basic structure. Full AST-based parsing is handled by specialized extractors.
 */

import type {
  LIRCodeToken,
  LIRDocToken,
  LIRTextToken,
  LIRToken,
  SymbolKind,
} from './types.js';

/**
 * Language detection based on file extension
 */
function detectLanguage(source: string): string {
  const ext = source.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    php: 'php',
    swift: 'swift',
    scala: 'scala',
    sh: 'bash',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
  };

  return languageMap[ext || ''] || 'unknown';
}

/**
 * Detect token type based on file extension
 */
function detectTokenType(source: string): 'code' | 'doc' | 'text' {
  const ext = source.split('.').pop()?.toLowerCase();

  const codeExtensions = [
    'ts',
    'tsx',
    'js',
    'jsx',
    'mjs',
    'cjs',
    'py',
    'rb',
    'go',
    'rs',
    'java',
    'kt',
    'cs',
    'cpp',
    'c',
    'php',
    'swift',
    'scala',
    'sh',
  ];

  const docExtensions = ['md', 'mdx', 'rst'];

  if (codeExtensions.includes(ext || '')) {
    return 'code';
  }
  if (docExtensions.includes(ext || '')) {
    return 'doc';
  }
  return 'text';
}

/**
 * Generate a unique ID for a token
 */
function generateId(): string {
  return `lir-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract headings from markdown content
 */
function extractHeadings(content: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      headings.push({ level, text });
    }
  }

  return headings;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Estimate paragraph count
 */
function estimateParagraphs(text: string): number {
  return text.split(/\n\n+/).filter(Boolean).length;
}

/**
 * Convert a raw string and source identifier into an LIR token
 *
 * This function detects the type of content based on the source filename
 * and creates an appropriate LIR token with minimal extracted information.
 * Full parsing is handled by specialized extractors.
 *
 * @param source - Source identifier (usually filename/path)
 * @param content - Raw string content to convert
 * @returns Appropriate LIR token type (Code, Doc, or Text)
 */
export function stringToLIR(source: string, content: string): LIRToken {
  const tokenType = detectTokenType(source);
  const language = detectLanguage(source);
  const id = generateId();

  const baseProps = {
    id,
    domain: 'unknown',
    layer: 'unknown',
    tags: [],
    metadata: {},
  };

  if (tokenType === 'code') {
    // For code files, create a minimal LIRCodeToken
    const codeToken: LIRCodeToken = {
      ...baseProps,
      type: 'code',
      name: source.split('/').pop() || 'unknown',
      kind: 'function' as SymbolKind,
      signature: '',
      summary: '',
      source: content,
      language,
      location: {
        file: source,
        startLine: 1,
        endLine: content.split('\n').length,
      },
      relationships: {
        calls: [],
        imports: [],
        exports: [],
        extends: [],
        importGraph: [],
      },
      metrics: {
        loc: content.split('\n').filter(line => line.trim()).length,
        cyclomaticComplexity: 1,
        paramCount: 0,
        importCount: 0,
        exportCount: 0,
        callCount: 0,
        classDepth: 0,
        nestingDepth: 0,
      },
    };
    return codeToken;
  }

  if (tokenType === 'doc') {
    // For documentation files, create a minimal LIRDocToken
    const headings = extractHeadings(content);
    const firstHeading = headings[0];
    const level = firstHeading?.level || 1;

    const docToken: LIRDocToken = {
      ...baseProps,
      type: 'doc',
      heading: firstHeading?.text || source.split('/').pop() || 'Untitled',
      level,
      summary: content.split('\n')[0].substring(0, 100),
      content,
      hierarchy: {
        parent: null,
        children: [],
        path: [id],
      },
      codeReferences: [],
      metrics: {
        wordCount: countWords(content),
        codeBlockCount: (content.match(/```/g) || []).length / 2,
        linkCount: (content.match(/\[.*?\]\(.*?\)/g) || []).length,
        depth: 0,
      },
    };
    return docToken;
  }

  // Default to text token
  const headings = extractHeadings(content);
  const textToken: LIRTextToken = {
    ...baseProps,
    type: 'text',
    content,
    structure: {
      headings,
      codeBlocks: [],
    },
    metrics: {
      wordCount: countWords(content),
      paragraphCount: estimateParagraphs(content),
      headingCount: headings.length,
    },
  };
  return textToken;
}

/**
 * Convert an LIR token back to a readable string representation
 *
 * This function produces a human-readable string from the token,
 * preserving core information. The output is not byte-perfect
 * (structure is preserved but exact formatting may differ).
 *
 * @param token - LIR token to convert
 * @returns String representation of the token
 */
export function lirToString(token: LIRToken): string {
  if (token.type === 'code') {
    // Render code token with symbol information
    const parts: string[] = [];

    if (token.name) {
      parts.push(`// Symbol: ${token.kind} ${token.name}`);
    }

    if (token.signature) {
      parts.push(`// Signature: ${token.signature}`);
    }

    if (token.summary) {
      parts.push(`// Summary: ${token.summary}`);
    }

    parts.push(`// Language: ${token.language}`);
    parts.push(`// Location: ${token.location.file}:${token.location.startLine}-${token.location.endLine}`);

    if (token.relationships.exports.length > 0) {
      parts.push(`// Exports: ${token.relationships.exports.join(', ')}`);
    }

    parts.push('');
    parts.push(token.source);

    return parts.join('\n');
  }

  if (token.type === 'doc') {
    // Render documentation token with heading hierarchy
    const parts: string[] = [];

    // Add heading with appropriate level
    const headingPrefix = '#'.repeat(token.level);
    parts.push(`${headingPrefix} ${token.heading}`);
    parts.push('');

    // Add content
    parts.push(token.content);
    parts.push('');

    // Add metadata as comments
    if (token.summary) {
      parts.push(`<!-- Summary: ${token.summary} -->`);
    }

    if (token.hierarchy.path.length > 1) {
      parts.push(`<!-- Path: ${token.hierarchy.path.join(' → ')} -->`);
    }

    if (token.codeReferences.length > 0) {
      parts.push(`<!-- References: ${token.codeReferences.join(', ')} -->`);
    }

    return parts.join('\n');
  }

  // Text token - join paragraphs and structure
  if (token.type === 'text') {
    const lines: string[] = [];

    // Add headings if present
    for (const heading of token.structure.headings) {
      const prefix = '#'.repeat(heading.level);
      lines.push(`${prefix} ${heading.text}`);
      lines.push('');
    }

    // Add content
    lines.push(token.content);

    return lines.join('\n');
  }

  // Fallback (should never reach here with proper typing)
  return String(token);
}
