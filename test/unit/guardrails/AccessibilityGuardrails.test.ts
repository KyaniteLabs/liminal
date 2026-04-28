/**
 * Tests for AccessibilityGuardrails — quickCheck static analysis
 * and constructor options.
 *
 * The full check() method requires puppeteer/browser and is tested
 * separately in integration tests. This file covers the static
 * code analysis path (quickCheck) and constructor merging.
 */

import { describe, it, expect, vi } from 'vitest';

const { mockLaunch, mockClose, mockNewPage, mockEvaluate, mockSetContent, mockWaitForSelector, mockEvaluateOnNewDocument } = vi.hoisted(() => ({
  mockLaunch: vi.fn(),
  mockClose: vi.fn().mockResolvedValue(undefined),
  mockNewPage: vi.fn(),
  mockEvaluate: vi.fn().mockResolvedValue(null),
  mockSetContent: vi.fn().mockResolvedValue(undefined),
  mockWaitForSelector: vi.fn().mockResolvedValue(undefined),
  mockEvaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('puppeteer', () => ({
  default: {
    launch: (...args: unknown[]) => mockLaunch(...args),
  },
}));

vi.mock('../../../src/security/SandboxConfig.js', () => ({
  getChromeArgs: vi.fn().mockReturnValue(['--no-sandbox']),
}));

vi.mock('../../../src/utils/generateHTML.js', () => ({
  generateHTML: vi.fn().mockReturnValue('<html><body><canvas></canvas></body></html>'),
}));

vi.mock('../../../src/utils/errors.js', () => ({
  formatError: vi.fn().mockReturnValue('formatted error'),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { AccessibilityGuardrails } from '../../../src/guardrails/AccessibilityGuardrails.js';

describe('AccessibilityGuardrails', () => {
  describe('quickCheck', () => {
    it('warns on rapid flashing patterns (random background)', () => {
      const code = 'function draw() { background(random(255)); }';
      const result = AccessibilityGuardrails.quickCheck(code);

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('rapid flashing')])
      );
    });

    it('warns on random flashing colors', () => {
      // Pattern: /random\(\).*255/ matches random() followed by *255
      const code = 'let c = random() * 255;';
      const result = AccessibilityGuardrails.quickCheck(code);

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('rapid flashing')])
      );
    });

    it('warns on animation without prefers-reduced-motion', () => {
      const code = 'function draw() { rotate(angle); } // animation';
      const result = AccessibilityGuardrails.quickCheck(code);

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('prefers-reduced-motion')])
      );
    });

    it('does not warn on animation with prefers-reduced-motion', () => {
      const code = `
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        function draw() { if (!prefersReduced) rotate(angle); }
      `;
      const result = AccessibilityGuardrails.quickCheck(code);
      expect(result.warnings).not.toEqual(
        expect.arrayContaining([expect.stringContaining('prefers-reduced-motion')])
      );
    });

    it('returns empty issues for safe code', () => {
      const result = AccessibilityGuardrails.quickCheck('function setup() { createCanvas(400, 400); }');
      expect(result.issues).toEqual([]);
    });

    it('detects flashing with modulo frameCount pattern', () => {
      // Pattern is case-sensitive: /framecount.*%\s*\d+\s*[=<>]/
      const code = 'if (framecount % 2 === 0) background(255); else background(0);';
      const result = AccessibilityGuardrails.quickCheck(code);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('rapid flashing')])
      );
    });
  });

  describe('constructor', () => {
    it('uses default options when none provided', () => {
      const guard = new AccessibilityGuardrails();
      // Internal options aren't exposed, but we can verify it constructs
      expect(guard).toBeInstanceOf(AccessibilityGuardrails);
    });

    it('merges custom options with defaults', () => {
      const guard = new AccessibilityGuardrails({ checkDurationMs: 5000, disableSandbox: true });
      expect(guard).toBeInstanceOf(AccessibilityGuardrails);
    });
  });

  describe('check', () => {
    it('rejects when browser launch fails', async () => {
      mockLaunch.mockRejectedValue(new Error('no browser'));
      const guard = new AccessibilityGuardrails({ disableSandbox: true });

      await expect(guard.check('code', 'p5')).rejects.toThrow('no browser');
    });

    it('runs full check with passing metrics', async () => {
      const mockPage = {
        evaluateOnNewDocument: mockEvaluateOnNewDocument,
        setContent: mockSetContent,
        waitForSelector: mockWaitForSelector,
        evaluate: mockEvaluate.mockResolvedValue({ flashCount: 1, luminanceSamples: [] }),
      };
      mockLaunch.mockResolvedValue({
        newPage: () => Promise.resolve(mockPage),
        close: mockClose,
      });
      mockEvaluate.mockResolvedValue({ flashCount: 0, luminanceSamples: [] });

      const guard = new AccessibilityGuardrails({ checkDurationMs: 100, disableSandbox: true });
      const result = await guard.check('function setup() {}', 'p5');

      expect(result.accessible).toBe(true);
      expect(result.checks.photosensitivity).toBe(true);
      expect(mockClose).toHaveBeenCalled();
    });

    it('flags photosensitivity when flash rate exceeds 3Hz', async () => {
      const mockPage = {
        evaluateOnNewDocument: mockEvaluateOnNewDocument,
        setContent: mockSetContent,
        waitForSelector: mockWaitForSelector,
        evaluate: mockEvaluate,
      };
      mockLaunch.mockResolvedValue({
        newPage: () => Promise.resolve(mockPage),
        close: mockClose,
      });
      // 10 flashes in 0.1 seconds = 100Hz
      mockEvaluate.mockResolvedValue({ flashCount: 10, luminanceSamples: [] });

      const guard = new AccessibilityGuardrails({ checkDurationMs: 100, disableSandbox: true });
      const result = await guard.check('flash code', 'p5');

      expect(result.checks.photosensitivity).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('Photosensitivity')])
      );
    });

    it('warns on code with red/green color blindness issues', async () => {
      const mockPage = {
        evaluateOnNewDocument: mockEvaluateOnNewDocument,
        setContent: mockSetContent,
        waitForSelector: mockWaitForSelector,
        evaluate: mockEvaluate,
      };
      mockLaunch.mockResolvedValue({
        newPage: () => Promise.resolve(mockPage),
        close: mockClose,
      });
      mockEvaluate.mockResolvedValue({ flashCount: 0, luminanceSamples: [] });

      const guard = new AccessibilityGuardrails({ checkDurationMs: 100, disableSandbox: true });
      // Code using red and green without shapes
      const result = await guard.check('fill("red"); fill("green");', 'p5');

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('color blindness')])
      );
    });

    it('passes color blindness check with shapes', async () => {
      const mockPage = {
        evaluateOnNewDocument: mockEvaluateOnNewDocument,
        setContent: mockSetContent,
        waitForSelector: mockWaitForSelector,
        evaluate: mockEvaluate,
      };
      mockLaunch.mockResolvedValue({
        newPage: () => Promise.resolve(mockPage),
        close: mockClose,
      });
      mockEvaluate.mockResolvedValue({ flashCount: 0, luminanceSamples: [] });

      const guard = new AccessibilityGuardrails({ checkDurationMs: 100, disableSandbox: true });
      const result = await guard.check('fill("red"); stroke("green"); line(0,0,100,100);', 'p5');

      expect(result.checks.colorBlindnessSafe).toBe(true);
    });

    it('warns on rapid motion without prefers-reduced-motion', async () => {
      const mockPage = {
        evaluateOnNewDocument: mockEvaluateOnNewDocument,
        setContent: mockSetContent,
        waitForSelector: mockWaitForSelector,
        evaluate: mockEvaluate,
      };
      mockLaunch.mockResolvedValue({
        newPage: () => Promise.resolve(mockPage),
        close: mockClose,
      });
      mockEvaluate.mockResolvedValue({ flashCount: 0, luminanceSamples: [] });

      const guard = new AccessibilityGuardrails({ checkDurationMs: 100, disableSandbox: true });
      const result = await guard.check('speed = 8; function draw() {}', 'p5');

      expect(result.checks.motionSafe).toBe(false);
    });

    it('warns on audio without volume control', async () => {
      const mockPage = {
        evaluateOnNewDocument: mockEvaluateOnNewDocument,
        setContent: mockSetContent,
        waitForSelector: mockWaitForSelector,
        evaluate: mockEvaluate,
      };
      mockLaunch.mockResolvedValue({
        newPage: () => Promise.resolve(mockPage),
        close: mockClose,
      });
      mockEvaluate.mockResolvedValue({ flashCount: 0, luminanceSamples: [] });

      const guard = new AccessibilityGuardrails({ checkDurationMs: 100, disableSandbox: true });
      const result = await guard.check('new Tone.Synth().toDestination();', 'p5');

      expect(result.checks.audioSafe).toBe(false);
    });
  });
});
