import { describe, it, expect } from 'vitest';
/**
 * SwarmOrchestrator tests
 */

import { SwarmOrchestrator } from '../../src/swarm/SwarmOrchestrator.js';
import { SwarmMode } from '../../src/swarm/types.js';
import type { SwarmConfig } from '../../src/swarm/types.js';
import { DEFAULT_PERSONAS } from '../../src/swarm/personas.js';

// Mock Ollama caller that returns deterministic responses per persona
const createMockOllama = (): (model: string, systemPrompt: string, userPrompt: string, options?: { temperature?: number; num_predict?: number }) => Promise<string> => {
  return async (_model: string, systemPrompt: string): Promise<string> => {
    // Support both old personas and new expert personas
    if (systemPrompt.includes('You are Max') || systemPrompt.includes('Distiller')) return 'Brief. Precise.';
    if (systemPrompt.includes('You are Rex') || systemPrompt.includes('Explorer')) return 'This is wrong. Challenge it.';
    if (systemPrompt.includes('You are Sam') || systemPrompt.includes('Muse')) return 'The warm light touched her face as she remembered.';
    if (systemPrompt.includes('You are Kai') || systemPrompt.includes('Architect')) return 'The system connects flows through hidden networks.';
    if (systemPrompt.includes('You are Nova') || systemPrompt.includes('Synthesizer')) return 'Two worlds bridge into one unified vision.';
    // Support new expert personas
    if (systemPrompt.includes('Geometer')) return 'function setup() { createCanvas(400, 400); } function draw() { background(0); rect(50, 50, 100, 100); }';
    if (systemPrompt.includes('Naturalist')) return 'function setup() { createCanvas(400, 400); } function draw() { background(0); circle(200, 200, 50); }';
    if (systemPrompt.includes('Mathematician')) return 'function setup() { createCanvas(400, 400); } function draw() { background(0); line(0, 0, 400, 400); }';
    if (systemPrompt.includes('Physicist')) return 'function setup() { createCanvas(400, 400); } function draw() { background(0); ellipse(200, 200, 80, 60); }';
    if (systemPrompt.includes('Synesthete')) return 'function setup() { createCanvas(400, 400); } function draw() { background(0); rect(100, 100, 200, 200); }';
    if (systemPrompt.includes('1st choice') || systemPrompt.includes('2nd choice')) return '1st choice: A\n2nd choice: B\nWinner is best.';
    return 'Default response with some code.';
  };
};

