/**
 * Shared test fixtures for swarm, scavenger, and integration tests.
 */

import { SwarmMode } from '../../src/swarm/types.js';
import type { SwarmPersona, SwarmConfig, ProjectDNA } from '../../src/swarm/types.js';

/** Minimal valid SwarmPersona for testing. */
export function makePersona(overrides: Partial<SwarmPersona> = {}): SwarmPersona {
  return {
    id: 'test-persona',
    name: 'Test',
    displayName: 'The Tester',
    model: 'test-model:latest',
    temperature: 0.5,
    maxTokens: 50,
    systemPrompt: 'You are a test persona.',
    voice: 'Neutral.',
    thinkingStyle: 'Analytical.',
    votingBias: 'Votes for correctness.',
    constraints: ['Be concise'],
    votingPower: 1,
    ...overrides,
  };
}

/** Create a mock SwarmConfig with sensible defaults. */
export function makeSwarmConfig(overrides: Partial<SwarmConfig> = {}): SwarmConfig {
  return {
    ollamaHost: 'http://localhost:11434',
    ollamaTimeout: 30,
    maxRounds: 3,
    convergenceThreshold: 2,
    musicalChairs: false,
    mode: SwarmMode.HYBRID,
    personas: [makePersona()],
    refinementConstraints: ['Be creative'],
    streamDir: './test-stream',
    ...overrides,
  };
}

/** Create a mock ProjectDNA for testing. */
export function makeProjectDNA(overrides: Partial<ProjectDNA> = {}): ProjectDNA {
  return {
    name: 'test-project',
    domain: 'generative-art',
    coreLogic: 'Test core logic.',
    constraints: ['constraint 1', 'constraint 2'],
    patterns: ['pattern-1'],
    prompts: ['prompt 1'],
    extractedAt: new Date().toISOString(),
    sourcePath: '/tmp/test-project',
    ...overrides,
  };
}
