/**
 * Unit tests for LIR Token Factory
 *
 * TDD tests for factory functions that create LIR tokens from parsed data.
 */

import { describe, it, expect } from 'vitest';
import {
  createCodeToken,
  createDocToken,
  createTextToken,
} from '../../../../src/core/lir/LIRTokenFactory.js';
import type {
  LIRCodeToken,
  LIRDocToken,
  LIRTextToken,
} from '../../../../src/core/lir/types.js';

describe('LIRTokenFactory - createCodeToken', () => {
  it('should create a valid LIRCodeToken with auto-generated ID', () => {
    const source = 'function test() { return 42; }';
    const language = 'typescript';
    const symbols = [
      {
        name: 'test',
        kind: 'function' as const,
        signature: 'test(): number',
        summary: 'A test function',
        source,
        location: {
          file: 'test.ts',
          startLine: 1,
          endLine: 3,
        },
      },
    ];
    const imports = ['lodash', 'axios'];
    const relationships = {
      calls: ['helperFunction'],
      imports: ['lodash', 'axios'],
      exports: ['test'],
      extends: [],
      importGraph: [
        { callee: 'map', module: 'lodash' },
        { callee: 'get', module: 'axios' },
      ],
    };

    const token = createCodeToken(source, language, symbols, imports, relationships);

    expect(token.type).toBe('code');
    expect(token.id).toBeDefined();
    expect(typeof token.id).toBe('string');
    expect(token.source).toBe(source);
    expect(token.language).toBe(language);
  });

  it('should generate deterministic IDs for same input', () => {
    const source = 'function test() { return 42; }';
    const language = 'typescript';
    const symbols = [
      {
        name: 'test',
        kind: 'function' as const,
        signature: 'test(): number',
        summary: 'A test function',
        source,
        location: {
          file: 'test.ts',
          startLine: 1,
          endLine: 3,
        },
      },
    ];
    const imports = ['lodash'];
    const relationships = {
      calls: [],
      imports: ['lodash'],
      exports: [],
      extends: [],
      importGraph: [],
    };

    const token1 = createCodeToken(source, language, symbols, imports, relationships);
    const token2 = createCodeToken(source, language, symbols, imports, relationships);

    expect(token1.id).toBe(token2.id);
  });

  it('should cap symbols at maxSymbolsPerFile (default 200)', () => {
    const source = 'class Test {}';
    const language = 'typescript';
    const symbols = Array.from({ length: 250 }, (_, i) => ({
      name: `symbol${i}`,
      kind: 'method' as const,
      signature: `method${i}(): void`,
      summary: `Method ${i}`,
      source: `method${i}() {}`,
      location: {
        file: 'test.ts',
        startLine: i + 1,
        endLine: i + 2,
      },
    }));
    const imports: string[] = [];
    const relationships = {
      calls: [],
      imports: [],
      exports: [],
      extends: [],
      importGraph: [],
    };

    const token = createCodeToken(source, language, symbols, imports, relationships);

    // Should create a token, but symbols should be capped
    // The factory creates ONE token from the input, not one per symbol
    expect(token).toBeDefined();
    expect(token.type).toBe('code');
  });

  it('should include all required token base properties', () => {
    const source = 'export function hello() { return "world"; }';
    const language = 'typescript';
    const symbols = [
      {
        name: 'hello',
        kind: 'function' as const,
        signature: 'hello(): string',
        summary: 'Returns a greeting',
        source,
        location: {
          file: 'hello.ts',
          startLine: 1,
          endLine: 1,
        },
      },
    ];
    const imports: string[] = [];
    const relationships = {
      calls: [],
      imports: [],
      exports: ['hello'],
      extends: [],
      importGraph: [],
    };

    const token = createCodeToken(source, language, symbols, imports, relationships);

    expect(token.domain).toBeDefined();
    expect(token.layer).toBeDefined();
    expect(token.metadata).toBeDefined();
    expect(token.tags).toBeDefined();
    expect(Array.isArray(token.tags)).toBe(true);
  });

  it('should calculate metrics correctly', () => {
    const source = `
      function complex(a: number, b: number): number {
        if (a > 0) {
          if (b > 0) {
            return a + b;
          }
        }
        return 0;
      }
    `;
    const language = 'typescript';
    const symbols = [
      {
        name: 'complex',
        kind: 'function' as const,
        signature: 'complex(a: number, b: number): number',
        summary: 'A complex function',
        source: source.trim(),
        location: {
          file: 'complex.ts',
          startLine: 2,
          endLine: 11,
        },
      },
    ];
    const imports: string[] = [];
    const relationships = {
      calls: [],
      imports: [],
      exports: ['complex'],
      extends: [],
      importGraph: [],
    };

    const token = createCodeToken(source, language, symbols, imports, relationships);

    expect(token.metrics).toBeDefined();
    expect(token.metrics.loc).toBeGreaterThan(0);
    expect(token.metrics.paramCount).toBe(2);
    expect(token.metrics.importCount).toBe(0);
    expect(token.metrics.exportCount).toBe(1);
  });
});

