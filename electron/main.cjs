'use strict';

const { app, BrowserWindow, shell, session } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_GUI_PORT = 5173;
const DEFAULT_API_PORT = 5174;
const STARTUP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;

let studioProcess = null;
let mainWindow = null;
let currentStudioOrigin = null;

function parsePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

function repoRoot() {
  const candidates = [
    process.env.LIMINAL_REPO_ROOT,
    path.resolve(__dirname, '..'),
    process.resourcesPath ? path.join(process.resourcesPath, 'app') : undefined,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  return path.resolve(__dirname, '..');
}

function request(url, timeoutMs = 2_000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ ok: Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 400), statusCode: res.statusCode || 0 });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, statusCode: 0 });
    });
    req.on('error', () => resolve({ ok: false, statusCode: 0 }));
  });
}

async function waitFor(url, timeoutMs = STARTUP_TIMEOUT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await request(url);
    if (response.ok) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function studioMode(root) {
  const forceDev = process.argv.includes('--dev') || process.env.LIMINAL_DESKTOP_DEV === '1';
  const staticIndex = path.join(root, 'gui', 'dist', 'index.html');
  if (!forceDev && fs.existsSync(staticIndex)) {
    return 'static';
  }
  return 'dev';
}

function createStudioLaunch(root) {
  const guiPort = parsePort(process.env.LIMINAL_STUDIO_GUI_PORT, DEFAULT_GUI_PORT);
  const apiPort = parsePort(process.env.LIMINAL_STUDIO_API_PORT || process.env.PORT, DEFAULT_API_PORT);
  const mode = studioMode(root);

  if (mode === 'static') {
    return {
      mode,
      script: path.join(root, 'gui', 'start.js'),
      url: `http://localhost:${apiPort}`,
      healthUrl: `http://localhost:${apiPort}/api/health`,
      env: {
        PORT: String(apiPort),
        LIMINAL_STUDIO_API_PORT: String(apiPort),
        LIMINAL_STUDIO_STATIC_DIR: path.join(root, 'gui', 'dist'),
      },
    };
  }

  return {
    mode,
    script: path.join(root, 'scripts', 'utils', 'start-studio.js'),
    url: `http://localhost:${guiPort}`,
    healthUrl: `http://localhost:${apiPort}/api/health`,
    env: {
      PORT: String(apiPort),
      LIMINAL_STUDIO_API_PORT: String(apiPort),
      LIMINAL_STUDIO_GUI_PORT: String(guiPort),
    },
  };
}

function startStudio(root, launch) {
  if (studioProcess) return;

  // Electron ships Node. ELECTRON_RUN_AS_NODE lets the child execute the
  // existing Studio scripts without requiring a separate system Node install.
  studioProcess = spawn(process.execPath, [launch.script], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...launch.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
  });

  studioProcess.stdout?.on('data', (data) => process.stdout.write(`[studio] ${data}`));
  studioProcess.stderr?.on('data', (data) => process.stderr.write(`[studio] ${data}`));
  studioProcess.on('error', (err) => {
    console.error('Sinter Studio failed to start:', err);
  });
  studioProcess.on('exit', (code, signal) => {
    studioProcess = null;
    if (mainWindow && code !== 0 && code !== null) {
      mainWindow.webContents.send('sinter-desktop:studio-exit', { code, signal });
    }
  });
}

function stopStudio() {
  if (!studioProcess || studioProcess.killed) return;

  const child = studioProcess;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  } else {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed && child.exitCode === null) child.kill('SIGKILL');
    }, 5_000).unref();
  }
}

function installPermissionPolicy(allowedOrigin) {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || '';
    let origin = '';
    try {
      origin = requestingUrl ? new URL(requestingUrl).origin : '';
    } catch {
      origin = '';
    }
    const localStudio = origin === allowedOrigin;
    const microphoneOnly = permission === 'media'
      && Array.isArray(details.mediaTypes)
      && details.mediaTypes.includes('audio')
      && !details.mediaTypes.includes('video');

    callback(Boolean(localStudio && microphoneOnly));
  });
}

function openExternalSafely(url) {
  try {
    const target = new URL(url);
    if (['http:', 'https:', 'mailto:'].includes(target.protocol)) {
      void shell.openExternal(url);
    }
  } catch {
    // Ignore malformed external navigation attempts from the renderer.
  }
}

function constrainNavigation(win, allowedOrigin) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const targetOrigin = new URL(url).origin;
    if (targetOrigin !== allowedOrigin) {
      event.preventDefault();
      openExternalSafely(url);
    }
  });
}

async function createWindow() {
  const root = repoRoot();
  const launch = createStudioLaunch(root);
  currentStudioOrigin = new URL(launch.url).origin;
  installPermissionPolicy(currentStudioOrigin);

  mainWindow = new BrowserWindow({
    title: 'Sinter Studio',
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: '#071014',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  constrainNavigation(mainWindow, currentStudioOrigin);
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const existingHealth = await request(launch.healthUrl);
  const existingStudio = await request(launch.url);
  if (!existingHealth.ok || !existingStudio.ok) {
    startStudio(root, launch);
  }

  await waitFor(launch.healthUrl);
  await waitFor(launch.url);
  await mainWindow.loadURL(launch.url);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => createWindow()).catch((err) => {
    console.error(err);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });

  app.on('before-quit', stopStudio);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
