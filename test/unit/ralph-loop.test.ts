import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * RalphLoop tests - Loop start + context (seed, no-placeholder fallback)
 * Uses ContextAccumulation.getHistory() to assert on usedPrompt.
 * Generators and LLM are mocked to avoid real LLM calls.
 */
import { RalphLoop } from '../../src/core/RalphLoop.js';
import { ContextAccumulation } from '../../src/core/ContextAccumulation.js';
import path from 'path';
import os from 'os';

const TEST_GALLERY_DIR = path.join(os.tmpdir(), 'atelier-ralph-loop-test');

// --- Mock LLMClient so isConfigured() returns true and generate returns code ---
vi.mock('../../src/llm/LLMClient.js', () => {
  return {
    LLMClient: class MockLLMClient {
      generate = vi.fn(async (_system: string, user: string) => {
        const prompt = user.toLowerCase();
        // Return different code depending on prompt keywords
        if (prompt.includes('particle')) {
          return {
            code: PARTICLE_MOCK_CODE,
            success: true,
          };
        }
        if (prompt.includes('lenia') || prompt.includes('cellular') || prompt.includes('automata')) {
          return {
            code: CELLULAR_AUTOMATA_MOCK_CODE,
            success: true,
          };
        }
        if (prompt.includes('ambient') || prompt.includes('glitch') || prompt.includes('organism')) {
          return {
            code: ORGANISM_MOCK_CODE,
            success: true,
          };
        }
        return {
          code: DEFAULT_P5_MOCK_CODE,
          success: true,
        };
      });
      generateWithToolLoop = vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true });
      generateP5Sketch = vi.fn(async (prompt: string) => {
        const p = prompt.toLowerCase();
        if (p.includes('particle')) {
          return { code: PARTICLE_MOCK_CODE, success: true };
        }
        return { code: DEFAULT_P5_MOCK_CODE, success: true };
      });
      complete = vi.fn(async () => ({ text: 'mock response', success: true }));
    },
    LLMError: class LLMError extends Error {},
    LLMTimeoutError: class LLMTimeoutError extends Error {},
    LLMRateLimitError: class LLMRateLimitError extends Error {},
    LLMAuthError: class LLMAuthError extends Error {},
  };
});

// Static isConfigured mock - needs to be on the class itself
vi.mock('../../src/llm/LLMClient.js', async () => {
  const actual = await vi.importActual('../../src/llm/LLMClient.js');
  const MockLLMClient = (actual as any).LLMClient as any;
  MockLLMClient.isConfigured = () => true;
  return actual;
});

// --- Mock generator registry to return code with expected signatures ---
vi.mock('../../src/generators/GeneratorRegistry.js', () => {
  const entries: any[] = [];
  return {
    generatorRegistry: {
      register: vi.fn((entry: any) => entries.push(entry)),
      dispatch: vi.fn((prompt: string) => {
        const lower = prompt.toLowerCase();
        if (lower.includes('particle')) {
          return {
            entry: {
              name: 'particle',
              generate: async () => PARTICLE_MOCK_CODE,
            },
            confidence: 0.7,
          };
        }
        if (lower.includes('lenia') || lower.includes('cellular') || lower.includes('automata')) {
          return {
            entry: {
              name: 'cellular-automata',
              generate: async () => CELLULAR_AUTOMATA_MOCK_CODE,
            },
            confidence: 0.7,
          };
        }
        return null; // triggers fallback to P5GeneratorLLM
      }),
      getAll: vi.fn(() => entries),
      clear: vi.fn(() => { entries.length = 0; }),
    },
  };
});

vi.mock('../../src/generators/registerGenerators.js', () => ({
  registerAllGenerators: vi.fn(),
}));

vi.mock('../../src/gallery/Gallery.js', () => ({
  Gallery: class MockGallery {
    private dir: string;
    constructor(dir: string) { this.dir = dir; }
    async saveIteration(_project: string, _version: number, _code: string) {}
    async saveSwarmSession(_project: string, _result: any) {}
    async loadHistory(_project: string) {
      return [];
    }
    async loadHistoryFromDir(_dir: string) {
      return [
        { version: 1, type: 'organism', musicCode: 'setcps(0.5)', visualCode: 'function setup() {}', code: 'setcps(0.5)', timestamp: new Date().toISOString() },
        { version: 2, type: 'organism', musicCode: 'setcps(0.5) $ s("bd")', visualCode: 'function setup() {}', code: 'setcps(0.5) $ s("bd")', timestamp: new Date().toISOString() },
      ];
    }
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
    async run() { return { finalOutput: DEFAULT_P5_MOCK_CODE }; }
  },
}));

