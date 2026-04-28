import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  LIRToken,
  LIRCodeToken,
  LIRDocToken,
  LIRTextToken,
  SymbolKind,
} from '../../../src/core/lir/types.js';

// Read schema.json directly - resolve from test file location
const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '../../../../src/core/lir/schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

describe('LIR Type Definitions', () => {
  describe('LIRCodeToken', () => {
    it('accepts valid code token with all required fields', () => {
      const validCodeToken: LIRCodeToken = {
        type: 'code',
        id: 'test-fn-1',
        name: 'testFunction',
        kind: 'function' as SymbolKind,
        signature: 'testFunction(arg: string): void',
        summary: 'A test function',
        source: 'function testFunction(arg: string) { return; }',
        language: 'typescript',
        location: {
          file: 'src/test.ts',
          startLine: 1,
          endLine: 5,
        },
        relationships: {
          calls: ['otherFunction'],
          imports: ['lodash'],
          exports: [],
          extends: [],
          importGraph: [{ callee: 'map', module: 'lodash' }],
        },
        metrics: {
          loc: 5,
          cyclomaticComplexity: 1,
          paramCount: 1,
          importCount: 1,
          exportCount: 0,
          callCount: 1,
          classDepth: 0,
          nestingDepth: 0,
        },
        domain: 'test-domain',
        layer: 'test-layer',
        metadata: {},
        tags: ['test', 'unit'],
      };

      expect(validCodeToken.type).toBe('code');
      expect(validCodeToken.id).toBe('test-fn-1');
      expect(validCodeToken.name).toBe('testFunction');
    });

    it('accepts valid code token with optional score', () => {
      const tokenWithScore: LIRCodeToken = {
        type: 'code',
        id: 'test-fn-2',
        name: 'scoredFunction',
        kind: 'function' as SymbolKind,
        signature: 'scoredFunction(): number',
        summary: 'A function with a score',
        source: 'function scoredFunction() { return 42; }',
        language: 'typescript',
        location: { file: 'src/test.ts', startLine: 1, endLine: 2 },
        relationships: { calls: [], imports: [], exports: [], extends: [], importGraph: [] },
        metrics: {
          loc: 2,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
        score: 0.85,
      };

      expect(tokenWithScore.score).toBe(0.85);
    });

    it('has all 8 required metric fields', () => {
      const codeToken: LIRCodeToken = {
        type: 'code',
        id: 'metrics-test',
        name: 'metricsTest',
        kind: 'function' as SymbolKind,
        signature: 'metricsTest()',
        summary: 'Test metrics',
        source: 'function metricsTest() {}',
        language: 'typescript',
        location: { file: 'src/test.ts', startLine: 1, endLine: 1 },
        relationships: { calls: [], imports: [], exports: [], extends: [], importGraph: [] },
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
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
      };

      expect(codeToken.metrics).toHaveProperty('loc');
      expect(codeToken.metrics).toHaveProperty('cyclomaticComplexity');
      expect(codeToken.metrics).toHaveProperty('paramCount');
      expect(codeToken.metrics).toHaveProperty('importCount');
      expect(codeToken.metrics).toHaveProperty('exportCount');
      expect(codeToken.metrics).toHaveProperty('callCount');
      expect(codeToken.metrics).toHaveProperty('classDepth');
      expect(codeToken.metrics).toHaveProperty('nestingDepth');
    });

    it('has all 5 relationship arrays', () => {
      const codeToken: LIRCodeToken = {
        type: 'code',
        id: 'rel-test',
        name: 'relationshipTest',
        kind: 'function' as SymbolKind,
        signature: 'relationshipTest()',
        summary: 'Test relationships',
        source: 'function relationshipTest() {}',
        language: 'typescript',
        location: { file: 'src/test.ts', startLine: 1, endLine: 1 },
        relationships: {
          calls: ['fn1', 'fn2'],
          imports: ['module-a', 'module-b'],
          exports: ['exportedFn'],
          extends: ['BaseClass'],
          importGraph: [{ callee: 'map', module: 'lodash' }, { callee: 'filter', module: 'lodash' }],
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
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
      };

      expect(Array.isArray(codeToken.relationships.calls)).toBe(true);
      expect(Array.isArray(codeToken.relationships.imports)).toBe(true);
      expect(Array.isArray(codeToken.relationships.exports)).toBe(true);
      expect(Array.isArray(codeToken.relationships.extends)).toBe(true);
      expect(Array.isArray(codeToken.relationships.importGraph)).toBe(true);
    });
  });

  describe('LIRDocToken', () => {
    it('accepts valid doc token with all required fields', () => {
      const validDocToken: LIRDocToken = {
        type: 'doc',
        id: 'doc-1',
        heading: 'Introduction',
        level: 1,
        summary: 'An introduction to the system',
        content: 'This is the introduction content.',
        hierarchy: {
          parent: null,
          children: ['doc-2', 'doc-3'],
          path: ['doc-1'],
        },
        codeReferences: ['fn-1', 'class-1'],
        metrics: {
          wordCount: 8,
          codeBlockCount: 0,
          linkCount: 0,
          depth: 0,
        },
        domain: 'docs',
        layer: 'user-guide',
        metadata: {},
        tags: ['intro', 'getting-started'],
      };

      expect(validDocToken.type).toBe('doc');
      expect(validDocToken.heading).toBe('Introduction');
      expect(validDocToken.level).toBe(1);
    });

    it('accepts valid doc token with parent hierarchy', () => {
      const docWithParent: LIRDocToken = {
        type: 'doc',
        id: 'doc-2',
        heading: 'Subsection',
        level: 2,
        summary: 'A subsection',
        content: 'Subsection content',
        hierarchy: {
          parent: 'doc-1',
          children: [],
          path: ['doc-1', 'doc-2'],
        },
        codeReferences: [],
        metrics: {
          wordCount: 3,
          codeBlockCount: 0,
          linkCount: 0,
          depth: 1,
        },
        domain: 'docs',
        layer: 'user-guide',
        metadata: {},
        tags: [],
      };

      expect(docWithParent.hierarchy.parent).toBe('doc-1');
      expect(docWithParent.hierarchy.path).toEqual(['doc-1', 'doc-2']);
    });

    it('has all 4 doc metric fields', () => {
      const docToken: LIRDocToken = {
        type: 'doc',
        id: 'doc-metrics',
        heading: 'Metrics Test',
        level: 1,
        summary: 'Testing doc metrics',
        content: 'Content',
        hierarchy: { parent: null, children: [], path: ['doc-metrics'] },
        codeReferences: [],
        metrics: {
          wordCount: 1,
          codeBlockCount: 2,
          linkCount: 3,
          depth: 0,
        },
        domain: 'docs',
        layer: 'test',
        metadata: {},
        tags: [],
      };

      expect(docToken.metrics).toHaveProperty('wordCount');
      expect(docToken.metrics).toHaveProperty('codeBlockCount');
      expect(docToken.metrics).toHaveProperty('linkCount');
      expect(docToken.metrics).toHaveProperty('depth');
    });
  });

  describe('LIRTextToken', () => {
    it('accepts valid text token with all required fields', () => {
      const validTextToken: LIRTextToken = {
        type: 'text',
        id: 'text-1',
        content: 'This is plain text content.',
        structure: {
          headings: [
            { level: 1, text: 'Main Heading' },
            { level: 2, text: 'Subheading' },
          ],
          codeBlocks: [
            { language: 'typescript', code: 'const x = 1;' },
          ],
        },
        metrics: {
          wordCount: 5,
          paragraphCount: 1,
          headingCount: 2,
        },
        domain: 'general',
        layer: 'content',
        metadata: {},
        tags: ['plain-text'],
      };

      expect(validTextToken.type).toBe('text');
      expect(validTextToken.content).toBe('This is plain text content.');
      expect(validTextToken.structure.headings).toHaveLength(2);
      expect(validTextToken.structure.codeBlocks).toHaveLength(1);
    });

    it('has all 3 text metric fields', () => {
      const textToken: LIRTextToken = {
        type: 'text',
        id: 'text-metrics',
        content: 'Content',
        structure: { headings: [], codeBlocks: [] },
        metrics: {
          wordCount: 1,
          paragraphCount: 2,
          headingCount: 3,
        },
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
      };

      expect(textToken.metrics).toHaveProperty('wordCount');
      expect(textToken.metrics).toHaveProperty('paragraphCount');
      expect(textToken.metrics).toHaveProperty('headingCount');
    });
  });

  describe('Type Discrimination', () => {
    it('narrows type correctly when token.type === "code"', () => {
      const token: LIRToken = {
        type: 'code',
        id: 'discrim-code',
        name: 'codeFunction',
        kind: 'function' as SymbolKind,
        signature: 'codeFunction()',
        summary: 'Code',
        source: 'function codeFunction() {}',
        language: 'typescript',
        location: { file: 'src/test.ts', startLine: 1, endLine: 1 },
        relationships: { calls: [], imports: [], exports: [], extends: [], importGraph: [] },
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
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
      };

      if (token.type === 'code') {
        // Type should be narrowed to LIRCodeToken
        expect(token.kind).toBe('function');
        expect(token.signature).toBe('codeFunction()');
        expect(token.metrics.cyclomaticComplexity).toBe(1);
        // @ts-expect-error - LIRCodeToken doesn't have 'heading'
        const noHeading = token.heading;
        expect(noHeading).toBeUndefined();
      }
    });

    it('narrows type correctly when token.type === "doc"', () => {
      const token: LIRToken = {
        type: 'doc',
        id: 'discrim-doc',
        heading: 'Doc Heading',
        level: 1,
        summary: 'Summary',
        content: 'Content',
        hierarchy: { parent: null, children: [], path: ['discrim-doc'] },
        codeReferences: [],
        metrics: { wordCount: 1, codeBlockCount: 0, linkCount: 0, depth: 0 },
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
      };

      if (token.type === 'doc') {
        // Type should be narrowed to LIRDocToken
        expect(token.heading).toBe('Doc Heading');
        expect(token.level).toBe(1);
        expect(token.metrics.wordCount).toBe(1);
        // @ts-expect-error - LIRDocToken doesn't have 'name'
        const noName = token.name;
        expect(noName).toBeUndefined();
      }
    });

    it('narrows type correctly when token.type === "text"', () => {
      const token: LIRToken = {
        type: 'text',
        id: 'discrim-text',
        content: 'Text content',
        structure: { headings: [], codeBlocks: [] },
        metrics: { wordCount: 2, paragraphCount: 1, headingCount: 0 },
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
      };

      if (token.type === 'text') {
        // Type should be narrowed to LIRTextToken
        expect(token.content).toBe('Text content');
        expect(token.structure.headings).toEqual([]);
        expect(token.metrics.paragraphCount).toBe(1);
        // @ts-expect-error - LIRTextToken doesn't have 'heading'
        const noHeading = token.heading;
        expect(noHeading).toBeUndefined();
      }
    });
  });

  describe('SymbolKind', () => {
    it('accepts all valid symbol kinds', () => {
      const validKinds: SymbolKind[] = [
        'function',
        'class',
        'method',
        'interface',
        'variable',
        'property',
        'enum',
        'type',
      ];

      validKinds.forEach((kind) => {
        expect(kind).toBeTruthy();
      });
    });
  });

  describe('schema.json', () => {
    it('is valid JSON with expected structure', () => {
      expect(schema).not.toBeNull();
      expect(typeof schema).toBe('object');
    });

    it('contains definitions for all three token types', () => {
      expect(schema).toHaveProperty('definitions');
      const defs = schema.definitions as Record<string, unknown>;

      expect(defs).toHaveProperty('LIRCodeToken');
      expect(defs).toHaveProperty('LIRDocToken');
      expect(defs).toHaveProperty('LIRTextToken');
    });

    it('has schema metadata', () => {
      expect(schema).toHaveProperty('$schema');
      expect(schema).toHaveProperty('title');
      expect(schema).toHaveProperty('description');
    });
  });
});
