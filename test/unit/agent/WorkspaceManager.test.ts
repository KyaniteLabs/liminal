import { describe, it, expect } from 'vitest';
import { WorkspaceManager } from '../../../src/agent/WorkspaceManager.js';

describe('WorkspaceManager', () => {
  it('creates a workspace', () => {
    const mgr = new WorkspaceManager();
    const config = mgr.create('test-project');

    expect(config!.name).toBe('test-project');
    expect(config!.createdAt).toBeTruthy();
    expect(config!.skillPreferences).toEqual([]);
    expect(config!.favorites).toEqual([]);
    expect(config!.sessionIds).toEqual([]);
  });

  it('rejects duplicate workspace names', () => {
    const mgr = new WorkspaceManager();
    mgr.create('dup');
    const result = mgr.create('dup');
    expect(result).toBeUndefined();
  });

  it('gets a workspace by name', () => {
    const mgr = new WorkspaceManager();
    mgr.create('get-test');
    const config = mgr.get('get-test');

    expect(config!.name).toBe('get-test');
  });

  it('returns undefined for nonexistent workspace', () => {
    const mgr = new WorkspaceManager();
    expect(mgr.get('nope')).toBeUndefined();
  });

  it('switches to a workspace', () => {
    const mgr = new WorkspaceManager();
    mgr.create('ws1');
    mgr.create('ws2');
    const config = mgr.switchTo('ws2');

    expect(config!.name).toBe('ws2');
    expect(mgr.activeName).toBe('ws2');
  });

  it('returns undefined switching to nonexistent workspace', () => {
    const mgr = new WorkspaceManager();
    expect(mgr.switchTo('ghost')).toBeUndefined();
    expect(mgr.activeName).toBeNull();
  });

  it('gets active workspace', () => {
    const mgr = new WorkspaceManager();
    mgr.create('active-ws');
    mgr.switchTo('active-ws');
    const active = mgr.getActive();

    expect(active!.name).toBe('active-ws');
  });

  it('lists workspace names', () => {
    const mgr = new WorkspaceManager();
    mgr.create('alpha');
    mgr.create('beta');
    mgr.create('gamma');

    const names = mgr.list();
    expect(names).toHaveLength(3);
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
    expect(names).toContain('gamma');
  });

  it('lists workspace configs sorted by updatedAt', () => {
    const mgr = new WorkspaceManager();
    mgr.create('first');
    mgr.create('second');

    // Update first workspace to make it more recent
    mgr.setMode('first', 'make' as any);

    const configs = mgr.listConfigs();
    expect(configs).toHaveLength(2);
    // 'first' was updated more recently, should be first
    expect(configs[0].name).toBe('first');
  });

  it('sets mode for a workspace', () => {
    const mgr = new WorkspaceManager();
    mgr.create('mode-ws');
    const result = mgr.setMode('mode-ws', 'make' as any);

    expect(result).toBe(true);
    expect(mgr.get('mode-ws')!.mode).toBe('make');
  });

  it('returns false setting mode for nonexistent workspace', () => {
    const mgr = new WorkspaceManager();
    expect(mgr.setMode('ghost', 'ask' as any)).toBe(false);
  });

  it('adds session to workspace', () => {
    const mgr = new WorkspaceManager();
    mgr.create('sess-ws');
    mgr.addSession('sess-ws', 'session-123');

    const config = mgr.get('sess-ws');
    expect(config!.sessionIds).toContain('session-123');
  });

  it('does not add duplicate session', () => {
    const mgr = new WorkspaceManager();
    mgr.create('dedup-ws');
    mgr.addSession('dedup-ws', 's-1');
    mgr.addSession('dedup-ws', 's-1');

    const config = mgr.get('dedup-ws');
    expect(config!.sessionIds).toHaveLength(1);
  });

  it('adds favorite to workspace', () => {
    const mgr = new WorkspaceManager();
    mgr.create('fav-ws');
    mgr.addFavorite('fav-ws', 'output/art.html');

    const config = mgr.get('fav-ws');
    expect(config!.favorites).toContain('output/art.html');
  });

  it('reports correct count', () => {
    const mgr = new WorkspaceManager();
    expect(mgr.count).toBe(0);
    mgr.create('a');
    mgr.create('b');
    expect(mgr.count).toBe(2);
  });
});
