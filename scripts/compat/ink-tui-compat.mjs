#!/usr/bin/env node
/** Compatibility-only launcher for the retired Ink TUI. */
import { spawn } from 'node:child_process';

if (process.env.LIMINAL_ENABLE_LEGACY_INK_TUI !== '1') {
  console.error('Legacy Ink TUI is compatibility-only and disabled by default.');
  console.error('Use the canonical operator cockpit instead: pnpm tui');
  console.error('If you must compare legacy behavior, set LIMINAL_ENABLE_LEGACY_INK_TUI=1.');
  process.exit(1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(npx, ['tsx', 'src/tui/HarnessTUI.tsx'], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('Failed to launch legacy Ink TUI:', err.message);
  process.exit(1);
});
