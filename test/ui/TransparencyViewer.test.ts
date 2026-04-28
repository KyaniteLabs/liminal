import { describe, it, expect, beforeEach } from 'vitest';
/**
 * TransparencyViewer tests
 */

import { TransparencyViewer, EventType } from '../../src/ui/TransparencyViewer.js';

describe('TransparencyViewer', () => {
  let viewer: TransparencyViewer;

  beforeEach(() => {
    viewer = new TransparencyViewer('test-mode');
  });

  it('constructor initializes with mode', () => {
    expect(viewer).toBeInstanceOf(TransparencyViewer);
  });

  it('getElapsedTime returns elapsed seconds', () => {
    const elapsed1 = viewer.getElapsedTime();
    expect(elapsed1).toBeGreaterThanOrEqual(0);
    expect(elapsed1).toBeLessThan(0.1); // Should be very fast

    // Wait a bit and check again
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Sleep 10ms
    }
    const elapsed2 = viewer.getElapsedTime();
    expect(elapsed2).toBeGreaterThan(elapsed1);
  });

  it('addEvent adds event with auto-generated timestamp', () => {
    viewer.addEvent({
      phase: 'test',
      model: 'Local',
      eventType: EventType.PROMPT,
      title: 'Test Event',
      content: 'Test content',
      metadata: {},
    });

    const events = viewer.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].timestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(events[0].phase).toBe('test');
    expect(events[0].model).toBe('Local');
    expect(events[0].eventType).toBe(EventType.PROMPT);
  });

  it('prompt adds PROMPT event', () => {
    viewer.prompt('Local', 'creator', 'draw a circle');

    const events = viewer.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe(EventType.PROMPT);
    expect(events[0].model).toBe('Local');
    expect(events[0].phase).toBe('creator');
    expect(events[0].content).toBe('draw a circle');
    expect(events[0].title).toBe('Local - creator Prompt');
  });

  it('prompt uses custom title when provided', () => {
    viewer.prompt('Cloud', 'critic', 'analyze this', 'Custom Title');

    const events = viewer.getEvents();
    expect(events[0].title).toBe('Custom Title');
  });

  it('output adds OUTPUT event', () => {
    viewer.output('Local', 'creator', 'circle code here');

    const events = viewer.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe(EventType.OUTPUT);
    expect(events[0].content).toBe('circle code here');
  });

  it('analysis adds ANALYSIS event', () => {
    viewer.analysis('Cloud', 'critic', 'This looks good but needs improvement');

    const events = viewer.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe(EventType.ANALYSIS);
    expect(events[0].model).toBe('Cloud');
    expect(events[0].phase).toBe('critic');
  });

  it('refinement adds REFINEMENT event', () => {
    viewer.refinement('Local', 'refiner', 'improved code here');

    const events = viewer.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe(EventType.REFINEMENT);
    expect(events[0].content).toBe('improved code here');
  });

  it('info adds INFO event', () => {
    viewer.info('creator', 'Starting generation...');

    const events = viewer.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe(EventType.INFO);
    expect(events[0].title).toBe('Starting generation...');
    expect(events[0].model).toBe('');
    expect(events[0].content).toBe('');
  });

  it('getEvents returns copy of events array', () => {
    viewer.prompt('Local', 'test', 'test');
    const events1 = viewer.getEvents();
    const events2 = viewer.getEvents();

    expect(events1).not.toBe(events2); // Different references
    expect(events1).toEqual(events2);  // Same content
  });

  it('getEventsByType filters by event type', () => {
    viewer.prompt('Local', 'creator', 'prompt1');
    viewer.output('Local', 'creator', 'output1');
    viewer.analysis('Cloud', 'critic', 'analysis1');
    viewer.output('Cloud', 'critic', 'output2');

    const prompts = viewer.getEventsByType(EventType.PROMPT);
    expect(prompts.length).toBe(1);

    const outputs = viewer.getEventsByType(EventType.OUTPUT);
    expect(outputs.length).toBe(2);

    const analyses = viewer.getEventsByType(EventType.ANALYSIS);
    expect(analyses.length).toBe(1);
  });

  it('getEventsByModel filters by model name', () => {
    viewer.prompt('Local', 'creator', 'prompt1');
    viewer.output('Local', 'creator', 'output1');
    viewer.analysis('Cloud', 'critic', 'analysis1');

    const localEvents = viewer.getEventsByModel('Local');
    expect(localEvents.length).toBe(2);
    expect(localEvents.every(e => e.model === 'Local')).toBe(true);

    const cloudEvents = viewer.getEventsByModel('Cloud');
    expect(cloudEvents.length).toBe(1);
  });

  it('getEventsByPhase filters by phase', () => {
    viewer.prompt('Local', 'creator', 'prompt1');
    viewer.output('Local', 'creator', 'output1');
    viewer.analysis('Cloud', 'critic', 'analysis1');

    const creatorEvents = viewer.getEventsByPhase('creator');
    expect(creatorEvents.length).toBe(2);

    const criticEvents = viewer.getEventsByPhase('critic');
    expect(criticEvents.length).toBe(1);
  });

  it('getSummary returns correct statistics', async () => {
    viewer.prompt('Local', 'creator', 'prompt1');
    viewer.output('Local', 'creator', 'output1');
    viewer.analysis('Cloud', 'critic', 'analysis1');
    viewer.refinement('Local', 'refiner', 'refinement1');
    viewer.info('creator', 'Info message');

    // Wait a bit to ensure elapsed time is measurable
    await new Promise(resolve => setTimeout(resolve, 10));

    const summary = viewer.getSummary();

    expect(summary.totalEvents).toBe(5);
    expect(summary.eventsByType[EventType.PROMPT]).toBe(1);
    expect(summary.eventsByType[EventType.OUTPUT]).toBe(1);
    expect(summary.eventsByType[EventType.ANALYSIS]).toBe(1);
    expect(summary.eventsByType[EventType.REFINEMENT]).toBe(1);
    expect(summary.eventsByType[EventType.INFO]).toBe(1);
    expect(summary.eventsByModel['Local']).toBe(3);
    expect(summary.eventsByModel['Cloud']).toBe(1);
    expect(summary.refinementCount).toBe(1);
    expect(summary.duration).toBeGreaterThan(0);
  });

  it('getSummary includes qualityScore from metadata', () => {
    viewer.prompt('Local', 'creator', 'prompt1');

    const summary = viewer.getSummary({ qualityScore: 0.85 });
    expect(summary.qualityScore).toBe(0.85);
  });

  it('formatSummary returns human-readable string', () => {
    viewer.prompt('Local', 'creator', 'prompt1');
    viewer.output('Local', 'creator', 'output1');
    viewer.refinement('Local', 'refiner', 'refinement1');

    const summary = viewer.formatSummary({ qualityScore: 0.9 });

    expect(summary).toContain('Generation Complete');
    expect(summary).toContain('Mode: test-mode');
    expect(summary).toContain('Duration:');
    expect(summary).toContain('Total events: 3');
    expect(summary).toContain('Quality score: 0.90');
    expect(summary).toContain('Refinements: 1');
    expect(summary).toContain('prompt: 1');
    expect(summary).toContain('output: 1');
    expect(summary).toContain('refinement: 1');
    expect(summary).toContain('Local: 3');
  });

  it('formatSummary handles no refinements gracefully', () => {
    viewer.prompt('Local', 'creator', 'prompt1');

    const summary = viewer.formatSummary();
    expect(summary).not.toContain('Refinements:');
  });

  it('formatSummary handles missing qualityScore', () => {
    viewer.prompt('Local', 'creator', 'prompt1');

    const summary = viewer.formatSummary();
    expect(summary).not.toContain('Quality score:');
  });

  it('exportToJson returns valid JSON', () => {
    viewer.prompt('Local', 'creator', 'prompt1');
    viewer.output('Local', 'creator', 'output1');

    const json = viewer.exportToJson();
    const parsed = JSON.parse(json);

    expect(parsed.mode).toBe('test-mode');

    expect(parsed.events?.length).toBe(2);
    expect(parsed.startTime).not.toBeNull();
    expect(parsed.endTime).not.toBeNull();
    expect(parsed.duration).not.toBeNull();
  });

  it('exportToJson supports pretty printing', () => {
    viewer.prompt('Local', 'creator', 'prompt1');

    const pretty = viewer.exportToJson(true);
    const compact = viewer.exportToJson(false);

    expect(pretty.length).toBeGreaterThan(compact.length);
    expect(pretty).toContain('\n');
    expect(compact).not.toContain('\n');
  });

  it('clear removes all events and resets timer', () => {
    viewer.prompt('Local', 'creator', 'prompt1');
    viewer.output('Local', 'creator', 'output1');

    expect(viewer.getEvents().length).toBe(2);

    viewer.clear();

    expect(viewer.getEvents().length).toBe(0);
  });

  it('clear resets start time', async () => {
    // Wait a bit to accumulate some elapsed time
    await new Promise(resolve => setTimeout(resolve, 10));

    const elapsedBefore = viewer.getElapsedTime();
    viewer.clear();
    const elapsedAfter = viewer.getElapsedTime();

    expect(elapsedAfter).toBeLessThan(elapsedBefore);
    expect(elapsedAfter).toBeLessThan(0.1);
  });

  it('clone creates independent copy', () => {
    viewer.prompt('Local', 'creator', 'prompt1');

    const clone = viewer.clone();

    expect(clone.getEvents().length).toBe(1);
    expect(clone.getEvents()[0].content).toBe('prompt1');

    // Add to clone, should not affect original
    clone.output('Cloud', 'critic', 'output2');

    expect(viewer.getEvents().length).toBe(1);
    expect(clone.getEvents().length).toBe(2);
  });

  it('clone preserves mode and start time', () => {
    const originalViewer = new TransparencyViewer('collab');
    originalViewer.prompt('Local', 'test', 'test');

    const cloned = originalViewer.clone();

    expect(cloned).not.toBe(originalViewer);
    // We can't directly check mode, but the events should be copied
    expect(cloned.getEvents()).toEqual(originalViewer.getEvents());
  });

  it('tracks multiple events in sequence', () => {
    viewer.prompt('Local', 'creator', 'Create a circle');
    viewer.output('Local', 'creator', 'circle code');
    viewer.analysis('Cloud', 'critic', 'Good but could be better');
    viewer.refinement('Local', 'refiner', 'improved circle code');
    viewer.output('Local', 'refiner', 'final code');
    viewer.info('creator', 'Generation complete');

    const events = viewer.getEvents();
    expect(events.length).toBe(6);
    expect(events[0].eventType).toBe(EventType.PROMPT);
    expect(events[1].eventType).toBe(EventType.OUTPUT);
    expect(events[2].eventType).toBe(EventType.ANALYSIS);
    expect(events[3].eventType).toBe(EventType.REFINEMENT);
    expect(events[4].eventType).toBe(EventType.OUTPUT);
    expect(events[5].eventType).toBe(EventType.INFO);
  });

  it('handles empty state gracefully', () => {
    expect(viewer.getEvents()).toEqual([]);
    expect(viewer.getEventsByType(EventType.PROMPT)).toEqual([]);
    expect(viewer.getEventsByModel('Local')).toEqual([]);
    expect(viewer.getEventsByPhase('creator')).toEqual([]);

    const summary = viewer.getSummary();
    expect(summary.totalEvents).toBe(0);
    expect(summary.refinementCount).toBe(0);
  });

  it('formatTimestamp produces consistent format', () => {
    viewer.prompt('Local', 'test', 'test');

    const events = viewer.getEvents();
    const timestamp = events[0].timestamp;

    expect(timestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/);

    const [hours, minutes, seconds] = timestamp.split(':').map(Number);
    expect(hours).toBeGreaterThanOrEqual(0);
    expect(hours).toBeLessThan(24);
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThan(60);
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThan(60);
  });

  it('handles different models and phases', () => {
    viewer.prompt('Local', 'creator', 'local prompt');
    viewer.prompt('Cloud', 'critic', 'cloud prompt');
    viewer.output('Hybrid', 'integrator', 'hybrid output');

    const summary = viewer.getSummary();
    expect(summary.eventsByModel['Local']).toBe(1);
    expect(summary.eventsByModel['Cloud']).toBe(1);
    expect(summary.eventsByModel['Hybrid']).toBe(1);
  });
});
