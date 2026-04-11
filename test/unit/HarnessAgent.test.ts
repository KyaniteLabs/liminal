import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks (only for external I/O) ─────────────────────────
const { mockLLM } = vi.hoisted(() => ({
  mockLLM: {
    getConfig: vi.fn(() => ({ model: 'test' })),
    generate: vi.fn(),
    generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }),
  },
}));

vi.mock('../../src/llm/LLMClient.js', () => ({
  LLMClient: class { 
    constructor() { return mockLLM; }
    static isConfigured = vi.fn(() => true);
  },
}));

// Import after mocks
import { HarnessAgent, createHarnessAgent } from '../../src/harness/agent/HarnessAgent.js';
import { Status } from '../../src/types/status.js';

describe('HarnessAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Factory ────────────────────────────────────────────────────────
  it('createHarnessAgent factory returns instance', () => {
    const agent = createHarnessAgent(mockLLM as unknown as import('../../src/llm/LLMClient.js').LLMClient);
    expect(agent).toBeInstanceOf(HarnessAgent);
  });

  // ── Session management ─────────────────────────────────────────────
  it('getSession returns undefined before any task', () => {
    const agent = new HarnessAgent(mockLLM as unknown as import('../../src/llm/LLMClient.js').LLMClient);
    expect(agent.getSession('nope')).toBeUndefined();
  });

  it('getAllSessions returns empty array initially', () => {
    const agent = new HarnessAgent(mockLLM as unknown as import('../../src/llm/LLMClient.js').LLMClient);
    expect(agent.getAllSessions()).toHaveLength(0);
  });

  // ── Unapproved task handling ───────────────────────────────────────
  it('executeTask rejects unapproved tasks immediately', async () => {
    const agent = new HarnessAgent(mockLLM as unknown as import('../../src/llm/LLMClient.js').LLMClient);

    await expect(agent.executeTask({
      id: 't-unapproved',
      title: 'Dangerous task',
      description: 'Mutate files',
      approved: false,
    })).rejects.toThrow(/approved/i);
  });

  // ── Self-evaluation API ────────────────────────────────────────────
  it('selfEvaluate returns summary structure', () => {
    const agent = new HarnessAgent(mockLLM as unknown as import('../../src/llm/LLMClient.js').LLMClient);
    const result = agent.selfEvaluate();
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('needsImprovement');
    expect(result).toHaveProperty('recommendations');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('generateImprovementTask returns task structure', () => {
    const agent = new HarnessAgent(mockLLM as unknown as import('../../src/llm/LLMClient.js').LLMClient);
    const task = agent.generateImprovementTask();
    expect(task).toHaveProperty('shouldCreate');
    expect(typeof task.shouldCreate).toBe('boolean');
  });

  it('getErrorHelp returns array of suggestions', () => {
    const agent = new HarnessAgent(mockLLM as unknown as import('../../src/llm/LLMClient.js').LLMClient);
    const help = agent.getErrorHelp('build failed');
    expect(Array.isArray(help)).toBe(true);
  });

  // ── Report generation ──────────────────────────────────────────────
  it('generateReport includes task counts', async () => {
    const agent = new HarnessAgent(mockLLM as unknown as import('../../src/llm/LLMClient.js').LLMClient);
    const report = agent.generateReport();
    expect(report).toContain('Total Tasks:');
    expect(report).toContain('Successful:');
  });
});
