#!/usr/bin/env node
/**
 * Version Consistency Validator
 * Ensures all version files match
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const quiet = process.argv.includes('--quiet');

const files = [
  { path: 'package.json', extract: (content) => JSON.parse(content).version },
  { path: 'VERSION', extract: (content) => content.trim() },
  { path: 'CHANGELOG.md', extract: (content) => content.match(/## \[(\d+\.\d+\.\d+)\]/)?.[1] },
  { path: 'docs/THE_BIBLE.md', extract: (content) => content.match(/Version[:\*]*\s*(\d+\.\d+\.?\d*)/i)?.[1] },
];

const versions = {};
let exitCode = 0;

for (const { path, extract } of files) {
  try {
    const content = readFileSync(resolve(path), 'utf-8');
    const version = extract(content);
    versions[path] = version;
    
    if (!version) {
      if (!quiet) console.error(`❌ ${path}: Could not extract version`);
      exitCode = 1;
    }
  } catch (err) {
    if (!quiet) console.error(`❌ ${path}: ${err.message}`);
    exitCode = 1;
  }
}

// Check consistency
const uniqueVersions = [...new Set(Object.values(versions).filter(Boolean))];
if (uniqueVersions.length > 1) {
  if (!quiet) {
    console.error('\n❌ VERSION MISMATCH DETECTED:');
    for (const [file, version] of Object.entries(versions)) {
      console.error(`   ${file}: ${version || 'NOT FOUND'}`);
    }
    console.error(`\nExpected: All versions should be ${uniqueVersions[0]}`);
  }
  exitCode = 1;
} else if (uniqueVersions.length === 1) {
  if (!quiet) console.log(`✅ All version files consistent: ${uniqueVersions[0]}`);
}

process.exit(exitCode);
