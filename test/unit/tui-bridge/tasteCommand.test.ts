/**
 * Tests for TuiBridgeService /taste <pin|reject> <artifactId> command handling.
 *
 * The GUI Showcase/archive view uses /taste to record human taste for any
 * artifact id (these entries are not reviewManager candidates, so the command
 * is intentionally ungated). The handler must:
 *   - record via TasteLearningService (mocked at the service boundary)
 *   - emit a `review.preference_recorded` event with the action/artifactId/saved
 *   - emit a command response stating saved vs unavailable
 *   - validate action ∈ {pin, reject} and artifactId non-empty
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── All mock values must be inside vi.hoisted() ─────────────────────
const {
  mockFsOpen, mockRecordPreference, mockTrainFromProject,
} = vi.hoisted(() => {
  const fsOpen = vi.fn();
  const recordPreference = vi.fn();
  const trainFromProject = vi.fn();
  return {
    mockFsOpen: fsOpen,
    mockRecordPreference: recordPreference,
    mockTrainFromProject: trainFromProject,
  };
});

vi.mock('../../../src/fs/SinterFS.js', () => ({
  SinterFS: { open: mockFsOpen },
}));

vi.mock('../../../src/learning/TasteLearningService.js', () => ({
  TasteLearningService: vi.fn(function(this: any) {
    this.recordPreference = mockRecordPreference;
    this.trainFromProject = mockTrainFromProject;
  }),
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

describe('TuiBridgeService /taste command handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFsOpen.mockReturnValue({ getProjectRoot: () => '/tmp/test-project' });
    mockRecordPreference.mockResolvedValue({ persisted: true, ref: { kind: 'preference' } });
    mockTrainFromProject.mockResolvedValue({
      archiveEntryCount: 0,
      preferenceEventCount: 0,
      pairCount: 0,
      persisted: false,
      reason: 'no archive entries',
    });
  });

  it('records a pin preference for any artifactId and emits the canonical event', async () => {
    const svc = makeService();

    const result = await (svc as any).handleReviewCommand(SID, '/taste pin artifact-123');

    expect(result.reviewRequired).toBe(false);
    expect(mockRecordPreference).toHaveBeenCalledTimes(1);
    expect(mockRecordPreference).toHaveBeenCalledWith({
      action: 'pin',
      artifactId: 'artifact-123',
      sessionId: SID,
    });
    const events = svc.getEvents(SID);
    const prefEvent = events.find((event: any) => event.type === 'review.preference_recorded');
    expect(prefEvent).toBeDefined();
    expect(prefEvent).toMatchObject({
      type: 'review.preference_recorded',
      sessionId: SID,
      action: 'pin',
      artifactId: 'artifact-123',
      saved: true,
    });
    const response = events.find((event: any) => event.type === 'response.committed');
    expect(response).toBeDefined();
    expect(response.content).toContain('Pinned: artifact-123');
    expect(response.content).toContain('Preference saved.');
  });

  it('records a reject preference with the right action and event fields', async () => {
    const svc = makeService();

    const result = await (svc as any).handleReviewCommand(SID, '/taste reject archive-piece-42');

    expect(result.reviewRequired).toBe(false);
    expect(mockRecordPreference).toHaveBeenCalledWith({
      action: 'reject',
      artifactId: 'archive-piece-42',
      sessionId: SID,
    });
    const events = svc.getEvents(SID);
    const prefEvent = events.find((event: any) => event.type === 'review.preference_recorded');
    expect(prefEvent).toMatchObject({
      type: 'review.preference_recorded',
      sessionId: SID,
      action: 'reject',
      artifactId: 'archive-piece-42',
      saved: true,
    });
    const response = events.find((event: any) => event.type === 'response.committed');
    expect(response.content).toContain('Rejected: archive-piece-42');
  });

  it('rejects /taste with a missing action and does not call the preference service', async () => {
    const svc = makeService();

    const result = await (svc as any).handleReviewCommand(SID, '/taste');

    expect(result.reviewRequired).toBe(false);
    expect(mockRecordPreference).not.toHaveBeenCalled();
    const events = svc.getEvents(SID);
    const response = events.find((event: any) => event.type === 'response.committed');
    expect(response).toBeDefined();
    expect(response.content).toBe('Usage: /taste <pin|reject> <artifact-id>');
    const prefEvent = events.find((event: any) => event.type === 'review.preference_recorded');
    expect(prefEvent).toBeUndefined();
  });

  it('rejects /taste with an invalid action', async () => {
    const svc = makeService();

    const result = await (svc as any).handleReviewCommand(SID, '/taste maybe artifact-123');

    expect(result.reviewRequired).toBe(false);
    expect(mockRecordPreference).not.toHaveBeenCalled();
    const events = svc.getEvents(SID);
    const response = events.find((event: any) => event.type === 'response.committed');
    expect(response.content).toBe('Usage: /taste <pin|reject> <artifact-id>');
  });

  it('rejects /taste pin with a missing artifactId', async () => {
    const svc = makeService();

    const result = await (svc as any).handleReviewCommand(SID, '/taste pin');

    expect(result.reviewRequired).toBe(false);
    expect(mockRecordPreference).not.toHaveBeenCalled();
    const events = svc.getEvents(SID);
    const response = events.find((event: any) => event.type === 'response.committed');
    expect(response.content).toBe('Usage: /taste <pin|reject> <artifact-id>');
  });

  it('rejects /taste reject with a missing artifactId', async () => {
    const svc = makeService();

    const result = await (svc as any).handleReviewCommand(SID, '/taste reject');

    expect(result.reviewRequired).toBe(false);
    expect(mockRecordPreference).not.toHaveBeenCalled();
    const events = svc.getEvents(SID);
    const response = events.find((event: any) => event.type === 'response.committed');
    expect(response.content).toBe('Usage: /taste <pin|reject> <artifact-id>');
  });

  it('rejects /taste with a whitespace-only artifactId', async () => {
    const svc = makeService();

    const result = await (svc as any).handleReviewCommand(SID, '/taste pin    ');

    expect(result.reviewRequired).toBe(false);
    expect(mockRecordPreference).not.toHaveBeenCalled();
  });

  it('reports saved:false and unavailable response when preference storage fails', async () => {
    mockRecordPreference.mockRejectedValue(new Error('disk full'));
    const svc = makeService();

    const result = await (svc as any).handleReviewCommand(SID, '/taste pin artifact-123');

    expect(result.reviewRequired).toBe(false);
    const events = svc.getEvents(SID);
    const prefEvent = events.find((event: any) => event.type === 'review.preference_recorded');
    expect(prefEvent).toMatchObject({
      type: 'review.preference_recorded',
      action: 'pin',
      artifactId: 'artifact-123',
      saved: false,
    });
    const response = events.find((event: any) => event.type === 'response.committed');
    expect(response.content).toContain('Pinned: artifact-123');
    expect(response.content).toContain('Preference storage unavailable.');
  });

  it('reports saved:false when the SinterFS project is unavailable', async () => {
    mockFsOpen.mockImplementation(() => { throw new Error('no project'); });
    const svc = new TuiBridgeService();

    const result = await (svc as any).handleReviewCommand(SID, '/taste pin artifact-123');

    expect(result.reviewRequired).toBe(false);
    expect(mockRecordPreference).not.toHaveBeenCalled();
    const events = svc.getEvents(SID);
    const prefEvent = events.find((event: any) => event.type === 'review.preference_recorded');
    expect(prefEvent).toMatchObject({
      type: 'review.preference_recorded',
      action: 'pin',
      artifactId: 'artifact-123',
      saved: false,
    });
    const response = events.find((event: any) => event.type === 'response.committed');
    expect(response.content).toContain('Preference storage unavailable.');
  });
});
