import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../../../src/agent/ReportGenerator.js';
import { SessionGraph } from '../../../src/agent/SessionGraph.js';

describe('ReportGenerator', () => {
  it('generates a markdown report with empty graph', () => {
    const graph = new SessionGraph('test-session-1');
    const gen = new ReportGenerator();
    const report = gen.generate(graph, 'markdown');

    expect(report.format).toBe('markdown');
    expect(report.manifest.sessionId).toBe('test-session-1');
    expect(report.manifest.turnCount).toBe(0);
    expect(report.totalDurationMs).toBe(0);
    expect(report.avgDurationMs).toBe(0);
    expect(report.delegationBreakdown).toEqual({});
    expect(report.topIntents).toEqual([]);
    expect(report.artifactRefs).toEqual([]);
    expect(report.taskRefs).toEqual([]);
    expect(report.content).toContain('test-session-1');
    expect(report.content).toContain('Session Report');
  });

  it('generates a JSON report', () => {
    const graph = new SessionGraph('json-session');
    const gen = new ReportGenerator();
    const report = gen.generate(graph, 'json');

    expect(report.format).toBe('json');
    expect(report.content).toBeTruthy();
    const parsed = JSON.parse(report.content);
    expect(parsed.manifest.sessionId).toBe('json-session');
  });

  it('computes delegation breakdown from turns', () => {
    const graph = new SessionGraph('breakdown-session');
    graph.recordTurn({
      turnId: 't1',
      input: 'make art',
      intent: 'creative',
      delegatedTo: 'ralph-loop',
      response: 'code',
      durationMs: 100,
    });
    graph.recordTurn({
      turnId: 't2',
      input: 'fix bug',
      intent: 'engineering',
      delegatedTo: 'conveyor',
      response: 'done',
      durationMs: 200,
    });
    graph.recordTurn({
      turnId: 't3',
      input: 'more art',
      intent: 'creative',
      delegatedTo: 'ralph-loop',
      response: 'code2',
      durationMs: 150,
    });

    const gen = new ReportGenerator();
    const report = gen.generate(graph);

    expect(report.delegationBreakdown).toEqual({
      'ralph-loop': 2,
      'conveyor': 1,
    });
  });

  it('computes top intents sorted by count', () => {
    const graph = new SessionGraph('intent-session');
    graph.recordTurn({ turnId: 't1', input: '', intent: 'creative', delegatedTo: 'ralph-loop', response: '', durationMs: 50 });
    graph.recordTurn({ turnId: 't2', input: '', intent: 'creative', delegatedTo: 'ralph-loop', response: '', durationMs: 50 });
    graph.recordTurn({ turnId: 't3', input: '', intent: 'engineering', delegatedTo: 'conveyor', response: '', durationMs: 50 });

    const gen = new ReportGenerator();
    const report = gen.generate(graph);

    expect(report.topIntents).toHaveLength(2);
    expect(report.topIntents[0]).toEqual({ intent: 'creative', count: 2 });
    expect(report.topIntents[1]).toEqual({ intent: 'engineering', count: 1 });
  });

  it('computes timing correctly', () => {
    const graph = new SessionGraph('timing-session');
    graph.recordTurn({ turnId: 't1', input: '', intent: 'creative', delegatedTo: 'x', response: '', durationMs: 100 });
    graph.recordTurn({ turnId: 't2', input: '', intent: 'creative', delegatedTo: 'x', response: '', durationMs: 200 });

    const gen = new ReportGenerator();
    const report = gen.generate(graph);

    expect(report.totalDurationMs).toBe(300);
    expect(report.avgDurationMs).toBe(150);
  });

  it('includes artifacts and task refs', () => {
    const graph = new SessionGraph('refs-session');
    graph.recordTurn({
      turnId: 't1',
      input: '',
      intent: 'creative',
      delegatedTo: 'x',
      response: '',
      durationMs: 50,
      artifactRefs: ['output/sketch.html'],
      taskRefs: ['TASK-001'],
    });

    const gen = new ReportGenerator();
    const report = gen.generate(graph);

    expect(report.artifactRefs).toContain('output/sketch.html');
    expect(report.taskRefs).toContain('TASK-001');
  });
});