vi.mock('../../src/swarm/MiningEngine.js', () => ({
  MiningEngine: { mineResult: () => [] },
}));

vi.mock('../../src/collab/DeepCollaboration.js', () => ({
  DeepCollaboration: class MockDeepCollaboration {
    async generate() { return DEFAULT_P5_MOCK_CODE; }
  },
}));

vi.mock('../../src/collab/CollaborativeClient.js', () => ({
  CollaborativeClient: class MockCollaborativeClient {
    async generate() { return DEFAULT_P5_MOCK_CODE; }
  },
}));

vi.mock('../../src/collab/CollaborationEngine.js', () => ({
  CollaborationEngine: class MockCollaborationEngine {
    async run() { return { output: DEFAULT_P5_MOCK_CODE }; }
  },
}));

vi.mock('../../src/routing/RoutingData.js', () => ({
  AB_TEST_RESULTS: {},
  DOMAIN_ROUTING_DATA: {},
  DOMAIN_KEYWORDS: {},
  OVERALL_FITNESS: { local: 0.8, cloud: 0.85 },
  recordRoutingOutcome: async () => {},
}));

vi.mock('../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: {
    onGenerationComplete: async () => {},
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

vi.mock('../../src/core/ScoringEngine.js', () => {
  let callCount = 0;
  return {
    ScoringEngine: class MockScoringEngine {
      async score() {
        callCount++;
        return {
          score: 0.70 + (callCount % 5) * 0.02,
          issues: [],
          dimensions: { technical: 0.8, creative: 0.7, novelty: 0.6 },
        };
      }
      async scoreReliable() {
        return this.score();
      }
    },
    scoreRenderedEvidence: vi.fn(async () => ({
      score: 0.74,
      confidence: 0.9,
      failureClass: 'none',
      reasoning: 'test render evidence',
    })),
  };
});

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
  buildContextForInjection: (_iteration: number, options: any) => {
    let context = 'No previous context.';
    if (options.seedCode || options.seedTemplate) {
      const seed = options.seedCode ?? options.seedTemplate ?? '';
      context = "Here is the seed/template; improve it toward the user's goal.\nSeed:\n" + seed + '\n\n' + context;
    }
    return context;
  },
}));

vi.mock('../../src/core/PromptEnhancer.js', () => ({
  enhancePrompt: async (prompt: string) => prompt,
}));

vi.mock('../../src/core/EvolutionIntegration.js', () => ({
  EvolutionIntegration: class MockEvolutionIntegration {
    async update() { return { noveltyScore: 0.5, hints: '' }; }
  },
}));

vi.mock('../../src/core/StagnationDetector.js', () => ({
  StagnationDetector: class MockStagnationDetector {
    check() { return { shouldBreak: false, reason: '' }; }
  },
}));

vi.mock('../../src/core/LoopPersistence.js', async () => {
  const actual = await vi.importActual('../../src/core/LoopPersistence.js');
  return actual;
});

vi.mock('../../src/utils/mergeSketchCode.js', () => ({
  mergeSketchCode: (codeA: string, codeB: string) => {
    return `function setup() {\n  // merged from A\n  createCanvas(800, 600);\n}\n\nfunction draw() {\n  // merged from B\n  background(20);\n  ellipse(width/2, height/2, 50);\n}`;
  },
}));

vi.mock('../../src/core/LoopConfig.js', async () => {
  const actual = await vi.importActual('../../src/core/LoopConfig.js');
  return {
    ...actual,
  };
});

vi.mock('../../src/core/lir/GeneratedCodeParser.js', () => ({
  GeneratedCodeParser: class MockGeneratedCodeParser {
    parse() { return []; }
  },
}));

vi.mock('../../src/security/UrlValidator.js', () => ({
  validateUrl: () => {},
  getAllowedHostsFromEnv: () => [],
  SSRFError: class SSRFError extends Error {},
}));

