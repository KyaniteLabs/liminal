import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock RevideoTemplateSetup BEFORE importing RevideoRenderer
// to prevent npm install during tests (ensureTemplate runs npm install)
const mockEnsureTemplate = vi.fn().mockResolvedValue(false);
const mockCopyToWorkDir = vi.fn();

vi.mock('../../../src/render/RevideoTemplateSetup.js', () => ({
  revideoTemplate: {
    ensureTemplate: mockEnsureTemplate,
    copyToWorkDir: mockCopyToWorkDir,
  },
}));

// Mock @revideo/renderer (dynamic import in renderToVideo)
const mockRenderVideo = vi.fn();
vi.mock('@revideo/renderer', () => ({
  renderVideo: mockRenderVideo,
}));

import { RevideoRenderer } from '../../../src/render/RevideoRenderer.js';

describe('RevideoRenderer', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-revideo-'));
    mockEnsureTemplate.mockResolvedValue(false);
    mockCopyToWorkDir.mockReset();
    mockRenderVideo.mockReset();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    vi.restoreAllMocks();
  });

  describe('writeEntryPoint', () => {
    it('scaffolds a project with scene and project files', async () => {
      const renderer = new RevideoRenderer({ tempDir });
      const sceneCode = `import { makeScene2D } from '@revideo/2d';
export default makeScene2D(function* (view) {
  yield* view.circle(100).fill('red');
});`;

      const projectDir = await renderer.writeEntryPoint(sceneCode);

      // Scene file should contain the generated code
      const sceneContent = await fs.readFile(
        path.join(projectDir, 'src', 'scene.ts'),
        'utf-8'
      );
      expect(sceneContent).toContain('makeScene2D');
      expect(sceneContent).toContain('circle');

      // Project file should reference the scene
      const projectContent = await fs.readFile(
        path.join(projectDir, 'src', 'project.ts'),
        'utf-8'
      );
      expect(projectContent).toContain('makeProject');

      // Package.json should exist with revideo dependencies
      const pkg = JSON.parse(
        await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8')
      );
      expect(pkg.dependencies['@revideo/core']).toBeDefined();
      expect(pkg.dependencies['@revideo/renderer']).toBeDefined();
      expect(pkg.type).toBe('module');
    });

    it('parses default export scene names correctly', async () => {
      const renderer = new RevideoRenderer({ tempDir });
      const projectDir = await renderer.writeEntryPoint(
        `export default makeScene2D(function* MyScene(view) {});`
      );

      const projectContent = await fs.readFile(
        path.join(projectDir, 'src', 'project.ts'),
        'utf-8'
      );
      expect(projectContent).toContain('makeProject');
      // parseSceneName captures the identifier after 'export default' (makeScene2D),
      // not the inner function name (MyScene) — that's correct import behavior
      expect(projectContent).toContain('makeScene2D');
    });

    it('creates tsconfig with JSX support for @revideo/2d', async () => {
      const renderer = new RevideoRenderer({ tempDir });
      const projectDir = await renderer.writeEntryPoint(
        `export default makeScene2D(function* () {});`
      );

      const tsconfig = JSON.parse(
        await fs.readFile(path.join(projectDir, 'tsconfig.json'), 'utf-8')
      );
      expect(tsconfig.compilerOptions.jsx).toBe('react-jsx');
      expect(tsconfig.compilerOptions.jsxImportSource).toBe('@revideo/2d');
    });

    it('uses RevideoTemplateSetup when available', async () => {
      mockEnsureTemplate.mockResolvedValue(true);
      mockCopyToWorkDir.mockResolvedValue(undefined);

      const renderer = new RevideoRenderer({ tempDir });
      const projectDir = await renderer.writeEntryPoint(
        `export default makeScene2D(function* () {});`
      );

      expect(mockEnsureTemplate).toHaveBeenCalled();
      expect(mockCopyToWorkDir).toHaveBeenCalledWith(projectDir);
    });
  });

  describe('renderToVideo', () => {
    it('throws if project directory does not exist', async () => {
      const renderer = new RevideoRenderer({ tempDir });
      await expect(
        renderer.renderToVideo({
          projectDir: '/nonexistent/path',
          outputPath: path.join(tempDir, 'out.mp4'),
        })
      ).rejects.toThrow('does not exist');
    });

    it('throws if project file is missing', async () => {
      const renderer = new RevideoRenderer({ tempDir });
      const emptyDir = path.join(tempDir, 'empty-project');
      await fs.mkdir(emptyDir, { recursive: true });

      await expect(
        renderer.renderToVideo({
          projectDir: emptyDir,
          outputPath: path.join(tempDir, 'out.mp4'),
        })
      ).rejects.toThrow('does not exist');
    });

    it('calls renderVideo with correct settings', async () => {
      const renderer = new RevideoRenderer({ tempDir });
      const projectDir = await renderer.writeEntryPoint(
        `export default makeScene2D(function* () {});`
      );
      const outputPath = path.join(tempDir, 'output.mp4');

      mockRenderVideo.mockResolvedValue(outputPath);

      const result = await renderer.renderToVideo({
        projectDir,
        outputPath,
      });

      expect(mockRenderVideo).toHaveBeenCalledTimes(1);
      const callArgs = mockRenderVideo.mock.calls[0][0];
      expect(callArgs.settings.outDir).toBe(tempDir);
      expect(callArgs.settings.outFile).toBe('output.mp4');
      expect(result).toBe(outputPath);
    });
  });

  describe('getCompositionConfig', () => {
    it('returns default config when no options provided', () => {
      const renderer = new RevideoRenderer();
      const config = renderer.getCompositionConfig();

      expect(config.id).toBe('generated');
      expect(config.fps).toBe(30);
      expect(config.durationInSeconds).toBe(5);
      expect(config.width).toBe(1920);
      expect(config.height).toBe(1080);
    });

    it('overrides specific fields', () => {
      const renderer = new RevideoRenderer();
      const config = renderer.getCompositionConfig({
        id: 'my-comp',
        fps: 60,
        width: 3840,
        height: 2160,
      });

      expect(config.id).toBe('my-comp');
      expect(config.fps).toBe(60);
      expect(config.durationInSeconds).toBe(5); // default preserved
      expect(config.width).toBe(3840);
      expect(config.height).toBe(2160);
    });
  });

  describe('constructor', () => {
    it('uses custom tempDir when provided', async () => {
      const customTemp = await fs.mkdtemp(path.join(os.tmpdir(), 'custom-'));
      const renderer = new RevideoRenderer({ tempDir: customTemp });
      const projectDir = await renderer.writeEntryPoint(
        `export default makeScene2D(function* () {});`
      );

      expect(projectDir.startsWith(customTemp)).toBe(true);
      await fs.rm(customTemp, { recursive: true, force: true });
    });

    it('uses os.tmpdir() when no options provided', async () => {
      const renderer = new RevideoRenderer();
      const projectDir = await renderer.writeEntryPoint(
        `export default makeScene2D(function* () {});`
      );

      expect(projectDir.startsWith(os.tmpdir())).toBe(true);
    });
  });
});
