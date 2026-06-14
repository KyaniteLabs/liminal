import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeRequest {
  url: () => string;
  continue: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
}

const { mockLaunch, mockRequestHandlers } = vi.hoisted(() => {
  const mockLaunch = vi.fn();
  const mockRequestHandlers: Array<(req: FakeRequest) => void> = [];
  return { mockLaunch, mockRequestHandlers };
});

vi.mock('puppeteer', () => ({
  default: { launch: mockLaunch },
}));

// Avoid needing ffmpeg.
vi.mock('../../src/export/VideoExporter.js', () => ({
  VideoExporter: class MockVideoExporter {
    framesToVideo = vi.fn().mockResolvedValue(undefined);
  },
}));

import { CanvasRecorder } from '../../src/render/CanvasRecorder.js';

function makeRequest(url: string): FakeRequest {
  return {
    url: () => url,
    continue: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockPage() {
  return {
    setViewport: vi.fn().mockResolvedValue(undefined),
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    setContent: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    // totalFrames = floor(fps*duration); keep it 0 so no real screenshots needed.
    $: vi.fn().mockResolvedValue({ screenshot: vi.fn().mockResolvedValue(undefined) }),
    on: vi.fn((event: string, handler: unknown) => {
      if (event === 'request') mockRequestHandlers.push(handler as (req: FakeRequest) => void);
    }),
  };
}

const ORIGINAL_ENV = process.env.LIMINAL_DISABLE_SANDBOX;

beforeEach(() => {
  mockLaunch.mockReset();
  mockRequestHandlers.length = 0;
  mockLaunch.mockResolvedValue({
    newPage: vi.fn().mockResolvedValue(makeMockPage()),
    close: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_ENV === undefined) delete process.env.LIMINAL_DISABLE_SANDBOX;
  else process.env.LIMINAL_DISABLE_SANDBOX = ORIGINAL_ENV;
});

function newRecorder(): CanvasRecorder {
  // duration 0 frames is invalid (must be > 0); use a tiny duration with fps 1
  // so totalFrames = floor(1 * 0.001) = 0 → no frame screenshots, fast record.
  return new CanvasRecorder({ fps: 1, duration: 0.001, width: 64, height: 64 });
}

describe('CanvasRecorder — respects SandboxConfig at launch', () => {
  it('omits --no-sandbox by default', async () => {
    delete process.env.LIMINAL_DISABLE_SANDBOX;
    await newRecorder().record('function setup(){createCanvas(64,64);}', 'p5' as never, '/tmp/out.mp4');

    const args: string[] = mockLaunch.mock.calls[0][0].args;
    expect(args).not.toContain('--no-sandbox');
    expect(args).not.toContain('--disable-setuid-sandbox');
  });

  it('includes --no-sandbox only when LIMINAL_DISABLE_SANDBOX=true', async () => {
    process.env.LIMINAL_DISABLE_SANDBOX = 'true';
    await newRecorder().record('function setup(){createCanvas(64,64);}', 'p5' as never, '/tmp/out.mp4');

    const args: string[] = mockLaunch.mock.calls[0][0].args;
    expect(args).toContain('--no-sandbox');
    expect(args).toContain('--disable-setuid-sandbox');
  });
});

describe('CanvasRecorder — deny-by-default network egress', () => {
  it('aborts an off-allowlist host and continues an allowlisted CDN host', async () => {
    await newRecorder().record('function setup(){createCanvas(64,64);}', 'p5' as never, '/tmp/out.mp4');

    expect(mockRequestHandlers.length).toBe(1);
    const handler = mockRequestHandlers[0];

    const blocked = makeRequest('https://evil.example.com/exfil');
    handler(blocked);
    expect(blocked.abort).toHaveBeenCalledWith('blockedbyclient');
    expect(blocked.continue).not.toHaveBeenCalled();

    const allowed = makeRequest('https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js');
    handler(allowed);
    expect(allowed.continue).toHaveBeenCalledTimes(1);
    expect(allowed.abort).not.toHaveBeenCalled();
  });
});
