/**
 * DocParser - Remark-based markdown section hierarchy extraction
 *
 * Parses markdown documents using the unified/remark pipeline to extract
 * structured sections with heading hierarchy, content, and metrics.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, Heading, Paragraph, Code, Link, Text, Content } from 'mdast';
import type { LIRDocToken } from '../lir/types.js';

/**
 * Parsed section representation during processing
 */
interface ParsedSection {
  id: string;
  heading: string;
  level: number;
  content: string;
  parentId: string | null;
  children: string[];
  depth: number;
  location?: { startLine: number; endLine: number };
  metrics: {
    wordCount: number;
    codeBlockCount: number;
    linkCount: number;
    depth: number;
  };
}

/**
 * DocParser parses markdown documents into LIRDocToken sections
 */
export class DocParser {
  private counter = 0;

  /**
   * Parse markdown content into LIR documentation tokens
   *
   * @param markdown - The markdown content to parse
   * @param file - The file path for location tracking
   * @returns Array of LIRDocToken representing sections
   */
  parse(markdown: string, file: string): LIRDocToken[] {
    const tree = unified().use(remarkParse).parse(markdown);
    const sections = this.extractSections(tree);
    return this.buildTokens(sections, file);
  }

  /**
   * Extract sections from the markdown AST
   */
  private extractSections(tree: Root): ParsedSection[] {
    const sections: ParsedSection[] = [];
    const stack: Array<{ id: string; level: number }> = [];
    let currentSection: ParsedSection | null = null;
    let contentBuffer: string[] = [];
    let linkCount = 0;
    let codeBlockCount = 0;
    let hasSeenHeading = false;
    // Track cumulative newlines to assign accurate line numbers
    let cumNewlines = 0;

    const flushContent = () => {
      if (currentSection) {
        currentSection.content = contentBuffer.join('\n').trim();
        currentSection.metrics.linkCount = linkCount;
        currentSection.metrics.codeBlockCount = codeBlockCount;
        this.computeWordCount(currentSection);
        // endLine is the last line of content in this section
        if (currentSection.location) {
          currentSection.location.startLine = currentSection.location.startLine || 1;
          currentSection.location.endLine = cumNewlines;
        } else {
          currentSection.location = { startLine: 1, endLine: cumNewlines };
        }
        sections.push(currentSection);
        contentBuffer = [];
        linkCount = 0;
        codeBlockCount = 0;
        currentSection = null;
      }
    };

    const startSection = (heading: string, level: number) => {
      // If this is the first heading and we have content buffered, create preamble first
      if (!hasSeenHeading && contentBuffer.length > 0) {
        const preambleId = this.generateId();
        const preambleSection: ParsedSection = {
          id: preambleId,
          heading: '',
          level: 0,
          content: '',
          parentId: null,
          children: [],
          depth: 0,
          metrics: {
            wordCount: 0,
            codeBlockCount: codeBlockCount,
            linkCount: linkCount,
            depth: 0,
          },
          location: { startLine: 1, endLine: cumNewlines },
        };

        // Set content and compute metrics
        currentSection = preambleSection;
        flushContent();
        // Reset for the actual heading section
        contentBuffer = [];
        linkCount = 0;
        codeBlockCount = 0;
      }

      hasSeenHeading = true;
      flushContent();

      // The heading line is the current cumulative newline count (before heading text is counted)
      const headingLine = cumNewlines + 1;

      // Pop stack to find parent
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parentId = stack.length > 0 ? stack[stack.length - 1].id : null;
      const depth = stack.length;
      const id = this.generateId();

      currentSection = {
        id,
        heading,
        level,
        content: '',
        parentId,
        children: [],
        depth,
        metrics: {
          wordCount: 0,
          codeBlockCount: 0,
          linkCount: 0,
          depth,
        },
        location: { startLine: headingLine, endLine: cumNewlines },
      };

      stack.push({ id, level });
    };

    const addContent = (text: string) => {
      contentBuffer.push(text);
      cumNewlines += (text.match(/\n/g) || []).length;
    };
    // Walk the tree
    const visit = (node: Root | Content) => {
      if (node.type === 'heading') {
        const heading = node as Heading;
        const text = this.extractText(heading);
        startSection(text, heading.depth);
      } else if (node.type === 'code') {
        const code = node as Code;
        const codeBlock = '```' + (code.lang || '') + '\n' + code.value + '\n```';
        addContent(codeBlock);
        codeBlockCount++;
      } else if (node.type === 'paragraph') {
        const paragraph = node as Paragraph;
        let paragraphText = '';

        for (const child of paragraph.children) {
          if (child.type === 'link') {
            const link = child as Link;
            const linkText = this.extractText(link);
            const markdownLink = `[${linkText}](${link.url})`;
            paragraphText += markdownLink;
            linkCount++;
          } else if (child.type === 'text') {
            paragraphText += (child as Text).value;
          } else {
            paragraphText += this.extractText(child);
          }
        }

        addContent(paragraphText);
        // Don't visit children of paragraph - we already processed them
        return;
      } else if (node.type === 'link') {
        // Standalone links (not in paragraph)
        const link = node as Link;
        const linkText = this.extractText(link);
        const markdownLink = `[${linkText}](${link.url})`;
        addContent(markdownLink);
        linkCount++;
        // Don't visit children of link - we already processed it
        return;
      } else if (node.type === 'list') {
        // Handle lists
        const listText = this.extractText(node);
        addContent(listText);
        // Don't visit children of list - we already processed them
        return;
      } else if (node.type === 'blockquote') {
        // Handle blockquotes
        const quoteText = this.extractText(node);
        addContent('> ' + quoteText);
        // Don't visit children of blockquote - we already processed them
        return;
      }

      // Visit children
      if ('children' in node && Array.isArray(node.children)) {
        for (const child of node.children) {
          visit(child);
        }
      }
    };

    visit(tree);

    // Flush any remaining content
    flushContent();

    // If we never saw a heading but have content, create a preamble section
    if (!hasSeenHeading && contentBuffer.length > 0) {
      sections.push({
        id: this.generateId(),
        heading: '',
        level: 0,
        content: contentBuffer.join('\n').trim(),
        parentId: null,
        children: [],
        depth: 0,
        metrics: {
          wordCount: 0,
          codeBlockCount: codeBlockCount,
          linkCount: linkCount,
          depth: 0,
        },
      });
    }

    // Build parent-child relationships
    this.buildHierarchy(sections);

    return sections;
  }

