/**
 * Unit tests for DocParser
 *
 * Tests remark-based markdown parsing with section hierarchy extraction.
 */

import { describe, it, expect } from 'vitest';
import { DocParser } from '../../../../src/core/parsing/DocParser.js';
import type { LIRDocToken } from '../../../../src/core/lir/types.js';

describe('DocParser', () => {
  describe('parse markdown with headings', () => {
    it('should parse H1/H2/H3 headings into sections with correct level and title', () => {
      const markdown = `# Main Title

Some content.

## Section 1

Content for section 1.

### Subsection 1.1

Deeper content.

## Section 2

More content.
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result).toHaveLength(4);

      // First section (H1)
      expect(result[0].type).toBe('doc');
      expect(result[0].heading).toBe('Main Title');
      expect(result[0].level).toBe(1);
      expect(result[0].hierarchy.parent).toBeNull();

      // Second section (H2)
      expect(result[1].type).toBe('doc');
      expect(result[1].heading).toBe('Section 1');
      expect(result[1].level).toBe(2);
      expect(result[1].hierarchy.parent).toBe(result[0].id);

      // Third section (H3)
      expect(result[2].type).toBe('doc');
      expect(result[2].heading).toBe('Subsection 1.1');
      expect(result[2].level).toBe(3);
      expect(result[2].hierarchy.parent).toBe(result[1].id);

      // Fourth section (H2 - sibling to Section 1)
      expect(result[3].type).toBe('doc');
      expect(result[3].heading).toBe('Section 2');
      expect(result[3].level).toBe(2);
      expect(result[3].hierarchy.parent).toBe(result[0].id);
    });

    it('should capture content between headings in correct section', () => {
      const markdown = `# Title

First paragraph.

Second paragraph.

## Section A

Content for section A.

More content here.

## Section B

Content for section B.
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result).toHaveLength(3);

      // Title section should have content before H2
      expect(result[0].content).toContain('First paragraph.');
      expect(result[0].content).toContain('Second paragraph.');

      // Section A should have its content
      expect(result[1].content).toContain('Content for section A.');
      expect(result[1].content).toContain('More content here.');
      expect(result[1].content).not.toContain('First paragraph.');

      // Section B should have its content
      expect(result[2].content).toContain('Content for section B.');
      expect(result[2].content).not.toContain('Content for section A.');
    });

    it('should preserve code blocks within sections', () => {
      const markdown = `# Code Examples

Here is some code:

\`\`\`typescript
function hello() {
  console.log('Hello, world!');
}
\`\`\`

Some explanation.

## More Code

Another example:

\`\`\`javascript
const x = 42;
\`\`\`
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result).toHaveLength(2);

      // First section should contain TypeScript code block
      expect(result[0].content).toContain('function hello()');
      expect(result[0].content).toContain('console.log');
      expect(result[0].metrics.codeBlockCount).toBe(1);

      // Second section should contain JavaScript code block
      expect(result[1].content).toContain('const x = 42;');
      expect(result[1].metrics.codeBlockCount).toBe(1);
    });
  });

  describe('metrics computation', () => {
    it('should compute wordCount correctly', () => {
      const markdown = `# Title

This is a test document with several words.

## Section

More words here.
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      // Title section: "This is a test document with several words." = 8 words
      expect(result[0].metrics.wordCount).toBeGreaterThan(0);
      expect(result[0].metrics.wordCount).toBe(8);

      // Section: "More words here." = 3 words
      expect(result[1].metrics.wordCount).toBe(3);
    });

    it('should compute codeBlockCount correctly', () => {
      const markdown = `# Title

Code 1:

\`\`\`js
console.log('1');
\`\`\`

Code 2:

\`\`\`js
console.log('2');
\`\`\`

Code 3:

\`\`\`js
console.log('3');
\`\`\`
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result[0].metrics.codeBlockCount).toBe(3);
    });

    it('should compute linkCount correctly', () => {
      const markdown = `# Title

Check out [this link](https://example.com) and [another](https://test.com).

[Third link](https://third.com).
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result[0].metrics.linkCount).toBe(3);
    });

    it('should compute depth correctly', () => {
      const markdown = `# H1

Content.

## H2

Content.

### H3

Content.
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result[0].metrics.depth).toBe(0);
      expect(result[1].metrics.depth).toBe(1);
      expect(result[2].metrics.depth).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty document', () => {
      const markdown = ``;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result).toHaveLength(0);
    });

    it('should handle document with no headings', () => {
      const markdown = `Just some content.

No headings here.

Just plain text.
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      // Should create a preamble section
      expect(result).toHaveLength(1);
      expect(result[0].heading).toBe('');
      expect(result[0].level).toBe(0);
      expect(result[0].content).toContain('Just some content.');
    });

    it('should handle malformed markdown gracefully', () => {
      const markdown = `# Title

 malformed **markdown

with [broken links

and \`\`\` unclosed code blocks

## Still Works

Content.
`;

      const parser = new DocParser();

      // Should not throw
      expect(() => parser.parse(markdown, 'test.md')).not.toThrow();

      const result = parser.parse(markdown, 'test.md');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle content before first heading as preamble', () => {
      const markdown = `This is preamble content.

It comes before any heading.

# Actual Title

Real content starts here.
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result).toHaveLength(2);

      // Preamble section
      expect(result[0].heading).toBe('');
      expect(result[0].level).toBe(0);
      expect(result[0].content).toContain('This is preamble content.');
      expect(result[0].hierarchy.parent).toBeNull();

      // Actual title section
      expect(result[1].heading).toBe('Actual Title');
      expect(result[1].level).toBe(1);
      expect(result[1].content).toContain('Real content starts here.');
    });

    it('should build hierarchy paths correctly', () => {
      const markdown = `# Root

## Child 1

### Grandchild 1.1

## Child 2

### Grandchild 2.1
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result).toHaveLength(5);

      // Root: empty path
      expect(result[0].hierarchy.path).toEqual([]);

      // Child 1: path to root
      expect(result[1].hierarchy.path).toEqual([result[0].id]);

      // Grandchild 1.1: path through child 1
      expect(result[2].hierarchy.path).toEqual([result[0].id, result[1].id]);

      // Child 2: path to root
      expect(result[3].hierarchy.path).toEqual([result[0].id]);

      // Grandchild 2.1: path through child 2
      expect(result[4].hierarchy.path).toEqual([result[0].id, result[3].id]);
    });

    it('should track children correctly', () => {
      const markdown = `# Root

## Child 1

## Child 2

### Grandchild 2.1
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result).toHaveLength(4);

      // Root should have 2 children
      expect(result[0].hierarchy.children).toHaveLength(2);
      expect(result[0].hierarchy.children).toContain(result[1].id);
      expect(result[0].hierarchy.children).toContain(result[2].id);

      // Child 1 should have no children
      expect(result[1].hierarchy.children).toHaveLength(0);

      // Child 2 should have 1 child
      expect(result[2].hierarchy.children).toHaveLength(1);
      expect(result[2].hierarchy.children).toContain(result[3].id);

      // Grandchild should have no children
      expect(result[3].hierarchy.children).toHaveLength(0);
    });
  });

  describe('token structure', () => {
    it('should create tokens with required base properties', () => {
      const markdown = `# Test

Content.
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      const token = result[0];
      expect(token.id).not.toBeNull();
      expect(token.type).toBe('doc');
      expect(token.domain).toBe('documentation');
      expect(token.layer).toBe('content');
      expect(token.metadata).toEqual({});
      expect(token.tags).toEqual([]);

      expect(token.location?.file).toBe('test.md');
    });

    it('should generate unique IDs for each section', () => {
      const markdown = `# Section 1

Content.

# Section 2

Content.

# Section 3

Content.
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      const ids = result.map((t) => t.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3);
      expect(ids).toEqual(expect.arrayContaining(ids));
    });

    it('should set codeReferences to empty array', () => {
      const markdown = `# Test

Content.
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      expect(result[0].codeReferences).toEqual([]);
    });
  });

  describe('summary generation', () => {
    it('should generate summary from first sentence', () => {
      const markdown = `# Title

This is the first sentence. This is the second sentence.

More content.
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      // Summary should be first sentence
      expect(result[0].summary).toBe('This is the first sentence.');
    });

    it('should use heading as summary if no content', () => {
      const markdown = `# Title

## Subtitle
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      // Should use heading as fallback
      expect(result[0].summary).toBe('Title');
    });

    it('should handle content without sentence terminators', () => {
      const markdown = `# Title

Just some words without periods
`;

      const parser = new DocParser();
      const result = parser.parse(markdown, 'test.md');

      // Should use first line or part of content

      expect(result[0].summary?.length).toBeGreaterThan(0);
    });
  });
});
