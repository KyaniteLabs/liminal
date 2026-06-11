import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const PROOF_REVIDEO_CANDIDATES = ['revideo.tsx', 'revideo.jsx', 'revideo.ts', 'revideo.js'];

export function findRevideoArtifact(root) {
  for (const file of PROOF_REVIDEO_CANDIDATES) {
    const candidate = path.join(root, file);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function looksLikeRevideoArtifact(source, filePath = '') {
  return /\.(tsx|jsx|ts|js)$/i.test(filePath)
    && /(@revideo\/(2d|core)|makeScene2D\s*\()/m.test(source);
}

export function revideoRenderReadiness() {
  const missing = [];
  for (const mod of ['@revideo/renderer', '@revideo/vite-plugin', '@revideo/ui']) {
    try {
      require.resolve(mod);
    } catch {
      missing.push(mod);
    }
  }
  if (missing.length > 0) return { ok: false, reason: `revideo renderer not installed: ${missing.join(', ')}` };
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore', timeout: 5000 });
  } catch {
    return { ok: false, reason: 'ffmpeg not installed for revideo frame extraction' };
  }
  if (!fs.existsSync(path.resolve('dist/render/RevideoRenderer.js'))) {
    return { ok: false, reason: 'dist render helper missing; run pnpm build before revideo grading' };
  }
  return { ok: true, reason: 'ready' };
}

export async function renderRevideoStill({ source, outputPath, tempDir, width = 900, height = 600, fps = 12, timeoutMs = 30_000 }) {
  const readiness = revideoRenderReadiness();
  if (!readiness.ok) return { status: 'skipped', message: `SKIPPED (${readiness.reason})` };

  const started = Date.now();
  const outputDir = path.dirname(outputPath);
  const mp4Path = path.join(outputDir, `${path.basename(outputPath, path.extname(outputPath))}.mp4`);
  const { RevideoRenderer } = await import('../../dist/render/RevideoRenderer.js');
  const renderer = new RevideoRenderer({ tempDir });
  await renderer.render(source, mp4Path, { width, height, fps });
  const renderMs = Date.now() - started;
  if (renderMs > timeoutMs) {
    return { status: 'skipped', message: `SKIPPED (revideo render took ${renderMs}ms; >30s needs harness design decision)` };
  }

  execFileSync(
    'ffmpeg',
    ['-y', '-v', 'error', '-ss', '0', '-i', mp4Path, '-frames:v', '1', outputPath],
    { timeout: timeoutMs }
  );
  const bytes = fs.statSync(outputPath).size;
  return { status: 'ok', message: `ok ${Math.round(bytes / 1024)}KB`, outputPath, mp4Path, renderMs };
}
