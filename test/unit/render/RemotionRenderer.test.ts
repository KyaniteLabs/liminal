import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { RemotionRenderer } from '../../../src/render/RemotionRenderer.js';

describe('RemotionRenderer', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-remotion-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('writes a Remotion project with entry point from generated code', async () => {
    const renderer = new RemotionRenderer({ tempDir });
    const projectDir = await renderer.writeEntryPoint(
      'export const TestComp: React.FC = () => { return <div/>; }'
    );

    // Check entry point exists
    const entryContent = await fs.readFile(
      path.join(projectDir, 'src', 'index.ts'),
      'utf-8'
    );
    expect(entryContent).toContain('TestComp');
    expect(entryContent).toContain('registerRoot');

    // Check package.json exists with remotion dependency
    const pkg = JSON.parse(
      await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8')
    );
    expect(pkg.dependencies.remotion).toBeDefined();
  });

  it('includes tsconfig.json with JSX support', async () => {
    const renderer = new RemotionRenderer({ tempDir });
    const projectDir = await renderer.writeEntryPoint(
      'export const MyComp: React.FC = () => { return <div/>; }'
    );

    const tsconfig = JSON.parse(
      await fs.readFile(path.join(projectDir, 'tsconfig.json'), 'utf-8')
    );
    expect(tsconfig.compilerOptions.jsx).toBe('react');
  });

  it('throws descriptive error if entry point path does not exist for render', async () => {
    const renderer = new RemotionRenderer({ tempDir });
    await expect(
      renderer.renderToVideo({
        projectDir: '/tmp/nonexistent-project-dir-xyz',
        outputPath: path.join(tempDir, 'output.mp4'),
      })
    ).rejects.toThrow();
  });

  it('generates correct composition config', () => {
    const renderer = new RemotionRenderer({ tempDir });
    const config = renderer.getCompositionConfig({
      id: 'TestComp',
      fps: 30,
      durationInFrames: 150,
      width: 1920,
      height: 1080,
    });
    expect(config.id).toBe('TestComp');
    expect(config.fps).toBe(30);
    expect(config.durationInFrames).toBe(150);
    expect(config.width).toBe(1920);
    expect(config.height).toBe(1080);
  });

  it('uses default tempDir when none provided', async () => {
    const renderer = new RemotionRenderer();
    const projectDir = await renderer.writeEntryPoint(
      'export const DefaultComp: React.FC = () => { return <div/>; }'
    );

    expect(projectDir).toContain('remotion-project');
    expect(
      await fs
        .access(path.join(projectDir, 'src', 'index.ts'))
        .then(() => true)
        .catch(() => false)
    ).toBe(true);

    // Cleanup
    await fs.rm(projectDir, { recursive: true, force: true }).catch(() => {});
  });

  it('parses exported component name from code', async () => {
    const renderer = new RemotionRenderer({ tempDir });
    const projectDir = await renderer.writeEntryPoint(
      'export const CoolAnimation: React.FC = () => { return <div/>; }'
    );

    const entryContent = await fs.readFile(
      path.join(projectDir, 'src', 'index.ts'),
      'utf-8'
    );
    expect(entryContent).toContain('CoolAnimation');
    // The component name should be used in the Composition
    expect(entryContent).toContain('component={CoolAnimation}');
  });

  it('handles default function export syntax', async () => {
    const renderer = new RemotionRenderer({ tempDir });
    const projectDir = await renderer.writeEntryPoint(
      'export default function MyScene() { return <div/>; }'
    );

    const entryContent = await fs.readFile(
      path.join(projectDir, 'src', 'index.ts'),
      'utf-8'
    );
    expect(entryContent).toContain('MyScene');
    expect(entryContent).toContain('component={MyScene}');
  });

  it('falls back to GeneratedComposition when no export name found', async () => {
    const renderer = new RemotionRenderer({ tempDir });
    const projectDir = await renderer.writeEntryPoint(
      'const x = 42;'
    );

    const entryContent = await fs.readFile(
      path.join(projectDir, 'src', 'index.ts'),
      'utf-8'
    );
    // Should still generate valid entry with a placeholder
    expect(entryContent).toContain('registerRoot');
    expect(entryContent).toContain('Composition');
  });
});
