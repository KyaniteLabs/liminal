#!/usr/bin/env node
/**
 * Comprehensive Documentation Audit
 * Runs all validation checks and generates report
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const checks = [
  { name: 'Version Consistency', cmd: 'node scripts/validate-version.js' },
  { name: 'File References', cmd: 'node scripts/verify-file-refs.js' },
  { name: 'Undocumented Code', cmd: 'node scripts/detect-undocumented.js' },
];

const results = [];
let failed = 0;

console.log('🔍 Running Comprehensive Documentation Audit\n');

for (const { name, cmd } of checks) {
  process.stdout.write(`Checking ${name}... `);
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log('✅');
    results.push({ name, status: 'PASS' });
  } catch (err) {
    console.log('❌');
    results.push({ name, status: 'FAIL', error: err.message });
    failed++;
  }
}

// Generate report
const report = `# Documentation Audit Report
Generated: ${new Date().toISOString()}

## Summary
- Passed: ${results.length - failed}/${results.length}
- Failed: ${failed}/${results.length}

## Results
${results.map(r => `- ${r.status === 'PASS' ? '✅' : '❌'} ${r.name}`).join('\n')}

## Next Steps
${failed > 0 ? '- Fix failing checks above\n- Run: npm run validate-docs' : '- All checks passed! 🎉'}
`;

writeFileSync(resolve('AUDIT_REPORT_LATEST.md'), report);
console.log(`\n📄 Report saved to AUDIT_REPORT_LATEST.md`);
process.exit(failed > 0 ? 1 : 0);
