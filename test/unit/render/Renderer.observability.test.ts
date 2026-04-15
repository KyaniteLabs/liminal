import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAccess,
  mockConsoleHandlers,
  mockPageErrorHandlers,
  mockCanvasHandle,
  mockPage,
  mockBrowser,
} = vi.hoisted(() => {
  const mockAccess = vi.fn();
  const mockConsoleHandlers: Array<(msg: { type: () => string; text: () => string }) => void> = [];
  const mockPageErrorHandlers: Array<(err: Error) => void> = [];
  const mockCanvasHandle = { screenshot: vi.fn().mockResolvedValue(undefined) };

  const mockPage = {
    setViewport: vi.fn().mockResolvedValue(undefined),
    setContent: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    $: vi.fn().mockResolvedValue(mockCanvasHandle),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: unknown) => {
      if (event === 'console') mockConsoleHandlers.push(handler as (msg: { type: () => string; text: () => string }) => void);
      if (event === 'pageerror') mockPageErrorHandlers.push(handler as (err: Error) => void);
    }),
  };

  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    mockAccess,
    mockConsoleHandlers,
    mockPageErrorHandlers,
    mockCanvasHandle,
    mockPage,
    mockBrowser,
  };
});

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    access: mockAccess,
  },
}));

vi.mock('../../../src/utils/validation.js', () => ({
  validateString: vi.fn(),
}));

vi.mock('../../../src/utils/htmlWrapper.js', () => ({
  HTMLWrapper: {
    wrap: vi.fn((code: string) => `<html><body><canvas></canvas><script>${code}</script></body></html>`),
  },
}));

import { Renderer } from '../../../src/render/Renderer.js';

describe('Renderer observability', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsoleHandlers.length = 0;
    mockPageErrorHandlers.length = 0;
    mockAccess.mockResolvedValue(undefined);
    mockPage.$.mockResolvedValue(mockCanvasHandle);
    await Renderer.closeBrowser();
  });

  afterEach(async () => {
    await Renderer.closeBrowser();
  });

  it('includes page errors when no canvas is found', async () => {
    mockPage.$.mockImplementationOnce(async () => {
      for (const handler of mockPageErrorHandlers) {
        handler(new Error('p5 is not defined'));
      }
      return null;
    });

    const renderer = new Renderer();
    await expect(renderer.render('function setup() {}', '/tmp/output.png')).rejects.toThrow(
      'Failed to render sketch: No canvas element found. The sketch may have failed to initialize. Diagnostics: page errors: p5 is not defined',
    );
  });

  it('includes console errors in the thrown message', async () => {
    mockPage.$.mockImplementationOnce(async () => {
      for (const handler of mockConsoleHandlers) {
        handler({
          type: () => 'error',
          text: () => 'Uncaught ReferenceError: createCanvas is not defined',
        });
      }
      return null;
    });

    const renderer = new Renderer();
    await expect(renderer.render('function setup() {}', '/tmp/output.png')).rejects.toThrow(
      'console errors: Uncaught ReferenceError: createCanvas is not defined',
    );
  });
});
