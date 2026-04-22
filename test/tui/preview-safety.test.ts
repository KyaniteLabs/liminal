import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openMock, exporterMock, previewServerStartMock, previewServerStopMock, previewServerServeSketchMock, previewServerGetPortMock, readFileMock } = vi.hoisted(() => ({
  openMock: vi.fn(async () => undefined),
  exporterMock: { exportHTML: vi.fn(async () => undefined) },
  previewServerStartMock: vi.fn(async () => undefined),
  previewServerStopMock: vi.fn(async () => undefined),
  previewServerServeSketchMock: vi.fn(),
  previewServerGetPortMock: vi.fn(() => 3456),
  readFileMock: vi.fn(),
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
    serveSketch = previewServerServeSketchMock;
    getPort = previewServerGetPortMock;
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: readFileMock,
  },
}));

import { AudioPlayer } from '../../src/tui/preview/AudioPlayer.js';
import { BrowserLauncher } from '../../src/tui/preview/BrowserLauncher.js';

describe('preview safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewServerGetPortMock.mockReturnValue(3456);
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

  it('serves Three.js code through the preview server with a module wrapper', async () => {
    const launcher = new BrowserLauncher();

    const url = await launcher.previewCode('const scene = new THREE.Scene();', 'three');

    expect(exporterMock.exportHTML).not.toHaveBeenCalled();
    expect(previewServerServeSketchMock).toHaveBeenCalledWith(expect.stringContaining('three.module.js'));
    expect(previewServerServeSketchMock).toHaveBeenCalledWith(expect.stringContaining('import * as THREE'));
    expect(openMock).toHaveBeenCalledWith('http://localhost:3456/preview');
    expect(url).toBe('http://localhost:3456/preview');
  });

  it('serves HTML preview files through the preview server route that exists', async () => {
    readFileMock.mockResolvedValue('<!doctype html><html><body>preview</body></html>');
    const launcher = new BrowserLauncher();

    const url = await launcher.previewFile('preview.html');

    expect(previewServerServeSketchMock).toHaveBeenCalledWith('<!doctype html><html><body>preview</body></html>');
    expect(openMock).toHaveBeenCalledWith('http://localhost:3456/preview');
    expect(url).toBe('http://localhost:3456/preview');
  });

  it('includes p5.sound when previewing p5 sound sketches', async () => {
    const launcher = new BrowserLauncher();

    await launcher.previewCode('function setup(){ createCanvas(100,100); loadSound("kick.wav"); }', 'p5');

    expect(previewServerServeSketchMock).toHaveBeenCalledWith(expect.stringContaining('p5.sound.min.js'));
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
