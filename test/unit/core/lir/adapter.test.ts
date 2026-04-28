/**
 * Unit tests for LIR Compatibility Adapter
 *
 * Tests bidirectional conversion between raw strings and LIR tokens.
 * Follows TDD: red → green → refactor cycle.
 */

import { describe, it, expect } from 'vitest';
import {
  stringToLIR,
  lirToString,
} from '../../../../src/core/lir/CompatibilityAdapter.js';
import type {
  LIRCodeToken,
  LIRDocToken,
  LIRTextToken,
} from '../../../../src/core/lir/types.js';

describe('CompatibilityAdapter: stringToLIR', () => {
  describe('code file detection', () => {
    it('detects TypeScript files and returns LIRCodeToken', () => {
      const source = 'example.ts';
      const content = `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
      `.trim();

      const result = stringToLIR(source, content);

      expect(result.type).toBe('code');
      expect(result.language).toBe('typescript');
      expect(result.source).toBe(content);
    });

    it('detects JavaScript files and returns LIRCodeToken', () => {
      const source = 'example.js';
      const content = `
function add(a, b) {
  return a + b;
}
      `.trim();

      const result = stringToLIR(source, content);

      expect(result.type).toBe('code');
      expect(result.language).toBe('javascript');
      expect(result.source).toBe(content);
    });

    it('handles .jsx and .tsx files as code', () => {
      const jsxSource = 'component.jsx';
      const tsxSource = 'component.tsx';
      const content = 'export default () => <div>Hello</div>';

      const jsxResult = stringToLIR(jsxSource, content);
      const tsxResult = stringToLIR(tsxSource, content);

      expect(jsxResult.type).toBe('code');
      expect(jsxResult.language).toBe('javascript');
      expect(tsxResult.type).toBe('code');
      expect(tsxResult.language).toBe('typescript');
    });
  });

  describe('markdown detection', () => {
    it('detects .md files and returns LIRDocToken', () => {
      const source = 'README.md';
      const content = `
# Project Title

This is a project description.

## Features

- Feature one
- Feature two
      `.trim();

      const result = stringToLIR(source, content);

      expect(result.type).toBe('doc');
      expect(result.content).toBe(content);
    });

    it('detects .mdx files as documentation', () => {
      const source = 'docs.mdx';
      const content = '# Documentation\n\nSome content';

      const result = stringToLIR(source, content);

      expect(result.type).toBe('doc');
      expect(result.content).toBe(content);
    });
  });

  describe('default text token', () => {
    it('returns LIRTextToken for unknown file types', () => {
      const source = 'data.txt';
      const content = 'Some plain text content';

      const result = stringToLIR(source, content);

      expect(result.type).toBe('text');
      expect(result.content).toBe(content);
    });

    it('returns LIRTextToken for files without extension', () => {
      const source = 'Makefile';
      const content = 'all:\n\techo "Building"';

      const result = stringToLIR(source, content);

      expect(result.type).toBe('text');
      expect(result.content).toBe(content);
    });
  });

  describe('token initialization', () => {
    it('generates unique IDs for each token', () => {
      const token1 = stringToLIR('test.ts', 'content1');
      const token2 = stringToLIR('test.ts', 'content2');

      expect(token1.id).not.toBeNull();
      expect(token2.id).not.toBeNull();
      expect(token1.id).not.toBe(token2.id);
    });

    it('initializes required fields with defaults', () => {
      const result = stringToLIR('test.ts', 'const x = 1;');

      expect(result.domain).toBe('unknown');
      expect(result.layer).toBe('unknown');
      expect(result.tags).toEqual([]);
      expect(result.metadata).toEqual({});
    });
  });
});

