/**
 * Unit tests for LIR type extensions to Compost types
 *
 * Tests that Seed and ExtractionResult can hold LIR token data
 * while maintaining backward compatibility.
 */

import { describe, it, expect } from 'vitest';
import type { Seed, ExtractionResult } from '../../src/compost/types.js';
import type { LIRToken, LIRCodeToken } from '../../src/core/lir/types.js';

describe('Compost LIR Type Extensions', () => {
  describe('Seed interface', () => {
    it('should allow creation with lir field set to a LIRToken', () => {
      const mockLIRToken: LIRCodeToken = {
        id: 'test-code-token-1',
        type: 'code',
        domain: 'test-domain',
        layer: 'business-logic',
        name: 'testFunction',
        kind: 'function',
        signature: 'testFunction(param: string): void',
        summary: 'A test function',
        source: 'function testFunction(param: string) { console.log(param); }',
        language: 'typescript',
        location: {
          file: 'test.ts',
          startLine: 1,
          endLine: 3,
        },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 3,
          cyclomaticComplexity: 1,
          paramCount: 1,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
        metadata: {},
        tags: ['test', 'unit'],
        score: 0.9,
      };

      const seed: Seed = {
        id: 'seed-1',
        content: 'Test seed content',
        score: 0.85,
        source: {
          fragments: ['frag-1', 'frag-2'],
          collisionType: 'merge',
          domains: ['domain1', 'domain2'],
        },
        promotedAt: new Date().toISOString(),
        usedBy: [],
        useCount: 0,
        lir: mockLIRToken,
      };

      expect(seed.lir?.type).toBe('code');
      expect(seed.lir?.id).toBe('test-code-token-1');
    });

    it('should work without lir field (backward compatibility)', () => {
      const seed: Seed = {
        id: 'seed-2',
        content: 'Test seed content without LIR',
        score: 0.75,
        source: {
          fragments: ['frag-3'],
          collisionType: 'collision',
          domains: ['domain3'],
        },
        promotedAt: new Date().toISOString(),
        usedBy: [],
        useCount: 0,
      };

      expect(seed.lir).toBeUndefined();
      // All other fields should still work
      expect(seed.id).toBe('seed-2');
      expect(seed.content).toBe('Test seed content without LIR');
    });
  });

  describe('ExtractionResult interface', () => {
    it('should allow lir field to be set', () => {
      const mockLIRToken: LIRCodeToken = {
        id: 'extraction-code-token-1',
        type: 'code',
        domain: 'extraction-domain',
        layer: 'data-access',
        name: 'extractData',
        kind: 'function',
        signature: 'extractData(): Promise<Data>',
        summary: 'Extracts data from source',
        source: 'async function extractData() { return await fetch(); }',
        language: 'typescript',
        location: {
          file: 'extract.ts',
          startLine: 10,
          endLine: 15,
        },
        relationships: {
          calls: ['fetch'],
          imports: [],
          exports: ['extractData'],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 6,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 1,
          callCount: 1,
          classDepth: 0,
          nestingDepth: 0,
        },
        metadata: {},
        tags: ['extraction', 'async'],
      };

      const extractionResult: ExtractionResult = {
        filePath: '/test/path/file.ts',
        semantic: 'Semantic summary',
        metadata: {
          fileType: 'typescript',
          timestamp: new Date().toISOString(),
          hash: 'abc123',
          size: 1024,
          extractedAt: new Date().toISOString(),
          language: 'typescript',
          loc: 50,
        },
        rawBytes: {
          headerHex: '0x1234',
          tailHex: '0x5678',
          sha256: 'hash123',
          size: 1024,
          hexChunks: ['0x12', '0x34'],
          base64: null,
        },
        lir: [mockLIRToken],
      };

      expect(extractionResult.lir?.[0]?.type).toBe('code');
      expect(extractionResult.lir?.[0]?.name).toBe('extractData');
    });

    it('should work without lir field (backward compatibility)', () => {
      const extractionResult: ExtractionResult = {
        filePath: '/test/path/other.ts',
        semantic: 'Another semantic summary',
        metadata: {
          fileType: 'typescript',
          timestamp: new Date().toISOString(),
          hash: 'def456',
          size: 2048,
          extractedAt: new Date().toISOString(),
          language: 'typescript',
          loc: 100,
        },
        rawBytes: {
          headerHex: '0xabcd',
          tailHex: '0xefgh',
          sha256: 'hash456',
          size: 2048,
          hexChunks: ['0xab', '0xcd'],
          base64: null,
        },
      };

      expect(extractionResult.lir).toBeUndefined();
      // All other fields should still work
      expect(extractionResult.filePath).toBe('/test/path/other.ts');
      expect(extractionResult.semantic).toBe('Another semantic summary');
    });
  });

  describe('JSON serialization', () => {
    it('should preserve LIR data on Seed through JSON round-trip', () => {
      const mockLIRToken: LIRCodeToken = {
        id: 'json-test-token',
        type: 'code',
        domain: 'json-domain',
        layer: 'presentation',
        name: 'serializeTest',
        kind: 'function',
        signature: 'serializeTest(): string',
        summary: 'Test JSON serialization',
        source: 'function serializeTest() { return "test"; }',
        language: 'typescript',
        location: {
          file: 'json-test.ts',
          startLine: 5,
          endLine: 7,
        },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 3,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
        metadata: { testKey: 'testValue' },
        tags: ['json', 'serialization'],
        score: 0.95,
      };

      const originalSeed: Seed = {
        id: 'seed-json-1',
        content: 'JSON test seed',
        score: 0.88,
        source: {
          fragments: ['frag-json'],
          collisionType: 'merge',
          domains: ['json-domain'],
        },
        promotedAt: new Date().toISOString(),
        usedBy: [],
        useCount: 0,
        lir: mockLIRToken,
      };

      // Serialize to JSON
      const json = JSON.stringify(originalSeed);
      // Deserialize back
      const parsedSeed = JSON.parse(json) as Seed;

      expect(parsedSeed.lir?.id).toBe('json-test-token');
      expect(parsedSeed.lir?.type).toBe('code');
      expect(parsedSeed.lir?.name).toBe('serializeTest');
      expect(parsedSeed.lir?.metadata).toEqual({ testKey: 'testValue' });
      expect(parsedSeed.lir?.tags).toEqual(['json', 'serialization']);
    });

    it('should preserve LIR data on ExtractionResult through JSON round-trip', () => {
      const mockLIRToken: LIRCodeToken = {
        id: 'json-extraction-token',
        type: 'code',
        domain: 'json-extraction-domain',
        layer: 'data-access',
        name: 'processExtraction',
        kind: 'function',
        signature: 'processExtraction(data: unknown): Result',
        summary: 'Process extraction result',
        source: 'function processExtraction(data) { return data; }',
        language: 'typescript',
        location: {
          file: 'process.ts',
          startLine: 20,
          endLine: 25,
        },
        relationships: {
          calls: [],
          imports: [],
          exports: ['processExtraction'],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 6,
          cyclomaticComplexity: 1,
          paramCount: 1,
          importCount: 0,
          exportCount: 1,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
        metadata: {},
        tags: ['processing'],
      };

      const originalResult: ExtractionResult = {
        filePath: '/json/test/process.ts',
        semantic: 'Process extraction semantic',
        metadata: {
          fileType: 'typescript',
          timestamp: new Date().toISOString(),
          hash: 'json-hash',
          size: 512,
          extractedAt: new Date().toISOString(),
          language: 'typescript',
          loc: 30,
        },
        rawBytes: {
          headerHex: '0xaaaa',
          tailHex: '0xbbbb',
          sha256: 'json-sha256',
          size: 512,
          hexChunks: ['0xaa', '0xbb'],
          base64: null,
        },
        lir: [mockLIRToken],
      };

      // Serialize to JSON
      const json = JSON.stringify(originalResult);
      // Deserialize back
      const parsedResult = JSON.parse(json) as ExtractionResult;

      expect(parsedResult.lir?.[0]?.id).toBe('json-extraction-token');
      expect(parsedResult.lir?.[0]?.type).toBe('code');
      expect(parsedResult.lir?.[0]?.name).toBe('processExtraction');
      expect(parsedResult.lir?.[0]?.signature).toBe('processExtraction(data: unknown): Result');
    });
  });
});
