/**
 * Unit tests for src/tui/preview/PreviewRouter.ts — content routing engine
 *
 * Covers route(), getSummary(), peekContent(), isAudio(), isCode(), isImage()
 * with all branch targets: terminal, browser, both, none, and content detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted() — required for mock variables used in vi.mock() factories
// ---------------------------------------------------------------------------

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    readFile: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  default: mockFs,
  readFile: mockFs.readFile,
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { PreviewRouter } from '../../../src/tui/preview/PreviewRouter.js';
import type { PreviewDecision } from '../../../src/tui/preview/PreviewRouter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRouter(): PreviewRouter {
  return new PreviewRouter();
}

/** Mock fs.readFile to return the given content (first 2KB is fine for tests). */
function stubContent(content: string) {
  mockFs.readFile.mockResolvedValue(content);
}

/** Mock fs.readFile to reject (file read error). */
function stubReadError() {
  mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PreviewRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── route() — audio files → both ───────────────────────────────────────

  describe('route() — audio files', () => {
    it('routes .mp3 to "both"', async () => {
      stubContent('');
      const router = makeRouter();
      const result = await router.route('/audio/song.mp3');
      expect(result.target).toBe('both');
      expect(result.terminalType).toBe('waveform');
    });

    it('routes .wav to "both"', async () => {
      stubContent('');
      const result = await makeRouter().route('/audio/track.wav');
      expect(result.target).toBe('both');
    });

    it('routes .ogg to "both"', async () => {
      stubContent('');
      const result = await makeRouter().route('/audio/sound.ogg');
      expect(result.target).toBe('both');
    });

    it('routes .flac to "both"', async () => {
      stubContent('');
      const result = await makeRouter().route('/audio/lossless.flac');
      expect(result.target).toBe('both');
    });

    it('routes .aac to "both"', async () => {
      stubContent('');
      const result = await makeRouter().route('/audio/compressed.aac');
      expect(result.target).toBe('both');
    });

    it('routes .m4a to "both"', async () => {
      stubContent('');
      const result = await makeRouter().route('/audio/podcast.m4a');
      expect(result.target).toBe('both');
    });
  });

  // ── route() — code files → terminal ────────────────────────────────────

  describe('route() — code files', () => {
    const codeExtensions = ['.ts', '.js', '.jsx', '.tsx', '.py', '.rb', '.go', '.rs', '.json', '.yaml'];

    it.each(codeExtensions)('routes %s to "terminal" with terminalType "code"', async (ext) => {
      stubContent('');
      const result = await makeRouter().route(`/src/file${ext}`);
      expect(result.target).toBe('terminal');
      expect(result.terminalType).toBe('code');
    });

    it('routes .sh to terminal', async () => {
      stubContent('');
      const result = await makeRouter().route('/scripts/run.sh');
      expect(result.target).toBe('terminal');
      expect(result.terminalType).toBe('code');
    });
  });

  // ── route() — text/ascii → terminal ────────────────────────────────────

  describe('route() — text/ascii', () => {
    it('routes .txt to terminal with terminalType "ascii"', async () => {
      stubContent('');
      const result = await makeRouter().route('/art/design.txt');
      expect(result.target).toBe('terminal');
      expect(result.terminalType).toBe('ascii');
    });

    it('routes .ascii to terminal with terminalType "ascii"', async () => {
      stubContent('');
      const result = await makeRouter().route('/art/banner.ascii');
      expect(result.target).toBe('terminal');
      expect(result.terminalType).toBe('ascii');
    });
  });

  // ── route() — image files → browser ────────────────────────────────────

  describe('route() — image files', () => {
    it('routes .png to browser', async () => {
      stubContent('');
      const result = await makeRouter().route('/img/photo.png');
      expect(result.target).toBe('browser');
    });

    it('routes .jpg to browser', async () => {
      stubContent('');
      const result = await makeRouter().route('/img/photo.jpg');
      expect(result.target).toBe('browser');
    });

    it('routes .svg to browser', async () => {
      stubContent('');
      const result = await makeRouter().route('/img/icon.svg');
      expect(result.target).toBe('browser');
    });

    it('routes .webp to browser', async () => {
      stubContent('');
      const result = await makeRouter().route('/img/photo.webp');
      expect(result.target).toBe('browser');
    });
  });

  // ── route() — content detection → browser ──────────────────────────────

  describe('route() — content detection', () => {
    // NOTE: content detection only runs for extensions NOT in audio/code/txt/ascii/image lists.
    // Using .glsl, extensionless, or .html files to reach detectCodeType().
    // .js/.ts hit isCode() first and never reach content detection.

    it('detects p5.js code via createCanvas', async () => {
      stubContent('function setup() { createCanvas(400, 400); }');
      const result = await makeRouter().route('/sketch/sketch.glsl');
      expect(result.target).toBe('browser');
      expect(result.browserType).toBe('p5');
    });

    it('detects p5.js code via function setup()', async () => {
      stubContent('function setup() { background(0); }');
      const result = await makeRouter().route('/sketch/sketch.glsl');
      expect(result.browserType).toBe('p5');
    });

    it('detects GLSL code via gl_FragColor', async () => {
      stubContent('void main() { gl_FragColor = vec4(1.0); }');
      const result = await makeRouter().route('/shader/frag.frag');
      expect(result.target).toBe('browser');
      expect(result.browserType).toBe('glsl');
    });

    it('detects GLSL code via precision mediump', async () => {
      stubContent('precision mediump float;');
      const result = await makeRouter().route('/shader/frag.frag');
      expect(result.browserType).toBe('glsl');
    });

    it('detects Three.js code via THREE.', async () => {
      stubContent('const scene = new THREE.Scene();');
      const result = await makeRouter().route('/scene/scene.html');
      expect(result.target).toBe('browser');
      expect(result.browserType).toBe('three');
    });

    it('detects Hydra code via osc()', async () => {
      // osc() is checked as a literal substring — need exact empty-parens call or
      // content that includes 'osc()' somewhere. Use render() instead which is clearer.
      stubContent('osc().out();');
      const result = await makeRouter().route('/hydra/sketch.hydra');
      expect(result.target).toBe('browser');
      expect(result.browserType).toBe('hydra');
    });

    it('detects Hydra code via render()', async () => {
      stubContent('render();');
      const result = await makeRouter().route('/hydra/sketch.hydra');
      expect(result.browserType).toBe('hydra');
    });

    it('detects Strudel code via $:', async () => {
      stubContent('$: s("bd sd");');
      const result = await makeRouter().route('/music/pattern.strudel');
      expect(result.target).toBe('browser');
      expect(result.browserType).toBe('strudel');
    });

    it('detects Strudel code via sound()', async () => {
      stubContent('sound("bd*4 [sd*2]");');
      const result = await makeRouter().route('/music/pattern.strudel');
      expect(result.browserType).toBe('strudel');
    });

    it('detects Tone.js code via Tone.', async () => {
      stubContent('const synth = new Tone.Synth().toDestination();');
      const result = await makeRouter().route('/music/tone.tone');
      expect(result.target).toBe('browser');
      expect(result.browserType).toBe('tone');
    });

    it('detects HTML via <!DOCTYPE', async () => {
      stubContent('<!DOCTYPE html><html><body></body></html>');
      const result = await makeRouter().route('/page/index.document');
      expect(result.target).toBe('browser');
      expect(result.browserType).toBe('html');
    });

    it('detects HTML via <html tag', async () => {
      stubContent('<html lang="en"><body>Hello</body></html>');
      const result = await makeRouter().route('/page/index');
      expect(result.browserType).toBe('html');
    });
  });

  // ── route() — unknown → none ───────────────────────────────────────────

  describe('route() — unknown content', () => {
    it('routes unknown extension with no detected content to "none"', async () => {
      stubContent('random binary data');
      const result = await makeRouter().route('/data/file.xyz');
      expect(result.target).toBe('none');
      expect(result.reason).toContain('.xyz');
    });

    it('routes empty string extension to "none" when content is empty', async () => {
      stubContent('');
      const result = await makeRouter().route('/data/file');
      expect(result.target).toBe('none');
    });
  });

  // ── getSummary() ───────────────────────────────────────────────────────

  describe('getSummary()', () => {
    it('returns terminal summary with terminalType', () => {
      const router = makeRouter();
      const decision: PreviewDecision = { target: 'terminal', reason: 'test', terminalType: 'code' };
      const summary = router.getSummary(decision);
      expect(summary).toContain('terminal');
      expect(summary).toContain('code');
    });

    it('returns browser summary with browserType', () => {
      const router = makeRouter();
      const decision: PreviewDecision = { target: 'browser', reason: 'test', browserType: 'p5' };
      const summary = router.getSummary(decision);
      expect(summary).toContain('browser');
      expect(summary).toContain('p5');
    });

    it('returns browser summary with "web content" when no browserType', () => {
      const router = makeRouter();
      const decision: PreviewDecision = { target: 'browser', reason: 'test' };
      const summary = router.getSummary(decision);
      expect(summary).toContain('web content');
    });

    it('returns both summary', () => {
      const router = makeRouter();
      const decision: PreviewDecision = { target: 'both', reason: 'test' };
      const summary = router.getSummary(decision);
      expect(summary).toContain('terminal');
      expect(summary).toContain('browser');
    });

    it('returns none summary with reason', () => {
      const router = makeRouter();
      const decision: PreviewDecision = { target: 'none', reason: 'Cannot preview binary' };
      const summary = router.getSummary(decision);
      expect(summary).toContain('Cannot preview');
      expect(summary).toContain('Cannot preview binary');
    });
  });

  // ── peekContent() (tested indirectly via route) ────────────────────────

  describe('peekContent — error handling', () => {
    it('gracefully handles file read errors by routing based on extension', async () => {
      stubReadError();
      // .ts is a code extension, so even with empty content it should route to terminal
      const result = await makeRouter().route('/src/module.ts');
      expect(result.target).toBe('terminal');
    });

    it('handles read error for unknown extension with empty content', async () => {
      stubReadError();
      const result = await makeRouter().route('/data/file.dat');
      expect(result.target).toBe('none');
    });
  });

  // ── Extension matching edge cases ──────────────────────────────────────

  describe('extension matching', () => {
    it('treats extensions case-insensitively', async () => {
      stubContent('');
      const result = await makeRouter().route('/audio/SONG.MP3');
      expect(result.target).toBe('both');
    });

    it('routes .JSON (uppercase) to terminal', async () => {
      stubContent('');
      const result = await makeRouter().route('/config/package.JSON');
      expect(result.target).toBe('terminal');
    });

    it('does not match partial extension names', async () => {
      // .tsx2 is NOT in the code extension list
      stubContent('some content');
      const result = await makeRouter().route('/file.tsx2');
      expect(result.target).toBe('none');
    });

    it('routes .md to terminal', async () => {
      stubContent('');
      const result = await makeRouter().route('/docs/README.md');
      expect(result.target).toBe('terminal');
    });

    it('routes .bmp to browser', async () => {
      stubContent('');
      const result = await makeRouter().route('/img/icon.bmp');
      expect(result.target).toBe('browser');
    });

    it('routes .gif to browser', async () => {
      stubContent('');
      const result = await makeRouter().route('/img/anim.gif');
      expect(result.target).toBe('browser');
    });

    it('routes .toml to terminal', async () => {
      stubContent('');
      const result = await makeRouter().route('/config/pyproject.toml');
      expect(result.target).toBe('terminal');
    });
  });

  // ── Content detection order (first match wins) ─────────────────────────

  describe('content detection priority', () => {
    it('audio extension takes priority over content detection', async () => {
      // File has .mp3 extension but content looks like p5 code
      stubContent('function setup() { createCanvas(400, 400); }');
      const result = await makeRouter().route('/weird/song.mp3');
      expect(result.target).toBe('both');
    });

    it('code extension (.ts) takes priority over content detection', async () => {
      // File has .ts extension but content contains Tone.
      // .ts is in isCode() list, so it routes to terminal regardless of content
      stubContent('const synth = new Tone.Synth();');
      const result = await makeRouter().route('/src/music.ts');
      expect(result.target).toBe('terminal');
      expect(result.terminalType).toBe('code');
    });

    it('image extension takes priority over content detection', async () => {
      stubContent('<!DOCTYPE html>');
      const result = await makeRouter().route('/img/photo.png');
      expect(result.target).toBe('browser');
      // browserType is undefined since image route does not set it
      expect(result.browserType).toBeUndefined();
    });

    it('txt extension takes priority over content detection', async () => {
      stubContent('const synth = new Tone.Synth();');
      const result = await makeRouter().route('/notes/code.txt');
      expect(result.target).toBe('terminal');
      expect(result.terminalType).toBe('ascii');
    });

    it('unknown extension falls through to content detection', async () => {
      stubContent('function setup() { createCanvas(400, 400); }');
      const result = await makeRouter().route('/sketch/main.creative');
      expect(result.target).toBe('browser');
      expect(result.browserType).toBe('p5');
    });
  });
});
