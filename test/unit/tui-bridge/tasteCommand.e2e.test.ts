import { dispatchCommand } from '../../../src/tui-bridge/CommandDispatcher.js';
/**
 * End-to-end proof: the GUI /taste command path actually persists preference
 * events through the real bridge handler + real TasteLearningService +
 * real SinterFS, and trainFromProject() reports preferenceEventCount >= 1.
 *
 * No LLM cost: the bridge /taste handler is synchronous over the preference
 * service (no LLM calls). This test exercises the same code path the GUI
 * Showcase/archive buttons drive (the button sends `/taste <action> <id>`
 * over the bridge input endpoint, which routes to handleReviewCommand).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock only the bridge's agent/lifecycle collaborators (mirroring the unit
// test's surface). We do NOT mock TasteLearningService or SinterFS — those
// are the real services that need to round-trip the preference event.
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
import { SinterFS } from '../../../src/fs/SinterFS.js';
import { resolveSinterProjectRoot } from '../../../src/fs/projectRoot.js';
import { TasteLearningService } from '../../../src/learning/TasteLearningService.js';

const SID = 'e2e-session';

describe('TuiBridgeService /taste end-to-end preference-event proof', () => {
  let tmpRoot: string;
  let savedRoot: string | undefined;
  let sinterFs: SinterFS;

  beforeEach(() => {
    savedRoot = process.env.SINTER_PROJECT_ROOT;
    tmpRoot = mkdtempSync(join(tmpdir(), 'taste-e2e-'));
    process.env.SINTER_PROJECT_ROOT = tmpRoot;
    sinterFs = SinterFS.open(resolveSinterProjectRoot());
  });

  afterEach(() => {
    sinterFs.close();
    if (savedRoot !== undefined) process.env.SINTER_PROJECT_ROOT = savedRoot;
    else delete process.env.SINTER_PROJECT_ROOT;
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('round-trips a /taste pin through the bridge handler, persists a preference event, and trainFromProject() reports it', async () => {
    const svc = new TuiBridgeService();

    const result = await dispatchCommand((svc as any).commandCtx, SID, '/taste pin archive-piece-99');

    // The command succeeded end-to-end.
    expect(result.reviewRequired).toBe(false);

    // The bridge emitted the canonical preference event with saved=true.
    const events = svc.getEvents(SID);
    const prefEvent = events.find((event: any) => event.type === 'review.preference_recorded');
    expect(prefEvent).toMatchObject({
      type: 'review.preference_recorded',
      sessionId: SID,
      action: 'pin',
      artifactId: 'archive-piece-99',
      saved: true,
    });

    // A preference event artifact exists on disk in the project-local dir.
    const prefDir = join(tmpRoot, '.sinter', 'preferences');
    expect(existsSync(prefDir)).toBe(true);
    expect(sinterFs.listRefs('preference').some((ref) => ref.includes('archive-piece-99/pin'))).toBe(true);

    // Round-trip with a real TasteLearningService against the same SinterFS:
    // trainFromProject() observes the preference event we just recorded.
    const service = new TasteLearningService(sinterFs);
    const summary = await service.trainFromProject();
    expect(summary.preferenceEventCount).toBeGreaterThanOrEqual(1);
  });

  it('round-trips a /taste reject and emits a saved=true preference event', async () => {
    const svc = new TuiBridgeService();

    const result = await dispatchCommand((svc as any).commandCtx, SID, '/taste reject archive-piece-7');

    expect(result.reviewRequired).toBe(false);

    const events = svc.getEvents(SID);
    const prefEvent = events.find((event: any) => event.type === 'review.preference_recorded');
    expect(prefEvent).toMatchObject({
      type: 'review.preference_recorded',
      sessionId: SID,
      action: 'reject',
      artifactId: 'archive-piece-7',
      saved: true,
    });

    expect(sinterFs.listRefs('preference').some((ref) => ref.includes('archive-piece-7/reject'))).toBe(true);

    const service = new TasteLearningService(sinterFs);
    const summary = await service.trainFromProject();
    expect(summary.preferenceEventCount).toBeGreaterThanOrEqual(1);
  });
});