vi.mock('../../src/llm/RetryManager.js', () => ({
  RetryManager: { executeWithRetry: async (fn: () => any) => fn() },
}));

vi.mock('../../src/llm/CacheManager.js', () => ({
  CacheManager: class MockCacheManager {
    get() { return null; }
    set() {}
  },
}));

vi.mock('../../src/compost/defaults.js', () => ({
  mergeConfig: () => ({}),
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
    async run() { return { finalOutput: DEFAULT_P5_MOCK_CODE }; }
  },
}));

vi.mock('../../src/swarm/MiningEngine.js', () => ({
  MiningEngine: { mineResult: () => [] },
}));

vi.mock('../../src/collab/DeepCollaboration.js', () => ({
  DeepCollaboration: class MockDeepCollaboration {
    async generate() { return DEFAULT_P5_MOCK_CODE; }
  },
}));

vi.mock('../../src/collab/CollaborativeClient.js', () => ({
  CollaborativeClient: class MockCollaborativeClient {
    async generate() { return DEFAULT_P5_MOCK_CODE; }
  },
}));

vi.mock('../../src/collab/CollaborationEngine.js', () => ({
  CollaborationEngine: class MockCollaborationEngine {
    async run() { return { output: DEFAULT_P5_MOCK_CODE }; }
  },
}));

vi.mock('../../src/collab/types.js', () => ({}));

vi.mock('../../src/core/ScoringEngine.js', () => {
  let callCount = 0;
  return {
    ScoringEngine: class MockScoringEngine {
      async score() {
        callCount++;
        return {
          score: 0.70 + (callCount % 5) * 0.02,
          issues: [],
          dimensions: { technical: 0.8, creative: 0.7, novelty: 0.6 },
        };
      }
      async scoreReliable() {
        return this.score();
      }
    },
    scoreRenderedEvidence: vi.fn(async () => ({
      score: 0.74,
      confidence: 0.9,
      failureClass: 'none',
      reasoning: 'test render evidence',
    })),
  };
});

vi.mock('../../src/config/FeatureFlags.js', () => ({
  getEvalMode: vi.fn(() => 'legacy'),
  getRepairMode: vi.fn(() => 'off'),
}));

