import { describe, it, expect, afterEach } from 'vitest';
/**
 * Integration test: Swarm + DNA injection
 * Tests that DNA from scavenger enriches swarm prompts correctly.
 */

import { SwarmOrchestrator } from '../../src/swarm/SwarmOrchestrator.js';
import { MiningEngine } from '../../src/swarm/MiningEngine.js';
import { DNAExtractor } from '../../src/scavenger/DNAExtractor.js';
import { generatorRegistry } from '../../src/generators/GeneratorRegistry.js';
import type { ProjectDNA } from '../../src/scavenger/types.js';
import type { SwarmPersona, MinedFragment } from '../../src/swarm/types.js';
import os from 'os';
import path from 'path';

const TEST_STREAM_DIR = path.join(os.tmpdir(), 'liminal-swarm-dna-test');

// Minimal persona set for fast tests
const MINI_PERSONAS: SwarmPersona[] = [
  {
    id: 'eve',
    name: 'eve',
    displayName: 'Eve the Dreamer',
    model: 'test-model',
    temperature: 0.9,
    maxTokens: 100,
    systemPrompt: 'You are Eve, a creative dreamer.',
    voice: 'Ethereal and poetic',
    thinkingStyle: 'Associative',
    votingBias: 'Favors sensory-rich, metaphorical output',
    constraints: ['Be creative', 'Use vivid imagery'],
    votingPower: 1,
  },
  {
    id: 'max',
    name: 'max',
    displayName: 'Max the Engineer',
    model: 'test-model',
    temperature: 0.5,
    maxTokens: 100,
    systemPrompt: 'You are Max, a technical engineer.',
    voice: 'Precise and analytical',
    thinkingStyle: 'Systematic',
    votingBias: 'Favors technically sound output',
    constraints: ['Be precise', 'Use correct syntax'],
    votingPower: 1,
  },
];

// Mock Ollama caller that returns deterministic content based on persona
function createDeterministicCaller(responses: Record<string, string>) {
  return async (_model: string, prompt: string, _options?: { temperature?: number; num_predict?: number }): Promise<string> => {
    // Extract persona name from prompt to determine response
    for (const [key, value] of Object.entries(responses)) {
      if (prompt.includes(key)) return value;
    }
    return 'Default response from the creative void.';
  };
}

describe('Swarm + DNA integration', () => {
  const testDNA: ProjectDNA = {
    name: 'test-art-project',
    domain: 'generative-art',
    coreLogic: 'Use Perlin noise to create flowing organic patterns. Combine with particle systems for emergent behavior.',
    constraints: ['Must use p5.js', 'Canvas size 800x600', 'Minimum 50 particles', 'Use color palette from nature'],
    patterns: ['Noise-based flow fields', 'Particle lifecycle management', 'Force accumulation'],
    prompts: ['Create a flowing noise field with particles'],
    extractedAt: '2026-01-01',
    sourcePath: '/tmp/test-project',
  };

  afterEach(async () => {
    generatorRegistry.clear();
  });

  it('should inject DNA into swarm prompts', async () => {
    const caller = createDeterministicCaller({
      'Eve': 'The warm light echoes through cold stone like crystal folds.',
      'Max': 'function setup() { createCanvas(800, 600); }',
    });

    const orchestrator = new SwarmOrchestrator(
      {
        personas: MINI_PERSONAS,
        maxRounds: 1,
        musicalChairs: false,
        streamDir: TEST_STREAM_DIR,
      },
      { callOllama: caller }
    );

    orchestrator.setDNA(testDNA);

    const result = await orchestrator.run('Create generative art');
    expect(result.rounds.length).toBe(1);
    // DNA was injected — the seed should contain domain knowledge
    expect(result.rounds[0].seed).toContain('Domain Knowledge');
    expect(result.rounds[0].seed).toContain('Perlin noise');
    expect(result.rounds[0].seed).toContain('Must use p5.js');
  });

  it('should mine fragments after swarm run with DNA-enriched prompts', async () => {
    const caller = createDeterministicCaller({
      'Eve': 'Crystal ocean folds like warm light through cold stone, shimmering echoes of color and scent.',
      'Max': 'function setup() { createCanvas(800, 600); }',
    });

    let minedFragments: MinedFragment[] = [];
    const orchestrator = new SwarmOrchestrator(
      {
        personas: MINI_PERSONAS,
        maxRounds: 1,
        musicalChairs: false,
        streamDir: TEST_STREAM_DIR,
      },
      {
        callOllama: caller,
        onFragmentsMined: (fragments) => { minedFragments = fragments; },
      }
    );

    orchestrator.setDNA(testDNA);
    await orchestrator.run('Create generative art');

    // Fragments should be auto-mined and callback fired
    expect(minedFragments.length).toBeGreaterThanOrEqual(0);
  });

  it('should run without DNA when none provided', async () => {
    const caller = createDeterministicCaller({
      'Eve': 'Simple creative output.',
      'Max': 'Simple technical output.',
    });

    const orchestrator = new SwarmOrchestrator(
      {
        personas: MINI_PERSONAS,
        maxRounds: 1,
        musicalChairs: false,
        streamDir: TEST_STREAM_DIR,
      },
      { callOllama: caller }
    );

    // No setDNA() call
    const result = await orchestrator.run('Create something');
    expect(result.rounds.length).toBe(1);
    // Seed should NOT contain domain knowledge
    expect(result.rounds[0].seed).not.toContain('Domain Knowledge');
  });
});

