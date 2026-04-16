import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiminalCortex } from '../../../src/cortex/LiminalCortex.js';
import type { CortexSnapshot, CortexConfig } from '../../../src/cortex/types.js';
import type { CortexEvent } from '../../../src/cortex/LiminalCortex.js';
const { mockSnapshot, mockGoals, mockOnEvent } = vi.hoisted(() => ({ mockSnapshot: vi.fn(), mockGoals: vi.fn(), mockOnEvent: vi.fn() }));
function mkS(o: Partial<CortexSnapshot> = {}): CortexSnapshot { return { timestamp: new Date().toISOString(), taskPipeline: { pending: 0, inProgress: 0, completed: 10, failed: 0, skipped: 0, acceptanceRate: 0.9, failureBreakdown: {} }, llmHealth: { avgLatencyMs: 500, successRate: 0.95, recentErrorCount: 0, lastError: null, activeProvider: 't', activeModel: 't' }, scoreTrend: { scores: [0.7, 0.75, 0.8], average: 0.75, count: 3 }, activeProcesses: [], eventsProcessed: 50, ...o }; }
function mkC(o: Partial<CortexConfig> = {}): CortexConfig { return { loopIntervalMs: 100, maxConsecutiveFailures: 3, budgetActionsLimit: 10, budgetTokenLimit: 50000, autonomyLevel: 'assist', ...o }; }
describe('LiminalCortex', () => {
  let pb: { getSnapshot: ReturnType<typeof vi.fn> }; let gs: { getActiveGoals: ReturnType<typeof vi.fn> };
  beforeEach(() => { vi.clearAllMocks(); pb = { getSnapshot: mockSnapshot }; gs = { getActiveGoals: mockGoals }; mockSnapshot.mockReturnValue(mkS()); mockGoals.mockReturnValue([]); });
  function mk(c?: Partial<CortexConfig>) { return new LiminalCortex({ perceptionBus: pb as any, goalStore: gs as any, config: mkC(c), onEvent: mockOnEvent }); }
  it('starts', () => { const c = mk({ loopIntervalMs: 60000 }); c.start(); expect(c.isRunning()).toBe(true); c.stop(); });
  it('stops', () => { const c = mk({ loopIntervalMs: 60000 }); c.start(); c.stop(); expect(c.isRunning()).toBe(false); });
  it('no double-start', () => { const c = mk({ loopIntervalMs: 60000 }); c.start(); c.start(); expect(c.isRunning()).toBe(true); c.stop(); });
  it('tick returns snapshot and proposals', () => { const r = mk().tick(); expect(r.snapshot).toEqual(mkS()); expect(r.proposals).toBeInstanceOf(Array); });
  it('tick reads goals', () => { mockGoals.mockReturnValue([{ id: 'g1', text: 'G', priority: 'normal', category: 'maintenance', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]); expect(mk().tick().goals).toHaveLength(1); });
  it('tick produces proposals from weakness', () => { mockSnapshot.mockReturnValue(mkS({ taskPipeline: { pending: 0, inProgress: 0, completed: 3, failed: 5, skipped: 0, acceptanceRate: 0.3, failureBreakdown: { timeout: 5 } } })); expect(mk().tick().proposals.length).toBeGreaterThanOrEqual(1); });
  it('budget starts at zero', () => { const u = mk().getBudgetUsage(); expect(u.actionsTaken).toBe(0); expect(u.actionsLimit).toBe(10); });
  it('emits loop_tick', async () => { const c = mk({ loopIntervalMs: 50 }); c.start(); await new Promise(r => setTimeout(r, 180)); c.stop(); expect(mockOnEvent.mock.calls.filter((x: any[]) => x[0].type === 'cortex.loop_tick').length).toBeGreaterThanOrEqual(2); });
  it('emits action_proposed', async () => { mockSnapshot.mockReturnValue(mkS({ taskPipeline: { pending: 0, inProgress: 0, completed: 3, failed: 5, skipped: 0, acceptanceRate: 0.3, failureBreakdown: {} } })); const c = mk({ loopIntervalMs: 50 }); c.start(); await new Promise(r => setTimeout(r, 120)); c.stop(); expect(mockOnEvent.mock.calls.filter((x: any[]) => x[0].type === 'cortex.action_proposed').length).toBeGreaterThanOrEqual(1); });
  it('circuit breaker trips', async () => { mockSnapshot.mockImplementation(() => { throw new Error('fail'); }); const c = mk({ loopIntervalMs: 50, maxConsecutiveFailures: 2 }); c.start(); await new Promise(r => setTimeout(r, 500)); expect(c.isRunning()).toBe(false); expect(mockOnEvent.mock.calls.find((x: any[]) => x[0].data?.circuitBreakerTripped === true)).not.toBeUndefined(); });
  it('events have tickNumber and timestamp', async () => { const c = mk({ loopIntervalMs: 50 }); c.start(); await new Promise(r => setTimeout(r, 80)); c.stop(); for (const call of mockOnEvent.mock.calls) { const e = call[0] as CortexEvent; expect(e.tickNumber).toBeGreaterThanOrEqual(1); expect(e.timestamp).toBeTruthy(); } });
});
