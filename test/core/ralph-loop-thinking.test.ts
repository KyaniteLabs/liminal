import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * RalphLoop thinking trace propagation tests
 * 
 * Verifies that thinking traces from generators flow through:
 * GeneratorRegistry → GenerationOrchestrator → RalphLoop → metaHarness
 */
import { RalphLoop } from '../../src/core/RalphLoop.js';
import { ContextAccumulation } from '../../src/core/ContextAccumulation.js';
import path from 'path';
import os from 'os';

const TEST_GALLERY_DIR = path.join(os.tmpdir(), 'liminal-thinking-test');

// Track metaHarness calls for verification
const metaHarnessCalls: Array<{
  success: boolean;
  model: string;
  domain: string;
  prompt: string;
  code?: string;
  error?: string;
  duration: number;
  thinking?: string;
  recoveredFromThinking?: boolean;
}> = [];

// --- Mock LLMClient ---
vi.mock('../../src/llm/LLMClient.js', async () => {
  const actual = await vi.importActual('../../src/llm/LLMClient.js');
  const MockLLMClient = (actual as any).LLMClient as any;
  MockLLMClient.isConfigured = () => true;
  return actual;
});

// --- Mock GeneratorRegistry with thinking support ---
vi.mock('../../src/generators/GeneratorRegistry.js', () => {
  const entries: any[] = [];
  return {
    generatorRegistry: {
      register: vi.fn((entry: any) => entries.push(entry)),
      dispatch: vi.fn((prompt: string) => {
        const lower = prompt.toLowerCase();
        
        // Generator that returns thinking (object format)
        if (lower.includes('thinking')) {
          return {
            entry: {
              name: 'thinking-generator',
              generate: async () => ({
                code: `// Generated with thinking\nfunction setup() { createCanvas(400, 400); }\nfunction draw() { background(220); }`,
                thinking: 'I analyzed the prompt and decided to create a simple canvas with default background.',
                model: 'test-model-v1',
                recoveredFromThinking: false,
              }),
            },
            confidence: 0.9,
          };
        }
        
        // Generator that returns plain string (backward compatibility)
        if (lower.includes('legacy')) {
          return {
            entry: {
              name: 'legacy-generator',
              generate: async () => `// Legacy generator output\nfunction setup() { createCanvas(400, 400); }\nfunction draw() { background(200); }`,
            },
            confidence: 0.8,
          };
        }
        
        // Generator that returns thinking recovered from reasoning tags
        if (lower.includes('recovered')) {
          return {
            entry: {
              name: 'recovered-thinking-generator',
              generate: async () => ({
                code: `// Recovered from thinking\nfunction setup() { createCanvas(400, 400); }`,
                thinking: '<thinking>Let me create a canvas...</thinking>\nfunction setup() { createCanvas(400, 400); }',
                model: 'test-model-v2',
                recoveredFromThinking: true,
              }),
            },
            confidence: 0.85,
          };
        }
        
        // Default generator for basic tests
        return {
          entry: {
            name: 'default',
            generate: async () => ({
              code: `// Default test sketch\nfunction setup() { createCanvas(400, 400); }\nfunction draw() { background(220); }`,
              thinking: 'Generated a simple test sketch',
              model: 'test-model-default',
            }),
          },
          confidence: 0.5,
        };
      }),
      getAll: vi.fn(() => entries),
      clear: vi.fn(() => { entries.length = 0; }),
    },
  };
});

vi.mock('../../src/generators/registerGenerators.js', () => ({
  registerAllGenerators: vi.fn(),
}));

// Mock P5GeneratorLLM for fallback when no generator matches
vi.mock('../../src/generators/p5/P5GeneratorLLM.js', () => ({
  P5GeneratorLLM: class MockP5GeneratorLLM {
    async generate() {
      return {
        code: `// Default P5 sketch\nfunction setup() { createCanvas(400, 400); }\nfunction draw() { background(220); }`,
        success: true,
      };
    }
  },
}));

