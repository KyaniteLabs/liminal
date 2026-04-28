/**
 * Tests for ChatCLI preview rendering
 * Phase 2: Chat Integration - Live Preview Rendering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatCLI } from '../../src/chat/ChatCLI.js';
import { ConversationManager } from '../../src/chat/ConversationManager.js';
import type { Domain } from '../../src/chat/types.js';

// Mock RalphLoop to avoid requiring LLM configuration in tests
vi.mock('../../src/core/RalphLoop.js', () => ({
  RalphLoop: {
    run: vi.fn().mockResolvedValue({
      code: '// mock code',
      iterations: 1,
      completed: true,
      reason: 'test',
      timestamp: new Date().toISOString(),
      duration: 100,
      finalScore: 0.7
    })
  }
}));

describe('ChatCLI - Preview Rendering', () => {
  let cli: ChatCLI;
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
    cli = new ChatCLI(manager);
  });

  describe('renderPreview', () => {
    it('should update preview state when called', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      const domain: Domain = 'p5';

      cli.renderPreview(code, domain);

      expect(cli.getPreviewState()).not.toBeNull();
      expect(cli.getPreviewState()?.code).toBe(code);
      expect(cli.getPreviewState()?.domain).toBe(domain);
    });

    it('should handle p5.js sketches', () => {
      const p5Code = `
        function setup() {
          createCanvas(400, 400);
          background(220);
        }
        function draw() {
          ellipse(200, 200, 50);
        }
      `;

      cli.renderPreview(p5Code, 'p5');

      expect(cli.getPreviewState()?.code).toContain('createCanvas');
      expect(cli.getPreviewState()?.domain).toBe('p5');
    });

    it('should handle GLSL shaders', () => {
      const shaderCode = `
        void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution;
          gl_FragColor = vec4(uv, 0.0, 1.0);
        }
      `;

      cli.renderPreview(shaderCode, 'shader');

      expect(cli.getPreviewState()?.code).toContain('void main');
      expect(cli.getPreviewState()?.domain).toBe('shader');
    });

    it('should handle Three.js scenes', () => {
      const threeCode = `
        import * as THREE from 'three';
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      `;

      cli.renderPreview(threeCode, 'three');

      expect(cli.getPreviewState()?.code).toContain('THREE');
      expect(cli.getPreviewState()?.domain).toBe('three');
    });

    it('should handle music code (Strudel)', () => {
      const strudelCode = `sound("bd sd").slow(2)`;

      cli.renderPreview(strudelCode, 'strudel');

      expect(cli.getPreviewState()?.code).toContain('sound');
      expect(cli.getPreviewState()?.domain).toBe('strudel');
    });

    it('should handle music code (Hydra)', () => {
      const hydraCode = `osc().out()`;

      cli.renderPreview(hydraCode, 'hydra');

      expect(cli.getPreviewState()?.code).toContain('osc');
      expect(cli.getPreviewState()?.domain).toBe('hydra');
    });

    it('should escape code for safe display', () => {
      // The escape function prevents script breakouts by escaping </script>
      // This prevents code from breaking out of script tags in the preview
      const codeWithScriptClose = 'const x = 1;</script><script>alert("xss")</script>';

      cli.renderPreview(codeWithScriptClose, 'p5');

      const displayedCode = cli.getPreviewState()?.code || '';
      // Should escape the closing script tag to prevent breakouts
      expect(displayedCode).toContain('<\\/script>');
      // Should NOT contain the unescaped version
      expect(displayedCode).not.toContain('</script>');
    });

    it('should update timestamp on each render', async () => {
      const code = 'function setup() {}';

      cli.renderPreview(code, 'p5');
      const firstTimestamp = cli.getPreviewState()?.timestamp;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      cli.renderPreview(code + ' // updated', 'p5');
      const secondTimestamp = cli.getPreviewState()?.timestamp;

      expect(secondTimestamp?.getTime()).toBeGreaterThan(firstTimestamp?.getTime() || 0);
    });
  });

  describe('preview update on iteration', () => {
    it('should update preview with iteration number', () => {
      const testCode = 'function test() {}';
      const testDomain: Domain = 'p5';
      const testIteration = 5;

      cli.renderPreview(testCode, testDomain, testIteration);

      expect(cli.getPreviewState()?.code).toContain('test');
      expect(cli.getCurrentIteration()).toBe(testIteration);
    });

    it('should display iteration number in preview', () => {
      cli.renderPreview('function iter5() {}', 'p5', 5);

      expect(cli.getCurrentIteration()).toBe(5);
    });

    it('should display iteration score in preview', () => {
      const testScore = 0.85;

      cli.renderPreview('function scored() {}', 'p5', 1, testScore);

      expect(cli.getCurrentScore()).toBe(testScore);
    });

    it('should update both iteration and score together', () => {
      const testIteration = 10;
      const testScore = 0.92;

      cli.renderPreview('function final() {}', 'shader', testIteration, testScore);

      expect(cli.getCurrentIteration()).toBe(testIteration);
      expect(cli.getCurrentScore()).toBe(testScore);
    });
  });

  describe('preview state management', () => {
    it('should return null for preview state before any render', () => {
      expect(cli.getPreviewState()).toBeNull();
    });

    it('should maintain preview state across multiple renders', () => {
      cli.renderPreview('code1', 'p5');
      const state1 = cli.getPreviewState();

      cli.renderPreview('code2', 'shader');
      const state2 = cli.getPreviewState();

      expect(state1?.code).toBe('code1');
      expect(state2?.code).toBe('code2');
      expect(state1?.domain).toBe('p5');
      expect(state2?.domain).toBe('shader');
    });

    it('should provide preview URL for different domains', () => {
      cli.renderPreview('p5 code', 'p5');
      expect(cli.getPreviewUrl()).toContain('preview');

      cli.renderPreview('shader code', 'shader');
      expect(cli.getPreviewUrl()).toContain('preview');
    });
  });
});