  /**
   * Extract plain text from a node
   */
  private extractText(node: Content): string {
    if (node.type === 'text') {
      return (node as Text).value;
    }

    if ('children' in node && Array.isArray(node.children)) {
      return node.children.map((child) => this.extractText(child)).join('');
    }

    return '';
  }

  /**
   * Compute word count for a section
   */
  private computeWordCount(section: ParsedSection): void {
    const content = section.content;
    const words = content.split(/\s+/).filter((w) => w.length > 0);
    section.metrics.wordCount = words.length;
  }

  /**
   * Build parent-child relationships between sections
   */
  private buildHierarchy(sections: ParsedSection[]): void {
    const sectionMap = new Map<string, ParsedSection>();

    for (const section of sections) {
      sectionMap.set(section.id, section);
    }

    for (const section of sections) {
      if (section.parentId) {
        const parent = sectionMap.get(section.parentId);
        if (parent) {
          parent.children.push(section.id);
        }
      }
    }
  }

  /**
   * Build LIRDocToken from parsed sections
   */
  private buildTokens(sections: ParsedSection[], file: string): LIRDocToken[] {
    const sectionMap = new Map<string, ParsedSection>();
    for (const section of sections) {
      sectionMap.set(section.id, section);
    }

    return sections.map((section) => {
      // Build path from root to this section
      const path: string[] = [];
      let currentId: string | null = section.parentId;
      while (currentId) {
        path.unshift(currentId);
        const parent = sectionMap.get(currentId);
        currentId = parent?.parentId || null;
      }

      // Generate summary
      const summary = this.generateSummary(section);

      return {
        id: section.id,
        type: 'doc',
        domain: 'documentation',
        layer: 'content',
        metadata: {},
        tags: [],
        heading: section.heading,
        level: section.level,
        summary,
        content: section.content,
        hierarchy: {
          parent: section.parentId,
          children: section.children,
          path,
        },
        codeReferences: [],
        metrics: section.metrics,
        location: {
          file,
          startLine: section.location?.startLine ?? 1,
          endLine: section.location?.endLine ?? 1,
        },
      };
    });
  }

  /**
   * Generate summary from section content
   */
  private generateSummary(section: ParsedSection): string {
    const content = section.content.trim();

    if (!content) {
      return section.heading || '';
    }

    // Try to extract first sentence
    const firstSentenceMatch = content.match(/^[^.!?]+[.!?]/);
    if (firstSentenceMatch) {
      return firstSentenceMatch[0].trim();
    }

    // Fallback to first line
    const firstLine = content.split('\n')[0].trim();
    if (firstLine) {
      return firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine;
    }

    return section.heading || '';
  }

  /**
   * Generate unique ID for sections
   */
  private generateId(): string {
    return `doc-${Date.now()}-${this.counter++}`;
  }
}
