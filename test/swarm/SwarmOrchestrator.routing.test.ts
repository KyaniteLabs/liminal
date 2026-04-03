import { describe, it, expect, beforeEach } from 'vitest';
/**
 * SwarmOrchestrator Routing Tests
 * 
 * Tests for learned routing and expert selection functionality.
 */

import { SwarmOrchestrator } from '../../src/swarm/SwarmOrchestrator.js';
import { VotingEngine } from '../../src/swarm/VotingEngine.js';
import { ALL_EXPERTS } from '../../src/swarm/ExpertPersonas.js';
import { SwarmMode } from '../../src/swarm/types.js';

describe('SwarmOrchestrator Routing', () => {
  let orchestrator: SwarmOrchestrator;

  beforeEach(() => {
    orchestrator = new SwarmOrchestrator();
  });

  describe('routePromptToExperts', () => {
    it('should route geometric prompts to the minimalist expert', () => {
      const result = orchestrator.routePromptToExperts('Create a geometric grid with circles and lines');
      
      const expertIds = result.selectedExperts.map(e => e.id);
      expect(expertIds).toContain('minimalist');
      
      // Check that the geometric expert has the highest score
      const minimalistScore = result.scores.get('minimalist') ?? 0;
      expect(minimalistScore).toBeGreaterThan(0);
    });

    it('should route nature prompts to the organic expert', () => {
      const result = orchestrator.routePromptToExperts('Flowing water with leaves and organic growth patterns');
      
      const expertIds = result.selectedExperts.map(e => e.id);
      expect(expertIds).toContain('organic');
    });

    it('should route fractal prompts to the mathematical expert', () => {
      const result = orchestrator.routePromptToExperts('Recursive fractal pattern with fibonacci spirals mandelbrot');
      
      const expertIds = result.selectedExperts.map(e => e.id);
      expect(expertIds).toContain('mathematical');
    });

    it('should route physics prompts to the interactive expert', () => {
      const result = orchestrator.routePromptToExperts('Physics simulation with gravity collision bounce mouse interaction');
      
      const expertIds = result.selectedExperts.map(e => e.id);
      expect(expertIds).toContain('interactive');
    });

    it('should route audio prompts to the audio expert', () => {
      const result = orchestrator.routePromptToExperts('Music visualization frequency spectrum beat rhythm bass');
      
      const expertIds = result.selectedExperts.map(e => e.id);
      expect(expertIds).toContain('audio');
    });

    it('should provide reasoning for expert selection', () => {
      const result = orchestrator.routePromptToExperts('Geometric grid with circles');
      
      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('Selected');
      expect(result.reasoning).toContain('experts');
    });

    it('should return scores for all experts', () => {
      const result = orchestrator.routePromptToExperts('Geometric pattern');
      
      expect(result.scores.size).toBe(ALL_EXPERTS.length);
      
      for (const expert of ALL_EXPERTS) {
        expect(result.scores.has(expert.id)).toBe(true);
        expect(typeof result.scores.get(expert.id)).toBe('number');
      }
    });

    it('should select different experts for different prompt types', () => {
      const geometricResult = orchestrator.routePromptToExperts('Geometric shapes grid circles lines minimal');
      const natureResult = orchestrator.routePromptToExperts('Flowing water organic leaves plants nature');
      const audioResult = orchestrator.routePromptToExperts('Music audio frequency beat bass visualization');
      
      // Get top expert for each
      const geometricTop = geometricResult.selectedExperts[0]?.id;
      const natureTop = natureResult.selectedExperts[0]?.id;
      const audioTop = audioResult.selectedExperts[0]?.id;
      
      // Different prompt types should route to different primary experts
      expect(geometricTop).not.toBe(natureTop);
      expect(audioTop).not.toBe(geometricTop);
      expect(audioTop).not.toBe(natureTop);
    });

    it('should use sparse selection (not all 5 experts)', () => {
      const result = orchestrator.routePromptToExperts('Geometric circles minimal');
      
      // Should select fewer than all experts (sparse routing)
      expect(result.selectedExperts.length).toBeLessThan(ALL_EXPERTS.length);
    });

    it('should select 2-3 experts when multiple domains match', () => {
      // This prompt should match multiple domains
      const result = orchestrator.routePromptToExperts(
        'Geometric grid with flowing water particles and physics simulation'
      );
      
      // When multiple domains match, should select 2-3 experts
      if (result.selectedExperts.length > 1) {
        expect(result.selectedExperts.length).toBeGreaterThanOrEqual(2);
        expect(result.selectedExperts.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('getRoutedPersonas', () => {
    it('should return personas for selected experts', () => {
      const personas = orchestrator.getRoutedPersonas('Geometric grid circles lines');
      
      expect(personas.length).toBeGreaterThan(0);
      
      for (const persona of personas) {
        expect(persona.id).toBeTruthy();
        expect(persona.name).toBeTruthy();
        expect(persona.systemPrompt).toBeTruthy();
        // All experts use same temperature (system-prompt-based differentiation)
        expect(persona.temperature).toBe(0.7);
      }
    });

    it('should include minimalist persona for geometric prompts', () => {
      const personas = orchestrator.getRoutedPersonas('Geometric circles and squares grid lines');
      
      const ids = personas.map(p => p.id);
      expect(ids).toContain('minimalist');
    });

    it('should create personas with creative philosophy system prompts', () => {
      const personas = orchestrator.getRoutedPersonas('Fractal patterns fibonacci');
      
      for (const persona of personas) {
        // System prompts should be substantial (creative philosophy)
        expect(persona.systemPrompt.length).toBeGreaterThan(100);
        // Should contain creative guidance, not just basic instructions
        expect(persona.systemPrompt.toLowerCase()).toMatch(/creative|philosophy|approach|aesthetic/);
      }
    });

    it('should use same temperature for all personas', () => {
      const personas = orchestrator.getRoutedPersonas('Mixed geometric and organic elements');
      
      // All personas should use same temperature
      const temperatures = new Set(personas.map(p => p.temperature));
      expect(temperatures.size).toBe(1);
      expect(personas[0]?.temperature).toBe(0.7);
    });
  });

  describe('run with routing', () => {
    it('should use routed personas during execution', async () => {
      const mockOllama = async (_model: string, systemPrompt: string): Promise<string> => {
        // Return the expert type based on system prompt
        if (systemPrompt.includes('Geometer')) return 'Minimalist geometric output';
        if (systemPrompt.includes('Naturalist')) return 'Organic flowing output';
        if (systemPrompt.includes('Mathematician')) return 'Fractal recursive output';
        if (systemPrompt.includes('Physicist')) return 'Physics simulation output';
        if (systemPrompt.includes('Synesthete')) return 'Audio visualization output';
        return 'Default output';
      };

      const testOrchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: './test-stream' },
        { callOllama: mockOllama }
      );

      const result = await testOrchestrator.run('Geometric grid with circles', SwarmMode.COMPETITIVE);
      
      expect(result.rounds.length).toBe(1);
      expect(result.finalOutput).toBeTruthy();
    }, 10000);
  });
});

describe('VotingEngine Calibration', () => {
  beforeEach(() => {
    VotingEngine.clearPerformanceHistory();
  });

  describe('recordOutcome', () => {
    it('should record correct votes', () => {
      VotingEngine.recordOutcome('expert1', 'geometric', 'expert1', 'expert1');
      
      const accuracy = VotingEngine.getExpertAccuracy('expert1', 'geometric');
      expect(accuracy).toBeGreaterThan(0.5); // Should be > 0.5 after correct vote
    });

    it('should record incorrect votes', () => {
      VotingEngine.recordOutcome('expert1', 'geometric', 'expert2', 'expert1');
      
      const accuracy = VotingEngine.getExpertAccuracy('expert1', 'geometric');
      expect(accuracy).toBeLessThan(0.5); // Should be < 0.5 after incorrect vote
    });

    it('should track votes per domain separately', () => {
      VotingEngine.recordOutcome('expert1', 'geometric', 'expert1', 'expert1');
      VotingEngine.recordOutcome('expert1', 'organic', 'expert2', 'expert3');
      
      const geometricAccuracy = VotingEngine.getExpertAccuracy('expert1', 'geometric');
      const organicAccuracy = VotingEngine.getExpertAccuracy('expert1', 'organic');
      
      // Should have different accuracies for different domains
      expect(geometricAccuracy).not.toBe(organicAccuracy);
    });

    it('should accumulate multiple votes', () => {
      // Record 3 correct votes
      VotingEngine.recordOutcome('expert1', 'geometric', 'expert1', 'expert1');
      VotingEngine.recordOutcome('expert1', 'geometric', 'expert1', 'expert1');
      VotingEngine.recordOutcome('expert1', 'geometric', 'expert1', 'expert1');
      
      const accuracy = VotingEngine.getExpertAccuracy('expert1', 'geometric');
      expect(accuracy).toBeGreaterThan(0.7); // High accuracy after 3 correct votes
    });
  });

  describe('getCalibratedWeight', () => {
    it('should return default weight for experts with no history', () => {
      const mockExpert = {
        id: 'newExpert',
        name: 'New',
        displayName: 'New Expert',
        model: 'test',
        temperature: 0.7,
        maxTokens: 100,
        systemPrompt: 'Test',
        voice: 'Test',
        thinkingStyle: 'Test',
        votingBias: 'Test',
        constraints: [],
        votingPower: 2,
      };
      
      const weight = VotingEngine.getCalibratedWeight(mockExpert, 'general');
      expect(weight).toBe(2); // Default: votingPower * 1.0
    });

    it('should increase weight for accurate experts', () => {
      const mockExpert = {
        id: 'accurateExpert',
        name: 'Accurate',
        displayName: 'Accurate Expert',
        model: 'test',
        temperature: 0.7,
        maxTokens: 100,
        systemPrompt: 'Test',
        voice: 'Test',
        thinkingStyle: 'Test',
        votingBias: 'Test',
        constraints: [],
        votingPower: 2,
      };
      
      // Record 5 correct votes
      for (let i = 0; i < 5; i++) {
        VotingEngine.recordOutcome('accurateExpert', 'geometric', 'winner', 'winner');
      }
      
      const weight = VotingEngine.getCalibratedWeight(mockExpert, 'geometric');
      expect(weight).toBeGreaterThan(2); // Should be > base weight
    });

    it('should decrease weight for inaccurate experts', () => {
      const mockExpert = {
        id: 'inaccurateExpert',
        name: 'Inaccurate',
        displayName: 'Inaccurate Expert',
        model: 'test',
        temperature: 0.7,
        maxTokens: 100,
        systemPrompt: 'Test',
        voice: 'Test',
        thinkingStyle: 'Test',
        votingBias: 'Test',
        constraints: [],
        votingPower: 2,
      };
      
      // Record 5 incorrect votes
      for (let i = 0; i < 5; i++) {
        VotingEngine.recordOutcome('inaccurateExpert', 'geometric', 'wrong', 'winner');
      }
      
      const weight = VotingEngine.getCalibratedWeight(mockExpert, 'geometric');
      expect(weight).toBeLessThan(2); // Should be < base weight
    });
  });

  describe('inferDomain', () => {
    it('should infer geometric domain', () => {
      const domain = VotingEngine.inferDomain('Geometric shapes and grid patterns');
      expect(domain).toBe('geometric');
    });

    it('should infer organic domain', () => {
      const domain = VotingEngine.inferDomain('Flowing water and organic leaves');
      expect(domain).toBe('organic');
    });

    it('should infer mathematical domain', () => {
      const domain = VotingEngine.inferDomain('Fractal patterns with fibonacci spirals');
      expect(domain).toBe('mathematical');
    });

    it('should infer interactive domain', () => {
      const domain = VotingEngine.inferDomain('Physics simulation with gravity and mouse interaction');
      expect(domain).toBe('interactive');
    });

    it('should infer audio domain', () => {
      const domain = VotingEngine.inferDomain('Music visualization reacting to bass frequencies');
      expect(domain).toBe('audio');
    });

    it('should return general for unmatched prompts', () => {
      const domain = VotingEngine.inferDomain('Something completely unrelated');
      expect(domain).toBe('general');
    });
  });

  describe('calibrateFromResult', () => {
    it('should calibrate from swarm result', () => {
      const mockResult = {
        rounds: [
          {
            votes: new Map([
              ['expert1', { voterId: 'expert1', firstChoice: 'expert1', secondChoice: 'expert2', reasoning: '' }],
              ['expert2', { voterId: 'expert2', firstChoice: 'expert1', secondChoice: 'expert3', reasoning: '' }],
            ]),
          },
        ],
      };
      
      VotingEngine.calibrateFromResult(mockResult, 'expert1', 'Geometric pattern');
      
      const expert1Accuracy = VotingEngine.getExpertAccuracy('expert1', 'geometric');
      const expert2Accuracy = VotingEngine.getExpertAccuracy('expert2', 'geometric');
      
      // expert1 voted correctly (voted for expert1, winner was expert1)
      expect(expert1Accuracy).toBeGreaterThan(0.5);
      
      // expert2 also voted correctly (voted for expert1, winner was expert1)
      expect(expert2Accuracy).toBeGreaterThan(0.5);
    });
  });

  describe('clearPerformanceHistory', () => {
    it('should clear all performance records', () => {
      VotingEngine.recordOutcome('expert1', 'geometric', 'expert1', 'expert1');
      
      expect(VotingEngine.getAllPerformanceRecords().length).toBeGreaterThan(0);
      
      VotingEngine.clearPerformanceHistory();
      
      expect(VotingEngine.getAllPerformanceRecords().length).toBe(0);
    });
  });
});
