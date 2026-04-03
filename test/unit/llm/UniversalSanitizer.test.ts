import { describe, it, expect } from 'vitest';
/**
 * Tests for Universal Output Sanitizer
 *
 * The sanitizer handles contamination from ANY LLM model:
 * - <think/> tags (Qwen, DeepSeek, etc.)
 * - Markdown fences (all models)
 * - Reasoning text preamble (all models)
 * - Mixed formats
 *
 * Philosophy: Clean the output, don't choose the model.
 */

import { sanitizeOutput } from '../../../src/llm/LLMClient.js';

describe('Universal Output Sanitizer', () => {
  describe('<think/> tag stripping', () => {
    it('strips simple think tags', () => {
      const content = '<think<Let me think</think<\n```javascript\nfunction setup() { createCanvas(400, 400); }\n```';
      const result = sanitizeOutput(content);
      expect(result.code).not.toContain('<think');
      expect(result.code).not.toContain('Let me think');
      expect(result.code).toContain('function setup()');
    });

    it('strips multiline think blocks', () => {
      const content = `<think<Let me think about this step by step:
1. Create canvas
2. Draw circle
3. Add color
</think<

\`\`\`javascript
function draw() { ellipse(200, 200, 100); }
\`\`\``;
      const result = sanitizeOutput(content);
      expect(result.code).not.toContain('<think');
      expect(result.code).not.toContain('step by step');
      expect(result.code).toContain('function draw()');
    });

    it('handles case-insensitive think tags', () => {
      const content = '<THINK<reasoning</THINK<\nconst x = 10;';
      const result = sanitizeOutput(content);
      expect(result.code).not.toContain('<THINK<');
      expect(result.code).toContain('const x = 10;');
    });

    it('handles nested think tags', () => {
      const content = '<think<outer<think<inner</think<outer2</think<\nfunction code() {}';
      const result = sanitizeOutput(content);
      expect(result.code).not.toContain('<think');
      expect(result.code).toContain('function code()');
    });

    it('handles code without think tags', () => {
      const content = '```javascript\nfunction setup() {}\n```';
      const result = sanitizeOutput(content);
      expect(result.code).toContain('function setup()');
    });
  });

  describe('markdown fence extraction', () => {
    it('extracts code from javascript fences', () => {
      const content = '```javascript\nfunction setup() { createCanvas(400, 400); }\n```';
      const result = sanitizeOutput(content);
      expect(result.code.trim()).toBe('function setup() { createCanvas(400, 400); }');
    });

    it('extracts code from js fences', () => {
      const content = '```js\nconst x = 10;\n```';
      const result = sanitizeOutput(content);
      expect(result.code.trim()).toBe('const x = 10;');
    });

    it('extracts code from generic fences', () => {
      const content = '```\nsome code here\n```';
      const result = sanitizeOutput(content);
      expect(result.code.trim()).toBe('some code here');
    });

    it('handles code without fences', () => {
      const content = 'function setup() { createCanvas(400, 400); }';
      const result = sanitizeOutput(content);
      expect(result.code).toContain('function setup()');
    });
  });

  describe('reasoning text stripping', () => {
    it('strips Here is the code preamble', () => {
      const content = 'Here is the code:\n```javascript\nfunction setup() {}\n```';
      const result = sanitizeOutput(content);
      expect(result.code).not.toContain('Here is the code');
      expect(result.code).toContain('function setup()');
    });

    it('strips Ill create preamble', () => {
      const content = "I'll create a sketch for you:\n\n```javascript\nfunction draw() {}\n```";
      const result = sanitizeOutput(content);
      expect(result.code.trim()).toBe('function draw() {}');
    });

    it('finds code after narrative text', () => {
      const content = 'The user wants a blue circle. Let me create that.\n\n```javascript\nfunction setup() {\n  createCanvas(400, 400);\n}\n```';
      const result = sanitizeOutput(content);
      expect(result.code).toContain('function setup()');
      expect(result.code).not.toContain('The user wants');
    });
  });

  describe('code completeness detection', () => {
    it('marks balanced braces as complete', () => {
      const content = '```javascript\nfunction setup() { createCanvas(400, 400); }\n```';
      const result = sanitizeOutput(content);
      expect(result.isComplete).toBe(true);
    });

    it('marks unbalanced braces as incomplete', () => {
      const content = '```javascript\nfunction setup() { createCanvas(400, 400);\n```';
      const result = sanitizeOutput(content);
      expect(result.isComplete).toBe(false);
    });

    it('marks unbalanced parentheses as incomplete', () => {
      const content = '```javascript\nfunction setup( {\n```';
      const result = sanitizeOutput(content);
      expect(result.isComplete).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = sanitizeOutput('');
      expect(result.code).toBe('');
      expect(result.success).toBe(false);
    });

    it('handles null-like content via empty string', () => {
      const result = sanitizeOutput('');
      expect(result.code).toBe('');
      expect(result.success).toBe(false);
    });

    it('handles only think tags with no code', () => {
      const content = '<think<thinking...</think<';
      const result = sanitizeOutput(content);
      expect(result.code).toBe('');
      expect(result.success).toBe(false);
    });

    it('handles mixed contamination', () => {
      const content = `<think<
Let me analyze the requirements:
- Blue circle
- 400x400 canvas
</think<

Here's the code:

\`\`\`javascript
function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(0);
  fill(0, 0, 255);
  circle(200, 200, 100);
}
\`\`\`

This should create a nice blue circle!`;
      const result = sanitizeOutput(content);
      expect(result.code).toContain('function setup()');
      expect(result.code).toContain('function draw()');
      expect(result.code).toContain('circle(200, 200, 100)');
      expect(result.code).not.toContain('<think');
      expect(result.code).not.toContain("Here's the code");
      expect(result.code).not.toContain('nice blue circle');
    });
  });
});
