#!/usr/bin/env node
import { spawn } from 'node:child_process';
import electronPath from 'electron';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited ${code}\n${stdout}\n${stderr}`));
    });
  });
}

await run(process.execPath, ['--check', 'electron/main.cjs']);
await run(process.execPath, ['--check', 'electron/preload.cjs']);
const version = await run(electronPath, ['--version']);

console.log(`Electron smoke passed: ${version.stdout}`);
