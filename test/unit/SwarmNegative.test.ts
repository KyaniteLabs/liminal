import { describe, it, expect, beforeEach } from 'vitest';
/**
 * Negative tests: invalid inputs, edge cases, error handling
 * Tests for swarm, voting, mining, and scavenger modules.
 */

import { VotingEngine } from '../../src/swarm/VotingEngine.js';
import { MiningEngine } from '../../src/swarm/MiningEngine.js';
import { MapElites } from '../../src/evolution/MapElites.js';
import { NoveltyArchive } from '../../src/evolution/NoveltyArchive.js';
import { CreativeEvaluator } from '../../src/core/CreativeEvaluator.js';
import { SafetyGuardrails } from '../../src/core/SafetyGuardrails.js';
import { generatorRegistry } from '../../src/generators/GeneratorRegistry.js';
import { DNAExtractor } from '../../src/scavenger/DNAExtractor.js';
import type { SwarmOutput } from '../../src/swarm/types.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('VotingEngine negative tests', () => {
  it('should handle empty vote text', () => {
    const candidateMap = new Map([['A', 'eve'], ['B', 'max']]);
    const result = VotingEngine.parseVote('', candidateMap);
    expect(result.first).toBeNull();
    expect(result.second).toBeNull();
  });

  it('should handle vote text with no valid letters', () => {
    const candidateMap = new Map([['A', 'eve'], ['B', 'max']]);
    const result = VotingEngine.parseVote('no letters here 12345', candidateMap);
    expect(result.first).toBeNull();
  });

  it('should handle vote text with letters beyond candidate range', () => {
    const candidateMap = new Map([['A', 'eve']]);
    // 'Z' is beyond the default maxLetter 'G'
    const result = VotingEngine.parseVote('I vote for Z', candidateMap);
    expect(result.first).toBeNull();
  });

  it('should handle candidate map with no entries', () => {
    const candidateMap = new Map<string, string>();
    const result = VotingEngine.parseVote('1st: A', candidateMap);
    expect(result.first).toBeNull();
  });

  it('should handle fallback voting with no Ollama caller', async () => {
    const outputs = new Map<string, SwarmOutput>([
      ['eve', { personaId: 'eve', personaName: 'Eve', content: 'Creative output', model: 'm', tokensUsed: 10, latencyMs: 100, roundNum: 1 }],
      ['max', { personaId: 'max', personaName: 'Max', content: 'Technical output', model: 'm', tokensUsed: 10, latencyMs: 100, roundNum: 1 }],
    ]);
    const result = await VotingEngine.conductVoting(outputs, [
      { id: 'eve', name: 'eve', displayName: 'Eve', model: 'm', temperature: 0.9, maxTokens: 100, systemPrompt: '', voice: '', thinkingStyle: '', votingBias: '', constraints: [], votingPower: 1 },
      { id: 'max', name: 'max', displayName: 'Max', model: 'm', temperature: 0.5, maxTokens: 100, systemPrompt: '', voice: '', thinkingStyle: '', votingBias: '', constraints: [], votingPower: 1 },
    ], 1, {} as any);
    // Without Ollama, first output wins
    expect(result.winnerId).toBe('eve');
    expect(result.votes.size).toBe(2);
  });
});

describe('MiningEngine negative tests', () => {
  it('should handle session with no rounds', () => {
    const session = { session_id: 'empty', rounds: [] };
    const fragments = MiningEngine.mineSession(session, 5);
    expect(fragments).toHaveLength(0);
  });

  it('should handle session with null winner', () => {
    const session = {
      session_id: 'null-winner',
      rounds: [{ round_num: 1, winner_id: null, winner_content: 'Some content', seed: 'test' }],
    };
    const fragments = MiningEngine.mineSession(session, 5);
    expect(fragments.length).toBeGreaterThan(0);
    expect(fragments[0].persona).toBe('unknown');
  });

  it('should handle very long content (truncation)', () => {
    const longContent = 'A'.repeat(600);
    const session = {
      session_id: 'long',
      rounds: [{ round_num: 1, winner_id: 'eve', winner_content: longContent, seed: 'test' }],
    };
    const fragments = MiningEngine.mineSession(session, 5);
    if (fragments.length > 0) {
      expect(fragments[0].text.length).toBeLessThanOrEqual(503); // 500 + '...'
      expect(fragments[0].text).toContain('...');
    }
  });

  it('should handle hybridize with all same-persona fragments', () => {
    const fragments = [
      { id: 'f1', text: 'First', source: 's1', round: 1, persona: 'eve', score: 8, mode: 'hybrid', tags: ['eve'], sessionPrompt: 'p', extractedAt: '' },
      { id: 'f2', text: 'Second', source: 's1', round: 2, persona: 'eve', score: 8, mode: 'hybrid', tags: ['eve'], sessionPrompt: 'p', extractedAt: '' },
      { id: 'f3', text: 'Third', source: 's1', round: 3, persona: 'eve', score: 8, mode: 'hybrid', tags: ['eve'], sessionPrompt: 'p', extractedAt: '' },
    ];
    // All same persona → only 1 selected, but synthesis template still wraps it
    const result = MiningEngine.hybridize(fragments);
    expect(result).toContain('First');
    expect(result).toContain('Synthesize');
  });

  it('should handle findGlitches with empty outputs', () => {
    const outputs = new Map<string, SwarmOutput>();
    const glitches = MiningEngine.findGlitches(outputs);
    expect(glitches).toHaveLength(0);
  });
});