describe('SwarmOrchestrator', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const orchestrator = new SwarmOrchestrator();
      expect(orchestrator).toBeDefined();
    });

    it('should create with custom config', () => {
      const config: Partial<SwarmConfig> = {
        maxRounds: 3,
        convergenceThreshold: 2,
        mode: SwarmMode.COMPETITIVE,
        musicalChairs: false,
      };

      const orchestrator = new SwarmOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });
  });

  describe('run', () => {
    it('should run a full swarm evolution with mock Ollama', async () => {
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 2, musicalChairs: false, streamDir: './test-stream' },
        { callOllama: createMockOllama() }
      );

      const result = await orchestrator.run('Write about light');

      expect(result).toBeDefined();
      expect(result.rounds.length).toBeGreaterThan(0);
      expect(result.finalOutput).toBeTruthy();
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.mode).toBe(SwarmMode.HYBRID);
    }, 10000);

    it('should run in competitive mode', async () => {
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 2, musicalChairs: false, streamDir: './test-stream' },
        { callOllama: createMockOllama() }
      );

      const result = await orchestrator.run('Test prompt', SwarmMode.COMPETITIVE);

      expect(result.mode).toBe(SwarmMode.COMPETITIVE);
      expect(result.rounds.length).toBe(2);
    }, 10000);

    it('should run in ring mode', async () => {
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, musicalChairs: false, streamDir: './test-stream' },
        { callOllama: createMockOllama() }
      );

      const result = await orchestrator.run('Test', SwarmMode.RING);

      expect(result.mode).toBe(SwarmMode.RING);
      expect(result.rounds.length).toBe(1);
    }, 10000);

    it('should call progress callback', async () => {
      const progressCalls: Array<{ round: number; winnerId: string | null }> = [];
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, musicalChairs: false, streamDir: './test-stream' },
        {
          callOllama: createMockOllama(),
          onProgress: (data) => progressCalls.push(data),
        }
      );

      await orchestrator.run('Test');

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].round).toBe(1);
    }, 10000);

    it('should run in mesh mode', async () => {
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 2, musicalChairs: false, streamDir: './test-stream' },
        { callOllama: createMockOllama() }
      );

      const result = await orchestrator.run('Test', SwarmMode.MESH);

      expect(result.mode).toBe(SwarmMode.MESH);
      expect(result.rounds.length).toBe(2);
      expect(result.finalOutput).toBeTruthy();
    }, 10000);

    it('should detect convergence', async () => {
      // Use a custom 2-persona set where alpha always scores higher on heuristic dimensions.
      const convergingPersonas = [
        {
          id: 'alpha',
          name: 'Alpha',
          displayName: 'Alpha',
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 200, // High enough that HeuristicScorer doesn't penalize length
          systemPrompt: 'You are Alpha. Write rich, varied vocabulary.',
          voice: 'Rich.',
          thinkingStyle: 'Linear.',
          votingBias: 'Votes for A.',
          constraints: ['Be rich in vocabulary and varied in word choice'],
          votingPower: 2,
        },
        {
          id: 'beta',
          name: 'Beta',
          displayName: 'Beta',
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 80,
          systemPrompt: 'You are Beta.',
          voice: 'Flat.',
          thinkingStyle: 'Linear.',
          votingBias: 'Votes for B.',
          constraints: ['Be brief'],
          votingPower: 2,
        },
      ];

      // Stateful mock: Alpha returns different rich outputs each round to maintain novelty.
      // Without this, HeuristicScorer's novelty dimension drops to 0 on repeated identical
      // output, causing the winner to alternate between Alpha and Beta.
      let alphaRound = 0;
      const alphaOutputs = [
        'Spectral luminance cascades through crystalline corridors of light.',
        'Shimmering resonance weaves ephemeral tapestries across vast undulating landscapes.',
        'Crystalline vibrations pulse through corridors of shimmering spectral glow.',
      ];

      const convergingMock = async (_model: string, systemPrompt: string, _userPrompt: string): Promise<string> => {
        if (systemPrompt.includes('Alpha')) {
          return alphaOutputs[alphaRound++ % alphaOutputs.length];
        }
        if (systemPrompt.includes('Beta')) {
          return 'Short.';
        }
        return '1st choice: A\n2nd choice: B\nAlpha is better.';
      };

      const orchestrator = new SwarmOrchestrator(
        {
          maxRounds: 6,
          convergenceThreshold: 3,
          musicalChairs: false,
          personas: convergingPersonas,
          streamDir: './test-stream',
          skipRouting: true,
        },
        { callOllama: convergingMock }
      );

      const result = await orchestrator.run('Test');

      expect(result.converged).toBe(true);
      expect(result.convergenceRound).toBeLessThanOrEqual(6);
    }, 30000);
  });

  describe('routing', () => {
    it('should route geometric prompts to relevant experts', () => {
      const orchestrator = new SwarmOrchestrator();
      const routing = orchestrator.routePromptToExperts('Geometric grid with circles and lines');
      
      expect(routing.selectedExperts.length).toBeGreaterThan(0);
      expect(routing.reasoning).toBeTruthy();
      
      // Should have scores for all experts
      expect(routing.scores.size).toBeGreaterThan(0);
    });

    it('should use configured personas when routing is not explicitly called', async () => {
      const mockOllama = async (): Promise<string> => {
        return 'function setup() { createCanvas(400, 400); } function draw() { background(0); }';
      };

      const orchestrator = new SwarmOrchestrator(
        { 
          maxRounds: 1, 
          musicalChairs: false, 
          streamDir: './test-stream',
          personas: DEFAULT_PERSONAS.slice(0, 2), // Use only 2 personas
        },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.run('Test');
      
      expect(result.rounds.length).toBe(1);
      expect(result.rounds[0]?.outputs.size).toBeLessThanOrEqual(2);
    }, 10000);
  });
});
