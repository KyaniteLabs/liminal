#!/usr/bin/env node

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import os from 'os';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

async function runInstallSmoke() {
  console.log('🚀 Starting Sinter Installation Smoke Test...');
  
  const tempDir = path.join(os.tmpdir(), `sinter-install-smoke-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  console.log(`Created temp directory: ${tempDir}`);

  let coreTarballName = '';
  let sinterTarballName = '';

  try {
    // 1. Pack @sinter/audio-core first
    console.log('Packing @sinter/audio-core...');
    const { stdout: corePackStdout } = await execAsync('pnpm --filter @sinter/audio-core pack', { cwd: repoRoot });
    
    // Find the tgz filename
    const coreLines = corePackStdout.trim().split('\n');
    coreTarballName = coreLines.find(line => line.includes('Tarball Details'))
      ? path.basename(coreLines[coreLines.length - 1].trim())
      : '';
    
    if (!coreTarballName || !coreTarballName.endsWith('.tgz')) {
      const files = await fs.readdir(repoRoot);
      const matched = files.find(f => f.startsWith('sinter-audio-core-') && f.endsWith('.tgz'));
      if (!matched) {
        throw new Error(`Could not find core tarball: ${corePackStdout}`);
      }
      coreTarballName = matched;
    }

    const sourceCorePath = path.join(repoRoot, coreTarballName);
    const destCorePath = path.join(tempDir, coreTarballName);
    await fs.copyFile(sourceCorePath, destCorePath);
    await fs.unlink(sourceCorePath).catch(() => {});
    console.log(`Packed and moved core tarball: ${coreTarballName}`);

    // 2. Pack the main sinter project
    console.log('Packing Sinter via pnpm pack...');
    const { stdout: packStdout } = await execAsync('pnpm pack', { cwd: repoRoot });
    
    const lines = packStdout.trim().split('\n');
    sinterTarballName = lines.find(line => line.includes('Tarball Details'))
      ? path.basename(lines[lines.length - 1].trim())
      : '';

    if (!sinterTarballName || !sinterTarballName.endsWith('.tgz')) {
      const files = await fs.readdir(repoRoot);
      const matched = files.find(f => f.startsWith('sinter-') && !f.startsWith('sinter-audio-core-') && f.endsWith('.tgz'));
      if (!matched) {
        throw new Error(`Could not find sinter tarball: ${packStdout}`);
      }
      sinterTarballName = matched;
    }
    
    const sourceSinterPath = path.join(repoRoot, sinterTarballName);
    const destSinterPath = path.join(tempDir, sinterTarballName);
    
    await fs.copyFile(sourceSinterPath, destSinterPath);
    await fs.unlink(sourceSinterPath).catch(() => {});
    console.log(`Packed and moved sinter tarball: ${sinterTarballName}`);

    // 3. Initialize new project in tempDir
    console.log('Initializing a fresh npm project...');
    await execAsync('npm init -y', { cwd: tempDir });

    // 4. Install both tarballs together
    console.log(`Installing Sinter tarballs...`);
    await execAsync(`npm install ./${coreTarballName} ./${sinterTarballName}`, { cwd: tempDir });
    console.log('Sinter and dependencies installed successfully.');

    // 5. Run version command via npx
    console.log('Verifying installed binary via npx...');
    const { stdout: versionStdout, stderr: versionStderr } = await execAsync('npx sinter --version', { cwd: tempDir });
    
    console.log('npx output:', versionStdout.trim());
    
    const isOk = versionStdout.includes('Sinter v') && !versionStderr;
    
    const qualityDir = path.join(repoRoot, '.quality', 'release');
    await fs.mkdir(qualityDir, { recursive: true });
    const resultsPath = path.join(qualityDir, 'install-smoke.json');
    
    const results = {
      timestamp: new Date().toISOString(),
      success: isOk,
      output: versionStdout.trim(),
      error: versionStderr.trim()
    };
    
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2) + '\n');
    console.log(`\n📝 Results written to ${resultsPath}`);
    
    if (isOk) {
      console.log('✅ Installation smoke test passed!');
      process.exit(0);
    } else {
      console.error('❌ Installed binary failed verification check.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Installation smoke test failed with error:', error);
    if (coreTarballName) {
      const sourceCorePath = path.join(repoRoot, coreTarballName);
      await fs.unlink(sourceCorePath).catch(() => {});
    }
    if (sinterTarballName) {
      const sourceSinterPath = path.join(repoRoot, sinterTarballName);
      await fs.unlink(sourceSinterPath).catch(() => {});
    }
    process.exit(1);
  } finally {
    // Clean up tempDir
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

runInstallSmoke();