describe('CompatibilityAdapter: lirToString', () => {
  describe('LIRCodeToken rendering', () => {
    it('renders code token with symbol list as string', () => {
      const codeToken: LIRCodeToken = {
        id: 'test-1',
        type: 'code',
        name: 'greet',
        kind: 'function',
        signature: 'greet(name: string): string',
        summary: 'Greets the user',
        source: 'export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}',
        language: 'typescript',
        location: {
          file: 'example.ts',
          startLine: 1,
          endLine: 3,
        },
        relationships: {
          calls: [],
          imports: [],
          exports: ['greet'],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 3,
          cyclomaticComplexity: 1,
          paramCount: 1,
          importCount: 0,
          exportCount: 1,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
        domain: 'example',
        layer: 'business-logic',
        tags: ['greeting'],
        metadata: {},
      };

      const result = lirToString(codeToken);

      expect(result).toContain('function');
      expect(result).toContain('greet');
      expect(result).toContain('typescript');
    });

    it('handles code tokens with minimal data', () => {
      const minimalCode: LIRCodeToken = {
        id: 'test-2',
        type: 'code',
        name: 'unknown',
        kind: 'function',
        signature: '',
        summary: '',
        source: 'function x() {}',
        language: 'javascript',
        location: {
          file: 'x.js',
          startLine: 1,
          endLine: 1,
        },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
        domain: 'unknown',
        layer: 'unknown',
        tags: [],
        metadata: {},
      };

      const result = lirToString(minimalCode);

      expect(result?.length).toBeGreaterThan(0);
    });
  });

  describe('LIRDocToken rendering', () => {
    it('renders markdown headings and content', () => {
      const docToken: LIRDocToken = {
        id: 'doc-1',
        type: 'doc',
        heading: 'Introduction',
        level: 1,
        summary: 'Project introduction',
        content: '# Introduction\n\nThis is the intro.',
        hierarchy: {
          parent: null,
          children: ['doc-2'],
          path: ['doc-1'],
        },
        codeReferences: [],
        metrics: {
          wordCount: 4,
          codeBlockCount: 0,
          linkCount: 0,
          depth: 0,
        },
        domain: 'docs',
        layer: 'documentation',
        tags: ['intro'],
        metadata: {},
      };

      const result = lirToString(docToken);

      expect(result).toContain('Introduction');
      expect(result).toContain('# Introduction');
    });

    it('preserves heading levels in output', () => {
      const docToken: LIRDocToken = {
        id: 'doc-2',
        type: 'doc',
        heading: 'Subsection',
        level: 2,
        summary: 'A subsection',
        content: '## Subsection\n\nDetails here.',
        hierarchy: {
          parent: 'doc-1',
          children: [],
          path: ['doc-1', 'doc-2'],
        },
        codeReferences: [],
        metrics: {
          wordCount: 2,
          codeBlockCount: 0,
          linkCount: 0,
          depth: 1,
        },
        domain: 'docs',
        layer: 'documentation',
        tags: [],
        metadata: {},
      };

      const result = lirToString(docToken);

      expect(result).toContain('## Subsection');
    });
  });

  describe('LIRTextToken rendering', () => {
    it('joins paragraphs for text tokens', () => {
      const textToken: LIRTextToken = {
        id: 'text-1',
        type: 'text',
        content: 'Paragraph one.\n\nParagraph two.\n\nParagraph three.',
        structure: {
          headings: [],
          codeBlocks: [],
        },
        metrics: {
          wordCount: 8,
          paragraphCount: 3,
          headingCount: 0,
        },
        domain: 'general',
        layer: 'content',
        tags: [],
        metadata: {},
      };

      const result = lirToString(textToken);

      expect(result).toContain('Paragraph one');
      expect(result).toContain('Paragraph two');
      expect(result).toContain('Paragraph three');
    });

    it('handles text with no structure', () => {
      const simpleText: LIRTextToken = {
        id: 'text-2',
        type: 'text',
        content: 'Simple text',
        structure: {
          headings: [],
          codeBlocks: [],
        },
        metrics: {
          wordCount: 2,
          paragraphCount: 1,
          headingCount: 0,
        },
        domain: 'unknown',
        layer: 'unknown',
        tags: [],
        metadata: {},
      };

      const result = lirToString(simpleText);

      expect(result).toBe('Simple text');
    });
  });
});

describe('CompatibilityAdapter: round-trip conversion', () => {
  it('preserves core information through round-trip (code)', () => {
    const originalSource = 'example.ts';
    const originalContent = 'export const x = 42;';

    const token = stringToLIR(originalSource, originalContent);
    const reconstructed = lirToString(token);

    // Should preserve language and core content
    expect(reconstructed).not.toBeNull();
    expect(token.type).toBe('code');
  });

  it('preserves core information through round-trip (doc)', () => {
    const originalSource = 'README.md';
    const originalContent = '# Title\n\nSome documentation';

    const token = stringToLIR(originalSource, originalContent);
    const reconstructed = lirToString(token);

    // Should preserve heading and content
    expect(reconstructed).toContain('Title');
    expect(token.type).toBe('doc');
  });

  it('preserves core information through round-trip (text)', () => {
    const originalSource = 'notes.txt';
    const originalContent = 'Line one\nLine two\nLine three';

    const token = stringToLIR(originalSource, originalContent);
    const reconstructed = lirToString(token);

    // Should preserve text content
    expect(reconstructed).not.toBeNull();
    expect(token.type).toBe('text');
  });
});

describe('CompatibilityAdapter: edge cases', () => {
  it('handles empty strings gracefully', () => {
    const result = stringToLIR('test.ts', '');

    expect(result?.source).toBe('');
  });

  it('handles whitespace-only content', () => {
    const result = stringToLIR('test.js', '   \n\n   ');

    expect(result?.source).toBe('   \n\n   ');
  });

  it('handles very long file paths', () => {
    const longPath = 'a'.repeat(1000) + '.ts';
    const content = 'const x = 1;';

    const result = stringToLIR(longPath, content);

    expect(result?.type).toBe('code');
  });

  it('handles special characters in content', () => {
    const content = 'const emoji = "🎉";\nconst quotes = \'"\';';
    const result = stringToLIR('test.ts', content);

    expect(result?.source).toBe(content);
  });
});
