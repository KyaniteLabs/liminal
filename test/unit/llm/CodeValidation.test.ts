import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMClient } from '../../../src/llm/LLMClient.js';

// Mock console.warn to avoid cluttering test output
const originalWarn = console.warn;
beforeEach(() => {
  console.warn = vi.fn();
});

describe('LLMClient Code Validation', () => {
  let client: LLMClient;

  beforeEach(() => {
    client = new LLMClient({ provider: 'lmstudio' });
  });

  describe('parseChatCompletionResponse - code completeness', () => {
    it('parses complete code successfully', () => {
      const data = {
        choices: [{
          message: {
            content: '```javascript\nfunction test() { return 42; }\n```'
          }
        }]
      };

      const result = client['parseChatCompletionResponse'](data);
      expect(result.success).toBe(true);
      expect(result.code).toContain('function test()');
    });

    it('warns for code with unclosed brace', () => {
      const data = {
        choices: [{
          message: {
            content: '```javascript\nfunction test() { return 42;\n```'
          }
        }]
      };

      const result = client['parseChatCompletionResponse'](data);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('incomplete'));
    });

    it('warns for code with unclosed parentheses', () => {
      const data = {
        choices: [{
          message: {
            content: '```javascript\nfunction test((\n```'
          }
        }]
      };

      const result = client['parseChatCompletionResponse'](data);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('incomplete'));
    });

    it('warns for code cutoff mid-function', () => {
      const data = {
        choices: [{
          message: {
            content: '```javascript\nfunction test() {\n  return '
          }
        }]
      };

      const result = client['parseChatCompletionResponse'](data);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('incomplete'));
    });

    it('handles balanced brackets correctly', () => {
      const data = {
        choices: [{
          message: {
            content: '```javascript\nconst arr = [1, 2, [3, 4]];\n```'
          }
        }]
      };

      const result = client['parseChatCompletionResponse'](data);
      expect(result.success).toBe(true);
      // Should not warn for balanced brackets
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('parseChatCompletionResponse - edge cases', () => {
    it('handles empty response', () => {
      const data = { choices: [] };
      const result = client['parseChatCompletionResponse'](data);
      expect(result.code).toBe('');
      expect(result.success).toBe(true);
    });

    it('handles response without code block', () => {
      const data = {
        choices: [{
          message: {
            content: 'Just some text without code blocks'
          }
        }]
      };

      const result = client['parseChatCompletionResponse'](data);
      expect(result.code).toBe('Just some text without code blocks');
    });

    it('handles response with reasoning content', () => {
      const data = {
        choices: [{
          message: {
            content: '```javascript\nfunction test() { return 42; }\n```',
            reasoning_content: 'Thinking about the code'
          }
        }]
      };

      const result = client['parseChatCompletionResponse'](data);
      expect(result.success).toBe(true);
      expect(result.reasoning).toBe('Thinking about the code');
    });
  });
});
