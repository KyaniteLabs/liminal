import { describe, expect, it, vi } from 'vitest';
import {
  DOMAIN_GAUNTLET_DOMAINS,
  buildDomainReceipt,
  buildMarkdownTable,
  handleLocalBrowserAssetFallbackRequest,
  selectDomains,
} from '../gauntlet.mjs';

describe('domain gauntlet pass/fail logic', () => {
  it('passes only when generate, validate, and render-or-receipt stages pass', () => {
    const receipt = buildDomainReceipt({
      domain: 'p5',
      prompt: 'Target creative domain: p5. Never-used test prompt.',
      generated: { ok: true, codeBytes: 120 },
      validation: { ok: true, cleanedBytes: 118, errors: [] },
      render: { ok: true, mode: 'png', artifact: '.quality/gauntlet/p5.png', errors: [] },
      startedAt: '2026-06-08T00:00:00.000Z',
      finishedAt: '2026-06-08T00:00:01.000Z',
    });

    expect(receipt.status).toBe('PASS');
    expect(receipt.failureReason).toBe('');
  });

  it('fails with the generation reason before later stage reasons', () => {
    const receipt = buildDomainReceipt({
      domain: 'three',
      prompt: 'Target creative domain: three. Never-used test prompt.',
      generated: { ok: false, codeBytes: 0, error: 'provider unavailable' },
      validation: { ok: false, cleanedBytes: 0, errors: ['No code provided'] },
      render: { ok: false, mode: 'png', errors: ['no html'] },
      startedAt: '2026-06-08T00:00:00.000Z',
      finishedAt: '2026-06-08T00:00:01.000Z',
    });

    expect(receipt.status).toBe('FAIL');
    expect(receipt.failureReason).toBe('generate: provider unavailable');
  });

  it('fails with validator errors when generation succeeded but validation failed', () => {
    const receipt = buildDomainReceipt({
      domain: 'glsl',
      prompt: 'Target creative domain: glsl. Never-used test prompt.',
      generated: { ok: true, codeBytes: 80 },
      validation: { ok: false, cleanedBytes: 80, errors: ['shader is missing void main'] },
      render: { ok: false, mode: 'png', errors: ['validation failed'] },
      startedAt: '2026-06-08T00:00:00.000Z',
      finishedAt: '2026-06-08T00:00:01.000Z',
    });

    expect(receipt.status).toBe('FAIL');
    expect(receipt.failureReason).toBe('validate: shader is missing void main');
  });

  it('renders markdown rows with explicit PASS and FAIL cells', () => {
    const pass = buildDomainReceipt({
      domain: 'ascii',
      prompt: 'Target creative domain: ascii. Never-used test prompt.',
      generated: { ok: true, codeBytes: 90 },
      validation: { ok: true, cleanedBytes: 90, errors: [] },
      render: { ok: true, mode: 'receipt', artifact: '.quality/gauntlet/ascii.json', errors: [] },
      startedAt: '2026-06-08T00:00:00.000Z',
      finishedAt: '2026-06-08T00:00:00.001Z',
    });
    const fail = buildDomainReceipt({
      domain: 'tone',
      prompt: 'Target creative domain: tone. Never-used test prompt.',
      generated: { ok: true, codeBytes: 180 },
      validation: { ok: true, cleanedBytes: 180, errors: [] },
      render: { ok: false, mode: 'receipt', errors: ['missing Tone.start'] },
      startedAt: '2026-06-08T00:00:00.000Z',
      finishedAt: '2026-06-08T00:00:00.001Z',
    });

    const table = buildMarkdownTable([pass, fail]);

    expect(table).toContain('| ascii | PASS | PASS | PASS | PASS |  |');
    expect(table).toContain('| tone | PASS | PASS | FAIL | FAIL | render-or-receipt: missing Tone.start |');
  });

  it('adds a Ratchet column when a ratchet floor is supplied', () => {
    const gated = buildDomainReceipt({
      domain: 'p5',
      prompt: 'Target creative domain: p5. Never-used test prompt.',
      generated: { ok: true, codeBytes: 120 },
      validation: { ok: true, cleanedBytes: 118, errors: [] },
      render: { ok: true, mode: 'png', artifact: '.quality/gauntlet/p5.png', errors: [] },
      startedAt: '2026-06-08T00:00:00.000Z',
      finishedAt: '2026-06-08T00:00:00.001Z',
    });
    const advisory = buildDomainReceipt({
      domain: 'svg',
      prompt: 'Target creative domain: svg. Never-used test prompt.',
      generated: { ok: true, codeBytes: 200 },
      validation: { ok: true, cleanedBytes: 200, errors: [] },
      render: { ok: false, mode: 'png', errors: ['PNG is suspiciously small'] },
      startedAt: '2026-06-08T00:00:00.000Z',
      finishedAt: '2026-06-08T00:00:00.001Z',
    });

    const table = buildMarkdownTable([gated, advisory], ['p5']);

    expect(table).toContain('| Domain | Generate | Validate | Render/Receipt | Ratchet | Status | Failure reason |');
    expect(table).toContain('| p5 | PASS | PASS | PASS | GATED | PASS |  |');
    expect(table).toContain('| svg | PASS | PASS | FAIL | advisory | FAIL | render-or-receipt: PNG is suspiciously small |');
  });

  it('selects all finish-line domains or a single requested domain', () => {
    expect(selectDomains({ all: true }).map((domain) => domain.id)).toEqual(DOMAIN_GAUNTLET_DOMAINS.map((domain) => domain.id));
    expect(selectDomains({ domain: 'GLSL' }).map((domain) => domain.id)).toEqual(['glsl']);
  });

  it('fulfills p5 CDN requests from local assets in the direct gauntlet renderer', async () => {
    const request = {
      url: () => 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js',
      respond: vi.fn(async () => {}),
      continue: vi.fn(async () => {}),
    };

    await handleLocalBrowserAssetFallbackRequest(request);

    expect(request.respond).toHaveBeenCalledWith(expect.objectContaining({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: expect.stringContaining('p5.js'),
    }));
    expect(request.continue).not.toHaveBeenCalled();
  });

  it('continues non-p5 asset requests in the direct gauntlet renderer', async () => {
    const request = {
      url: () => 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js',
      respond: vi.fn(async () => {}),
      continue: vi.fn(async () => {}),
    };

    await handleLocalBrowserAssetFallbackRequest(request);

    expect(request.respond).not.toHaveBeenCalled();
    expect(request.continue).toHaveBeenCalledOnce();
  });
});
