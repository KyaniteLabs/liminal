/**
 * Security tests for HTMLAdapter
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HTMLAdapter } from '../../../../src/composition/adapters/HTMLAdapter.js';
import type { Layer } from '../../../../src/composition/types.js';

describe('HTMLAdapter Security', () => {
  let adapter: HTMLAdapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    adapter = new HTMLAdapter();

    mockLayer = {
      id: 'test-html-layer',
      type: 'html',
      code: '<div class="test">Hello World</div>',
      config: {
        zIndex: 1,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt: 'Test html layer',
        generator: 'HTMLGenerator',
        model: 'test-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };

    mockContainer = document.createElement('div');

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('XSS Prevention', () => {
    it('should remove script tags from HTML', () => {
      const maliciousLayer = {
        ...mockLayer,
        code: '<div>Hello</div><script>alert("hacked")</script><div>World</div>',
      };

      const instance = adapter.render(maliciousLayer, mockContainer);

      // Script content should be removed
      expect(instance.container.innerHTML).not.toContain('<script');
      expect(instance.container.innerHTML).not.toContain('alert');
      // Safe content should remain
      expect(instance.container.innerHTML).toContain('Hello');
      expect(instance.container.innerHTML).toContain('World');
    });

    it('should block javascript: protocol in href attributes', () => {
      const maliciousLayer = {
        ...mockLayer,
        code: '<a href="javascript:alert(1)">Click me</a>',
      };

      const instance = adapter.render(maliciousLayer, mockContainer);
      const link = instance.container.querySelector('a');

      // Link should either not exist, not have href, or have sanitized href
      if (link) {
        const href = link.getAttribute('href');
        if (href !== null) {
          expect(href).not.toMatch(/^javascript:/i);
        }
      }
    });

    it('should block on* event handlers', () => {
      const maliciousLayer = {
        ...mockLayer,
        code: '<div onclick="alert(1)" onload="steal()">Content</div>',
      };

      const instance = adapter.render(maliciousLayer, mockContainer);
      const div = instance.container.querySelector('div');

      // Event handlers should be removed
      expect(div?.getAttribute('onclick')).toBeNull();
      expect(div?.getAttribute('onload')).toBeNull();
    });

    it('should block data: URLs that could execute JavaScript', () => {
      const maliciousLayer = {
        ...mockLayer,
        code: '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>',
      };

      const instance = adapter.render(maliciousLayer, mockContainer);

      // iframe with dangerous src should be removed or sanitized
      const iframe = instance.container.querySelector('iframe');
      if (iframe) {
        expect(iframe.getAttribute('src')).not.toMatch(/^data:/i);
      }
    });

    it('should block SVG-based XSS attacks', () => {
      const maliciousLayer = {
        ...mockLayer,
        code: '<svg><script>alert(1)</script></svg>',
      };

      const instance = adapter.render(maliciousLayer, mockContainer);

      // SVG script should be removed
      expect(instance.container.innerHTML).not.toContain('<script');
    });

    it('should block image-based XSS via onerror', () => {
      const maliciousLayer = {
        ...mockLayer,
        code: '<img src="x" onerror="alert(1)">',
      };

      const instance = adapter.render(maliciousLayer, mockContainer);
      const img = instance.container.querySelector('img');

      // onerror handler should be removed
      expect(img?.getAttribute('onerror')).toBeNull();
    });

    it('should allow safe HTML content', () => {
      const safeLayer = {
        ...mockLayer,
        code: '<div class="container"><h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p></div>',
      };

      const instance = adapter.render(safeLayer, mockContainer);

      // Safe content should be preserved
      expect(instance.container.innerHTML).toContain('Title');
      expect(instance.container.innerHTML).toContain('bold');
      expect(instance.container.querySelector('h1')).not.toBeNull();
      expect(instance.container.querySelector('strong')).not.toBeNull();
    });

    it('should allow safe links with http/https protocols', () => {
      const safeLayer = {
        ...mockLayer,
        code: '<a href="https://example.com" class="link">Safe link</a>',
      };

      const instance = adapter.render(safeLayer, mockContainer);
      const link = instance.container.querySelector('a');

      // Safe URL should be preserved
      expect(link?.getAttribute('href')).toBe('https://example.com');
      expect(link?.textContent).toBe('Safe link');
    });

    it('should preserve safe data attributes', () => {
      const safeLayer = {
        ...mockLayer,
        code: '<div data-id="123" data-action="click">Content</div>',
      };

      const instance = adapter.render(safeLayer, mockContainer);
      const div = instance.container.querySelector('div');

      // Data attributes should be preserved
      expect(div?.getAttribute('data-id')).toBe('123');
      expect(div?.getAttribute('data-action')).toBe('click');
    });

    it('should block object and embed tags', () => {
      const maliciousLayer = {
        ...mockLayer,
        code: '<object data="malicious.swf"></object><embed src="malicious.swf">',
      };

      const instance = adapter.render(maliciousLayer, mockContainer);

      // Object and embed tags should be removed
      expect(instance.container.querySelector('object')).toBeNull();
      expect(instance.container.querySelector('embed')).toBeNull();
    });

    it('should block form actions with javascript:', () => {
      const maliciousLayer = {
        ...mockLayer,
        code: '<form action="javascript:alert(1)"><input type="submit"></form>',
      };

      const instance = adapter.render(maliciousLayer, mockContainer);
      const form = instance.container.querySelector('form');

      // javascript: action should be removed or sanitized
      if (form?.getAttribute('action')) {
        expect(form.getAttribute('action')).not.toMatch(/^javascript:/i);
      }
    });
  });

  describe('Validation Security', () => {
    it('should reject HTML with script tags during validation', () => {
      const maliciousLayer = {
        ...mockLayer,
        code: '<script>alert(1)</script>',
      };

      const result = adapter.validate(maliciousLayer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('script tags are not allowed for security');
    });

    it('should pass validation for safe HTML', () => {
      const safeLayer = {
        ...mockLayer,
        code: '<div class="safe"><p>Content</p></div>',
      };

      const result = adapter.validate(safeLayer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });
});
