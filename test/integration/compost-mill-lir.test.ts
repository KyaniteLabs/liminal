/**
 * Integration test for LIR wiring in CompostMill.
 *
 * Verifies that:
 * - extractAll() produces ExtractionResults with LIR tokens when lirEnabled
 * - Promoted seeds include LIR tokens for code/doc files
 * - lirEnabled: false produces no LIR on seeds (backward compat)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CompostMill } from '../../src/compost/CompostMill.js';
import { CompostParser } from '../../src/core/parsing/CompostParser.js';
import type { LLMClientLike } from '../../src/compost/SemanticExtractor.js';
import type { CompostConfig } from '../../src/compost/types.js';
import type { LIRCodeToken, LIRDocToken, LIRTextToken } from '../../src/core/lir/types.js';

// Mock LLM that always returns success
const createMockLLM = (): LLMClientLike => ({
  generate: vi.fn().mockResolvedValue({ code: 'mock summary', success: true }),
    generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }),
    generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }),
});

// Sample files
const TS_FILE = `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export class Greeter {
  private name: string;
  constructor(name: string) {
    this.name = name;
  }
}
`;

const MD_FILE = `# Getting Started

This is the introduction.

## Installation

Run \`npm install\` to get started.

## Usage

Import the module and call greet().
`;

const TXT_FILE = `This is a plain text file.

It has multiple paragraphs.

The third paragraph is here.
`;

let tempDir: string;
let mockLLM: LLMClientLike;

function makeConfig(heapDir: string, seedDir: string, lirEnabled: boolean): Partial<CompostConfig> & { soupStatePath?: string; fastLLM?: LLMClientLike } {
  return {
    heapDir,
    seedDir,
    digestDir: path.join(heapDir, 'digest'),
    lirEnabled,
    soupEnabled: false,
    seedPromotionThreshold: 0.0, // Promote everything for testing
    maxSeedsPerDigest: 100,
  };
}

describe('CompostMill LIR integration', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compost-mill-lir-'));
    mockLLM = createMockLLM();

    // Write test files to heap dir
    const heapDir = path.join(tempDir, 'heap');
    await fs.mkdir(heapDir, { recursive: true });
    await fs.writeFile(path.join(heapDir, 'example.ts'), TS_FILE);
    await fs.writeFile(path.join(heapDir, 'guide.md'), MD_FILE);
    await fs.writeFile(path.join(heapDir, 'notes.txt'), TXT_FILE);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('digest with lirEnabled: true — ExtractionResults have LIR tokens', async () => {
    const config = makeConfig(
      path.join(tempDir, 'heap'),
      path.join(tempDir, 'seeds'),
      true,
    );
    config.fastLLM = mockLLM;

    const parser = new CompostParser(path.join(tempDir, 'cache'));
    const mill = new CompostMill(mockLLM, config);
    mill.setParser(parser);

    const result = await mill.digest();

    // At least one seed should have been promoted
    expect(result.seeds.length).toBeGreaterThanOrEqual(1);

    // Some seeds should have LIR tokens (from .ts and .md files)
    const seedsWithLIR = result.seeds.filter(s => s.lir !== undefined);
    expect(seedsWithLIR.length).toBeGreaterThanOrEqual(1);
  });

  it('digest with lirEnabled: true — .ts file produces LIRCodeToken on seeds', async () => {
    const config = makeConfig(
      path.join(tempDir, 'heap'),
      path.join(tempDir, 'seeds'),
      true,
    );
    config.fastLLM = mockLLM;

    const parser = new CompostParser(path.join(tempDir, 'cache'));
    const mill = new CompostMill(mockLLM, config);
    mill.setParser(parser);

    const result = await mill.digest();

    // Find seeds with code LIR tokens
    const codeSeeds = result.seeds.filter(
      s => s.lir && s.lir.type === 'code'
    );
    expect(codeSeeds.length).toBeGreaterThanOrEqual(1);

    // Verify the code token structure
    const codeToken = codeSeeds[0].lir as LIRCodeToken;
    expect(codeToken.type).toBe('code');
    expect(codeToken.kind).not.toBeNull();
    expect(codeToken.metrics).not.toBeNull();
    expect(typeof codeToken.metrics.loc).toBe('number');
  });

  it('digest with lirEnabled: true — .md file produces LIRDocToken on seeds', async () => {
    const config = makeConfig(
      path.join(tempDir, 'heap'),
      path.join(tempDir, 'seeds'),
      true,
    );
    config.fastLLM = mockLLM;

    const parser = new CompostParser(path.join(tempDir, 'cache'));
    const mill = new CompostMill(mockLLM, config);
    mill.setParser(parser);

    const result = await mill.digest();

    // Find seeds with doc LIR tokens
    const docSeeds = result.seeds.filter(
      s => s.lir && s.lir.type === 'doc'
    );
    expect(docSeeds.length).toBeGreaterThanOrEqual(1);

    const docToken = docSeeds[0].lir as LIRDocToken;
    expect(docToken.type).toBe('doc');
    expect(docToken.heading).not.toBeNull();
    expect(docToken.metrics).not.toBeNull();
  });

  it('digest with lirEnabled: true — .txt file produces LIRTextToken on seeds', async () => {
    const config = makeConfig(
      path.join(tempDir, 'heap'),
      path.join(tempDir, 'seeds'),
      true,
    );
    config.fastLLM = mockLLM;

    const parser = new CompostParser(path.join(tempDir, 'cache'));
    const mill = new CompostMill(mockLLM, config);
    mill.setParser(parser);

    const result = await mill.digest();

    // Find seeds with text LIR tokens
    const textSeeds = result.seeds.filter(
      s => s.lir && s.lir.type === 'text'
    );
    expect(textSeeds.length).toBeGreaterThanOrEqual(1);

    const textToken = textSeeds[0].lir as LIRTextToken;
    expect(textToken.type).toBe('text');
    expect(textToken.content).not.toBeNull();
    expect(textToken.metrics).not.toBeNull();
  });

  it('digest with lirEnabled: false — no LIR tokens on seeds (backward compat)', async () => {
    const config = makeConfig(
      path.join(tempDir, 'heap'),
      path.join(tempDir, 'seeds'),
      false,
    );
    config.fastLLM = mockLLM;

    const mill = new CompostMill(mockLLM, config);
    const result = await mill.digest();

    // No seeds should have LIR tokens
    for (const seed of result.seeds) {
      expect(seed.lir).toBeUndefined();
    }
  });

  it('collision seeds do not have LIR tokens', async () => {
    // Collision seeds merge two sources — no single LIR applies
    const config = makeConfig(
      path.join(tempDir, 'heap'),
      path.join(tempDir, 'seeds'),
      true,
    );
    config.fastLLM = mockLLM;

    const parser = new CompostParser(path.join(tempDir, 'cache'));
    const mill = new CompostMill(mockLLM, config);
    mill.setParser(parser);

    const result = await mill.digest();

    // Collision seeds have 'cross-domain' in their source.domains
    const collisionSeeds = result.seeds.filter(
      s => s.source.collisionType !== 'heuristic' || s.source.domains.includes('cross-domain'),
    );
    for (const seed of collisionSeeds) {
      expect(seed.lir).toBeUndefined();
    }
  });
});
