import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeRequest {
  url: () => string;
  continue: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  respond: ReturnType<typeof vi.fn>;
}

const { mockLaunch, mockRequestHandlers, mockPage, mockAccess, mockMkdir } = vi.hoisted(() => {
  const mockLaunch = vi.fn();
  const mockRequestHandlers: Array<(req: FakeRequest) => void> = [];
  const mockAccess = vi.fn();
  const mockMkdir = vi.fn();

  const mockPage = {
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined),
    setContent: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    $: vi.fn().mockResolvedValue({ screenshot: vi.fn().mockResolvedValue(undefined) }),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: unknown) => {
      if (event === 'request') mockRequestHandlers.push(handler as (req: FakeRequest) => void);
    }),
  };

  return { mockLaunch, mockRequestHandlers, mockPage, mockAccess, mockMkdir };
});

vi.mock('puppeteer', () => ({
  default: { launch: mockLaunch },
}));

vi.mock('fs/promises', () => ({
  default: {
    access: mockAccess,
    mkdir: mockMkdir,
  },
}));

vi.mock('../../src/utils/validation.js', () => ({
  validateString: vi.fn(),
}));

vi.mock('../../src/utils/htmlWrapper.js', () => ({
  HTMLWrapper: {
    wrap: vi.fn((code: string) => `<html><body><canvas></canvas><script>${code}</script></body></html>`),
  },
}));

import { Renderer } from '../../src/render/Renderer.js';

function makeRequest(url: string): FakeRequest {
  return {
    url: () => url,
    continue: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
    respond: vi.fn().mockResolvedValue(undefined),
  };
}

async function flush(): Promise<void> {
  // request handlers run an async IIFE; let microtasks settle.
  await Promise.resolve();
  await Promise.resolve();
}

const ORIGINAL_ENV = process.env.LIMINAL_DISABLE_SANDBOX;

beforeEach(async () => {
  mockLaunch.mockReset();
  mockRequestHandlers.length = 0;
  mockAccess.mockResolvedValue(undefined);
  mockMkdir.mockResolvedValue(undefined);
  mockLaunch.mockResolvedValue({
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  });
  await Renderer.closeBrowser();
});

afterEach(async () => {
  await Renderer.closeBrowser();
  if (ORIGINAL_ENV === undefined) delete process.env.LIMINAL_DISABLE_SANDBOX;
  else process.env.LIMINAL_DISABLE_SANDBOX = ORIGINAL_ENV;
});

describe('Renderer — respects SandboxConfig at launch', () => {
  it('omits --no-sandbox by default', async () => {
    delete process.env.LIMINAL_DISABLE_SANDBOX;
    const renderer = new Renderer();
    await renderer.render('function setup(){createCanvas(10,10);}', '/tmp/x.png');

    const args: string[] = mockLaunch.mock.calls[0][0].args;
    expect(args).not.toContain('--no-sandbox');
    expect(args).not.toContain('--disable-setuid-sandbox');
  });

  it('includes --no-sandbox only when LIMINAL_DISABLE_SANDBOX=true', async () => {
    process.env.LIMINAL_DISABLE_SANDBOX = 'true';
    const renderer = new Renderer();
    await renderer.render('function setup(){createCanvas(10,10);}', '/tmp/x.png');

    const args: string[] = mockLaunch.mock.calls[0][0].args;
    expect(args).toContain('--no-sandbox');
    expect(args).toContain('--disable-setuid-sandbox');
  });
});

describe('Renderer — deny-by-default network egress', () => {
  it('aborts an off-allowlist host and continues an allowlisted CDN host', async () => {
    const renderer = new Renderer();
    await renderer.render('function setup(){createCanvas(10,10);}', '/tmp/x.png');

    expect(mockRequestHandlers.length).toBe(1);
    const handler = mockRequestHandlers[0];

    const blocked = makeRequest('https://evil.example.com/exfil');
    handler(blocked);
    await flush();
    expect(blocked.abort).toHaveBeenCalledWith('blockedbyclient');
    expect(blocked.continue).not.toHaveBeenCalled();

    const allowed = makeRequest('https://cdn.jsdelivr.net/npm/three/build/three.min.js');
    handler(allowed);
    await flush();
    expect(allowed.continue).toHaveBeenCalledTimes(1);
    expect(allowed.abort).not.toHaveBeenCalled();
  });
});
