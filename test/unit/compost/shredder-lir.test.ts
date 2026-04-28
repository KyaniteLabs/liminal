/**
 * Unit tests for CompostShredder LIR-aware shredding.
 *
 * Tests that shredLIR() creates structured fragments from LIR tokens,
 * and that shredFile() prefers LIR over legacy shredding when available.
 */

import { describe, it, expect } from 'vitest';
import { CompostShredder } from '../../../src/compost/CompostShredder.js';
import type { LIRCodeToken, LIRDocToken, LIRTextToken } from '../../../src/core/lir/types.js';
import type { ExtractionResult } from '../../../src/compost/types.js';

// --- Test data factories ---

function makeCodeToken(overrides?: Partial<LIRCodeToken>): LIRCodeToken {
  return {
    id: 'code-tok-1',
    type: 'code',
    name: 'add',
    kind: 'function',
    signature: 'add(a: number, b: number): number',
    summary: 'Adds two numbers',
    source: 'return a + b;',
    language: 'typescript',
    domain: 'math',
    layer: 'application',
    tags: ['math', 'utility'],
    metadata: {},
    location: { file: 'calc.ts', startLine: 1, endLine: 3 },
    relationships: { calls: [], imports: ['fs'], exports: ['add'], extends: [], importGraph: [] },
    metrics: { loc: 3, cyclomaticComplexity: 1, paramCount: 2, importCount: 1, exportCount: 1, callCount: 0, classDepth: 0, nestingDepth: 1 },
    ...overrides,
  };
}

function makeDocToken(overrides?: Partial<LIRDocToken>): LIRDocToken {
  return {
    id: 'doc-tok-1',
    type: 'doc',
    heading: 'Getting Started',
    level: 1,
    summary: 'How to get started',
    content: 'Welcome to the project. Install dependencies first.',
    domain: 'documentation',
    layer: 'content',
    tags: [],
    metadata: {},
    hierarchy: { parent: null, children: ['section-2'], path: [] },
    codeReferences: ['Calculator'],
    metrics: { wordCount: 8, codeBlockCount: 0, linkCount: 0, depth: 0 },
    ...overrides,
  };
}

function makeTextToken(overrides?: Partial<LIRTextToken>): LIRTextToken {
  return {
    id: 'text-tok-1',
    type: 'text',
    content: 'Introduction\n\nThis is a paragraph about things.\n\n## Heading Two\n\nMore content here.',
    domain: 'general',
    layer: 'content',
    tags: [],
    metadata: {},
    structure: {
      headings: [{ level: 1, text: 'Introduction' }, { level: 2, text: 'Heading Two' }],
      codeBlocks: [],
    },
    metrics: { wordCount: 15, paragraphCount: 3, headingCount: 2 },
    ...overrides,
  };
}

function makeExtractionResult(filePath: string, lir?: LIRCodeToken | LIRDocToken | LIRTextToken): ExtractionResult {
  return {
    filePath,
    semantic: 'some semantic content',
    metadata: {
      fileType: filePath.split('.').pop() ?? '',
      timestamp: new Date().toISOString(),
      hash: 'abc123',
      size: 100,
      extractedAt: new Date().toISOString(),
    },
    rawBytes: { headerHex: '', tailHex: '', sha256: 'abc', size: 100, hexChunks: [], base64: null },
    lir: lir ? [lir] : undefined,
  };
}

// --- Tests ---

describe('CompostShredder — LIR-aware shredding', () => {
  describe('shredLIR() static method', () => {
    it('LIRCodeToken → one fragment per symbol with tags [code, kind, structured]', () => {
      const token = makeCodeToken();
      const fragments = CompostShredder.shredLIR(token, 'calc.ts');

      expect(fragments.length).toBeGreaterThanOrEqual(1);
      const frag = fragments[0];
      expect(frag.layer).toBe('structured');
      expect(frag.tags).toContain('code');
      expect(frag.tags).toContain('function');
      expect(frag.tags).toContain('structured');
      expect(frag.content).toContain('add');
    });

    it('LIRCodeToken fragment metadata includes symbol kind and metrics', () => {
      const token = makeCodeToken();
      const fragments = CompostShredder.shredLIR(token, 'calc.ts');

      const frag = fragments[0];

      expect(frag.metadata?.symbolKind).toBe('function');
      expect(frag.metadata.loc).toBe(3);
      expect(frag.metadata.cyclomaticComplexity).toBe(1);
    });

    it('LIRDocToken → one fragment per section with heading info in metadata', () => {
      const token = makeDocToken();
      const fragments = CompostShredder.shredLIR(token, 'guide.md');

      expect(fragments.length).toBeGreaterThanOrEqual(1);
      const frag = fragments[0];
      expect(frag.layer).toBe('structured');
      expect(frag.tags).toContain('doc');
      expect(frag.tags).toContain('structured');
      expect(frag.content).toContain('Getting Started');
      expect(frag.metadata.heading).toBe('Getting Started');
      expect(frag.metadata.level).toBe(1);
    });

    it('LIRTextToken → one fragment per paragraph/heading', () => {
      const token = makeTextToken();
      const fragments = CompostShredder.shredLIR(token, 'notes.txt');

      expect(fragments.length).toBeGreaterThanOrEqual(1);
      for (const frag of fragments) {
        expect(frag.layer).toBe('structured');
        expect(frag.tags).toContain('text');
        expect(frag.tags).toContain('structured');
      }
    });

    it('all LIR-derived fragments have layer "structured"', () => {
      const codeToken = makeCodeToken();
      const docToken = makeDocToken();
      const textToken = makeTextToken();

      const codeFrags = CompostShredder.shredLIR(codeToken, 'a.ts');
      const docFrags = CompostShredder.shredLIR(docToken, 'b.md');
      const textFrags = CompostShredder.shredLIR(textToken, 'c.txt');

      const allFrags = [...codeFrags, ...docFrags, ...textFrags];
      for (const frag of allFrags) {
        expect(frag.layer).toBe('structured');
      }
    });
  });

  describe('shredFile() LIR integration', () => {
    it('when result.lir is a code token, uses LIR shredding (not legacy)', () => {
      const token = makeCodeToken();
      const result = makeExtractionResult('calc.ts', token);
      const fragments = CompostShredder.shredFile(result);

      // All fragments should be structured, not semantic
      for (const frag of fragments) {
        expect(frag.layer).toBe('structured');
      }
      // Should have at least one fragment
      expect(fragments.length).toBeGreaterThanOrEqual(1);
    });

    it('when result.lir is a doc token, uses LIR shredding', () => {
      const token = makeDocToken();
      const result = makeExtractionResult('guide.md', token);
      const fragments = CompostShredder.shredFile(result);

      for (const frag of fragments) {
        expect(frag.layer).toBe('structured');
      }
    });

    it('when result.lir is a text token, uses LIR shredding', () => {
      const token = makeTextToken();
      const result = makeExtractionResult('notes.txt', token);
      const fragments = CompostShredder.shredFile(result);

      for (const frag of fragments) {
        expect(frag.layer).toBe('structured');
      }
    });

    it('when no LIR token, falls back to legacy shredding', () => {
      const result = makeExtractionResult('readme.md');
      const fragments = CompostShredder.shredFile(result);

      // Legacy shredding produces semantic-layer fragments
      for (const frag of fragments) {
        expect(frag.layer).toBe('semantic');
      }
    });
  });
});
