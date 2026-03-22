/**
 * This file exists solely to verify that the types in lir-types.test.ts
 * will fail compilation until we add the lir field to Seed and ExtractionResult.
 *
 * This file should be deleted after Task 3.1 is complete.
 */

import type { Seed, ExtractionResult } from '../../src/compost/types.js';
import type { LIRCodeToken } from '../../src/core/lir/types.js';

const mockLIR: LIRCodeToken = {
  id: 'compile-check-token',
  type: 'code',
  domain: 'test-domain',
  layer: 'test-layer',
  name: 'testFunction',
  kind: 'function',
  signature: 'testFunction(): void',
  summary: 'Test function',
  source: 'function testFunction() {}',
  language: 'typescript',
  location: {
    file: 'test.ts',
    startLine: 1,
    endLine: 2,
  },
  relationships: {
    calls: [],
    imports: [],
    exports: [],
    extends: [],
    importGraph: [],
  },
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
  metadata: {},
  tags: ['test'],
};

// This should cause a compilation error until we add lir to Seed
const seedWithLIR: Seed = {
  id: 'test-seed',
  content: 'test content',
  score: 0.8,
  source: {
    fragments: [],
    collisionType: 'test',
    domains: [],
  },
  promotedAt: new Date().toISOString(),
  usedBy: [],
  useCount: 0,
  lir: mockLIR, // ERROR: Property 'lir' does not exist on type 'Seed'
};

// This should cause a compilation error until we add lir to ExtractionResult
const extractionWithLIR: ExtractionResult = {
  filePath: '/test/path',
  semantic: 'test semantic',
  metadata: {
    fileType: 'typescript',
    timestamp: new Date().toISOString(),
    hash: 'test-hash',
    size: 100,
    extractedAt: new Date().toISOString(),
  },
  rawBytes: {
    headerHex: '0x1234',
    tailHex: '0x5678',
    sha256: 'test-sha256',
    size: 100,
    hexChunks: [],
    base64: null,
  },
  lir: mockLIR, // ERROR: Property 'lir' does not exist on type 'ExtractionResult'
};

export { seedWithLIR, extractionWithLIR };
