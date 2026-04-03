#!/usr/bin/env node
/**
 * Undocumented Code Detector
 * Finds src/ directories not mentioned in THE_BIBLE.md
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const quiet = process.argv.includes('--quiet');

const bibleContent = readFileSync(resolve('docs/THE_BIBLE.md'), 'utf-8').toLowerCase();
const srcDir = resolve('src');

const entries = readdirSync(srcDir);
const undocumented = [];

for (const entry of entries) {
  const fullPath = resolve(srcDir, entry);
  const stat = statSync(fullPath);
  
  // Check if it's a directory with .ts files
  if (stat.isDirectory()) {
    const hasTsFiles = readdirSync(fullPath).some(f => f.endsWith('.ts'));
    if (hasTsFiles) {
      // Check if mentioned in Bible
      const mentioned = bibleContent.includes(entry.toLowerCase()) ||
                       bibleContent.includes(entry.replace(/-/g, ' ').toLowerCase());
      if (!mentioned) {
        undocumented.push(entry);
      }
    }
  }
}

if (undocumented.length > 0) {
  if (!quiet) {
    console.error('⚠️  Potentially undocumented directories:');
    for (const dir of undocumented) {
      console.error(`   - src/${dir}/`);
    }
    console.error('\nIf these are intentional, add them to THE_BIBLE.md');
  }
  // Don't exit with error - this is a warning
} else {
  if (!quiet) console.log('✅ All source directories documented');
}
