#!/usr/bin/env node
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const appName = 'Sinter Studio';
const bundleId = 'com.kyanitelabs.liminalstudio';
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const outputDir = path.join(root, 'dist-desktop', `${appName}-darwin-${arch}`);
const targetApp = path.join(outputDir, `${appName}.app`);
const resourcesApp = path.join(targetApp, 'Contents', 'Resources', 'app');

function resolveElectronApp(executablePath) {
  let current = path.resolve(executablePath);
  while (current !== path.dirname(current)) {
    if (path.basename(current) === 'Electron.app') return current;
    current = path.dirname(current);
  }
  throw new Error(`Could not resolve Electron.app from ${executablePath}`);
}

async function copyIfExists(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(resourcesApp, relativePath);
  if (!existsSync(source)) return;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (entry) => {
      const name = path.basename(entry);
      return ![
        '.git',
        '.worktrees',
        '.omx',
        '.cache',
        'coverage',
        'dist-desktop',
        'test-output',
        'test-results',
      ].includes(name);
    },
  });
}

async function writeElectronPackageJson() {
  const packageJsonPath = path.join(root, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  const desktopPackageJson = {
    name: 'sinter-studio-desktop',
    version: packageJson.version,
    private: true,
    type: packageJson.type,
    main: 'electron/main.cjs',
    dependencies: packageJson.dependencies,
    optionalDependencies: packageJson.optionalDependencies,
  };
  await fs.writeFile(
    path.join(resourcesApp, 'package.json'),
    `${JSON.stringify(desktopPackageJson, null, 2)}\n`,
    'utf-8',
  );
}

async function updateInfoPlist() {
  const plistPath = path.join(targetApp, 'Contents', 'Info.plist');
  let plist = await fs.readFile(plistPath, 'utf-8');
  const replaceValue = (key, value) => {
    const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);
    if (pattern.test(plist)) {
      plist = plist.replace(pattern, `$1${value}$3`);
    } else {
      plist = plist.replace('</dict>', `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>`);
    }
  };

  replaceValue('CFBundleName', appName);
  replaceValue('CFBundleDisplayName', appName);
  replaceValue('CFBundleIdentifier', bundleId);
  await fs.writeFile(plistPath, plist, 'utf-8');
}

if (process.platform !== 'darwin') {
  throw new Error('desktop:package:mac can only run on macOS.');
}

if (!existsSync(path.join(root, 'gui', 'dist', 'index.html'))) {
  throw new Error('Missing gui/dist/index.html. Run pnpm desktop:build before packaging.');
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
await fs.cp(resolveElectronApp(electronPath), targetApp, { recursive: true, verbatimSymlinks: true });
await fs.rm(resourcesApp, { recursive: true, force: true });
await fs.mkdir(resourcesApp, { recursive: true });

for (const entry of [
  'electron',
  'gui',
  'dist',
  'scripts',
  'bin',
  'config',
  'plugins',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'THIRD_PARTY_NOTICES.md',
  'pnpm-lock.yaml',
  'node_modules',
]) {
  await copyIfExists(entry);
}

await writeElectronPackageJson();
await updateInfoPlist();

console.log(`Packaged ${appName}: ${targetApp}`);
