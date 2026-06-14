import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * F2 wiring: the network-isolated Puppeteer executor (runInSandbox) must be a
 * REAL, reachable executor on the live render path — gated by
 * LIMINAL_NETWORK_ISOLATED_RENDER, default OFF.
 *
 * These tests prove:
 *  - runInSandbox is invoked (and gates the Playwright render) when the flag is
 *    set AND the domain is p5,
 *  - runInSandbox is NOT invoked by default,
 *  - a sandbox rejection short-circuits to a candidateFailure without rendering.
 *
 * We mock at boundaries: runInSandbox (Puppeteer) and the renderer's own
 * render() (Playwright). Assertions check returned RenderEvidence outcomes.
 */

const { mockRunInSandbox } = vi.hoisted(() => ({
  mockRunInSandbox: vi.fn(),
}));

vi.mock('../../../src/sandbox/index.js', () => ({
  runInSandbox: mockRunInSandbox,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { HeadlessRenderer } from '../../../src/render/HeadlessRenderer.js';

const P5_CODE = `function setup(){ createCanvas(400,400); noLoop(); } function draw(){ ellipse(200,200,50,50); }`;

const PASSING_EVIDENCE = {
  timingMs: 5,
  infraUnavailable: false,
  candidateFailure: false,
  screenshotRef: 'screenshot',
  screenshot: { mimeType: 'image/png', dataBase64: 'AAAA', width: 400, height: 400 },
  logRef: undefined,
  audio: undefined,
};

describe('HeadlessRenderer network-isolated executor gate (F2)', () => {
  let renderer: HeadlessRenderer;
  let renderSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.LIMINAL_NETWORK_ISOLATED_RENDER;
    mockRunInSandbox.mockReset();
    renderer = new HeadlessRenderer();
    // Stub the Playwright render boundary so renderWithEvidence resolves to a
    // known passing evidence shape without launching a real browser.
    renderSpy = vi.spyOn(renderer, 'render').mockResolvedValue({
      success: true,
      screenshot: { buffer: Buffer.from('AAAA', 'base64'), width: 400, height: 400, success: true },
      logs: [],
      errors: [],
    } as never);
  });

  afterEach(() => {
    delete process.env.LIMINAL_NETWORK_ISOLATED_RENDER;
    renderSpy.mockRestore();
  });

  it('does NOT invoke runInSandbox by default (flag unset)', async () => {
    const evidence = await renderer.renderWithEvidence(P5_CODE, { domain: 'p5' });

    expect(mockRunInSandbox).toHaveBeenCalledTimes(0);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(evidence.candidateFailure).toBe(false);
    expect(evidence.screenshotRef).toBe('screenshot');
  });

  it('invokes runInSandbox before rendering when the flag is set and domain is p5', async () => {
    process.env.LIMINAL_NETWORK_ISOLATED_RENDER = 'true';
    mockRunInSandbox.mockResolvedValue({ completed: true });

    const evidence = await renderer.renderWithEvidence(P5_CODE, { domain: 'p5' });

    expect(mockRunInSandbox).toHaveBeenCalledTimes(1);
    expect(mockRunInSandbox).toHaveBeenCalledWith(P5_CODE, { timeoutMs: undefined });
    // Sandbox passed → normal render proceeds and evidence reflects it.
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(evidence.candidateFailure).toBe(false);
    expect(evidence.screenshotRef).toBe('screenshot');
  });

  it('short-circuits to candidateFailure and skips render when the sandbox rejects the code', async () => {
    process.env.LIMINAL_NETWORK_ISOLATED_RENDER = 'true';
    mockRunInSandbox.mockResolvedValue({
      completed: false,
      error: 'Sandbox timeout: execution exceeded 30000ms',
    });

    const evidence = await renderer.renderWithEvidence(P5_CODE, { domain: 'p5' });

    expect(mockRunInSandbox).toHaveBeenCalledTimes(1);
    // The Playwright render must NOT run when the isolated sandbox rejects.
    expect(renderSpy).toHaveBeenCalledTimes(0);
    expect(evidence.candidateFailure).toBe(true);
    expect(evidence.infraUnavailable).toBe(false);
    expect(evidence.screenshotRef).toBeUndefined();
  });

  it('does NOT invoke runInSandbox for non-p5 domains even when the flag is set', async () => {
    process.env.LIMINAL_NETWORK_ISOLATED_RENDER = 'true';
    mockRunInSandbox.mockResolvedValue({ completed: true });

    const evidence = await renderer.renderWithEvidence(P5_CODE, { domain: 'three' });

    expect(mockRunInSandbox).toHaveBeenCalledTimes(0);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(evidence.candidateFailure).toBe(false);
  });

  it('passes the render timeout through to runInSandbox as timeoutMs', async () => {
    process.env.LIMINAL_NETWORK_ISOLATED_RENDER = 'true';
    mockRunInSandbox.mockResolvedValue({ completed: true });

    await renderer.renderWithEvidence(P5_CODE, { domain: 'p5', timeout: 12000 });

    expect(mockRunInSandbox).toHaveBeenCalledWith(P5_CODE, { timeoutMs: 12000 });
  });
});

describe('SandboxConfig.isNetworkIsolatedRenderEnabled', () => {
  afterEach(() => {
    delete process.env.LIMINAL_NETWORK_ISOLATED_RENDER;
  });

  it('returns false when the env flag is unset', async () => {
    delete process.env.LIMINAL_NETWORK_ISOLATED_RENDER;
    const { isNetworkIsolatedRenderEnabled } = await import('../../../src/security/SandboxConfig.js');
    expect(isNetworkIsolatedRenderEnabled()).toBe(false);
  });

  it('returns true only for the exact string "true"', async () => {
    const { isNetworkIsolatedRenderEnabled } = await import('../../../src/security/SandboxConfig.js');
    process.env.LIMINAL_NETWORK_ISOLATED_RENDER = '1';
    expect(isNetworkIsolatedRenderEnabled()).toBe(false);
    process.env.LIMINAL_NETWORK_ISOLATED_RENDER = 'true';
    expect(isNetworkIsolatedRenderEnabled()).toBe(true);
  });
});