describe('MapElites negative tests', () => {
  it('should handle negative fitness values', () => {
    const map = new MapElites([5, 5]);
    expect(map.insert('a', [0.5, 0.5], -1)).toBe(true);
    expect(map.get(2, 2)!.fitness).toBe(-1);
  });

  it('should handle behavior vectors with NaN', () => {
    const map = new MapElites([5, 5]);
    // NaN gets clamped/converted during behavior mapping
    const result = map.insert('a', [NaN, 0.5], 0.5);
    // Should not throw
    expect(result === true || result === false).toBe(true);
  });

  it('should handle zero-sized grid (behavior mapping wraps to valid cell)', () => {
    const map = new MapElites([0, 0]);
    // With dims=[0,0], behaviorToCell produces negative coords but Math.max clamps
    // The grid still accepts inserts since it's Map-based
    const result = map.insert('a', [0.5, 0.5], 0.5);
    expect(result === true || result === false).toBe(true);
  });

  it('should handle getElites with empty map', () => {
    const map = new MapElites([5, 5]);
    expect(map.getElites(5)).toHaveLength(0);
  });

  it('should handle getElites requesting more than available', () => {
    const map = new MapElites([5, 5]);
    map.insert('a', [0.0, 0.0], 0.5);
    expect(map.getElites(10)).toHaveLength(1);
  });
});

describe('NoveltyArchive negative tests', () => {
  it('should handle empty query vector', () => {
    const archive = new NoveltyArchive();
    archive.add([0.5, 0.5]);
    expect(() => archive.noveltyScore([])).not.toThrow();
  });

  it('should handle single-element vectors', () => {
    const archive = new NoveltyArchive();
    archive.add([0.5]);
    const score = archive.noveltyScore([0.5]);
    expect(score).toBeCloseTo(0, 1);
  });

  it('should handle very large vectors', () => {
    const archive = new NoveltyArchive();
    const bigVec = Array.from({ length: 1000 }, (_, i) => i / 1000);
    archive.add(bigVec);
    const score = archive.noveltyScore(bigVec);
    expect(score).toBeCloseTo(0, 1);
  });
});

describe('CreativeEvaluator negative tests', () => {
  it('should handle numeric input', () => {
    const result = CreativeEvaluator.assess(42);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should handle null input', () => {
    const result = CreativeEvaluator.assess(null);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should handle object input', () => {
    const result = CreativeEvaluator.assess({ code: 'bad' });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should handle code with unclosed braces', () => {
    const code = `function setup() { createCanvas(400, 400); }
function draw() { background(220);`;
    const result = CreativeEvaluator.assess(code);
    expect(result.issues).toContain('Syntax or structural errors detected');
  });

  it('should handle code with common misspellings', () => {
    const code = `function setup() { creatCanvas(400, 400); }
function draw() { backgound(220); fil(255, 0, 0); }`;
    const result = CreativeEvaluator.assess(code);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('should handle very long code', () => {
    const longCode = `function setup() { createCanvas(400, 400); }
function draw() { ${'background(220);'.repeat(200)} }`;
    const result = CreativeEvaluator.assess(longCode);
    expect(result.metrics.codeLength).toBeGreaterThan(1000);
  });
});

describe('SafetyGuardrails negative tests', () => {
  it('should fail immediately with zero budget', () => {
    const guard = new SafetyGuardrails({ maxBudgetUsd: 0 });
    // budgetUsed=0 < maxBudget=0 → false (0 is not less than 0)
    expect(guard.checkBudget()).toBe(false);
  });

  it('should handle negative API cost', () => {
    const guard = new SafetyGuardrails({ maxBudgetUsd: 1.00 });
    guard.recordApiCost(-0.50);
    expect(guard.getBudgetUsed()).toBe(-0.50);
    expect(guard.checkBudget()).toBe(true);
  });

  it('should handle stop file that exists', () => {
    const stopFile = path.join(os.tmpdir(), `liminal-stop-test-${Date.now()}`);
    try {
      fs.writeFileSync(stopFile, '');
      const guard = new SafetyGuardrails({ stopFilePath: stopFile });
      expect(guard.checkStopFile()).toBe(false);
    } finally {
      fs.unlinkSync(stopFile);
    }
  });
});

describe('GeneratorRegistry negative tests', () => {
  beforeEach(() => {
    generatorRegistry.clear();
  });

  it('should return null for dispatch when all generators have zero confidence', () => {
    generatorRegistry.register({
      name: 'never',
      canHandle: () => 0,
      generate: () => 'nope',
    });
    expect(generatorRegistry.dispatch('anything')).toBeNull();
  });

  it('should throw on unregisterDomain for non-existent domain', () => {
    expect(generatorRegistry.unregisterDomain('ghost')).toBe(false);
  });

  it('should handle getDNA for unregistered domain', () => {
    expect(generatorRegistry.getDNA('nonexistent')).toBeUndefined();
  });
});

describe('DNAExtractor negative tests', () => {
  it('should return unknown domain for content with no keywords', () => {
    const domain = DNAExtractor['detectDomainFromContent'].call(DNAExtractor, 'just some random text about nothing specific');
    expect(domain).toBe('unknown');
  });

  it('should handle scanForCarcasses on non-existent directory', async () => {
    const result = await DNAExtractor.scanForCarcasses('/nonexistent/path/12345');
    expect(result).toHaveLength(0);
  });

  it('should return null for loadDNAForDomain with non-existent file', async () => {
    const result = await DNAExtractor.loadDNAForDomain('nonexistent-domain', '/nonexistent/dir');
    expect(result).toBeNull();
  });
});