vi.mock('../../src/gallery/Gallery.js', () => ({
  Gallery: class MockGallery {
    private dir: string;
    constructor(dir: string) { this.dir = dir; }
    async saveIteration(_project: string, _version: number, _code: string) {}
    async saveSwarmSession(_project: string, _result: any) {}
    async loadHistory(_project: string) { return []; }
    async loadHistoryFromDir(_dir: string) { return []; }
  },
}));

vi.mock('../../src/compost/CompostHeap.js', () => ({
  CompostHeap: class MockCompostHeap {
    async addFile() {}
    async isOverCapacity() { return false; }
  },
}));

vi.mock('../../src/compost/CompostMill.js', () => ({
  CompostMill: class MockCompostMill {
    async digest() {}
  },
}));

vi.mock('../../src/evolution/AestheticModel.js', () => ({
  AestheticModel: class MockAestheticModel {
    async load() {}
    async save() {}
  },
}));

vi.mock('../../src/learning/index.js', () => ({
  ArchiveLearning: class MockArchiveLearning {
    getArchive() {
      return { load: async () => {}, save: async () => {} };
    }
    addOutput() {}
    addFragment() {}
  },
  QualityArchive: class MockQualityArchive {
    async load() {}
    async save() {}
  },
}));

vi.mock('../../src/swarm/SwarmOrchestrator.js', () => ({
  SwarmOrchestrator: class MockSwarmOrchestrator {
    async run() { 
      return { 
        finalOutput: `// Swarm output\nfunction setup() { createCanvas(400, 400); }`,
      }; 
    }
  },
}));

vi.mock('../../src/swarm/MiningEngine.js', () => ({
  MiningEngine: { mineResult: () => [] },
}));

vi.mock('../../src/collab/CollaborationEngine.js', () => ({
  CollaborationEngine: class MockCollaborationEngine {
    async run() { 
      return { 
        output: `// Collaboration output\nfunction setup() { createCanvas(400, 400); }`,
      }; 
    }
  },
}));

vi.mock('../../src/routing/RoutingData.js', () => ({
  AB_TEST_RESULTS: {},
  DOMAIN_ROUTING_DATA: {},
  DOMAIN_KEYWORDS: {},
  OVERALL_FITNESS: { local: 0.8, cloud: 0.85 },
  recordRoutingOutcome: async () => {},
}));

// Mock metaHarness to capture calls
vi.mock('../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: {
    onGenerationComplete: vi.fn(async (result) => {
      metaHarnessCalls.push(result);
    }),
  },
}));

vi.mock('../../src/core/EventBus.js', () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
  },
  EventTypes: {
    PROCESS_START: 'PROCESS_START',
    PROCESS_END: 'PROCESS_END',
    LOOP_ITERATION: 'LOOP_ITERATION',
    LOOP_EVALUATION: 'LOOP_EVALUATION',
    LLM_REQUEST: 'LLM_REQUEST',
    LLM_RESPONSE: 'LLM_RESPONSE',
    COMPOST_STAGE: 'COMPOST_STAGE',
  },
}));

vi.mock('../../src/utils/Logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/core/ScoringEngine.js', () => ({
  ScoringEngine: class MockScoringEngine {
    async score() {
      return {
        score: 0.75,
        issues: [],
        dimensions: { technical: 0.8, creative: 0.7, novelty: 0.6 },
      };
    }
    async scoreReliable() {
      return this.score();
    }
  },
  scoreRenderedEvidence: vi.fn(async () => ({
    score: 0.75,
    confidence: 0.9,
    failureClass: 'none',
    reasoning: 'test render evidence',
  })),
}));

vi.mock('../../src/config/FeatureFlags.js', () => ({
  getEvalMode: vi.fn(() => 'legacy'),
  getRepairMode: vi.fn(() => 'off'),
}));

vi.mock('../../src/core/PromptStore.js', () => ({
  PromptStore: {
    load: (prompt: string) => prompt,
    injectContext: (prompt: string, context: string) => prompt + '\n\n---\nContext from previous iterations:\n' + context,
  },
}));

