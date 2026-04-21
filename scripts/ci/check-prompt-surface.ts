#!/usr/bin/env npx tsx
/**
 * Prompt Surface CI Audit — detect prompt drift and registration issues
 *
 * Imports the prompt registry (triggering all side-effect registrations),
 * then checks:
 * 1. Registration count hasn't dropped (regression gate)
 * 2. All templates pass PromptLibrary.validate()
 * 3. No duplicate system prompts within the same category
 * 4. No empty or placeholder system prompts
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — blocking issues found
 *
 * Usage:
 *   npx tsx scripts/ci/check-prompt-surface.ts
 */

import '../../src/prompts/index.js';
import { PromptLibrary } from '../../src/prompts/PromptLibrary.js';

// ── Checks ──────────────────────────────────────────────────────────

const failures: string[] = [];
const warnings: string[] = [];

// 1. Registration count
const stats = PromptLibrary.stats();
const MIN_PROMPTS = 30;

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  Prompt Surface Audit');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log(`  Registered prompts: ${stats.total}`);
console.log(`  Categories: ${Object.keys(stats.byCategory).join(', ')}`);
console.log('');

if (stats.total < MIN_PROMPTS) {
  failures.push(`Registration count dropped to ${stats.total} (minimum: ${MIN_PROMPTS})`);
}

for (const [cat, count] of Object.entries(stats.byCategory)) {
  console.log(`    ${cat}: ${count} prompts`);
}
console.log('');

// 2. Template validation
const validations = PromptLibrary.validate();
const invalidTemplates = validations.filter((v) => !v.valid);

if (invalidTemplates.length > 0) {
  console.log(`  ✗ ${invalidTemplates.length} templates with validation issues:`);
  for (const t of invalidTemplates) {
    console.log(`    - ${t.id}: ${t.issues.join(', ')}`);
    failures.push(`Template ${t.id} has issues: ${t.issues.join(', ')}`);
  }
  console.log('');
} else {
  console.log('  ✓ All templates pass validation');
  console.log('');
}

// 3. Duplicate system prompts within categories
const allPrompts = PromptLibrary.list();
const byCategory = new Map<string, typeof allPrompts>();
for (const p of allPrompts) {
  const existing = byCategory.get(p.category) || [];
  existing.push(p);
  byCategory.set(p.category, existing);
}

for (const [cat, prompts] of byCategory) {
  const seen = new Map<string, string[]>();
  for (const p of prompts) {
    const key = p.systemPrompt.trim();
    const ids = seen.get(key) || [];
    ids.push(p.id);
    seen.set(key, ids);
  }
  for (const [content, ids] of seen) {
    if (ids.length > 1) {
      warnings.push(`Duplicate system prompt in ${cat}: ${ids.join(', ')}`);
    }
  }
}

if (warnings.length > 0) {
  console.log(`  ⚠ ${warnings.length} warnings:`);
  for (const w of warnings) {
    console.log(`    - ${w}`);
  }
  console.log('');
}

// 4. Empty or placeholder detection
for (const p of allPrompts) {
  const sys = p.systemPrompt.trim();
  if (sys.length < 50) {
    failures.push(`${p.id}: system prompt suspiciously short (${sys.length} chars)`);
  }
  if (sys.includes('TODO') || sys.includes('PLACEHOLDER') || sys.includes('FIXME')) {
    failures.push(`${p.id}: system prompt contains placeholder marker`);
  }
}

// ── Verdict ──────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
if (failures.length === 0) {
  console.log(`  PASS: ${stats.total} prompts registered, all valid`);
  if (warnings.length > 0) {
    console.log(`  (${warnings.length} non-blocking warnings)`);
  }
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  process.exit(0);
} else {
  console.log(`  FAIL: ${failures.length} blocking issues`);
  for (const f of failures) {
    console.log(`    ✗ ${f}`);
  }
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  process.exit(1);
}
