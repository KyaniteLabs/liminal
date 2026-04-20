import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';

describe('TuiBridgeService command handlers', () => {
  let service: TuiBridgeService;
  let sessionId: string;

  beforeEach(() => {
    service = new TuiBridgeService();
    sessionId = service.createSession().sessionId;
  });

  function events() { return service.getEvents(sessionId); }
  function lastCommandContent(): string {
    const cmds = events().filter(e => e.type === 'response.committed');
    return cmds.length > 0 ? (cmds[cmds.length - 1] as any).content ?? '' : '';
  }

  describe('/modes', () => {
    it('lists all product modes', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/modes' });
      const content = lastCommandContent();
      expect(content).toContain('Available modes:');
      expect(content).toContain('ask');
      expect(content).toContain('make');
      expect(content).toContain('remix');
      expect(content).toContain('improve');
    });
  });

  describe('/mode', () => {
    it('switches to a valid mode', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/mode make' });
      const content = lastCommandContent();
      expect(content).toContain('Mode switched to Make');
    });

    it('rejects an unknown mode', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/mode unknown' });
      const content = lastCommandContent();
      expect(content).toContain('Unknown mode');
      expect(content).toContain('Available:');
    });

    it('shows error when no mode argument', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/mode' });
      const content = lastCommandContent();
      expect(content).toContain('Unknown mode');
    });
  });

  describe('/skills', () => {
    it('lists skills (possibly empty)', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/skills' });
      const types = events().map(e => e.type);
      expect(types).toContain('skill.list');
    });
  });

  describe('/skill', () => {
    it('shows usage when no skill name given', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/skill ' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /skill <name>');
    });

    it('shows unknown skill message for missing skill', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/skill nonexistent' });
      const content = lastCommandContent();
      expect(content).toContain('Unknown skill: nonexistent');
    });
  });

  describe('/autonomy', () => {
    it('lists all levels when called without argument', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/autonomy' });
      const content = lastCommandContent();
      expect(content).toContain('Autonomy levels:');
      expect(content).toContain('assist');
      expect(content).toContain('co-create');
      expect(content).toContain('autopilot');
      expect(content).toContain('← current');
    });

    it('switches to co-create level', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/autonomy co-create' });
      const content = lastCommandContent();
      expect(content).toContain('Autonomy set to Co-Create');
      const autonomyEvent = events().find(e => e.type === 'autonomy.changed');
      expect(autonomyEvent).toMatchObject({ type: 'autonomy.changed', level: 'co-create' });
    });

    it('switches to autopilot level', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/autonomy autopilot' });
      const content = lastCommandContent();
      expect(content).toContain('Autonomy set to Autopilot');
    });

    it('rejects unknown level', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/autonomy super' });
      const content = lastCommandContent();
      expect(content).toContain('Unknown autonomy level');
    });
  });

  describe('/sessions', () => {
    it('lists sessions (at least current)', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/sessions' });
      const types = events().map(e => e.type);
      expect(types).toContain('session.list');
    });
  });

  describe('/report', () => {
    it('generates a markdown report', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/report' });
      const types = events().map(e => e.type);
      expect(types).toContain('report.generated');
    });

    it('generates a json report', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/report json' });
      const reportEvent = events().find(e => e.type === 'report.generated');
      expect(reportEvent).toMatchObject({ format: 'json' });
    });
  });

  describe('/workspace', () => {
    it('lists workspaces', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/workspace' });
      const types = events().map(e => e.type);
      expect(types).toContain('workspace.list');
    });

    it('creates and switches to a new workspace', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/workspace create test-ws' });
      const content = lastCommandContent();
      expect(content).toContain('Workspace "test-ws" created and activated');
      const types = events().map(e => e.type);
      expect(types).toContain('workspace.created');
      expect(types).toContain('workspace.switched');
    });

    it('rejects duplicate workspace name', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/workspace create myws' });
      await service.submitInput(sessionId, { mode: 'chat', text: '/workspace create myws' });
      const content = lastCommandContent();
      expect(content).toContain('already exists');
    });

    it('requires name for create', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/workspace create' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /workspace create <name>');
    });

    it('switches to existing workspace', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/workspace create ws1' });
      await service.submitInput(sessionId, { mode: 'chat', text: '/workspace create ws2' });
      await service.submitInput(sessionId, { mode: 'chat', text: '/workspace switch ws1' });
      const content = lastCommandContent();
      expect(content).toContain('Switched to workspace "ws1"');
    });

    it('rejects switch to nonexistent workspace', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/workspace switch ghost' });
      const content = lastCommandContent();
      expect(content).toContain('not found');
    });

    it('requires name for switch', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/workspace switch' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /workspace switch <name>');
    });
  });

  describe('/candidates', () => {
    it('shows empty candidates message', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/candidates' });
      const content = lastCommandContent();
      expect(content).toContain('No review candidates');
    });
  });

  describe('/accept, /reject, /pin, /diff', () => {
    it('/accept requires an id', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/accept' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /accept <candidate-id>');
    });

    it('/reject requires an id', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/reject' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /reject <candidate-id>');
    });

    it('/pin requires an id', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/pin' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /pin <candidate-id>');
    });

    it('/diff requires two ids', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/diff' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /diff');
    });
  });

  describe('/cortex', () => {
    it('shows cortex dashboard', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/cortex' });
      const types = events().map(e => e.type);
      expect(types).toContain('cortex.dashboard');
    });

    it('stops cortex loop', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/cortex stop' });
      const content = lastCommandContent();
      expect(content).toContain('Cortex loop stopped');
    });

    it('handles double stop gracefully', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/cortex stop' });
      await service.submitInput(sessionId, { mode: 'chat', text: '/cortex stop' });
      const content = lastCommandContent();
      expect(content).toContain('not running');
    });

    it('starts cortex loop', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/cortex stop' });
      await service.submitInput(sessionId, { mode: 'chat', text: '/cortex start' });
      const content = lastCommandContent();
      expect(content).toContain('Cortex loop started');
    });

    it('handles double start gracefully', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/cortex start' });
      const content = lastCommandContent();
      expect(content).toContain('already running');
    });
  });

  describe('/goal', () => {
    it('shows usage when no subcommand matches', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/goal' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /goal');
    });

    it('/goal add requires text', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/goal add' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /goal add <text>');
    });

    it('/goal remove requires id', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/goal remove' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /goal remove <id>');
    });

    it('/goal done requires id', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/goal done' });
      const content = lastCommandContent();
      expect(content).toContain('Usage: /goal done <id>');
    });
  });

  describe('/setup', () => {
    it('runs setup wizard and emits events', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/setup' });
      const types = events().map(e => e.type);
      expect(types).toContain('onboarding.complete');
    });
  });

  describe('/diagnostics', () => {
    it('runs diagnostics and emits results', async () => {
      await service.submitInput(sessionId, { mode: 'chat', text: '/diagnostics' });
      const types = events().map(e => e.type);
      expect(types).toContain('diagnostics.result');
    });
  });
});
