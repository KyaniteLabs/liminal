import { describe, it, expect } from 'vitest';
import { sanitize } from '../../../src/core/validators/DOMSanitizer.js';

describe('DOMSanitizer', () => {
  describe('sanitize', () => {
    it('passes through safe HTML', () => {
      expect(sanitize('<span class="keyword">hello</span>')).toBe('<span class="keyword">hello</span>');
    });

    it('strips script tags', () => {
      const result = sanitize('<script>alert("xss")</script><p>safe</p>');
      expect(result).not.toContain('<script');
      expect(result).toContain('<p>safe</p>');
    });

    it('strips iframe tags', () => {
      const result = sanitize('<iframe src="evil.com"></iframe><p>ok</p>');
      expect(result).not.toContain('<iframe');
      expect(result).toContain('<p>ok</p>');
    });

    it('strips object tags', () => {
      expect(sanitize('<object data="evil.swf"></object>')).not.toContain('<object');
    });

    it('strips embed tags', () => {
      expect(sanitize('<embed src="evil.swf">')).not.toContain('<embed');
    });

    it('strips form tags', () => {
      expect(sanitize('<form action="evil.com"><input></form>')).not.toContain('<form');
    });

    it('strips event handler attributes', () => {
      const result = sanitize('<div onclick="alert(1)">click</div>');
      expect(result).not.toContain('onclick');
      expect(result).toContain('click');
    });

    it('strips javascript: URLs', () => {
      const result = sanitize('<a href="javascript:alert(1)">link</a>');
      expect(result).not.toContain('javascript:');
    });

    it('strips data:text/html URLs', () => {
      const result = sanitize('<a href="data:text/html,<script>alert(1)</script>">link</a>');
      expect(result).not.toContain('data:text/html');
    });

    it('allows safe button elements', () => {
      expect(sanitize('<button id="test-btn">Start</button>')).toBe('<button id="test-btn">Start</button>');
    });

    it('handles empty string', () => {
      expect(sanitize('')).toBe('');
    });

    it('handles plain text with no HTML', () => {
      expect(sanitize('Hello world')).toBe('Hello world');
    });
  });
});