vi.mock('../../src/core/AmbiguityDetector.js', () => ({
  AmbiguityDetector: class MockAmbiguityDetector {
    detect() { return []; }
  },
}));

vi.mock('../../src/core/CodeValidator.js', () => ({
  CodeValidator: {
    validate: (code: string) => ({ valid: true, cleanedCode: code, errors: [] }),
  },
}));

vi.mock('../../src/core/PromiseDetector.js', () => ({
  PromiseDetector: {
    detect: () => false,
  },
}));

vi.mock('../../src/core/ContextBuilder.js', () => ({
  buildContextForInjection: () => 'No previous context.',
}));

vi.mock('../../src/core/PromptEnhancer.js', () => ({
  enhancePrompt: async (prompt: string) => prompt,
}));

vi.mock('../../src/core/EvolutionIntegration.js', () => ({
  EvolutionIntegration: class MockEvolutionIntegration {
    update() { return { noveltyScore: 0.5, hints: '' }; }
  },
}));

vi.mock('../../src/core/StagnationDetector.js', () => ({
  StagnationDetector: class MockStagnationDetector {
    check() { return { shouldBreak: false, reason: '' }; }
  },
}));

vi.mock('../../src/core/LoopPersistence.js', () => ({
  LoopPersistence: class MockLoopPersistence {
    async saveIteration() {}
    async saveMergeStep() {}
  },
}));

describe('RalphLoop Thinking Trace Propagation', () => {
  beforeEach(() => {
    RalphLoop.reset();
    metaHarnessCalls.length = 0;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    RalphLoop.reset();
  });

  describe('RED phase: Tests expecting thinking propagation (will fail initially)', () => {
    it('Test 1: Generator returns thinking → RalphLoop.run() result includes thinking', async () => {
      const result = await RalphLoop.run('create thinking test sketch', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'thinking-test-1',
      });

      // The result should include thinking from the generator
      expect(result.code).toContain('Generated with thinking');

      expect(result.thinking).toBe('I analyzed the prompt and decided to create a simple canvas with default background.');
      expect(result.model).toBe('test-model-v1');
    });

    it('Test 2: Generator returns plain string → RalphLoop.run() still works, no thinking', async () => {
      const result = await RalphLoop.run('create legacy test sketch', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'legacy-test-2',
      });

      // The result should work but have no thinking
      expect(result.code).toContain('Legacy generator output');
      expect(result.thinking).toBeUndefined();
      expect(result.model).toBeUndefined();
    });

    it('Test 3: RalphLoop passes thinking to metaHarness → verify onGenerationComplete receives thinking', async () => {
      // Set NODE_ENV to something other than 'test' so metaHarness is called
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'not-test';
      
      try {
        // Clear previous calls
        metaHarnessCalls.length = 0;
        
        await RalphLoop.run('create thinking test sketch', {
          maxIterations: 1,
          galleryDir: TEST_GALLERY_DIR,
          project: 'meta-test-3',
        });

        // Find the metaHarness call
        const metaCall = metaHarnessCalls.find(
          call => call.prompt === 'create thinking test sketch'
        );

        expect(metaCall!.thinking).toBe('I analyzed the prompt and decided to create a simple canvas with default background.');
        expect(metaCall!.model).toBe('test-model-v1');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('Test 4: Generator with recovered thinking → recoveredFromThinking flag is propagated', async () => {
      const result = await RalphLoop.run('create recovered test sketch', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'recovered-test-4',
      });

      expect(result.code).toContain('Recovered from thinking');
      // Note: The full thinking propagation with recoveredFromThinking flag
      // will be tested when the feature is implemented
    });
  });

  describe('GREEN phase: Backward compatibility tests (should pass)', () => {
    it('Existing tests should not break - basic loop functionality preserved', async () => {
      const result = await RalphLoop.run('basic test', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'basic-test',
      });

      expect(result.code?.length).toBeGreaterThan(0);
      expect(result.iterations).toBe(1);
      // completed may be false if promise not detected - that's OK for this test
      expect(result.finalScore).toBeGreaterThan(0);
    });
  });
});