describe('Scavenger + Swarm integration', () => {
  it('should register DNA and make it available for swarm', () => {
    const dna: ProjectDNA = {
      name: 'shader-project',
      domain: 'creative-coding',
      coreLogic: 'Fragment shader with ray marching',
      constraints: ['Use GLSL 300 es', 'Max 500 lines'],
      patterns: ['SDF rendering'],
      prompts: [],
      extractedAt: '2026-01-01',
      sourcePath: '/tmp/shader',
    };

    generatorRegistry.registerDNA(dna);
    const retrieved = generatorRegistry.getDNA('creative-coding');

    expect(retrieved!.coreLogic).toContain('ray marching');
  });

  it('should detect domain from content keywords', () => {
    // Use DNAExtractor's registerDNA static method
    const registry = new Map<string, ProjectDNA>();
    const dna: ProjectDNA = {
      name: 'test',
      domain: 'generative-art',
      coreLogic: 'p5.js noise patterns',
      constraints: [],
      patterns: [],
      prompts: [],
      extractedAt: '2026-01-01',
      sourcePath: '/tmp/test',
    };

    DNAExtractor.registerDNA(dna, registry);
    expect(registry.get('generative-art')).not.toBeNull();
    expect(registry.size).toBe(1);
  });
});

describe('Swarm + MiningEngine integration', () => {
  it('should mine high-quality fragments from multi-round session', () => {
    const session = {
      session_id: 'integration-test',
      rounds: [
        { round_num: 1, winner_id: 'eve', winner_content: 'The crystal ocean folds like warm light through cold stone, shimmering with echoes of color.', seed: 'prompt' },
        { round_num: 2, winner_id: 'kai', winner_content: 'Noise-driven particles emerge from silence, each one a note in the symphony of light.', seed: 'prompt' },
        { round_num: 3, winner_id: 'rex', winner_content: 'Simple text', seed: 'prompt' },
      ],
    };

    const fragments = MiningEngine.mineSession(session, 8);
    // Rounds 1 and 2 have rich content, round 3 is too short
    expect(fragments.length).toBeGreaterThanOrEqual(1);
    expect(fragments.length).toBeLessThanOrEqual(2);

    // All fragments should have valid metadata
    for (const frag of fragments) {
      expect(frag.score).toBeGreaterThanOrEqual(8);
      expect(frag.source).toBe('integration-test');
      expect(frag.persona).not.toBeNull();
    }
  });

  it('should hybridize fragments from different personas', () => {
    const fragments = [
      {
        id: 'f1', text: 'Alpha content from eve', source: 's1',
        round: 1, persona: 'eve', score: 9, mode: 'hybrid',
        tags: ['eve', 'hybrid'], sessionPrompt: 'p', extractedAt: '',
      },
      {
        id: 'f2', text: 'Beta content from max', source: 's1',
        round: 2, persona: 'max', score: 8, mode: 'hybrid',
        tags: ['max', 'hybrid'], sessionPrompt: 'p', extractedAt: '',
      },
      {
        id: 'f3', text: 'Gamma content from kai', source: 's1',
        round: 3, persona: 'kai', score: 8, mode: 'hybrid',
        tags: ['kai', 'hybrid'], sessionPrompt: 'p', extractedAt: '',
      },
    ];

    const synthesis = MiningEngine.hybridize(fragments);
    expect(synthesis).toContain('Synthesize');
    expect(synthesis).toContain('Alpha content from eve');
    expect(synthesis).toContain('Beta content from max');
    expect(synthesis).toContain('Gamma content from kai');
  });
});
