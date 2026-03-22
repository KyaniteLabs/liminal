/**
 * LIRPromptFormatter — converts LIR tokens into compact, prompt-ready text.
 *
 * This is the central abstraction all consumers use when injecting seed data
 * into prompts. When a seed has LIR, structured metadata is used.
 * When it doesn't, raw content is returned unchanged.
 */

import type { Seed } from '../../compost/types.js';
import type { LIRToken, LIRCodeToken, LIRDocToken, LIRTextToken } from './types.js';

/** Default token budget for prompt formatting. */
const DEFAULT_BUDGET = 500;

/**
 * Format a seed for prompt injection. Uses LIR if available, falls back to raw content.
 */
export function formatSeedForPrompt(seed: Seed, budget = DEFAULT_BUDGET): string {
  if (seed.lir) {
    return formatLIRForPrompt(seed.lir, budget);
  }
  return seed.content;
}

/**
 * Format an LIR token for prompt injection (compact, budget-aware).
 */
export function formatLIRForPrompt(token: LIRToken, budget = DEFAULT_BUDGET): string {
  switch (token.type) {
    case 'code':
      return formatCodeToken(token, budget);
    case 'doc':
      return formatDocToken(token, budget);
    case 'text':
      return formatTextToken(token, budget);
  }
}

/**
 * Format a code token — signature, kind, metrics, exports. No raw source.
 */
function formatCodeToken(token: LIRCodeToken, budget: number): string {
  const parts: string[] = [];
  parts.push(`[${token.kind}] ${token.name}`);
  if (token.signature) {
    parts.push(`  ${token.signature}`);
  }
  if (token.summary) {
    parts.push(`  ${token.summary}`);
  }
  const metrics: string[] = [];
  metrics.push(`loc: ${token.metrics.loc}`);
  metrics.push(`complexity: ${token.metrics.cyclomaticComplexity}`);
  if (token.relationships.exports.length > 0) {
    metrics.push(`exports: ${token.relationships.exports.join(', ')}`);
  }
  if (token.language) {
    metrics.push(`lang: ${token.language}`);
  }
  parts.push(`  ${metrics.join(' | ')}`);

  const result = parts.join('\n');
  return truncate(result, budget);
}

/**
 * Format a doc token — heading hierarchy, summary, key sections.
 */
function formatDocToken(token: LIRDocToken, budget: number): string {
  const parts: string[] = [];
  const prefix = '#'.repeat(token.level);
  parts.push(`${prefix} ${token.heading}`);
  if (token.summary) {
    parts.push(`  ${token.summary}`);
  }
  parts.push(`  words: ${token.metrics.wordCount}`);
  if (token.codeReferences.length > 0) {
    parts.push(`  refs: ${token.codeReferences.join(', ')}`);
  }

  const result = parts.join('\n');
  return truncate(result, budget);
}

/**
 * Format a text token — headings, paragraph summaries.
 */
function formatTextToken(token: LIRTextToken, budget: number): string {
  const parts: string[] = [];
  if (token.structure.headings.length > 0) {
    parts.push(token.structure.headings.map(h => `${'#'.repeat(h.level)} ${h.text}`).join('\n'));
  }
  parts.push(`words: ${token.metrics.wordCount}`);

  const result = parts.join('\n');
  return truncate(result, budget);
}

/**
 * Format seed metadata for CLI display (rich, no budget).
 */
export function formatSeedForDisplay(seed: Seed): string {
  if (!seed.lir) {
    return seed.content;
  }

  const lines: string[] = [];

  switch (seed.lir.type) {
    case 'code': {
      const t = seed.lir as LIRCodeToken;
      lines.push(`LIR: code`);
      lines.push(`  Symbol: ${t.kind} ${t.name}`);
      if (t.signature) lines.push(`  Signature: ${t.signature}`);
      if (t.language) lines.push(`  Language: ${t.language}`);
      lines.push(`  Location: ${t.location.file}:${t.location.startLine}-${t.location.endLine}`);
      lines.push(`  Metrics: loc=${t.metrics.loc}, complexity=${t.metrics.cyclomaticComplexity}, params=${t.metrics.paramCount}`);
      if (t.relationships.exports.length > 0) {
        lines.push(`  Exports: ${t.relationships.exports.join(', ')}`);
      }
      break;
    }
    case 'doc': {
      const t = seed.lir as LIRDocToken;
      lines.push(`LIR: doc`);
      lines.push(`  Heading: ${t.heading} (level ${t.level})`);
      if (t.summary) lines.push(`  Summary: ${t.summary}`);
      lines.push(`  Metrics: words=${t.metrics.wordCount}, codeBlocks=${t.metrics.codeBlockCount}, links=${t.metrics.linkCount}`);
      if (t.codeReferences.length > 0) {
        lines.push(`  Code refs: ${t.codeReferences.join(', ')}`);
      }
      break;
    }
    case 'text': {
      const t = seed.lir as LIRTextToken;
      lines.push(`LIR: text`);
      if (t.structure.headings.length > 0) {
        lines.push(`  Headings: ${t.structure.headings.map(h => h.text).join(', ')}`);
      }
      lines.push(`  Metrics: words=${t.metrics.wordCount}, paragraphs=${t.metrics.paragraphCount}`);
      break;
    }
  }

  lines.push('');
  lines.push('(raw content below)');
  lines.push('---');
  lines.push(seed.content);

  return lines.join('\n');
}

/** Truncate string to budget, adding ellipsis if needed. */
function truncate(text: string, budget: number): string {
  if (text.length <= budget) return text;
  return text.slice(0, budget - 3) + '...';
}
