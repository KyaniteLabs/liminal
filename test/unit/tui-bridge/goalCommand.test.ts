/**
 * Tests for TuiBridgeService /goal command handling.
 *
 * Exercises handleGoalCommand via the private method accessor
 * with GoalStore mocked at the module level.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── All mock values must be inside vi.hoisted() ─────────────────────
const {
  mockAddGoal, mockListGoals, mockRemoveGoal, mockCompleteGoal,
  mockFsOpen, mockGoalStore,
} = vi.hoisted(() => {
  const addGoal = vi.fn();
  const listGoals = vi.fn();
  const removeGoal = vi.fn();
  const completeGoal = vi.fn();
  const fsOpen = vi.fn();
  const goalStore = vi.fn(function() {
    return { addGoal, getActiveGoals: listGoals, removeGoal, completeGoal };
  });
  return {
    mockAddGoal: addGoal,
    mockListGoals: listGoals,
    mockRemoveGoal: removeGoal,
    mockCompleteGoal: completeGoal,
    mockFsOpen: fsOpen,
    mockGoalStore: goalStore,
  };
});

vi.mock('../../../src/fs/LiminalFS.js', () => ({
  LiminalFS: { open: mockFsOpen },
}));

vi.mock('../../../src/cortex/GoalStore.js', () => ({
  GoalStore: mockGoalStore,
}));

vi.mock('../../../src/cortex/CortexPerceptionBus.js', () => ({
  CortexPerceptionBus: vi.fn(function(this: any) {
    this.start = vi.fn();
    this.stop = vi.fn();
    this.getSnapshot = vi.fn(() => ({}));
  }),
}));

vi.mock('../../../src/core/EventBus.js', () => ({
  eventBus: { onEvent: vi.fn() },
  EventTypes: { SWARM_ROUND: 'SWARM_ROUND' },
}));

vi.mock('../../../src/chat/ConversationManager.js', () => ({
  ConversationManager: vi.fn(function(this: any) { this.startNewSession = vi.fn(); }),
}));

vi.mock('../../../src/agent/IntentRouter.js', () => ({
  IntentRouter: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/ProductMode.js', () => ({
  ModeAwareRouter: vi.fn(function() {}),
  PRODUCT_MODES: [],
}));

vi.mock('../../../src/agent/ModeRegistry.js', () => ({
  ModeRegistry: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/SkillRunner.js', () => ({
  SkillRunner: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/SkillCatalog.js', () => ({
  SkillCatalog: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/ReviewManager.js', () => ({
  ReviewManager: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/DiffRenderer.js', () => ({
  DiffRenderer: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/OnboardingWizard.js', () => ({
  OnboardingWizard: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/EnvironmentValidator.js', () => ({
  EnvironmentValidator: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/SessionResumer.js', () => ({
  SessionResumer: vi.fn(function(this: any) { this.register = vi.fn(); }),
}));

vi.mock('../../../src/agent/ReportGenerator.js', () => ({
  ReportGenerator: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/WorkspaceManager.js', () => ({
  WorkspaceManager: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/AutonomyController.js', () => ({
  AutonomyController: vi.fn(function() {}),
}));

vi.mock('../../../src/agent/SessionGraph.js', () => ({
  SessionGraph: vi.fn(function() {}),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/harness/agent/index.js', () => ({
  createLLMModeAgent: vi.fn(),
}));

import { TuiBridgeService } from '../../../src/tui-bridge/TuiBridgeService.js';

const SID = 'test-session';

function makeService(): TuiBridgeService {
  mockFsOpen.mockReturnValue({ getProjectRoot: () => '/tmp/test-project' });
  return new TuiBridgeService();
}

const FAKE_GOAL = {
  id: 'goal-123-abc',
  text: 'Fix tests',
  priority: 'normal',
  category: 'maintenance',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('TuiBridgeService /goal command handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFsOpen.mockReturnValue({ getProjectRoot: () => '/tmp/test-project' });
  });

  // ── /goal add ──────────────────────────────────────────────────

  it('adds a goal with plain text', () => {
    const svc = makeService();
    mockAddGoal.mockReturnValue(FAKE_GOAL);

    const result = (svc as any).handleGoalCommand(SID, '/goal add Fix tests');
    expect(result.reviewRequired).toBe(false);
    expect(mockAddGoal).toHaveBeenCalledWith({ text: 'Fix tests', priority: 'normal', category: 'maintenance' });
  });

  it('adds a goal with priority and category tags', () => {
    const svc = makeService();
    mockAddGoal.mockReturnValue({ ...FAKE_GOAL, priority: 'high', category: 'coverage' });

    const result = (svc as any).handleGoalCommand(SID, '/goal add [priority:high] [category:coverage] 80% coverage');
    expect(result.reviewRequired).toBe(false);
    expect(mockAddGoal).toHaveBeenCalledWith({ text: '80% coverage', priority: 'high', category: 'coverage' });
  });

  it('rejects /goal add with no text', () => {
    const svc = makeService();
    const result = (svc as any).handleGoalCommand(SID, '/goal add');
    expect(result.reviewRequired).toBe(false);
    expect(mockAddGoal).not.toHaveBeenCalled();
  });

  it('rejects /goal add with only tags and no text after stripping', () => {
    const svc = makeService();
    const result = (svc as any).handleGoalCommand(SID, '/goal add [priority:critical] [category:reliability]');
    expect(result.reviewRequired).toBe(false);
    expect(mockAddGoal).not.toHaveBeenCalled();
  });

  // ── /goal list ─────────────────────────────────────────────────

  it('lists active goals', () => {
    const svc = makeService();
    mockListGoals.mockReturnValue([FAKE_GOAL]);

    const result = (svc as any).handleGoalCommand(SID, '/goal list');
    expect(result.reviewRequired).toBe(false);
    expect(mockListGoals).toHaveBeenCalled();
  });

  it('shows empty message when no active goals', () => {
    const svc = makeService();
    mockListGoals.mockReturnValue([]);

    const result = (svc as any).handleGoalCommand(SID, '/goal list');
    expect(result.reviewRequired).toBe(false);
    expect(mockListGoals).toHaveBeenCalled();
  });

  // ── /goal remove ───────────────────────────────────────────────

  it('removes an existing goal', () => {
    const svc = makeService();
    mockRemoveGoal.mockReturnValue(true);

    const result = (svc as any).handleGoalCommand(SID, '/goal remove goal-123');
    expect(result.reviewRequired).toBe(false);
    expect(mockRemoveGoal).toHaveBeenCalledWith('goal-123');
  });

  it('reports when goal not found for remove', () => {
    const svc = makeService();
    mockRemoveGoal.mockReturnValue(false);

    const result = (svc as any).handleGoalCommand(SID, '/goal remove nonexistent');
    expect(result.reviewRequired).toBe(false);
  });

  it('rejects /goal remove with no id', () => {
    const svc = makeService();
    const result = (svc as any).handleGoalCommand(SID, '/goal remove');
    expect(result.reviewRequired).toBe(false);
    expect(mockRemoveGoal).not.toHaveBeenCalled();
  });

  // ── /goal done ─────────────────────────────────────────────────

  it('completes an existing goal', () => {
    const svc = makeService();
    mockCompleteGoal.mockReturnValue({ ...FAKE_GOAL, status: 'completed' });

    const result = (svc as any).handleGoalCommand(SID, '/goal done goal-123');
    expect(result.reviewRequired).toBe(false);
    expect(mockCompleteGoal).toHaveBeenCalledWith('goal-123');
  });

  it('reports when goal not found for done', () => {
    const svc = makeService();
    mockCompleteGoal.mockReturnValue(null);

    const result = (svc as any).handleGoalCommand(SID, '/goal done nonexistent');
    expect(result.reviewRequired).toBe(false);
  });

  it('rejects /goal done with no id', () => {
    const svc = makeService();
    const result = (svc as any).handleGoalCommand(SID, '/goal done');
    expect(result.reviewRequired).toBe(false);
    expect(mockCompleteGoal).not.toHaveBeenCalled();
  });

  // ── default / usage ────────────────────────────────────────────

  it('shows usage for unknown subcommand', () => {
    const svc = makeService();
    const result = (svc as any).handleGoalCommand(SID, '/goal foo');
    expect(result.reviewRequired).toBe(false);
  });

  it('shows usage for bare /goal', () => {
    const svc = makeService();
    const result = (svc as any).handleGoalCommand(SID, '/goal');
    expect(result.reviewRequired).toBe(false);
  });

  // ── goal store unavailable ─────────────────────────────────────

  it('reports unavailable for /goal add when LiminalFS.open fails', () => {
    mockFsOpen.mockImplementation(() => { throw new Error('no project'); });
    const svc = new TuiBridgeService();

    const result = (svc as any).handleGoalCommand(SID, '/goal add Test');
    expect(result.reviewRequired).toBe(false);
    expect(mockAddGoal).not.toHaveBeenCalled();
  });

  it('reports unavailable for /goal list when LiminalFS.open fails', () => {
    mockFsOpen.mockImplementation(() => { throw new Error('no project'); });
    const svc = new TuiBridgeService();

    const result = (svc as any).handleGoalCommand(SID, '/goal list');
    expect(result.reviewRequired).toBe(false);
    expect(mockListGoals).not.toHaveBeenCalled();
  });
});
