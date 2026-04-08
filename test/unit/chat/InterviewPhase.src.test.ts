/**
 * Tests for InterviewPhase - source-imported coverage
 *
 * The existing InterviewPhase.test.ts imports from dist/ and doesn't
 * contribute to src/ coverage. This file imports from src/ to cover
 * the uncovered branches.
 */

import { describe, it, expect } from 'vitest';
import {
  getNextQuestion,
  getAllQuestions,
  getPhaseOrder,
  generateSummary,
} from '../../../src/chat/InterviewPhase.js';

describe('InterviewPhase (src coverage)', () => {
  describe('getNextQuestion - boundary conditions', () => {
    it('returns first greeting question for empty answers', () => {
      const answers = new Map<string, unknown>();
      const q = getNextQuestion('greeting', answers);
      expect(q).not.toBeNull();
      expect(q!.id).toBe('intent');
      expect(q!.phase).toBe('greeting');
    });

    it('returns null when all questions in all phases are answered', () => {
      const answers = new Map<string, unknown>([
        ['intent', 'test'],
        ['context', 'test'],
        ['mood', 'test'],
        ['references', 'test'],
        ['constraints', 'test'],
        ['audioPreference', 'test'],
        ['aestheticPreset', 'test'],
        ['confirmed', 'yes'],
        ['generating', 'done'],
      ]);
      const q = getNextQuestion('greeting', answers);
      expect(q).toBeNull();
    });

    it('returns null when called with generating phase and all answered', () => {
      const answers = new Map<string, unknown>([
        ['intent', 'test'],
        ['generating', 'done'],
      ]);
      const q = getNextQuestion('generating', answers);
      expect(q).toBeNull();
    });

    it('recurses from greeting to discovery when intent is answered', () => {
      const answers = new Map<string, unknown>([
        ['intent', 'create art'],
      ]);
      const q = getNextQuestion('greeting', answers);
      expect(q).not.toBeNull();
      expect(q!.phase).toBe('discovery');
      expect(q!.id).toBe('context');
    });

    it('returns next unanswered question within same phase', () => {
      const answers = new Map<string, unknown>([
        ['context', 'gallery'],
      ]);
      const q = getNextQuestion('discovery', answers);
      expect(q).not.toBeNull();
      expect(q!.id).toBe('mood');
    });

    it('skips multiple answered questions in discovery phase', () => {
      const answers = new Map<string, unknown>([
        ['context', 'gallery'],
        ['mood', 'dreamy'],
        ['references', 'artist x'],
      ]);
      const q = getNextQuestion('discovery', answers);
      expect(q).not.toBeNull();
      expect(q!.id).toBe('constraints');
    });

    it('recurses from discovery to confirm when all discovery questions answered', () => {
      const answers = new Map<string, unknown>([
        ['context', 'gallery'],
        ['mood', 'dreamy'],
        ['references', 'artist x'],
        ['constraints', 'none'],
        ['audioPreference', 'no'],
        ['aestheticPreset', 'minimalist'],
      ]);
      const q = getNextQuestion('discovery', answers);
      expect(q).not.toBeNull();
      expect(q!.phase).toBe('confirm');
      expect(q!.id).toBe('confirmed');
    });

    it('recurses from confirm to generating when confirmed is answered', () => {
      const answers = new Map<string, unknown>([
        ['confirmed', 'yes'],
      ]);
      const q = getNextQuestion('confirm', answers);
      expect(q).not.toBeNull();
      expect(q!.phase).toBe('generating');
      expect(q!.id).toBe('generating');
    });

    it('returns generating question when in generating phase with no answers', () => {
      const answers = new Map<string, unknown>();
      const q = getNextQuestion('generating', answers);
      expect(q).not.toBeNull();
      expect(q!.id).toBe('generating');
    });
  });

  describe('getAllQuestions', () => {
    it('returns all questions across all phases', () => {
      const questions = getAllQuestions();
      expect(questions.length).toBe(9); // 1 greeting + 6 discovery + 1 confirm + 1 generating
    });

    it('includes required intent question', () => {
      const questions = getAllQuestions();
      const intent = questions.find(q => q.id === 'intent');
      expect(intent).not.toBeUndefined();
      expect(intent!.required).toBe(true);
    });
  });

  describe('getPhaseOrder', () => {
    it('returns all four phases in order', () => {
      const order = getPhaseOrder();
      expect(order).toEqual(['greeting', 'discovery', 'confirm', 'generating']);
    });
  });

  describe('generateSummary', () => {
    it('returns empty string when no answers provided', () => {
      const summary = generateSummary(new Map());
      expect(summary).toBe('');
    });

    it('includes intent in summary', () => {
      const answers = new Map<string, unknown>([
        ['intent', 'Create a particle system'],
      ]);
      const summary = generateSummary(answers);
      expect(summary).toContain('Create a particle system');
    });

    it('includes all display fields when provided', () => {
      const answers = new Map<string, unknown>([
        ['intent', 'particles'],
        ['context', 'web'],
        ['mood', 'dreamy'],
        ['references', 'artist'],
        ['constraints', 'fast'],
      ]);
      const summary = generateSummary(answers);
      expect(summary).toContain('particles');
      expect(summary).toContain('web');
      expect(summary).toContain('dreamy');
      expect(summary).toContain('artist');
      expect(summary).toContain('fast');
    });

    it('joins array values with comma-space', () => {
      const answers = new Map<string, unknown>([
        ['constraints', ['fast', 'small']],
      ]);
      const summary = generateSummary(answers);
      expect(summary).toContain('fast, small');
    });

    it('skips fields not in displayIds (e.g., audioPreference)', () => {
      const answers = new Map<string, unknown>([
        ['intent', 'test'],
        ['audioPreference', 'Yes, voice input'],
      ]);
      const summary = generateSummary(answers);
      expect(summary).toContain('test');
      expect(summary).not.toContain('voice input');
    });

    it('skips falsy values', () => {
      const answers = new Map<string, unknown>([
        ['intent', 'test'],
        ['context', ''],
      ]);
      const summary = generateSummary(answers);
      expect(summary).toContain('test');
      // context is empty string, which is falsy, so it should be skipped
      expect(summary.split('\n').length).toBe(1);
    });
  });
});
