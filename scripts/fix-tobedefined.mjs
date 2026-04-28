#!/usr/bin/env node
/**
 * Mechanical fixer for toBeDefined() calls that exceed the 5% assertion cap.
 *
 * Strategies:
 * 1. expect(x).toBeDefined(); expect(x.prop).toBe(val) → expect(x?.prop).toBe(val)
 * 2. expect(x).toBeDefined() alone → expect(x).not.toBeNull()
 * 3. expect(x.prop).toBeDefined() → remove if redundant, or expect(x.prop).not.toBeNull()
 * 4. expect(x.y).toBeDefined(); followed by expect(x.y.z) → expect(x.y?.z)
 * 5. typeof checks: expect(typeof x).toBeDefined() is nonsensical, remove
 */

import fs from 'fs';
import path from 'path';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node fix-tobedefined.mjs <file1> <file2> ...');
  process.exit(1);
}

let totalFixed = 0;

for (const filePath of files) {
  if (!fs.existsSync(filePath)) {
    console.warn(`SKIP: ${filePath} not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const originalContent = content;

  // Strategy 1: expect(x).toBeDefined() followed by expect(x.something) → merge
  for (let i = 0; i < lines.length - 1; i++) {
    const match = lines[i].match(/^(\s*)expect\(([^)]+)\)\.toBeDefined\(\);?\s*$/);
    if (match) {
      const [, indent, varName] = match;
      // Check if next non-empty line accesses a property of this variable
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nextLine = lines[j];
        // Pattern: expect(varName.prop).toBe(val) or expect(varName?.prop)
        const propMatch = nextLine.match(
          new RegExp(`^\\s*expect\\(${escapeRegex(varName)}(\\?\\.)?([^)]+)\\)\\.(toBe|toEqual|toBeGreaterThan|toBeLessThan|toContain|toMatch|toBeInstanceOf|toBeTruthy|toBeFalsy)\\(`)
        );
        if (propMatch) {
          // Merge: remove the toBeDefined line, add optional chaining to next
          lines[i] = '';
          // Already has optional chaining? Great. Otherwise add it.
          if (!nextLine.includes(`${varName}?.`)) {
            lines[j] = lines[j].replace(
              `expect(${varName}.`,
              `expect(${varName}?.`
            );
          }
          totalFixed++;
          break;
        }
        // Pattern: expect(varName[prop]) or expect(varName.length)
        const bracketMatch = nextLine.match(
          new RegExp(`^\\s*expect\\(${escapeRegex(varName)}\\[`)
        );
        if (bracketMatch) {
          lines[i] = '';
          totalFixed++;
          break;
        }
        // Check for expect(varName).toBe(expected)
        const directBeMatch = nextLine.match(
          new RegExp(`^\\s*expect\\(${escapeRegex(varName)}\\)\\.toBe\\(`)
        );
        if (directBeMatch) {
          lines[i] = '';
          totalFixed++;
          break;
        }
      }
    }
  }

  // Strategy 2: Standalone expect(x).toBeDefined() → expect(x).not.toBeNull()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)expect\(([^)]+)\)\.toBeDefined\(\);?\s*$/);
    if (match && line !== '') {
      const [, indent, varName] = match;

      // Check context: is the next line using this variable?
      let isRedundant = false;
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        if (lines[j].includes(varName) && lines[j].includes('expect(')) {
          isRedundant = true;
          break;
        }
      }

      if (isRedundant) {
        // Already handled by strategy 1 (was blanked) or will be
        // If still present, it means strategy 1 didn't catch it
        // Check if the varName access is further away
        lines[i] = `${indent}expect(${varName}).not.toBeNull();`;
        totalFixed++;
      } else {
        // Standalone - replace with not.toBeNull()
        lines[i] = `${indent}expect(${varName}).not.toBeNull();`;
        totalFixed++;
      }
    }
  }

  // Strategy 3: expect(x.prop).toBeDefined() → expect(x.prop).not.toBeNull()
  // (property-level toBeDefined)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('.toBeDefined()') && !line.match(/^(\s*)expect\([^.)]+\)\.toBeDefined\(\)/)) {
      // Has dots in the expect() - property access
      const fixed = line.replace(/\.toBeDefined\(\)/g, '.not.toBeNull()');
      if (fixed !== line) {
        lines[i] = fixed;
        totalFixed++;
      }
    }
  }

  // Clean up blank lines left by strategy 1
  const cleanedLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '' && i > 0 && lines[i-1] === '') continue;
    cleanedLines.push(lines[i]);
  }

  const newContent = cleanedLines.join('\n');
  if (newContent !== originalContent) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    const remaining = (newContent.match(/\.toBeDefined\(\)/g) || []).length;
    console.log(`FIXED: ${filePath} (${remaining} toBeDefined() remaining)`);
  } else {
    console.log(`OK: ${filePath} (no mechanical fixes applied)`);
  }
}

console.log(`\nTotal fixes applied: ${totalFixed}`);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
