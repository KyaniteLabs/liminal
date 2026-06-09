import { describe, it, expect } from 'vitest';
import { getPhaseOrder, getAllQuestions, getNextQuestion, generateSummary } from '../../../src/chat/InterviewPhase.js';

describe('InterviewPhase', () => {
  describe('getPhaseOrder', () => {
    it('returns phases in correct order', () => {
      const order = getPhaseOrder();
      expect(order).toEqual(['greeting', 'discovery', 'confirm', 'generating']);
    });
  });

  describe('getAllQuestions', () => {
    it('returns all questions across phases', () => {
      const all = getAllQuestions();
      expect(all.length).toBeGreaterThan(5);
      expect(all.some(q => q.phase === 'greeting')).toBe(true);
      expect(all.some(q => q.phase === 'discovery')).toBe(true);
      expect(all.some(q => q.phase === 'confirm')).toBe(true);
    });

    it('includes required questions', () => {
      const all = getAllQuestions();
      const required = all.filter(q => q.required);
      expect(required.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getNextQuestion', () => {
    it('returns first greeting question for empty answers', () => {
      const q = getNextQuestion('greeting', new Map());
      expect(q).not.toBeNull();
      expect(q!.id).toBe('intent');
      expect(q!.phase).toBe('greeting');
      expect(q!.required).toBe(true);
    });

    it('returns null when past last phase', () => {
      // generating is the last phase; after that index would be >= length
      const q = getNextQuestion('generating' as any, new Map());
      // generating has one question; if it's answered, returns null
      const answered = new Map([['generating', 'true']]);
      const q2 = getNextQuestion('generating', answered);
      expect(q2).toBeNull();
    });

    it('skips answered questions within a phase', () => {
      const answers = new Map([['intent', 'a sunset']]);
      const q = getNextQuestion('greeting', answers);
      // All greeting questions answered → moves to discovery
      expect(q).not.toBeNull();
      expect(q!.phase).toBe('discovery');
    });

    it('advances through discovery phase', () => {
      const answers = new Map([
        ['intent', 'sunset'],
        ['context', 'gallery'],
      ]);
      // Start from greeting → all answered → discovery → find first unanswered
      const q = getNextQuestion('greeting', answers);
      expect(q).not.toBeNull();
      expect(q!.id).toBe('mood');
    });

    it('returns confirm question after discovery is complete', () => {
      const discoveryAnswers = new Map();
      // Fill all discovery question IDs
      const discoveryIds = ['context', 'mood', 'references', 'constraints', 'audioPreference', 'aestheticPreset'];
      for (const id of discoveryIds) {
        discoveryAnswers.set(id, 'test');
      }
      discoveryAnswers.set('intent', 'test');

      const q = getNextQuestion('greeting', discoveryAnswers);
      expect(q).not.toBeNull();
      expect(q!.phase).toBe('confirm');
      expect(q!.id).toBe('confirmed');
    });

    it('returns null when all phases complete', () => {
      const all = getAllQuestions();
      const allAnswered = new Map(all.map(q => [q.id, 'answered']));
      const q = getNextQuestion('greeting', allAnswered);
      expect(q).toBeNull();
    });

    it('returns discovery questions individually', () => {
      const answers = new Map([['intent', 'test']]);
      const q = getNextQuestion('discovery', answers);
      expect(q).not.toBeNull();
      expect(q!.id).toBe('context');
    });
  });

  describe('generateSummary', () => {
    it('returns empty string for empty answers', () => {
      expect(generateSummary(new Map())).toBe('');
    });

    it('formats answered questions', () => {
      const answers = new Map([
        ['intent', 'a sunset'],
        ['context', 'web background'],
      ]);
      const summary = generateSummary(answers);
      expect(summary).toContain('sunset');
      expect(summary).toContain('web background');
    });

    it('joins array values with comma', () => {
      const answers = new Map([
        ['constraints', ['no audio', 'dark mode']],
      ]);
      const summary = generateSummary(answers);
      expect(summary).toContain('no audio, dark mode');
    });

    it('skips display-only IDs that have no answers', () => {
      const answers = new Map([['intent', 'a sunset']]);
      const summary = generateSummary(answers);
      // Should have the intent but not empty lines for missing answers
      const lines = summary.split('\n').filter(Boolean);
      expect(lines.length).toBe(1);
    });

    it('excludes non-display IDs like confirmed', () => {
      const answers = new Map([
        ['intent', 'test'],
        ['confirmed', 'Yes'],
      ]);
      const summary = generateSummary(answers);
      expect(summary).not.toContain('Yes');
      expect(summary).toContain('test');
    });
  });
});
