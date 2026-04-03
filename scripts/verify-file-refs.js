#!/usr/bin/env node
/**
 * Bible File Reference Validator
 * Ensures all src/ file paths in THE_BIBLE.md exist
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const quiet = process.argv.includes('--quiet');

const bibleContent = readFileSync(resolve('docs/THE_BIBLE.md'), 'utf-8');

// Extract file paths from markdown tables and inline references
const fileRefs = [
  ...bibleContent.matchAll(/`src\/([^`]+)`/g),
  ...bibleContent.matchAll(/src\/([a-zA-Z0-9\/._-]+\.ts)/g),
];

let errors = 0;
const checked = new Set();

for (const [, filePath] of fileRefs) {
  if (checked.has(filePath)) continue;
  checked.add(filePath);
  
  const fullPath = resolve('src', filePath);
  if (!existsSync(fullPath)) {
    if (!quiet) console.error(`❌ Referenced file not found: src/${filePath}`);
    errors++;
  }
}

if (errors === 0) {
  if (!quiet) console.log(`✅ All ${checked.size} file references verified`);
} else {
  if (!quiet) console.error(`\n❌ ${errors} file reference(s) invalid`);
  process.exit(1);
}
