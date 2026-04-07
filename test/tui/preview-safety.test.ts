import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openMock, exporterMock, previewServerStartMock, previewServerStopMock } = vi.hoisted(() => ({
  openMock: vi.fn(async () => undefined),
  exporterMock: { exportHTML: vi.fn(async () => undefined) },
  previewServerStartMock: vi.fn(async () => undefined),
  previewServerStopMock: vi.fn(async () => undefined),
}));

vi.mock('open', () => ({
  default: openMock,
}));

vi.mock('../../src/export/Exporter.js', () => ({
  Exporter: class {
    exportHTML = exporterMock.exportHTML;
  },
}));

vi.mock('../../src/render/PreviewServer.js', () => ({
  PreviewServer: class {
    start = previewServerStartMock;
    stop = previewServerStopMock;
  },
}));

import { AudioPlayer } from '../../src/tui/preview/AudioPlayer.js';
import { BrowserLauncher } from '../../src/tui/preview/BrowserLauncher.js';

describe('preview safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('browser preview rejects path traversal attempts', async () => {
    const launcher = new BrowserLauncher();

    await expect(launcher.previewFile('../secrets.txt')).rejects.toThrow(/unsafe|path/i);
    expect(openMock).not.toHaveBeenCalled();
  });

  it('browser preview rejects unsupported file types', async () => {
    const launcher = new BrowserLauncher();

    await expect(launcher.previewFile('notes.txt')).rejects.toThrow(/unsupported|preview/i);
    expect(openMock).not.toHaveBeenCalled();
  });

  it('audio playback rejects path traversal attempts', async () => {
    const player = new AudioPlayer();

    const result = await player.play('../song.mp3');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unsafe|path/i);
  });

  it('audio playback rejects unsupported file types', async () => {
    const player = new AudioPlayer();

    const result = await player.play('notes.txt');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unsupported|audio/i);
  });
});
