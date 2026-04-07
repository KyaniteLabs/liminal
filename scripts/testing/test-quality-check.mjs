#!/usr/bin/env node
/**
 * Test Quality Checker for Liminal
 *
 * Standalone script that enforces test quality patterns without ESLint plugin
 * registration hassles. Run as:
 *   - `node scripts/testing/test-quality-check.mjs`
 *   - CI step (parallel to eslint)
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = violations found (warnings treated as errors in CI)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { cwd } from 'node:process';

const ROOT = cwd();

// ── Configuration ────────────────────────────────────────────────────────
const CONFIG = {
  // Directories to scan for test files
  testDirs: ['test/'],

  // Maximum number of violations before hard failure
  maxErrors: Infinity,
  maxWarnings: Infinity,

  // Treat warnings as errors only in strict mode (STRICT_QUALITY=1).
  // Pre-existing warnings are tracked as tech debt; they don't block CI
  // until STRICT_QUALITY enforcement is turned on deliberately.
  warningAsError: process.env.STRICT_QUALITY === '1',

  // toBeDefined cap: warning now, error when STRICT_QUALITY=1
  toBeDefinedStrict: process.env.STRICT_QUALITY === '1',
};

// ── Violation tracking ────────────────────────────────────────────────────
const violations = {
  errors: [],
  warnings: [],
};

function addViolation(severity, rule, file, line, message) {
  violations[severity === 'error' ? 'errors' : 'warnings'].push({
    rule,
    file,
    line,
    message,
  });
}

// ── Rule: require-vi-hoisted ──────────────────────────────────────────────
// Detects mock variables used in vi.mock() factories that aren't vi.hoisted()
function checkViHoisted(content, filePath) {
  const lines = content.split('\n');

  // Find all const declarations at module level
  const declarations = new Map(); // name -> { line, isHoisted }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match: const { mockX, mockY } = vi.hoisted(() => ...  (destructuring form)
    const hoistedMatch = line.match(/const\s*\{([^}]+)\}\s*=\s*vi\.hoisted/);
    if (hoistedMatch) {
      const names = hoistedMatch[1].split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean);
      for (const name of names) {
        declarations.set(name, { line: i + 1, hoisted: true });
      }
      continue;
    }

    // Match: const mockX = vi.hoisted(...)  (direct assignment form)
    const hoistedDirectMatch = line.match(/^const\s+(\w+)\s*=\s*vi\.hoisted/);
    if (hoistedDirectMatch) {
      declarations.set(hoistedDirectMatch[1], { line: i + 1, hoisted: true });
      continue;
    }

    // Match: const mockX = vi.fn()
    const constMatch = line.match(/^const\s+(\w+)\s*=\s*/);
    if (constMatch) {
      const name = constMatch[1];
      if (name.startsWith('mock') || name.startsWith('Mock') || name.includes('Mock')) {
        declarations.set(name, { line: i + 1, hoisted: false });
      }
    }
  }

  // Find vi.mock() calls and extract identifiers used in their factories
  const mockBlocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('vi.mock(')) {
      // Find the factory function - scan ahead for the arrow function or function expression
      let depth = 0;
      let factoryStart = -1;
      let blockFound = false;
      for (let j = i; j < lines.length && j < i + 50; j++) {
        const l = lines[j];
        if (l.includes('()') && (l.includes('=>') || l.includes('{'))) {
          factoryStart = j;
        }
        depth += (l.match(/\(/g) || []).length - (l.match(/\)/g) || []).length;
        if (depth <= 0 && factoryStart >= 0 && j > i + 1) {
          // We have the complete vi.mock() block
          const block = lines.slice(i, j + 1).join('\n');
          mockBlocks.push(block);
          blockFound = true;
          break;
        }
      }
      // Only fall back to 30-line window if we couldn't find the closing paren
      if (!blockFound && factoryStart >= 0) {
        mockBlocks.push(lines.slice(i, i + 30).join('\n'));
      }
    }
  }

  // Check each mock block for references to non-hoisted variables
  for (const block of mockBlocks) {
    for (const [name, info] of declarations) {
      if (!info.hoisted) {
        // Check if this variable name appears inside the mock block
        const regex = new RegExp(`\\b${name}\\b`, 'g');
        if (regex.test(block)) {
          addViolation(
            'error',
            'require-vi-hoisted',
            filePath,
            info.line,
            `\`${name}\` is used inside vi.mock() but not created with vi.hoisted(). ` +
            `This causes ReferenceError: Cannot access '${name}' before initialization. ` +
            `Wrap in: const { ${name} } = vi.hoisted(() => ({ ${name}: vi.fn() }))`,
          );
        }
      }
    }
  }
}