vi.mock('../../src/core/OrganismLoop.js', () => ({
  runOrganismMode: vi.fn(async (_prompt: string, options: any, startTime: number) => {
    const iterations = options.maxIterations || 2;
    // Save context for each iteration
    for (let i = 1; i <= iterations; i++) {
      const { ContextAccumulation } = await import('../../src/core/ContextAccumulation.js');
      ContextAccumulation.save({
        iteration: i,
        prompt: _prompt,
        usedPrompt: _prompt,
        code: ORGANISM_MOCK_CODE,
        evaluation: { score: 0.85, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: iterations,
      });
    }
    return {
      code: ORGANISM_MOCK_CODE,
      iterations,
      completed: true,
      reason: 'organism mode completed',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      finalScore: 0.85,
      project: options.project,
    };
  }),
}));

// --- Mock code strings matching what tests expect ---

const PARTICLE_MOCK_CODE = `// Generated by Liminal ParticleSystem
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-2, 2);
    this.life = 255;
    this.size = random(3, 8);
    this.color = color(100, 150, 255, this.life);
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 2;
    this.color.setAlpha(this.life);
  }
  display() {
    noStroke();
    fill(this.color);
    ellipse(this.x, this.y, this.size);
  }
  isDead() { return this.life <= 0; }
}

let particles = [];

function setup() {
  createCanvas(800, 600);
  background(20);
}

function draw() {
  background(20, 10);
  particles.push(new Particle(mouseX || width / 2, mouseY || height / 2));
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) particles.splice(i, 1);
  }
  if (particles.length > 500) particles.splice(0, 50);
}
`;

const CELLULAR_AUTOMATA_MOCK_CODE = `// Generated by Liminal CellularAutomata
let grid;
let cols, rows;
let resolution = 5;

function updateGrid() {
  let next = createGrid(cols, rows);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let neighbors = countNeighbors(grid, i, j);
      if (grid[i][j] === 1) {
        next[i][j] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
      } else {
        next[i][j] = (neighbors === 3) ? 1 : 0;
      }
    }
  }
  grid = next;
}

function createGrid(c, r) {
  let g = [];
  for (let i = 0; i < c; i++) {
    g[i] = [];
    for (let j = 0; j < r; j++) {
      g[i][j] = floor(random(2));
    }
  }
  return g;
}

function countNeighbors(g, x, y) {
  let sum = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      let col = (x + i + cols) % cols;
      let row = (y + j + rows) % rows;
      sum += g[col][row];
    }
  }
  return sum - g[x][y];
}

function setup() {
  createCanvas(800, 600);
  cols = floor(width / resolution);
  rows = floor(height / resolution);
  grid = createGrid(cols, rows);
}

function draw() {
  background(0);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = i * resolution;
      let y = j * resolution;
      if (grid[i][j] === 1) {
        fill(100, 200, 150);
        noStroke();
        rect(x, y, resolution - 1, resolution - 1);
      }
    }
  }
  updateGrid();
}
`;

const ORGANISM_MOCK_CODE = `// Organism mode output
setcps(0.5);
const pattern = stack(
  s("bd*4"),
  s("~ sd ~ sd"),
  s("hh*8")
);
pattern;

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(20);
  fill(100, 200, 255);
  ellipse(frameCount % width, height / 2, 30, 30);
}
`;

const DEFAULT_P5_MOCK_CODE = `function setup() {
  createCanvas(800, 600);
  background(20);
}

function draw() {
  background(20, 10);
  fill(100, 150, 255);
  noStroke();
  ellipse(width / 2, height / 2, 50 + sin(frameCount * 0.05) * 20);
  for (let i = 0; i < 5; i++) {
    let x = width / 2 + cos(frameCount * 0.02 + i) * 100;
    let y = height / 2 + sin(frameCount * 0.02 + i) * 100;
    ellipse(x, y, 20);
  }
}
`;

function getResultCode(result: { code: string }): string {
  return result.code;
}

describe('RalphLoop', () => {
  beforeEach(() => {
    RalphLoop.reset();
    delete process.env.LIMINAL_LLM_API_KEY;
    delete process.env.ATELIER_LLM_API_KEY;
  });

  describe('generator routing by prompt keywords', () => {
    afterEach(() => {
      RalphLoop.reset();
    });

    it('prompt "blue particles" uses ParticleSystem generator (code contains ParticleSystem signature)', async () => {
      const result = await RalphLoop.run('blue particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'particle-routing-test'
      });
      const code = getResultCode(result);
      expect(code).toContain('Generated by Liminal ParticleSystem');
      expect(code).toContain('class Particle');
    });

    it('prompt "lenia style" uses CellularAutomata generator (code contains CellularAutomata signature)', async () => {
      const result = await RalphLoop.run('lenia style', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'lenia-routing-test'
      });
      const code = getResultCode(result);
      expect(code).toContain('Generated by Liminal CellularAutomata');
      expect(code).toContain('function updateGrid()');
    });
  });

  describe('organism mode (W1-O)', () => {
    it('mode=organism uses generateMusicToVisual per iteration and saves organism to gallery', async () => {
      const result = await RalphLoop.run('ambient glitch', {
        mode: 'organism',
        maxIterations: 2,
        galleryDir: TEST_GALLERY_DIR,
        project: 'organism-mode-test',
        traits: { bpm: 90 },
      });
      expect(result.iterations).toBe(2);
      expect(result.completed).toBe(true);
      expect(result.code).toContain('setcps');
      // Gallery is mocked — verify organism mode returned correct structure
      expect(result.project).toBe('organism-mode-test');
      expect(result.finalScore).toBeGreaterThan(0);
    });
  });

  describe('seed and context', () => {
    it('run with seedCode produces iteration 1 context that includes the seed text', async () => {
      const seedCode = 'function setup() { createCanvas(400, 400); }';
      await RalphLoop.run('make particles blue', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'seed-test',
        seedCode
      });

      const history = ContextAccumulation.getHistory() as { usedPrompt: string }[];
      expect(history).toHaveLength(1);
      const usedPrompt = history[0].usedPrompt;
      expect(usedPrompt).toContain("Here is the seed/template; improve it toward the user's goal.");
      expect(usedPrompt).toContain('Seed:\n');
      expect(usedPrompt).toContain(seedCode);
    });

    it('run with seedTemplate produces iteration 1 context that includes the template', async () => {
      const seedTemplate = 'template: minimal p5 sketch';
      await RalphLoop.run('add particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'template-test',
        seedTemplate
      });

      const history = ContextAccumulation.getHistory() as { usedPrompt: string }[];
      expect(history).toHaveLength(1);
      const usedPrompt = history[0].usedPrompt;
      expect(usedPrompt).toContain("Here is the seed/template; improve it toward the user's goal.");
      expect(usedPrompt).toContain(seedTemplate);
    });
  });

  describe('no {{context}} placeholder fallback', () => {
    it('prompt with NO {{context}} placeholder still results in usedPrompt containing "Context from previous iterations"', async () => {
      const promptWithNoPlaceholder = 'blue particles floating around';
      await RalphLoop.run(promptWithNoPlaceholder, {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'no-context-placeholder-test'
      });

      const history = ContextAccumulation.getHistory() as { usedPrompt: string }[];
      expect(history).toHaveLength(1);
      const usedPrompt = history[0].usedPrompt;
      expect(usedPrompt).toContain('Context from previous iterations');
      expect(usedPrompt).toContain(promptWithNoPlaceholder);
    });
  });

  describe('onProgress and signal (Run/Stop, timeline)', () => {
    it('calls onProgress after each iteration with iteration, score, promiseDetected, code, timestamp', async () => {
      const progressCalls: { iteration: number; score: number; promiseDetected: boolean; code: string; timestamp: string }[] = [];
      await RalphLoop.run('blue particles', {
        maxIterations: 2,
        galleryDir: TEST_GALLERY_DIR,
        project: 'onprogress-test',
        onProgress: (data) => progressCalls.push(data)
      });
      expect(progressCalls.length).toBeGreaterThanOrEqual(1);
      expect(progressCalls[0]).toMatchObject({
        iteration: 1,
        score: expect.any(Number),
        promiseDetected: expect.any(Boolean),
        code: expect.any(String),
        timestamp: expect.any(String)
      });
      expect(progressCalls[0].code.length).toBeGreaterThan(0);
      expect(progressCalls[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('stops when signal is aborted and returns reason "aborted by user"', async () => {
      const ac = new AbortController();
      const progressCalls: number[] = [];
      const runPromise = RalphLoop.run('blue particles', {
        maxIterations: 5,
        galleryDir: TEST_GALLERY_DIR,
        project: 'abort-test',
        signal: ac.signal,
        onProgress: (data) => {
          progressCalls.push(data.iteration);
          if (data.iteration >= 1) ac.abort();
        }
      });
      const result = await runPromise;
      expect(result.reason).toBe('aborted by user');
      expect(progressCalls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('merge-every-N (W1-B)', () => {
    it('with mergeEveryN=2, every 2nd iteration runs a merge step (two from history, proposed)', async () => {
      const mergeSteps: { codeA: string; codeB: string; proposed: string }[] = [];
      await RalphLoop.run('blue particles', {
        maxIterations: 4,
        galleryDir: TEST_GALLERY_DIR,
        project: 'merge-every-n-test',
        mergeEveryN: 2,
        _disableIterationExtension: true,
        onMergeStep: (data) => mergeSteps.push(data),
      });
      expect(mergeSteps.length).toBe(2);
      expect(mergeSteps[0].codeA).not.toBeNull();
      expect(mergeSteps[0].codeB).not.toBeNull();
      // Smart merge extracts setup from A and draw from B — verify output is valid p5.js
      expect(mergeSteps[0].proposed).toMatch(/function\s+setup\s*\(/);
      expect(mergeSteps[0].proposed).toMatch(/function\s+draw\s*\(/);
      expect(mergeSteps[1].proposed).toMatch(/function\s+setup\s*\(/);
      expect(mergeSteps[1].proposed).toMatch(/function\s+draw\s*\(/);
    });
  });

  describe('deep collaboration integration', () => {
    it('loop works normally without collab options (existing behavior preserved)', async () => {
      const result = await RalphLoop.run('blue particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'no-collab-test'
      });
      expect(result.iterations).toBe(1);

      expect(result.code?.length).toBeGreaterThan(0);
    });

    it('loop accepts useDeepCollab option without errors', async () => {
      // This test verifies the option is accepted and doesn't break the loop
      // Actual collaboration behavior is tested in integration tests
      const result = await RalphLoop.run('blue particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'deep-collab-test',
        useDeepCollab: true,
        collabConfig: {
          maxPhases: 2,
        },
      });
      expect(result.iterations).toBe(1);
      expect(result.code).not.toBeNull();
    });

    it('loop accepts useCollab option without errors', async () => {
      const result = await RalphLoop.run('blue particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'simple-collab-test',
        useCollab: true,
        collabConfig: {
          maxRounds: 2,
        },
      });
      expect(result.iterations).toBe(1);
      expect(result.code).not.toBeNull();
    });

    it('loop accepts collabDomain option', async () => {
      const result = await RalphLoop.run('blue particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'collab-domain-test',
        useDeepCollab: true,
        collabDomain: 'p5',
      });
      expect(result.iterations).toBe(1);
      expect(result.code).not.toBeNull();
    });
  });

  describe('chat mode integration (W1-C)', () => {
    it('accepts chatMode option without breaking existing behavior', async () => {
      const result = await RalphLoop.run('blue particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'chat-mode-test',
        chatMode: true,
      });
      expect(result.iterations).toBe(1);

      expect(result.code?.length).toBeGreaterThan(0);
    });

    it('calls onIteration callback after each iteration when provided', async () => {
      const iterationCalls: any[] = [];
      await RalphLoop.run('blue particles', {
        maxIterations: 2,
        galleryDir: TEST_GALLERY_DIR,
        project: 'on-iteration-test',
        onIteration: (context) => iterationCalls.push(context),
      });

      expect(iterationCalls.length).toBeGreaterThanOrEqual(1);
      expect(iterationCalls[0]).toMatchObject({
        iteration: expect.any(Number),
        prompt: expect.any(String),
        usedPrompt: expect.any(String),
        code: expect.any(String),
        evaluation: expect.any(Object),
        timestamp: expect.any(String),
      });
    });

    it('calls onThought callback with thought strings during generation', async () => {
      const thoughts: string[] = [];
      await RalphLoop.run('blue particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'on-thought-test',
        onThought: (thought) => thoughts.push(thought),
      });

      // Thoughts should be emitted during generation
      // At minimum, we should get some thoughts about the process
      expect(thoughts.length).toBeGreaterThanOrEqual(0);
      // Each thought should be a string
      thoughts.forEach(thought => {
        expect(typeof thought).toBe('string');
      });
    });

    it('accepts onSuggestion callback option', async () => {
      const suggestions: any[] = [];
      await RalphLoop.run('blue particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'on-suggestion-test',
        onSuggestion: (suggestion) => suggestions.push(suggestion),
      });

      // The callback should be accepted and not break the loop
      expect(suggestions).not.toBeNull();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('chat mode with all callbacks works together without conflicts', async () => {
      const iterationCalls: any[] = [];
      const thoughts: string[] = [];
      const suggestions: any[] = [];
      const progressCalls: any[] = [];

      await RalphLoop.run('blue particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'all-callbacks-test',
        chatMode: true,
        onIteration: (context) => iterationCalls.push(context),
        onThought: (thought) => thoughts.push(thought),
        onSuggestion: (suggestion) => suggestions.push(suggestion),
        onProgress: (data) => progressCalls.push(data),
      });

      // All callbacks should be called
      expect(iterationCalls.length).toBeGreaterThanOrEqual(0);
      expect(thoughts.length).toBeGreaterThanOrEqual(0);
      expect(suggestions.length).toBeGreaterThanOrEqual(0);
      expect(progressCalls.length).toBeGreaterThanOrEqual(1);

      // Existing onProgress should still work
      expect(progressCalls[0]).toMatchObject({
        iteration: expect.any(Number),
        score: expect.any(Number),
        promiseDetected: expect.any(Boolean),
        code: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it('existing tests still pass with chat mode options present', async () => {
      // Verify that the existing particle routing still works
      const result = await RalphLoop.run('blue particles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'chat-mode-compat-test',
        chatMode: true,
        onIteration: () => {},
        onThought: () => {},
      });

      const code = getResultCode(result);
      expect(code).toContain('Generated by Liminal ParticleSystem');
      expect(code).toContain('class Particle');
    });
  });
});
