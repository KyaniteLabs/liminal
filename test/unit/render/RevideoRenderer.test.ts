import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ── Hoisted mocks ──────────────────────────────────────────────────
const mockRenderVideo = vi.hoisted(() =>
  vi.fn(async () => ({ duration: 5 }))
);

let shouldThrowOnImport = false;

vi.mock('@revideo/renderer', () => {
  if (shouldThrowOnImport) {
    throw new Error('Cannot find module @revideo/renderer');
  }
  return { renderVideo: mockRenderVideo };
});

// Mock child_process.execSync so npm install doesn't really run
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// ── System under test ──────────────────────────────────────────────
import { RevideoRenderer } from '../../../src/render/RevideoRenderer.js';

const SCENE_CODE = `
import { makeScene2D, Rect } from '@revideo/2d/lib';
import { createRef } from '@revideo/core/lib';

export default makeScene2D('test', function* (view) {
  const rect = createRef<Rect>();
  view.add(<Rect ref={rect} width={400} height={300} fill={'blue'} />);
  yield* rect().scale(2, 1);
  yield* waitFor(3);
});
`;

describe('RevideoRenderer', () => {
  let renderer: RevideoRenderer;
  let tempDir: string;

  beforeEach(async () => {
    shouldThrowOnImport = false;
    mockRenderVideo.mockClear();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rev-test-'));
    renderer = new RevideoRenderer({ tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('returns VideoRenderResult with correct fields on success', async () => {
    const outputPath = path.join(tempDir, 'out.mp4');
    mockRenderVideo.mockResolvedValue({});

    const result = await renderer.render(SCENE_CODE, outputPath, {
      fps: 30,
      width: 1920,
      height: 1080,
    });

    expect(result.outputPath).toBe(outputPath);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.format).toBe('mp4');
    expect(result.duration).toBeGreaterThan(0);
  });

  it('throws with install instructions when @revideo/renderer is missing', async () => {
    shouldThrowOnImport = true;
    vi.resetModules();
    vi.doMock('@revideo/renderer', () => {
      throw new Error('Cannot find module @revideo/renderer');
    });
    vi.doMock('child_process', () => ({ execSync: vi.fn() }));

    const { RevideoRenderer: FreshRenderer } = await import(
      '../../../src/render/RevideoRenderer.js'
    );
    const freshRenderer = new FreshRenderer({ tempDir });
    const outputPath = path.join(tempDir, 'out.mp4');

    await expect(freshRenderer.render(SCENE_CODE, outputPath)).rejects.toThrow(
      'Install with: pnpm add @revideo/renderer'
    );

    // Restore
    vi.resetModules();
    vi.doMock('@revideo/renderer', () => ({ renderVideo: mockRenderVideo }));
    vi.doMock('child_process', () => ({ execSync: vi.fn() }));
    await import('../../../src/render/RevideoRenderer.js');
  });

  it('writeProject creates proper Revideo project structure', async () => {
    const projectDir = await renderer.writeProject(SCENE_CODE);

    const sceneFile = path.join(projectDir, 'src', 'scene.tsx');
    const projectFile = path.join(projectDir, 'src', 'project.ts');
    const packageFile = path.join(projectDir, 'package.json');
    const tsconfigFile = path.join(projectDir, 'tsconfig.json');

    const sceneContent = await fs.readFile(sceneFile, 'utf-8');
    expect(sceneContent).toBe(SCENE_CODE);

    const projectContent = await fs.readFile(projectFile, 'utf-8');
    expect(projectContent).toContain('makeProject');
    expect(projectContent).toContain("import scene from './scene.js'");

    const pkg = JSON.parse(await fs.readFile(packageFile, 'utf-8'));
    expect(pkg.dependencies['@revideo/core']).toBeDefined();
    expect(pkg.dependencies['@revideo/renderer']).toBeDefined();
    expect(pkg.type).toBe('module');

    const tsconfig = JSON.parse(await fs.readFile(tsconfigFile, 'utf-8'));
    expect(tsconfig.compilerOptions.jsx).toBe('react-jsx');
    expect(tsconfig.compilerOptions.strict).toBe(true);

    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it('getCompositionConfig parses waitFor durations', () => {
    const config = renderer.getCompositionConfig(SCENE_CODE);
    // waitFor(3) => 3 seconds * 30fps = 90 frames
    expect(config.durationInFrames).toBe(90);
    expect(config.fps).toBe(30);
  });

  it('getCompositionConfig parses width/height from Rect', () => {
    const config = renderer.getCompositionConfig(SCENE_CODE);
    expect(config.width).toBe(400);
    expect(config.height).toBe(300);
  });

  it('getCompositionConfig falls back to defaults when no size found', () => {
    const code = `
      export default makeScene2D('minimal', function* (view) {
        yield* waitFor(2);
      });
    `;
    const config = renderer.getCompositionConfig(code);
    expect(config.width).toBe(1920);
    expect(config.height).toBe(1080);
  });

  it('getCompositionConfig falls back to 300 frames with no waitFor', () => {
    const code = `
      export default makeScene2D('empty', function* (view) {});
    `;
    const config = renderer.getCompositionConfig(code);
    expect(config.durationInFrames).toBe(300);
  });

  it('calls renderVideo with project file path', async () => {
    const outputPath = path.join(tempDir, 'out.mp4');
    mockRenderVideo.mockResolvedValue({});

    await renderer.render(SCENE_CODE, outputPath);

    expect(mockRenderVideo).toHaveBeenCalledTimes(1);
    const callArg = mockRenderVideo.mock.calls[0][0];
    expect(callArg.projectFile).toContain('project.ts');
    expect(callArg.settings.outFile).toBe(outputPath);
  });
});
