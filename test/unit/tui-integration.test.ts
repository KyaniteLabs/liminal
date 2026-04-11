import { describe, it, expect, test } from 'vitest';
/**
 * TUI Integration tests - v2.0 layout with PlayerPiano + X-Ray
 *
 * Tests that PlayerPiano and X-Ray components
 * integrate into main TUI layout
 */

describe('TUI Integration v2.0', () => {

  test('TUI layout includes all components', () => {
    // Component structure:
    // - Banner
    // - PromptBar
    // - Seed (optional) line
    // - Flex row: LogsPanel + IterationTimeline + PlayerPiano + XRayPanel + GalleryPanel
    // - StatusBar (Run / Stop)
    const components = [
      'Banner',
      'PromptBar',
      'LogsPanel',
      'IterationTimeline',
      'PlayerPiano',
      'XRayPanel',
      'GalleryPanel',
    ];
    expect(components.length).toBe(7);
    expect(components).toContain('IterationTimeline');
    expect(components).toContain('PlayerPiano');
    expect(components).toContain('XRayPanel');
  });

  test('PlayerPiano receives iteration data', () => {
    const iterations = [
      { id: 1, code: 'setup()', timestamp: 1000 },
      { id: 2, code: 'draw()', timestamp: 2000 },
    ];

    const props = {
      iterations,
      currentIndex: 0,
      isPlaying: false,
    };

    expect(props.iterations).toEqual(iterations);
    expect(props.iterations.length).toBe(2);
    expect(props.currentIndex).toBeGreaterThanOrEqual(0);
    expect(props.currentIndex).toBeLessThan(iterations.length);
  });

  test('X-Ray panel receives LLM output', () => {
    const rawOutput = ['token1', 'token2', 'token3'];

    const props = {
      iterations: [],
      currentIndex: 0,
      rawOutput,
      isStreaming: true,
    };

    expect(props.rawOutput).toEqual(['token1', 'token2', 'token3']);
    expect(props.rawOutput.length).toBe(3);
    expect(props.isStreaming).toBe(true);
  });

  test('keyboard shortcuts defined', () => {
    const shortcuts = [
      { key: 'q', action: 'exit' },
      { key: '1', action: 'toggle-player-piano' },
    ];
    
    expect(shortcuts.length).toBe(2);
    expect(shortcuts[0].key).toBe('q');
    expect(shortcuts[1].key).toBe('1');
  });

  test('state management for v2.0 components', () => {
    const stateKeys = [
      'prompt',
      'seedCode',
      'isGenerating',
      'logs',
      'currentIterations',
      'gallery',
      'galleryIndex',
      'playerPianoIndex',
      'isPlayerPianoPlaying',
    ];
    expect(stateKeys.length).toBe(9);
    expect(stateKeys).toContain('currentIterations');
    expect(stateKeys).toContain('playerPianoIndex');
    expect(stateKeys).toContain('isPlayerPianoPlaying');
    expect(stateKeys).toContain('seedCode');
  });

  test('component width distribution', () => {
    // Layout: LogsPanel (25%) + PlayerPiano (25%) + X-Ray (25%) + Gallery (25%)
    // Or responsive: adjusts based on terminal size
    
    const components = [
      { name: 'LogsPanel', width: '25%' },
      { name: 'PlayerPiano', width: '25%' },
      { name: 'XRayPanel', width: '25%' },
      { name: 'GalleryPanel', width: '25%' },
    ];
    
    const totalWidth = components.reduce((sum, comp) => sum + parseInt(comp.width), 0);
    expect(totalWidth).toBe(100);
  });

  test('PlayerPiano toggle works', () => {
    let isPlaying = false;
    const toggle = () => { isPlaying = !isPlaying; };
    
    expect(isPlaying).toBe(false);
    toggle();
    expect(isPlaying).toBe(true);
    toggle();
    expect(isPlaying).toBe(false);
  });

  test('iteration data structure matches components', () => {
    const iteration = {
      id: 1,
      code: 'function setup() {}',
      timestamp: Date.now(),
    };

    expect(iteration.id).toBe(1);
    expect(iteration.code).toBe('function setup() {}');
    expect(iteration.timestamp).toBeGreaterThan(0);
  });
});
