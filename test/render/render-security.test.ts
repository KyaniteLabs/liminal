import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLaunch, mockNewContext } = vi.hoisted(() => {
  const mockLaunch = vi.fn();
  const mockNewContext = vi.fn();
  return { mockLaunch, mockNewContext };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: mockLaunch,
    executablePath: () => '/nonexistent/chromium', // forces resolveChromiumExecutable to scan (returns undefined)
  },
}));

import {
  HeadlessRenderer,
  isAllowedRenderRequestUrl,
} from '../../src/render/HeadlessRenderer.js';

describe('isAllowedRenderRequestUrl — deny-by-default egress guard', () => {
  it('allows the p5/three/hydra/tone CDN hosts referenced in the wrappers', () => {
    expect(isAllowedRenderRequestUrl('https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js')).toBe(true);
    expect(isAllowedRenderRequestUrl('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js')).toBe(true);
    expect(isAllowedRenderRequestUrl('https://unpkg.com/hydra-synth')).toBe(true);
    expect(isAllowedRenderRequestUrl('https://raw.githubusercontent.com/foo/bar/baz.json')).toBe(true);
    expect(isAllowedRenderRequestUrl('https://puenteworks.com/ph/capture')).toBe(true);
  });

  it('aborts requests to off-allowlist hosts (exfiltration / callout)', () => {
    expect(isAllowedRenderRequestUrl('https://evil.example.com/steal?data=secret')).toBe(false);
    expect(isAllowedRenderRequestUrl('http://attacker.test/beacon')).toBe(false);
    expect(isAllowedRenderRequestUrl('https://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('does not allow lookalike subdomains of allowlisted hosts', () => {
    expect(isAllowedRenderRequestUrl('https://unpkg.com.evil.test/x.js')).toBe(false);
    expect(isAllowedRenderRequestUrl('https://puenteworks.com.attacker.test/ph')).toBe(false);
  });

  it('allows inert non-network schemes and loopback', () => {
    expect(isAllowedRenderRequestUrl('data:text/html,<p>hi</p>')).toBe(true);
    expect(isAllowedRenderRequestUrl('blob:null/abc-123')).toBe(true);
    expect(isAllowedRenderRequestUrl('about:blank')).toBe(true);
    expect(isAllowedRenderRequestUrl('http://localhost:3099/x')).toBe(true);
    expect(isAllowedRenderRequestUrl('http://127.0.0.1:8080/x')).toBe(true);
  });

  it('blocks unparseable / non-http(s) URLs', () => {
    expect(isAllowedRenderRequestUrl('not a url')).toBe(false);
    expect(isAllowedRenderRequestUrl('ftp://files.example.com/x')).toBe(false);
    expect(isAllowedRenderRequestUrl('')).toBe(false);
  });
});

describe('HeadlessRenderer route handler — deny-by-default', () => {
  function makeFakePage() {
    let routeHandler: ((route: FakeRoute) => Promise<void>) | undefined;
    return {
      page: {
        route: vi.fn(async (_pattern: string, handler: (route: FakeRoute) => Promise<void>) => {
          routeHandler = handler;
        }),
      },
      getHandler: () => routeHandler,
    };
  }

  interface FakeRoute {
    request: () => { url: () => string };
    continue: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
    fulfill: ReturnType<typeof vi.fn>;
  }

  function makeRoute(url: string): FakeRoute {
    return {
      request: () => ({ url: () => url }),
      continue: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
      fulfill: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('aborts an off-allowlist host and continues an allowlisted CDN host', async () => {
    const renderer = new HeadlessRenderer();
    const { page, getHandler } = makeFakePage();

    // installLocalAssetFallbacks is private; reach it via the prototype like other render tests.
    await (renderer as unknown as { installLocalAssetFallbacks: (p: unknown) => Promise<void> })
      .installLocalAssetFallbacks(page);

    const handler = getHandler();
    expect(handler).toBeInstanceOf(Function);

    const blocked = makeRoute('https://evil.example.com/exfil');
    await handler!(blocked);
    expect(blocked.abort).toHaveBeenCalledWith('blockedbyclient');
    expect(blocked.continue).not.toHaveBeenCalled();

    // jsdelivr is an allowlisted CDN that is NOT served by the local p5 fallback,
    // so it must continue to the network rather than abort or fulfill.
    const allowed = makeRoute('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js');
    await handler!(allowed);
    expect(allowed.continue).toHaveBeenCalledTimes(1);
    expect(allowed.abort).not.toHaveBeenCalled();
  });
});

describe('HeadlessRenderer launch — respects SandboxConfig', () => {
  const ORIGINAL_ENV = process.env.LIMINAL_DISABLE_SANDBOX;

  beforeEach(() => {
    mockLaunch.mockReset();
    mockNewContext.mockReset();
    mockNewContext.mockResolvedValue({ close: vi.fn().mockResolvedValue(undefined) });
    mockLaunch.mockResolvedValue({
      newContext: mockNewContext,
      close: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(async () => {
    if (ORIGINAL_ENV === undefined) delete process.env.LIMINAL_DISABLE_SANDBOX;
    else process.env.LIMINAL_DISABLE_SANDBOX = ORIGINAL_ENV;
  });

  it('omits --no-sandbox by default (sandbox enabled)', async () => {
    delete process.env.LIMINAL_DISABLE_SANDBOX;
    const renderer = new HeadlessRenderer();
    await renderer.initialize();

    expect(mockLaunch).toHaveBeenCalledTimes(1);
    const args: string[] = mockLaunch.mock.calls[0][0].args;
    expect(args).not.toContain('--no-sandbox');
    expect(args).not.toContain('--disable-setuid-sandbox');
  });

  it('includes --no-sandbox only when LIMINAL_DISABLE_SANDBOX=true', async () => {
    process.env.LIMINAL_DISABLE_SANDBOX = 'true';
    const renderer = new HeadlessRenderer();
    await renderer.initialize();

    expect(mockLaunch).toHaveBeenCalledTimes(1);
    const args: string[] = mockLaunch.mock.calls[0][0].args;
    expect(args).toContain('--no-sandbox');
    expect(args).toContain('--disable-setuid-sandbox');
  });
});
