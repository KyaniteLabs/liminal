import { describe, expect, it, vi } from 'vitest';
import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';

type PageHandler = (error: Error) => void;

const pageErrorHandlers: PageHandler[] = [];
const closePage = vi.fn(async () => undefined);
const closeBrowser = vi.fn(async () => undefined);

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(async () => ({
      newPage: vi.fn(async () => ({
        on: vi.fn((event: string, handler: PageHandler) => {
          if (event === 'pageerror') pageErrorHandlers.push(handler);
        }),
        setViewport: vi.fn(),
        goto: vi.fn(async () => {
          pageErrorHandlers.forEach((handler) => handler(new Error('p5 runtime failed')));
        }),
        waitForSelector: vi.fn(),
        screenshot: vi.fn(),
        close: closePage,
      })),
      close: closeBrowser,
    })),
  },
}));

describe('TuiBridgeService preview runtime verification', () => {
  it('rejects preview screenshots when the generated page throws a runtime error', async () => {
    const service = new TuiBridgeService();

    await expect((service as any).renderHtmlScreenshot('/tmp/bad-p5.html', '/tmp/bad-p5.png', 'p5'))
      .rejects.toThrow('p5 runtime failed');
    expect(closePage).toHaveBeenCalled();
    expect(closeBrowser).toHaveBeenCalled();
  });
});
