import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseComposer } from '../../../src/agent/ResponseComposer.js';

describe('ResponseComposer', () => {
  let composer: ResponseComposer;

  beforeEach(() => {
    composer = new ResponseComposer();
  });

  describe('directResponse', () => {
    it('formats a direct response with correct metadata', () => {
      const response = composer.directResponse('Hello!', 'turn-1', 150);

      expect(response.content).toBe('Hello!');
      expect(response.metadata.turnId).toBe('turn-1');
      expect(response.metadata.intent).toBe('direct');
      expect(response.metadata.delegatedTo).toBe('llm-chat');
      expect(response.metadata.durationMs).toBe(150);
      expect(response.metadata.artifactRefs).toEqual([]);
      expect(response.metadata.taskRefs).toEqual([]);
    });

    it('includes model when provided', () => {
      const response = composer.directResponse('Hi', 'turn-2', 50, 'glm-5.1');
      expect(response.metadata.model).toBe('glm-5.1');
    });
  });

  describe('creativeResponse', () => {
    it('formats a creative response with artifact refs', () => {
      const response = composer.creativeResponse(
        'function setup() { ... }',
        'turn-3',
        2000,
        ['artifacts/sketch-1.js'],
      );

      expect(response.content).toBe('function setup() { ... }');
      expect(response.metadata.intent).toBe('creative');
      expect(response.metadata.delegatedTo).toBe('ralph-loop');
      expect(response.metadata.artifactRefs).toEqual(['artifacts/sketch-1.js']);
    });

    it('accepts empty artifact refs', () => {
      const response = composer.creativeResponse('no artifacts', 'turn-4', 100, []);
      expect(response.metadata.artifactRefs).toEqual([]);
    });
  });

  describe('engineeringResponse', () => {
    it('formats an engineering response with task refs', () => {
      const response = composer.engineeringResponse(
        'Fixed the test',
        'turn-5',
        5000,
        ['T-001'],
      );

      expect(response.content).toBe('Fixed the test');
      expect(response.metadata.intent).toBe('engineering');
      expect(response.metadata.delegatedTo).toBe('conveyor');
      expect(response.metadata.taskRefs).toEqual(['T-001']);
    });
  });

  describe('hybridResponse', () => {
    it('formats a hybrid response with both artifact and task refs', () => {
      const response = composer.hybridResponse(
        'Generated and verified',
        'turn-6',
        8000,
        ['artifacts/gen-1.js'],
        ['T-002'],
        'glm-5.1',
      );

      expect(response.metadata.intent).toBe('hybrid');
      expect(response.metadata.delegatedTo).toBe('ralph-loop');
      expect(response.metadata.artifactRefs).toEqual(['artifacts/gen-1.js']);
      expect(response.metadata.taskRefs).toEqual(['T-002']);
      expect(response.metadata.model).toBe('glm-5.1');
    });
  });

  describe('compose (low-level)', () => {
    it('allows custom delegation decisions', () => {
      const response = composer.compose(
        'custom content',
        'turn-7',
        'direct',
        { target: 'none', params: { reason: 'test' }, reason: 'Manual override' },
        42,
        { model: 'test-model' },
      );

      expect(response.metadata.delegatedTo).toBe('none');
      expect(response.metadata.durationMs).toBe(42);
    });

    it('defaults artifactRefs and taskRefs to empty arrays', () => {
      const response = composer.compose(
        'content',
        'turn-8',
        'direct',
        { target: 'llm-chat', params: {}, reason: 'test' },
        0,
      );

      expect(response.metadata.artifactRefs).toEqual([]);
      expect(response.metadata.taskRefs).toEqual([]);
    });
  });
});