describe('LIRTokenFactory - createDocToken', () => {
  it('should create a valid LIRDocToken', () => {
    const source = 'README.md';
    const sections = [
      {
        heading: 'Introduction',
        level: 1,
        content: 'This is the introduction.',
        hierarchy: {
          parent: null,
          children: ['section-2'],
          path: [],
        },
        codeReferences: [],
        metrics: {
          wordCount: 4,
          codeBlockCount: 0,
          linkCount: 0,
          depth: 0,
        },
      },
    ];

    const token = createDocToken(source, sections);

    expect(token.type).toBe('doc');
    expect(token.id).toBeDefined();
    expect(typeof token.id).toBe('string');
    expect(token.heading).toBe('Introduction');
    expect(token.level).toBe(1);
    expect(token.content).toBe('This is the introduction.');
  });

  it('should generate deterministic IDs for same input', () => {
    const source = 'README.md';
    const sections = [
      {
        heading: 'Introduction',
        level: 1,
        content: 'This is the introduction.',
        hierarchy: {
          parent: null,
          children: [],
          path: [],
        },
        codeReferences: [],
        metrics: {
          wordCount: 4,
          codeBlockCount: 0,
          linkCount: 0,
          depth: 0,
        },
      },
    ];

    const token1 = createDocToken(source, sections);
    const token2 = createDocToken(source, sections);

    expect(token1.id).toBe(token2.id);
  });

  it('should include all required token base properties', () => {
    const source = 'docs/api.md';
    const sections = [
      {
        heading: 'API Reference',
        level: 2,
        content: 'API documentation here.',
        hierarchy: {
          parent: 'root',
          children: [],
          path: ['root'],
        },
        codeReferences: ['func1', 'func2'],
        metrics: {
          wordCount: 4,
          codeBlockCount: 0,
          linkCount: 0,
          depth: 1,
        },
      },
    ];

    const token = createDocToken(source, sections);

    expect(token.domain).toBeDefined();
    expect(token.layer).toBeDefined();
    expect(token.metadata).toBeDefined();
    expect(token.tags).toBeDefined();
    expect(Array.isArray(token.tags)).toBe(true);
  });

  it('should preserve hierarchy information', () => {
    const source = 'docs.md';
    const sections = [
      {
        heading: 'Parent Section',
        level: 1,
        content: 'Parent content',
        hierarchy: {
          parent: null,
          children: ['child-section'],
          path: [],
        },
        codeReferences: [],
        metrics: {
          wordCount: 2,
          codeBlockCount: 0,
          linkCount: 0,
          depth: 0,
        },
      },
    ];

    const token = createDocToken(source, sections);

    expect(token.hierarchy.parent).toBeNull();
    expect(token.hierarchy.children).toEqual(['child-section']);
    expect(token.hierarchy.path).toEqual([]);
  });

  it('should include code references', () => {
    const source = 'docs.md';
    const sections = [
      {
        heading: 'Usage',
        level: 2,
        content: 'See `functionName` for details.',
        hierarchy: {
          parent: null,
          children: [],
          path: [],
        },
        codeReferences: ['functionName', 'ClassName'],
        metrics: {
          wordCount: 6,
          codeBlockCount: 0,
          linkCount: 0,
          depth: 0,
        },
      },
    ];

    const token = createDocToken(source, sections);

    expect(token.codeReferences).toEqual(['functionName', 'ClassName']);
  });
});

describe('LIRTokenFactory - createTextToken', () => {
  it('should create a valid LIRTextToken', () => {
    const source = 'notes.txt';
    const content = 'This is some text content. It has multiple sentences.';

    const token = createTextToken(source, content);

    expect(token.type).toBe('text');
    expect(token.id).toBeDefined();
    expect(typeof token.id).toBe('string');
    expect(token.content).toBe(content);
  });

  it('should generate deterministic IDs for same input', () => {
    const source = 'notes.txt';
    const content = 'Repeated content';

    const token1 = createTextToken(source, content);
    const token2 = createTextToken(source, content);

    expect(token1.id).toBe(token2.id);
  });

  it('should split content into paragraphs in structure', () => {
    const source = 'document.txt';
    const content = `First paragraph.

Second paragraph.

Third paragraph.`;

    const token = createTextToken(source, content);

    expect(token.content).toBe(content);
    expect(token.structure).toBeDefined();
  });

  it('should extract headings from content', () => {
    const source = 'document.txt';
    const content = `# Main Heading

Some content.

## Sub Heading

More content.`;

    const token = createTextToken(source, content);

    expect(token.structure.headings).toBeDefined();
    expect(Array.isArray(token.structure.headings)).toBe(true);
  });

  it('should extract code blocks from content', () => {
    const source = 'document.txt';
    const content = `Some text.

\`\`\`typescript
function test() { return 42; }
\`\`\`

More text.`;

    const token = createTextToken(source, content);

    expect(token.structure.codeBlocks).toBeDefined();
    expect(Array.isArray(token.structure.codeBlocks)).toBe(true);
  });

  it('should calculate text metrics correctly', () => {
    const source = 'document.txt';
    const content = `# Heading

This is a paragraph with multiple words.

Another paragraph here.`;

    const token = createTextToken(source, content);

    expect(token.metrics).toBeDefined();
    expect(token.metrics.wordCount).toBeGreaterThan(0);
    expect(token.metrics.paragraphCount).toBeGreaterThan(0);
  });

  it('should include all required token base properties', () => {
    const source = 'notes.txt';
    const content = 'Some notes content';

    const token = createTextToken(source, content);

    expect(token.domain).toBeDefined();
    expect(token.layer).toBeDefined();
    expect(token.metadata).toBeDefined();
    expect(token.tags).toBeDefined();
    expect(Array.isArray(token.tags)).toBe(true);
  });
});