// ── Rule: no-weak-test-assertions ──────────────────────────────────────────
// Detects weak assertion patterns that indicate PADDING/WEAK quality
function checkWeakAssertions(content, filePath) {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // toBeDefined() — proves existence only
    if (line.includes('.toBeDefined()')) {
      addViolation(
        'warning',
        'no-weak-test-assertions',
        filePath,
        i + 1,
        'toBeDefined() only proves the value is not undefined, not that it is correct. ' +
        'Use toBe(expectedValue) or toEqual(expectedShape) instead.',
      );
    }

    // toBeTruthy() — passes for any truthy value
    if (line.includes('. toBeTruthy()')) {
      addViolation(
        'warning',
        'no-weak-test-assertions',
        filePath,
        i + 1,
        'toBeTruthy() passes for any truthy value (1, "abc", {}, []). ' +
        'Use toBe(true), toBe(expectedValue), or toEqual(expectedShape) instead.',
      );
    }

    // typeof x === 'boolean' without checking the expected value
    if (line.includes("typeof") && line.includes("'boolean'") && line.includes("expect")) {
      addViolation(
        'warning',
        'no-weak-test-assertions',
        filePath,
        i + 1,
        'typeof x === "boolean" only checks the type, not the expected value. ' +
        'Use expect(x).toBe(true) or expect(x).toBe(false) instead.',
      );
    }

    // toContain with single character
    const singleCharMatch = line.match(/\. toContain\(\s*['"](\w)['"]\s*\)/);
    if (singleCharMatch) {
      addViolation(
        'warning',
        'no-weak-test-assertions',
        filePath,
        i + 1,
        `toContain('${singleCharMatch[1]}') with single char matches almost anything. ` +
        'Use a longer, more specific substring or toMatch(/pattern/) instead.',
      );
    }
  }
}

// ── Rule: no-padding-tests ────────────────────────────────────────────────
// Detects PADDING pattern: test files with only constructor + generateReport tests
function checkPaddingTests(content, filePath) {
  const testNames = [];
  const describeMatch = content.match(/it\(['"]([^'"]+)['"]/g);
  if (describeMatch) {
    for (const m of describeMatch) {
      const name = m.match(/it\(['"]([^'"]+)['"]/)?.[1];
      if (name) testNames.push(name.toLowerCase());
    }
  }

  // PADDING pattern: only has constructor and report tests
  const hasOnlyPadding =
    testNames.length > 0 &&
    testNames.length <= 3 &&
    testNames.every(n =>
      n.includes('constructor') ||
      n.includes('create') ||
      n.includes('factory') ||
      n.includes('instance') ||
      n.includes('generatereport') ||
      n.includes('get session') ||
      n.includes('session') && n.includes('return')
    );

  if (hasOnlyPadding) {
    addViolation(
      'error',
      'no-padding-tests',
      filePath,
      0,
      'Test file appears to be PADDING quality (only constructor/factory/report tests). ' +
      'Add behavioral tests: test actual outcomes, not just object creation.',
    );
  }
}

// ── Rule: toBe-defined-cap ────────────────────────────────────────────────
// Enforces that toBeDefined() is at most 5% of total assertions per file
// Target: 75% coverage requires high-quality assertions, not existence checks
function checkToBeDefinedCap(content, filePath) {
  const MAX_DEFINED_RATIO = 0.05; // 5% cap

  // Count all expect() assertions
  const assertionMatches = content.match(/expect\s*\(/g) || [];
  const totalAssertions = assertionMatches.length;

  if (totalAssertions < 10) return; // Skip small files

  // Count toBeDefined assertions
  const definedMatches = content.match(/\.toBeDefined\s*\(\)/g) || [];
  const definedCount = definedMatches.length;

  const ratio = definedCount / totalAssertions;
  if (ratio > MAX_DEFINED_RATIO) {
    const severity = CONFIG.toBeDefinedStrict ? 'error' : 'warning';
    addViolation(
      severity,
      'tobe-defined-cap',
      filePath,
      0,
      `toBeDefined() is ${(ratio * 100).toFixed(1)}% of assertions (${definedCount}/${totalAssertions}), ` +
      `exceeding the 5% cap. Replace with toBe(expectedValue) or toEqual(expectedShape). ` +
      `(Coverage target: 75% — existence-only assertions don't count toward it.)`,
    );
  }
}

// ── Main execution ──────────────────────────────────────────────────────
function findTestFiles() {
  const exts = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];
  const results = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (exts.some(ext => entry.name.endsWith(ext))) results.push(full);
    }
  }

  walk('test');
  return results.sort();
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  checkViHoisted(content, filePath);
  checkWeakAssertions(content, filePath);
  checkPaddingTests(content, filePath);
  checkToBeDefinedCap(content, filePath);
}

// Run
const testFiles = findTestFiles();
console.log(`\n🔍 Test Quality Check: scanning ${testFiles.length} test files...\n`);

for (const file of testFiles) {
  checkFile(file);
}

// Report
const totalErrors = violations.errors.length;
const totalWarnings = violations.warnings.length;

if (totalErrors > 0) {
  console.log(`\n❌ Errors: ${totalErrors}`);
  for (const v of violations.errors) {
    const loc = v.line ? `:${v.line}` : '';
    console.log(`  ${v.file}${loc}  [${v.rule}]  ${v.message}`);
  }
}

if (totalWarnings > 0) {
  console.log(`\n⚠️  Warnings: ${totalWarnings}`);
  for (const v of violations.warnings) {
    const loc = v.line ? `:${v.line}` : '';
    console.log(`  ${v.file}${loc}  [${v.rule}]  ${v.message}`);
  }
}

if (totalErrors === 0 && totalWarnings === 0) {
  console.log('\n✅ All test quality checks passed!\n');
} else {
  console.log(`\n📊 Summary: ${totalErrors} errors, ${totalWarnings} warnings\n`);
}

// Exit code
if (totalErrors > 0) {
  process.exit(1);
}
if (totalWarnings > 0 && CONFIG.warningAsError) {
  console.log('(Warnings treated as errors in CI)\n');
  process.exit(1);
}

process.exit(0);
