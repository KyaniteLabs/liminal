import { PromptStore } from '../../src/core/PromptStore.js';

describe('PromptStore', () => {
  describe('load()', () => {
    it('should return the same prompt every time for identical input', () => {
      const prompt = 'Generate a particle system';
      const result1 = PromptStore.load(prompt);
      const result2 = PromptStore.load(prompt);
      const result3 = PromptStore.load(prompt);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(result1).toBe(prompt);
    });

    it('should return the same prompt every time for complex input', () => {
      const prompt = 'Create a p5.js sketch with glitch effects and color decay';
      const result1 = PromptStore.load(prompt);
      const result2 = PromptStore.load(prompt);

      expect(result1).toBe(result2);
      expect(result1).toBe(prompt);
    });

    it('should return the same prompt every time for multiline input', () => {
      const prompt = `Generate a particle system with:
- 100+ particles
- Mouse interaction
- Smooth animation`;

      const result1 = PromptStore.load(prompt);
      const result2 = PromptStore.load(prompt);

      expect(result1).toBe(result2);
      expect(result1).toBe(prompt);
    });

    it('should return the same prompt every time for empty string', () => {
      const prompt = '';
      const result1 = PromptStore.load(prompt);
      const result2 = PromptStore.load(prompt);

      expect(result1).toBe(result2);
      expect(result1).toBe(prompt);
    });

    it('should return the same prompt every time for prompt with special characters', () => {
      const prompt = 'Create <glitch> effect with {params} and $variables';
      const result1 = PromptStore.load(prompt);
      const result2 = PromptStore.load(prompt);

      expect(result1).toBe(result2);
      expect(result1).toBe(prompt);
    });

    it('should return the same prompt every time across multiple calls', () => {
      const prompt = 'Test prompt consistency';
      const results = [];

      for (let i = 0; i < 10; i++) {
        results.push(PromptStore.load(prompt));
      }

      // All results should be identical
      results.forEach(result => {
        expect(result).toBe(prompt);
      });

      // All results should be the same reference
      expect(results[0]).toBe(results[5]);
      expect(results[2]).toBe(results[9]);
    });

    it('should handle different prompts independently', () => {
      const prompt1 = 'First prompt';
      const prompt2 = 'Second prompt';

      const result1 = PromptStore.load(prompt1);
      const result2 = PromptStore.load(prompt2);
      const result1Again = PromptStore.load(prompt1);

      expect(result1).toBe(prompt1);
      expect(result2).toBe(prompt2);
      expect(result1Again).toBe(prompt1);
      expect(result1).not.toBe(result2);
    });
  });

  describe('injectContext()', () => {
    it('should inject context into prompt template with {{context}} placeholder', () => {
      const prompt = 'Generate art. Context: {{context}}';
      const context = 'Previous iteration had 50 particles';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toContain('Previous iteration had 50 particles');
      expect(result).not.toContain('{{context}}');
    });

    it('should inject context into prompt template with {context} placeholder', () => {
      const prompt = 'Generate art. Context: {context}';
      const context = 'Iteration 3 completed';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toContain('Iteration 3 completed');
      expect(result).not.toContain('{context}');
    });

    it('should inject context into prompt template with <context> placeholder', () => {
      const prompt = 'Generate art. Context: <context>';
      const context = 'Gallery saved successfully';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toContain('Gallery saved successfully');
      expect(result).not.toContain('<context>');
    });

    it('should handle multiple {{context}} placeholders', () => {
      const prompt = '{{context}} and {{context}} again';
      const context = 'test context';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toBe('test context and test context again');
    });

    it('should handle multiple {context} placeholders', () => {
      const prompt = '{context} and {context} again';
      const context = 'test context';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toBe('test context and test context again');
    });

    it('should return original prompt if no placeholder found', () => {
      const prompt = 'Generate art with no placeholder';
      const context = 'Some context';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toBe(prompt);
    });

    it('should handle empty context string', () => {
      const prompt = 'Context: {{context}}';
      const context = '';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toBe('Context: ');
      expect(result).not.toContain('{{context}}');
    });

    it('should handle multiline context', () => {
      const prompt = 'Context: {{context}}';
      const context = `Iteration 1: Basic particles
Iteration 2: Added color
Iteration 3: Fixed animation`;
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toContain('Iteration 1: Basic particles');
      expect(result).toContain('Iteration 2: Added color');
      expect(result).toContain('Iteration 3: Fixed animation');
      expect(result).not.toContain('{{context}}');
    });

    it('should handle context with special characters', () => {
      const prompt = 'Context: {{context}}';
      const context = 'Test with <tags>, {braces}, and $symbols';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toContain('Test with <tags>, {braces}, and $symbols');
      expect(result).not.toContain('{{context}}');
    });

    it('should handle context with code snippets', () => {
      const prompt = 'Previous code: {{context}}';
      const context = `function setup() {
  createCanvas(400, 400);
}`;
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toContain('function setup()');
      expect(result).toContain('createCanvas(400, 400)');
      expect(result).not.toContain('{{context}}');
    });

    it('should handle very long context strings', () => {
      const prompt = 'Context: {{context}}';
      const longContext = 'x'.repeat(10000);
      const result = PromptStore.injectContext(prompt, longContext);

      expect(result.length).toBeGreaterThanOrEqual(10000); // At least 10000 chars from context
      expect(result).not.toContain('{{context}}');
    });

    it('should prioritize {{context}} over other placeholders', () => {
      const prompt = 'Test {{context}} and {context}';
      const context = 'double braces';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toContain('double braces');
    });

    it('should handle prompt with only placeholder', () => {
      const prompt = '{{context}}';
      const context = 'just context';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toBe('just context');
    });

    it('should not mutate original prompt string', () => {
      const prompt = 'Original {{context}} prompt';
      const context = 'injected';
      const originalPrompt = prompt;

      PromptStore.injectContext(prompt, context);

      expect(prompt).toBe(originalPrompt);
    });

    it('should handle null context gracefully', () => {
      const prompt = 'Test {{context}}';
      const result = PromptStore.injectContext(prompt, null);

      expect(result).toContain('null');
      expect(result).not.toContain('{{context}}');
    });

    it('should handle undefined context gracefully', () => {
      const prompt = 'Test {{context}}';
      const result = PromptStore.injectContext(prompt, undefined);

      expect(result).toContain('undefined');
      expect(result).not.toContain('{{context}}');
    });

    it('should handle context with newlines and tabs', () => {
      const prompt = 'Context:\n{{context}}\nEnd';
      const context = 'Line 1\n\tLine 2\nLine 3';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toContain('Line 1');
      expect(result).toContain('\tLine 2');
      expect(result).toContain('Line 3');
      expect(result).not.toContain('{{context}}');
    });

    it('should handle emoji and unicode in context', () => {
      const prompt = 'Context: {{context}}';
      const context = '🎨 Creative coding 🚀 with 中文 and 日本語';
      const result = PromptStore.injectContext(prompt, context);

      expect(result).toContain('🎨');
      expect(result).toContain('🚀');
      expect(result).toContain('中文');
      expect(result).toContain('日本語');
      expect(result).not.toContain('{{context}}');
    });
  });

  describe('Integration', () => {
    it('should work together: load and injectContext', () => {
      const originalPrompt = 'Generate {{context}}';
      const loadedPrompt = PromptStore.load(originalPrompt);
      const context = 'with particle systems';

      expect(loadedPrompt).toBe(originalPrompt);

      const result = PromptStore.injectContext(loadedPrompt, context);

      expect(result).toBe('Generate with particle systems');
    });

    it('should maintain consistency across load-inject cycles', () => {
      const prompt = 'Create {{context}} art';
      const context1 = 'iteration 1';
      const context2 = 'iteration 2';

      const loaded1 = PromptStore.load(prompt);
      const loaded2 = PromptStore.load(prompt);

      expect(loaded1).toBe(loaded2);

      const injected1 = PromptStore.injectContext(loaded1, context1);
      const injected2 = PromptStore.injectContext(loaded2, context2);

      expect(injected1).toContain('iteration 1');
      expect(injected2).toContain('iteration 2');
    });

    it('should handle typical Ralph-Wiggum loop scenario', () => {
      const basePrompt = 'Generate art. Previous: {{context}}';

      // Load same prompt multiple times (iteration loop)
      const iter1Prompt = PromptStore.load(basePrompt);
      const iter2Prompt = PromptStore.load(basePrompt);
      const iter3Prompt = PromptStore.load(basePrompt);

      expect(iter1Prompt).toBe(iter2Prompt);
      expect(iter2Prompt).toBe(iter3Prompt);

      // Inject different context each time
      const context1 = 'Iteration 1: Basic sketch created';
      const context2 = 'Iteration 2: Added particles';
      const context3 = 'Iteration 3: Refined colors';

      const result1 = PromptStore.injectContext(iter1Prompt, context1);
      const result2 = PromptStore.injectContext(iter2Prompt, context2);
      const result3 = PromptStore.injectContext(iter3Prompt, context3);

      expect(result1).toContain('Iteration 1: Basic sketch created');
      expect(result2).toContain('Iteration 2: Added particles');
      expect(result3).toContain('Iteration 3: Refined colors');

      // Original prompt never changes
      expect(iter1Prompt).toBe(basePrompt);
    });
  });
});