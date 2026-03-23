import { describe, it, expect } from 'vitest';
import {
  getNextQuestion,
  getAllQuestions,
  getPhaseOrder
} from '../../../dist/chat/InterviewPhase.js';
import type { InterviewQuestion, InterviewPhase } from '../../../dist/chat/types.js';

describe('InterviewPhase', () => {
  describe('getAllQuestions', () => {
    it('should return all questions for each phase', () => {
      const questions = getAllQuestions();

      expect(questions.length).toBeGreaterThan(0);

      // Check greeting phase
      const greetingQuestions = questions.filter(q => q.phase === 'greeting');
      expect(greetingQuestions.length).toBeGreaterThanOrEqual(1);

      // Check discovery phase
      const discoveryQuestions = questions.filter(q => q.phase === 'discovery');
      expect(discoveryQuestions.length).toBeGreaterThanOrEqual(3);

      // Check confirm phase
      const confirmQuestions = questions.filter(q => q.phase === 'confirm');
      expect(confirmQuestions.length).toBeGreaterThanOrEqual(1);

      // Check generating phase
      const generatingQuestions = questions.filter(q => q.phase === 'generating');
      expect(generatingQuestions.length).toBeGreaterThanOrEqual(1);
    });

    it('should return questions with valid structure', () => {
      const questions = getAllQuestions();

      questions.forEach(question => {
        expect(question).toHaveProperty('id');
        expect(question).toHaveProperty('phase');
        expect(question).toHaveProperty('question');
        expect(question).toHaveProperty('type');
        expect(question).toHaveProperty('required');

        expect(typeof question.id).toBe('string');
        expect(typeof question.question).toBe('string');
        expect(typeof question.required).toBe('boolean');

        expect(['greeting', 'discovery', 'confirm', 'generating']).toContain(question.phase);
        expect(['text', 'choice', 'multiple']).toContain(question.type);

        // If type is choice or multiple, options should be present
        if (question.type === 'choice' || question.type === 'multiple') {
          expect(question.options).toBeDefined();
          expect(Array.isArray(question.options)).toBe(true);
          expect(question.options!.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('getPhaseOrder', () => {
    it('should return correct phase order', () => {
      const order = getPhaseOrder();

      expect(order).toEqual(['greeting', 'discovery', 'confirm', 'generating']);
    });
  });

  describe('getNextQuestion', () => {
    it('should return first greeting question when no answers provided', () => {
      const answers = new Map<string, any>();
      const question = getNextQuestion('greeting', answers);

      expect(question).not.toBeNull();
      expect(question?.phase).toBe('greeting');
    });

    it('should return discovery questions after greeting', () => {
      const answers = new Map<string, any>([
        ['intent', 'Create a particle system']
      ]);
      const question = getNextQuestion('discovery', answers);

      expect(question).not.toBeNull();
      expect(question?.phase).toBe('discovery');
    });

    it('should return confirm question after discovery', () => {
      const answers = new Map<string, any>([
        ['intent', 'Create a particle system'],
        ['context', 'Web background'],
        ['mood', 'Dreamy'],
        ['references', []],
        ['constraints', []]
      ]);
      const question = getNextQuestion('confirm', answers);

      expect(question).not.toBeNull();
      expect(question?.phase).toBe('confirm');
    });

    it('should return generating status after confirm', () => {
      const answers = new Map<string, any>([
        ['intent', 'Create a particle system'],
        ['context', 'Web background'],
        ['mood', 'Dreamy'],
        ['references', []],
        ['constraints', []],
        ['confirmed', true]
      ]);
      const question = getNextQuestion('generating', answers);

      expect(question).not.toBeNull();
      expect(question?.phase).toBe('generating');
    });

    it('should return null after generating phase', () => {
      const answers = new Map<string, any>([
        ['intent', 'Create a particle system'],
        ['context', 'Web background'],
        ['mood', 'Dreamy'],
        ['references', []],
        ['constraints', []],
        ['confirmed', true],
        ['generating_complete', true]
      ]);
      const question = getNextQuestion('generating', answers);

      expect(question).toBeNull();
    });

    it('should skip questions based on answers provided', () => {
      const answers = new Map<string, any>([
        ['intent', 'Create a particle system'],
        ['context', 'Web background'],
        ['mood', 'Dreamy']
      ]);

      // Should return next un answered question
      const question = getNextQuestion('discovery', answers);

      expect(question).not.toBeNull();
      expect(question?.phase).toBe('discovery');
      // Should be asking about references or constraints
      expect(['references', 'constraints']).toContain(question?.id);
    });

    it('should handle empty answers map gracefully', () => {
      const answers = new Map<string, any>();
      const question = getNextQuestion('greeting', answers);

      expect(question).not.toBeNull();
    });

    it('should return question with text type for open-ended questions', () => {
      const answers = new Map<string, any>();
      const question = getNextQuestion('greeting', answers);

      expect(question).not.toBeNull();
      expect(question?.type).toBe('text');
    });
  });

  describe('Question content', () => {
    it('should include context question in discovery phase', () => {
      const questions = getAllQuestions();
      const contextQuestion = questions.find(q => q.id === 'context');

      expect(contextQuestion).toBeDefined();
      expect(contextQuestion?.phase).toBe('discovery');
      expect(contextQuestion?.question).toBeDefined();
    });

    it('should include mood question in discovery phase', () => {
      const questions = getAllQuestions();
      const moodQuestion = questions.find(q => q.id === 'mood');

      expect(moodQuestion).toBeDefined();
      expect(moodQuestion?.phase).toBe('discovery');
      expect(moodQuestion?.question).toBeDefined();
    });

    it('should include references question in discovery phase', () => {
      const questions = getAllQuestions();
      const referencesQuestion = questions.find(q => q.id === 'references');

      expect(referencesQuestion).toBeDefined();
      expect(referencesQuestion?.phase).toBe('discovery');
      expect(referencesQuestion?.question).toBeDefined();
    });

    it('should include constraints question in discovery phase', () => {
      const questions = getAllQuestions();
      const constraintsQuestion = questions.find(q => q.id === 'constraints');

      expect(constraintsQuestion).toBeDefined();
      expect(constraintsQuestion?.phase).toBe('discovery');
      expect(constraintsQuestion?.question).toBeDefined();
    });

    it('should include confirm question in confirm phase', () => {
      const questions = getAllQuestions();
      const confirmQuestion = questions.find(q => q.id === 'confirm');

      expect(confirmQuestion).toBeDefined();
      expect(confirmQuestion?.phase).toBe('confirm');
      expect(confirmQuestion?.type).toBe('choice');
    });

    it('should include generating status in generating phase', () => {
      const questions = getAllQuestions();
      const generatingQuestion = questions.find(q => q.id === 'generating');

      expect(generatingQuestion).toBeDefined();
      expect(generatingQuestion?.phase).toBe('generating');
      expect(generatingQuestion?.required).toBe(false);
    });
  });
});
