/**
 * ResponseComposer tests — behavioral assertions on response formatting.
 *
 * Tests real composition behavior with specific expected values.
 */
import { describe, it, expect } from 'vitest';
import { ResponseComposer } from '../../../src/agent/ResponseComposer.js';
import type { DelegationDecision } from '../../../src/agent/types.js';

describe('ResponseComposer', () => {
  const composer = new ResponseComposer();

  const testDelegation: DelegationDecision = {
    target: 'llm-chat',
    params: {},
    reason: 'Test delegation',
  };

  // ── Core compose() ──

  describe('compose()', () => {
    it('creates a response with correct metadata', () => {
      const response = composer.compose(
        'Hello, artist!',
        'turn-001',
        'direct',
        testDelegation,
        150,
      );

      expect(response.content).toBe('Hello, artist!');
      expect(response.metadata.turnId).toBe('turn-001');
      expect(response.metadata.intent).toBe('direct');
      expect(response.metadata.delegatedTo).toBe('llm-chat');
      expect(response.metadata.durationMs).toBe(150);
      expect(response.metadata.artifactRefs).toEqual([]);
      expect(response.metadata.taskRefs).toEqual([]);
    });

    it('includes artifact refs when provided', () => {
      const creativeDelegation: DelegationDecision = {
        target: 'ralph-loop',
        params: {},
        reason: 'Creative generation',
      };
      const response = composer.compose(
        'Generated a p5 sketch',
        'turn-002',
        'creative',
        creativeDelegation,
        3000,
        { artifactRefs: ['art-001', 'art-002'] },
      );

      expect(response.metadata.artifactRefs).toEqual(['art-001', 'art-002']);
      expect(response.metadata.delegatedTo).toBe('ralph-loop');
    });

    it('includes task refs when provided', () => {
      const engDelegation: DelegationDecision = {
        target: 'conveyor',
        params: {},
        reason: 'Engineering task',
      };
      const response = composer.compose(
        'Fixed test coverage',
        'turn-003',
        'engineering',
        engDelegation,
        5000,
        { taskRefs: ['L001'] },
      );

      expect(response.metadata.taskRefs).toEqual(['L001']);
      expect(response.metadata.delegatedTo).toBe('conveyor');
    });

    it('includes model name when provided', () => {
      const response = composer.compose(
        'Response text',
        'turn-004',
        'direct',
        testDelegation,
        100,
        { model: 'glm-5.1' },
      );

      expect(response.metadata.model).toBe('glm-5.1');
    });
  });

  // ── Convenience Methods ──

  describe('directResponse()', () => {
    it('creates a direct response with correct defaults', () => {
      const response = composer.directResponse(
        'I can help with that.',
        'turn-010',
        200,
        'glm-5.1',
      );

      expect(response.content).toBe('I can help with that.');
      expect(response.metadata.intent).toBe('direct');
      expect(response.metadata.delegatedTo).toBe('llm-chat');
      expect(response.metadata.artifactRefs).toEqual([]);
      expect(response.metadata.taskRefs).toEqual([]);
      expect(response.metadata.model).toBe('glm-5.1');
    });

    it('works without a model name', () => {
      const response = composer.directResponse('Hi', 'turn-011', 50);
      expect(response.metadata.model).toBeUndefined();
    });
  });

  describe('creativeResponse()', () => {
    it('creates a creative response with artifact refs', () => {
      const response = composer.creativeResponse(
        'Here is your p5 sketch.',
        'turn-020',
        4500,
        ['art-100'],
        'glm-5.1',
      );

      expect(response.metadata.intent).toBe('creative');
      expect(response.metadata.delegatedTo).toBe('ralph-loop');
      expect(response.metadata.artifactRefs).toEqual(['art-100']);
    });
  });

  describe('engineeringResponse()', () => {
    it('creates an engineering response with task refs', () => {
      const response = composer.engineeringResponse(
        'Task L001 completed.',
        'turn-030',
        8000,
        ['L001', 'L002'],
      );

      expect(response.metadata.intent).toBe('engineering');
      expect(response.metadata.delegatedTo).toBe('conveyor');
      expect(response.metadata.taskRefs).toEqual(['L001', 'L002']);
    });
  });

  describe('hybridResponse()', () => {
    it('creates a hybrid response with both refs', () => {
      const response = composer.hybridResponse(
        'Generated and verified.',
        'turn-040',
        12000,
        ['art-200'],
        ['W001'],
        'glm-5.1',
      );

      expect(response.metadata.intent).toBe('hybrid');
      expect(response.metadata.artifactRefs).toEqual(['art-200']);
      expect(response.metadata.taskRefs).toEqual(['W001']);
    });
  });

  // ── Error paths ──

  describe('edge cases', () => {
    it('handles empty content', () => {
      const response = composer.directResponse('', 'turn-empty', 10);
      expect(response.content).toBe('');
      expect(response.metadata.turnId).toBe('turn-empty');
    });

    it('handles zero duration', () => {
      const response = composer.directResponse('fast', 'turn-fast', 0);
      expect(response.metadata.durationMs).toBe(0);
    });

    it('handles empty refs arrays', () => {
      const response = composer.creativeResponse('content', 'turn-noref', 100, []);
      expect(response.metadata.artifactRefs).toEqual([]);
    });
  });
});
