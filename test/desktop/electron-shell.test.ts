import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf-8');
}

describe('Electron desktop shell', () => {
  it('keeps the renderer isolated and routes external navigation outside Studio', () => {
    const main = read('electron/main.cjs');

    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('sandbox: true');
    expect(main).not.toContain('nodeIntegration: true');
    expect(main).toContain('setWindowOpenHandler');
    expect(main).toContain('will-navigate');
    expect(main).toContain('shell.openExternal');
  });

  it('reuses the existing Studio scripts instead of creating a second backend path', () => {
    const main = read('electron/main.cjs');

    expect(main).toContain("path.join(root, 'scripts', 'utils', 'start-studio.js')");
    expect(main).toContain("path.join(root, 'gui', 'start.js')");
    expect(main).toContain('ELECTRON_RUN_AS_NODE');
    expect(main).toContain('LIMINAL_STUDIO_STATIC_DIR');
  });

  it('scopes desktop permissions to local microphone access only', () => {
    const main = read('electron/main.cjs');

    expect(main).toContain('setPermissionRequestHandler');
    expect(main).toContain("permission === 'media'");
    expect(main).toContain("details.mediaTypes.includes('audio')");
    expect(main).toContain("!details.mediaTypes.includes('video')");
  });

  it('serves the built GUI from the existing backend for desktop static mode', () => {
    const start = read('gui/start.js');

    expect(start).toContain('LIMINAL_STUDIO_STATIC_DIR');
    expect(start).toContain('express.static');
    expect(start).toContain('index.html');
    expect(start).toContain("Full Studio: pnpm gui");
  });

  it('exposes package scripts for desktop launch, smoke, and mac packaging', () => {
    const pkg = JSON.parse(read('package.json'));

    expect(pkg.scripts.desktop).toBe('pnpm desktop:build && electron electron/main.cjs');
    expect(pkg.scripts['desktop:dev']).toBe('pnpm build && electron electron/main.cjs --dev');
    expect(pkg.scripts['desktop:build']).toBe('pnpm build && pnpm --dir gui build');
    expect(pkg.scripts['desktop:smoke']).toBe('node scripts/proof/electron-smoke.mjs');
    expect(pkg.scripts['desktop:package:mac']).toBe('pnpm desktop:build && node scripts/packaging/package-electron-mac.mjs');
  });
});
