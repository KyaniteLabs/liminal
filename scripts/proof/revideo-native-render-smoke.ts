#!/usr/bin/env tsx
/**
 * Native Revideo render smoke.
 *
 * Proves the Revideo path produces an actual MP4, not only an inert code
 * wrapper or timeline approximation.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RevideoRenderer } from '../../src/render/RevideoRenderer.js';

interface Receipt {
  contract: 'liminal-revideo-native-render-smoke-v1';
  generatedAt: string;
  status: 'pass' | 'fail';
  outputPath: string;
  bytes: number;
  duration: number;
  width: number;
  height: number;
  fps: number;
  actualWidth?: number;
  actualHeight?: number;
  actualFrameRate?: string;
  format: string;
  error?: string;
}

function parseStringArg(argv: string[], name: string): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === name) return argv[++i];
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

function parseNumberArg(argv: string[], name: string, fallback: number): number {
  const value = parseStringArg(argv, name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number, got ${value}`);
  }
  return parsed;
}

function parseOutDir(argv: string[]): string {
  const out = parseStringArg(argv, '--out');
  if (out) return path.resolve(out);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(process.cwd(), '.omx', 'proof', `revideo-native-render-smoke-${stamp}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ProbeMetadata {
  actualWidth?: number;
  actualHeight?: number;
  actualFrameRate?: string;
}

function probeVideoMetadata(outputPath: string): ProbeMetadata {
  const probe = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,r_frame_rate',
      '-of',
      'json',
      outputPath,
    ],
    { encoding: 'utf8' }
  );

  if (probe.status !== 0 || !probe.stdout.trim()) return {};

  try {
    const parsed = JSON.parse(probe.stdout) as {
      streams?: Array<{ width?: number; height?: number; r_frame_rate?: string }>;
    };
    const stream = parsed.streams?.[0];
    if (!stream) return {};
    return {
      actualWidth: stream.width,
      actualHeight: stream.height,
      actualFrameRate: stream.r_frame_rate,
    };
  } catch {
    return {};
  }
}

const argv = process.argv.slice(2);
const outDir = parseOutDir(argv);
const width = parseNumberArg(argv, '--width', 1280);
const height = parseNumberArg(argv, '--height', 720);
const fps = parseNumberArg(argv, '--fps', 12);
const outputPath = path.join(outDir, 'revideo-smoke.mp4');
const sceneCode = `
import { makeScene2D, Rect, Txt } from '@revideo/2d';
import { createRef, waitFor } from '@revideo/core';

export default makeScene2D('NativeSmokeScene', function* (view) {
  const title = createRef<Txt>();
  view.add(
    <Rect width={${width}} height={${height}} fill={'#050816'}>
      <Txt ref={title} text={'Liminal Revideo'} fill={'#ffffff'} fontSize={72} />
    </Rect>
  );
  yield* title().opacity(1, 0.2);
  yield* waitFor(0.2);
});
`;

await mkdir(outDir, { recursive: true });

let receipt: Receipt;
try {
  const renderer = new RevideoRenderer({ tempDir: path.join(outDir, 'tmp') });
  const result = await renderer.render(sceneCode, outputPath, { fps, width, height });
  const file = await stat(outputPath);
  if (file.size <= 0) throw new Error(`Rendered MP4 is empty: ${outputPath}`);
  const metadata = probeVideoMetadata(outputPath);
  if (metadata.actualWidth !== undefined && metadata.actualWidth !== width) {
    throw new Error(`Rendered MP4 width mismatch: expected ${width}, got ${metadata.actualWidth}`);
  }
  if (metadata.actualHeight !== undefined && metadata.actualHeight !== height) {
    throw new Error(`Rendered MP4 height mismatch: expected ${height}, got ${metadata.actualHeight}`);
  }
  receipt = {
    contract: 'liminal-revideo-native-render-smoke-v1',
    generatedAt: new Date().toISOString(),
    status: 'pass',
    outputPath,
    bytes: file.size,
    duration: result.duration,
    width: result.width,
    height: result.height,
    fps,
    ...metadata,
    format: result.format,
  };
} catch (error) {
  receipt = {
    contract: 'liminal-revideo-native-render-smoke-v1',
    generatedAt: new Date().toISOString(),
    status: 'fail',
    outputPath,
    bytes: 0,
    duration: 0,
    width: 0,
    height: 0,
    fps,
    format: 'mp4',
    error: errorMessage(error),
  };
}

await writeFile(path.join(outDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
if (receipt.status !== 'pass') process.exit(1);
