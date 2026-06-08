#!/usr/bin/env node

import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import os from 'os';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const binPath = path.join(repoRoot, 'bin', 'sinter');

async function runCommand(args, envOverrides = {}) {
  const tempHome = path.join(os.tmpdir(), `sinter-smoke-home-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  await fs.mkdir(tempHome, { recursive: true });

  const env = {
    ...process.env,
    HOME: tempHome,
    USERPROFILE: tempHome,
    NODE_ENV: 'test',
    ...envOverrides,
  };

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [binPath, ...args], {
      cwd: repoRoot,
      env,
    });
    return { success: true, code: 0, stdout, stderr, tempHome };
  } catch (error) {
    return {
      success: false,
      code: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      tempHome,
    };
  } finally {
    // Clean up tempHome
    await fs.rm(tempHome, { recursive: true, force: true }).catch(() => {});
  }
}

async function runSmokeTests() {
  console.log('🚀 Starting Sinter Startup Smoke Tests...');
  const results = [];

  // Test 1: --version
  console.log('Checking --version...');
  const resVersion = await runCommand(['--version']);
  const versionOk = resVersion.success && resVersion.stdout.includes('Sinter v');
  console.log(`  Exit code: ${resVersion.code}, Ok: ${versionOk}`);
  results.push({ name: '--version', ok: versionOk, code: resVersion.code, stdout: resVersion.stdout, stderr: resVersion.stderr });

  // Test 2: --help
  console.log('Checking --help...');
  const resHelp = await runCommand(['--help']);
  const helpOk = resHelp.success && resHelp.stdout.includes('USAGE:');
  console.log(`  Exit code: ${resHelp.code}, Ok: ${helpOk}`);
  results.push({ name: '--help', ok: helpOk, code: resHelp.code, stdout: resHelp.stdout, stderr: resHelp.stderr });

  // Test 3: No-config start
  console.log('Checking no-config start (should fail gracefully)...');
  const resNoConfig = await runCommand(['-p', 'test prompt']);
  const noConfigOk = !resNoConfig.success && 
                     resNoConfig.code === 1 && 
                     resNoConfig.stderr.includes('Error') && 
                     !resNoConfig.stderr.includes('at Module._resolveFilename') &&
                     !resNoConfig.stderr.includes('at Object.run');
  console.log(`  Exit code: ${resNoConfig.code}, Ok: ${noConfigOk}`);
  results.push({ name: 'no-config start', ok: noConfigOk, code: resNoConfig.code, stdout: resNoConfig.stdout, stderr: resNoConfig.stderr });

  // Test 4: Bad-provider start
  console.log('Checking bad-provider start (should fail gracefully)...');
  const resBadProvider = await runCommand(['--provider', 'openai', '--base-url', 'http://127.0.0.1:9999/v1', '-p', 'test prompt']);
  const badProviderOk = !resBadProvider.success && 
                        resBadProvider.code === 1 && 
                        resBadProvider.stderr.includes('Error') && 
                        !resBadProvider.stderr.includes('at Module._resolveFilename') &&
                        !resBadProvider.stderr.includes('at Object.run');
  console.log(`  Exit code: ${resBadProvider.code}, Ok: ${badProviderOk}`);
  results.push({ name: 'bad-provider start', ok: badProviderOk, code: resBadProvider.code, stdout: resBadProvider.stdout, stderr: resBadProvider.stderr });

  // Determine aggregate success
  const allPassed = results.every(r => r.ok);
  
  // Write results to .quality/release/startup-smoke.json
  const qualityDir = path.join(repoRoot, '.quality', 'release');
  await fs.mkdir(qualityDir, { recursive: true });
  const resultsPath = path.join(qualityDir, 'startup-smoke.json');
  await fs.writeFile(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    success: allPassed,
    cases: results
  }, null, 2) + '\n');
  
  console.log(`\n📝 Results written to ${resultsPath}`);
  
  if (allPassed) {
    console.log('✅ All startup smoke tests passed!');
    process.exit(0);
  } else {
    console.error('❌ Some startup smoke tests failed!');
    process.exit(1);
  }
}

runSmokeTests().catch(err => {
  console.error('Smoke test harness failed:', err);
  process.exit(1);
});
