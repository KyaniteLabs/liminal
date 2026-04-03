/**
 * Shared scoring utilities for collaborative generation
 *
 * Provides heuristic quality scoring for different creative domains.
 * Used across both CollaborativeClient and DeepCollaboration.
 */

import { Domain } from '../types/domains.js';

/**
 * Quick heuristic quality score for creative outputs
 *
 * Returns a score between 0.0 and 1.0 based on domain-specific heuristics.
 * Merges the best heuristics from both CollaborativeClient and DeepCollaboration.
 *
 * @param output - The creative output to score
 * @param domain - The creative domain (e.g., 'ascii', 'music', 'code')
 * @returns Quality score between 0.0 and 1.0
 */
export function quickScore(output: string, domain: Domain): number {
  let score = 0.5;

  // Length check - use more generous range from DeepCollaboration (100-3000)
  const length = output.length;
  if (length >= 100 && length <= 3000) {
    score += 0.15;  // More generous bonus from DeepCollaboration
  } else if (length < 50) {
    score -= 0.3;   // More generous penalty from DeepCollaboration (was -0.2 in CollabClient)
  }

  // Domain-specific heuristics - merged from both versions
  if (domain === 'ascii') {
    // ASCII should have special characters (from CollabClient)
    if (/[/\\|()\-=+*<>@#%]/.test(output)) score += 0.15;
    // Should have multiple lines (from CollabClient)
    if (output.split('\n').length >= 3) score += 0.1;
    // Character variety (from DeepCollaboration)
    const uniqueChars = new Set(output).size;
    if (uniqueChars >= 10) score += 0.1;
  } else if (domain === 'music') {
    // Music notation markers - merged from both versions
    // From CollabClient: basic ABC notation markers
    if (/X:|T:|M:|K:|L:/i.test(output)) score += 0.2;
    // From DeepCollaboration: additional markers with density scoring
    const markers = ['X:', 'T:', 'M:', 'K:', 'L:', 'V:', '|', ':|', '[', ']', '"'];
    const markerCount = markers.filter(m => output.includes(m)).length;
    score += Math.min(0.25, markerCount * 0.03);
    // Should have notes (from CollabClient)
    if (/[CDEFGAB]/i.test(output)) score += 0.1;
    // Note density (from DeepCollaboration)
    const noteCount = (output.match(/[CDEFGAB]/gi) || []).length;
    if (noteCount >= 10) score += 0.1;
  } else if (domain === Domain.CODE || domain === Domain.P5 || domain === Domain.GLSL || domain === Domain.THREE) {
    // Code keywords - merged from both versions
    // From CollabClient: basic keywords
    const collabKeywords = ['def ', 'class', 'function', 'return', 'import', 'var', 'let', 'const'];
    // From DeepCollaboration: additional keywords
    const deepKeywords = ['def ', 'class ', 'function', 'import ', 'from ', 'const ', 'let ', 'var '];
    const allCodeKeywords = [...new Set([...collabKeywords, ...deepKeywords])];
    if (allCodeKeywords.some(kw => output.includes(kw))) score += 0.15;
    // Logic keywords (from DeepCollaboration)
    const logicKeywords = ['if ', 'for ', 'while ', 'return '];
    if (logicKeywords.some(kw => output.includes(kw))) score += 0.1;
    // Should have some structure (from CollabClient)
    if (output.split('\n').length >= 5) score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}
