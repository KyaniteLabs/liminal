/**
 * Tests for Exporter.exportVideo() domain routing.
 *
 * Covers the revideo, hyperframes, and canvas (default) branches,
 * plus validation and directory-creation error paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockMkdir, mockRevideoRender, mockHyperframesRender, mockCanvasRecord, mockRequire } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockRevideoRender: vi.fn(),
  mockHyperframesRender: vi.fn(),
  mockCanvasRecord: vi.fn(),
  mockRequire: vi.fn(),
}));

vi.mock('fs/promises', () => {
  const handler = (...args: unknown[]) => mockMkdir(...args);
  return { __esModule: true, default: { mkdir: handler }, mkdir: handler };
});

vi.mock('../../../src/render/RevideoRenderer.js', () => ({
  RevideoRenderer: vi.fn().mockImplementation(function () {
    return { render: (...args: unknown[]) => mockRevideoRender(...args) };
  }),
}));

vi.mock('../../../src/render/HyperFramesRenderer.js', () => ({
  HyperFramesRenderer: vi.fn().mockImplementation(function () {
    return { render: (...args: unknown[]) => mockHyperframesRender(...args) };
  }),
}));

vi.mock('../../../src/render/CanvasRecorder.js', () => ({
  CanvasRecorder: vi.fn().mockImplementation(function () {
    return { record: (...args: unknown[]) => mockCanvasRecord(...args) };
  }),
}));

vi.mock('../../../src/render/VideoCapabilityDetector.js', () => ({
  VideoCapabilityDetector: { require: (...args: unknown[]) => mockRequire(...args) },
}));

vi.mock('../../../src/utils/htmlWrapper.js', () => ({
  HTMLWrapper: { wrap: vi.fn().mockReturnValue('<html></html>') },
}));

vi.mock('../../../src/core/CodeValidator.js', () => ({
  CodeValidator: { validate: vi.fn().mockReturnValue({ valid: true }) },
}));

class MockValidationError extends Error { constructor(msg: string) { super(msg); this.name = 'ValidationError'; } }
vi.mock('../../../src/utils/validation.js', () => ({
  validateCode: (code: string) => { if (!code) throw new MockValidationError('Code is required'); },
  validateOutputPath: (p: string, msg: string) => { if (!p) throw new MockValidationError(msg); },
  validateProjectName: vi.fn(),
}));

vi.mock('archiver', () => ({
  default: vi.fn(),
}));

vi.mock('fs', () => ({
  createWriteStream: vi.fn(),
}));

import { Exporter } from '../../../src/export/Exporter.js';

describe('Exporter.exportVideo', () => {
  let exporter: Exporter;

  beforeEach(() => {
    vi.clearAllMocks();
    exporter = new Exporter();
    mockMkdir.mockResolvedValue(undefined);
    mockRequire.mockReturnValue(undefined);
    mockRevideoRender.mockResolvedValue(undefined);
    mockHyperframesRender.mockResolvedValue(undefined);
    mockCanvasRecord.mockResolvedValue(undefined);
  });

  it('rejects empty code', async () => {
    await expect(exporter.exportVideo('', '/tmp/out.mp4', { domain: 'p5' }))
      .rejects.toThrow('Code is required');
  });

  it('rejects empty output path', async () => {
    await expect(exporter.exportVideo('code', '', { domain: 'p5' }))
      .rejects.toThrow('Output path is required');
  });

  it('rejects missing domain', async () => {
    await expect(exporter.exportVideo('code', '/tmp/out.mp4', {} as any))
      .rejects.toThrow('domain is required');
  });

  it('routes to RevideoRenderer for revideo domain', async () => {
    await exporter.exportVideo('code', '/tmp/rev.mp4', { domain: 'revideo', fps: 60, width: 1280, height: 720 });

    expect(mockRequire).toHaveBeenCalledWith('revideo');
    expect(mockRevideoRender).toHaveBeenCalledWith('code', '/tmp/rev.mp4', { fps: 60, width: 1280, height: 720 });
  });

  it('routes to HyperFramesRenderer for hyperframes domain', async () => {
    await exporter.exportVideo('code', '/tmp/hf.mp4', { domain: 'hyperframes', fps: 24 });

    expect(mockRequire).toHaveBeenCalledWith('hyperframes');
    expect(mockHyperframesRender).toHaveBeenCalledWith('code', '/tmp/hf.mp4', { fps: 24, width: 1920, height: 1080 });
  });

  it('routes to CanvasRecorder for other domains', async () => {
    await exporter.exportVideo('code', '/tmp/canvas.mp4', { domain: 'p5' });

    expect(mockCanvasRecord).toHaveBeenCalledWith('code', 'p5', '/tmp/canvas.mp4');
    expect(mockRequire).not.toHaveBeenCalled();
  });

  it('routes to CanvasRecorder for threejs domain', async () => {
    await exporter.exportVideo('code', '/tmp/3d.mp4', { domain: 'threejs' });

    expect(mockCanvasRecord).toHaveBeenCalledWith('code', 'threejs', '/tmp/3d.mp4');
  });

  it('creates output directory before rendering', async () => {
    await exporter.exportVideo('code', '/nested/dir/out.mp4', { domain: 'p5' });

    expect(mockMkdir).toHaveBeenCalledWith('/nested/dir', { recursive: true });
  });

  it('throws ExportError when directory creation fails', async () => {
    mockMkdir.mockRejectedValue(new Error('permission denied'));

    await expect(exporter.exportVideo('code', '/nope/out.mp4', { domain: 'p5' }))
      .rejects.toThrow('Failed to create directory');
  });

  it('uses default options when fps/duration/width/height omitted', async () => {
    await exporter.exportVideo('code', '/tmp/out.mp4', { domain: 'revideo' });

    expect(mockRevideoRender).toHaveBeenCalledWith('code', '/tmp/out.mp4', {
      fps: 30,
      width: 1920,
      height: 1080,
    });
  });

  it('propagates revideo render errors', async () => {
    mockRevideoRender.mockRejectedValue(new Error('render failed'));

    await expect(exporter.exportVideo('code', '/tmp/out.mp4', { domain: 'revideo' }))
      .rejects.toThrow('render failed');
  });

  it('propagates hyperframes render errors', async () => {
    mockHyperframesRender.mockRejectedValue(new Error('hf render failed'));

    await expect(exporter.exportVideo('code', '/tmp/out.mp4', { domain: 'hyperframes' }))
      .rejects.toThrow('hf render failed');
  });

  it('propagates canvas recorder errors', async () => {
    mockCanvasRecord.mockRejectedValue(new Error('canvas failed'));

    await expect(exporter.exportVideo('code', '/tmp/out.mp4', { domain: 'p5' }))
      .rejects.toThrow('canvas failed');
  });
});
