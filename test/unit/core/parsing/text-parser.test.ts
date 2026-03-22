/**
 * Unit tests for TextParser
 *
 * Tests simple paragraph-splitting parser for unsupported file types.
 * This is the fallback when neither CodeParser nor DocParser applies.
 */

import { describe, it, expect } from 'vitest';
import { TextParser } from '../../../../src/core/parsing/TextParser.js';
import type { LIRTextToken } from '../../../../src/core/lir/types.js';

describe('TextParser', () => {
  describe('paragraph splitting', () => {
    it('should split content on double newlines into paragraphs', () => {
      const content = `First paragraph here.

Second paragraph here.

Third paragraph here.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toContain('First paragraph here.');
      expect(result[0].content).toContain('Second paragraph here.');
      expect(result[0].content).toContain('Third paragraph here.');
    });

    it('should trim whitespace from each paragraph', () => {
      const content = `  First paragraph with spaces.

  Second paragraph with tabs.

Third paragraph.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      const token = result[0];
      // Check that content is properly trimmed
      expect(token.content).not.toMatch(/^  /);
      expect(token.content).not.toMatch(/  $/m);
    });

    it('should filter out empty paragraphs', () => {
      const content = `First paragraph.


Third paragraph (skip empty one).`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].metrics.paragraphCount).toBe(2);
    });

    it('should handle single line content', () => {
      const content = `Just one line here.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Just one line here.');
      expect(result[0].metrics.paragraphCount).toBe(1);
    });
  });

  describe('metrics computation', () => {
    it('should compute wordCount correctly', () => {
      const content = `This is a test document.

It has several words in multiple paragraphs.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      // "This is a test document." = 5 words
      // "It has several words in multiple paragraphs." = 7 words
      // Total = 12 words
      expect(result[0].metrics.wordCount).toBe(12);
    });

    it('should compute paragraphCount correctly', () => {
      const content = `Paragraph one.

Paragraph two.

Paragraph three.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].metrics.paragraphCount).toBe(3);
    });

    it('should compute headingCount correctly', () => {
      const content = `# Heading 1

Some content.

## Heading 2

More content.

### Heading 3

Even more content.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].metrics.headingCount).toBe(3);
    });

    it('should handle content with no headings', () => {
      const content = `Just plain text.

No markdown headings here.

Just paragraphs.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].metrics.headingCount).toBe(0);
    });
  });

  describe('structure extraction', () => {
    it('should extract headings via regex pattern', () => {
      const content = `# Main Title

Some content.

## Subsection

More content.

### Deep Section

Deep content.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      const structure = result[0].structure;

      expect(structure.headings).toHaveLength(3);
      expect(structure.headings[0]).toEqual({
        level: 1,
        text: 'Main Title',
      });
      expect(structure.headings[1]).toEqual({
        level: 2,
        text: 'Subsection',
      });
      expect(structure.headings[2]).toEqual({
        level: 3,
        text: 'Deep Section',
      });
    });

    it('should extract code blocks from markdown-style fenced code', () => {
      const content = `Some text before.

\`\`\`javascript
function hello() {
  console.log('world');
}
\`\`\`

Some text after.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      const structure = result[0].structure;

      expect(structure.codeBlocks).toHaveLength(1);
      expect(structure.codeBlocks[0].language).toBe('javascript');
      expect(structure.codeBlocks[0].code).toContain('function hello()');
    });

    it('should handle multiple code blocks', () => {
      const content = `First code:

\`\`\`python
print('hello')
\`\`\`

Second code:

\`\`\`typescript
const x = 42;
\`\`\`

Third code:

\`\`\`bash
echo "test"
\`\`\`

`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      const structure = result[0].structure;

      expect(structure.codeBlocks).toHaveLength(3);
      expect(structure.codeBlocks[0].language).toBe('python');
      expect(structure.codeBlocks[1].language).toBe('typescript');
      expect(structure.codeBlocks[2].language).toBe('bash');
    });

    it('should handle content without structure', () => {
      const content = `Just plain text.

No special structure.

Just paragraphs.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      const structure = result[0].structure;

      expect(structure.headings).toEqual([]);
      expect(structure.codeBlocks).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty file', () => {
      const content = ``;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toBe('');
      expect(result[0].metrics.paragraphCount).toBe(0);
      expect(result[0].metrics.wordCount).toBe(0);
      expect(result[0].metrics.headingCount).toBe(0);
    });

    it('should handle whitespace-only content', () => {
      const content = `   \n\n   \n\n   `;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('');
      expect(result[0].metrics.paragraphCount).toBe(0);
    });

    it('should handle content with only headings', () => {
      const content = `# Heading 1

## Heading 2

### Heading 3`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].metrics.headingCount).toBe(3);
      expect(result[0].structure.headings).toHaveLength(3);
    });

    it('should handle irregular spacing', () => {
      const content = `Paragraph one.



Paragraph two (after triple newline).


Paragraph three.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].metrics.paragraphCount).toBe(3);
    });

    it('should handle mixed newline styles (CRLF and LF)', () => {
      const content = "Paragraph one.\r\n\r\nParagraph two.\n\nParagraph three.";

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      expect(result[0].metrics.paragraphCount).toBe(3);
    });
  });

  describe('token structure', () => {
    it('should create tokens with required base properties', () => {
      const content = `Test content.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      const token = result[0];
      expect(token.id).toBeDefined();
      expect(token.type).toBe('text');
      expect(token.domain).toBe('unstructured');
      expect(token.layer).toBe('content');
      expect(token.metadata).toEqual({});
      expect(token.tags).toEqual([]);
    });

    it('should generate unique IDs for each call', () => {
      const content = `Test content.`;

      const parser = new TextParser();
      const result1 = parser.parse(content, 'test.txt');
      const result2 = parser.parse(content, 'test.txt');

      expect(result1[0].id).not.toBe(result2[0].id);
    });

    it('should preserve full content in token', () => {
      const content = `First paragraph.

Second paragraph.

Third paragraph.`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result[0].content).toBe(content);
    });
  });

  describe('heading detection regex', () => {
    it('should detect H1 through H6 headings', () => {
      const content = `# H1

## H2

### H3

#### H4

##### H5

###### H6`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      const headings = result[0].structure.headings;

      expect(headings).toHaveLength(6);
      expect(headings[0].level).toBe(1);
      expect(headings[1].level).toBe(2);
      expect(headings[2].level).toBe(3);
      expect(headings[3].level).toBe(4);
      expect(headings[4].level).toBe(5);
      expect(headings[5].level).toBe(6);
    });

    it('should not detect non-heading lines starting with #', () => {
      const content = `This is #not a heading.

Neither is this# one.

# This IS a heading`;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      const headings = result[0].structure.headings;

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe('This IS a heading');
    });

    it('should handle headings with trailing spaces', () => {
      const content = `# Heading with spaces

## Another heading   `;

      const parser = new TextParser();
      const result = parser.parse(content, 'test.txt');

      expect(result).toHaveLength(1);
      const headings = result[0].structure.headings;

      expect(headings).toHaveLength(2);
      expect(headings[0].text).toBe('Heading with spaces');
      expect(headings[1].text).toBe('Another heading');
    });
  });
});
