import { describe, it, expect, beforeEach } from 'vitest';
/**
 * PromptLibrary tests
 */

import { PromptLibrary } from '../../src/prompts/PromptLibrary.js';
import type { PromptTemplate } from '../../src/prompts/PromptLibrary.js';

describe('PromptLibrary', () => {
  beforeEach(() => {
    // Clear any existing templates before each test
    (PromptLibrary as any).templates.clear();
  });

  describe('register and get', () => {
    it('should register a template and retrieve it', () => {
      const template: PromptTemplate = {
        id: 'test.prompt',
        version: '1.0.0',
        category: 'test',
        systemPrompt: 'You are a test assistant.',
        userPromptTemplate: 'Test: ${input}',
      };

      PromptLibrary.register(template);
      const retrieved = PromptLibrary.get('test.prompt');

      expect(retrieved?.id).toBe('test.prompt');
      expect(retrieved?.systemPrompt).toBe('You are a test assistant.');
      expect(retrieved?.userPromptTemplate).toBe('Test: ${input}');
    });

    it('should throw when registering duplicate id', () => {
      const template: PromptTemplate = {
        id: 'duplicate',
        version: '1.0.0',
        category: 'test',
        systemPrompt: 'Test',
      };

      PromptLibrary.register(template);

      expect(() => {
        PromptLibrary.register(template);
      }).toThrow('Prompt template already registered: duplicate');
    });

    it('should return undefined for missing id', () => {
      expect(PromptLibrary.get('nonexistent')).toBeUndefined();
    });
  });

  describe('render with variables', () => {
    beforeEach(() => {
      PromptLibrary.register({
        id: 'render.test',
        version: '1.0.0',
        category: 'test',
        systemPrompt: 'System: ${context}',
        userPromptTemplate: 'User input: ${prompt}, extra: ${optional}',
      });
    });

    it('should replace variables in user prompt template', () => {
      const result = PromptLibrary.render('render.test', {
        prompt: 'hello world',
        optional: 'extra value',
      });

      expect(result.user).toBe('User input: hello world, extra: extra value');
    });

    it('should keep system prompt unchanged', () => {
      const result = PromptLibrary.render('render.test', {
        prompt: 'test',
        optional: 'value',
      });

      expect(result.system).toBe('System: ${context}');
    });

    it('should handle empty user prompt template', () => {
      PromptLibrary.register({
        id: 'no.user',
        version: '1.0.0',
        category: 'test',
        systemPrompt: 'System only',
      });

      const result = PromptLibrary.render('no.user');
      expect(result.system).toBe('System only');
      expect(result.user).toBe('');
    });

    it('should handle missing variables gracefully', () => {
      const result = PromptLibrary.render('render.test', {
        prompt: 'test',
        // optional is missing
      });

      expect(result.user).toBe('User input: test, extra: ${optional}');
    });

    it('should handle no vars provided', () => {
      const result = PromptLibrary.render('render.test');
      expect(result.user).toBe('User input: ${prompt}, extra: ${optional}');
    });

    it('should throw for non-existent template id', () => {
      expect(() => {
        PromptLibrary.render('nonexistent');
      }).toThrow('Prompt template not found: nonexistent');
    });
  });

  describe('listByCategory', () => {
    beforeEach(() => {
      PromptLibrary.register({
        id: 'cat1.a',
        version: '1.0.0',
        category: 'category1',
        systemPrompt: 'Test A',
      });
      PromptLibrary.register({
        id: 'cat1.b',
        version: '1.0.0',
        category: 'category1',
        systemPrompt: 'Test B',
      });
      PromptLibrary.register({
        id: 'cat2.a',
        version: '1.0.0',
        category: 'category2',
        systemPrompt: 'Test C',
      });
    });

    it('should list all templates in a category', () => {
      const cat1 = PromptLibrary.listByCategory('category1');
      expect(cat1).toHaveLength(2);
      expect(cat1.map((t) => t.id)).toEqual(expect.arrayContaining(['cat1.a', 'cat1.b']));
    });

    it('should return empty array for non-existent category', () => {
      const empty = PromptLibrary.listByCategory('nonexistent');
      expect(empty).toEqual([]);
    });
  });

  describe('list all', () => {
    beforeEach(() => {
      PromptLibrary.register({
        id: 'all.a',
        version: '1.0.0',
        category: 'cat',
        systemPrompt: 'Test A',
      });
      PromptLibrary.register({
        id: 'all.b',
        version: '1.0.0',
        category: 'cat',
        systemPrompt: 'Test B',
      });
    });

    it('should list all registered templates', () => {
      const all = PromptLibrary.list();
      expect(all).toHaveLength(2);
      expect(all.map((t) => t.id)).toEqual(expect.arrayContaining(['all.a', 'all.b']));
    });
  });
});
