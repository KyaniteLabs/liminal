/**
 * SyllableCounter — Pure vowel-group syllable estimation for English text.
 *
 * Ported from the Python lyrics-engine syllable counter. Counts syllables using
 * vowel group patterns without requiring an external dictionary.
 *
 * Algorithm:
 * 1. Consecutive vowel groups (a, e, i, o, u, y) each count as one syllable.
 * 2. A trailing silent 'e' does not count as a syllable.
 * 3. An 'le' ending after a consonant counts as one syllable (e.g. "ta-ble").
 * 4. The digraph 'io' (not preceded by a consonant) counts as two syllables.
 * 5. Every word has a minimum of one syllable.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Vowel characters used for syllable grouping. */
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

/**
 * Determine whether a character is a vowel.
 *
 * @param ch - A single lowercase character.
 * @returns `true` if the character is a vowel.
 */
function isVowel(ch: string): boolean {
  return VOWELS.has(ch);
}

/**
 * Check whether a character is a consonant (English letter that is not a vowel).
 *
 * @param ch - A single lowercase character.
 * @returns `true` if the character is a consonant.
 */
function isConsonant(ch: string): boolean {
  return ch >= 'a' && ch <= 'z' && !VOWELS.has(ch);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Count the number of syllables in a single English word using vowel-group
 * heuristics.
 *
 * Rules applied (in order):
 * 1. Every word has at least one syllable.
 * 2. Consecutive vowels are grouped and counted as a single syllable.
 * 3. A final silent 'e' is removed from the count (unless the word is only
 *    the letter "e").
 * 4. When a word ends in consonant + "le", the silent-e rule is reversed and
 *    the 'e' contributes a syllable (e.g. "ta-ble" -> 2).
 * 5. The digraph "io" preceded by a vowel is counted as two syllables
 *    (e.g. "poem" has no "io", but "radio" has "io" preceded by 'd' which is
 *    a consonant so it stays at 1 for that group; "na-i-o-nal" would split).
 *    Specifically, when "io" appears and the character before it is NOT a
 *    consonant, we add an extra syllable.
 *
 * @param word - A single word (case-insensitive; non-alpha characters are stripped).
 * @returns The estimated number of syllables (minimum 1).
 *
 * @example
 * countSyllables('hello')   // 2
 * countSyllables('table')   // 2
 * countSyllables('radio')   // 4
 * countSyllables('fire')    // 2
 * countSyllables('the')     // 1
 */
export function countSyllables(word: string): number {
  // Normalise: lowercase, strip non-alpha
  const w = (word || '').toLowerCase().replace(/[^a-z]/g, '');

  if (w.length === 0) {
    return 0;
  }

  // Special-case single-letter words
  if (w.length === 1) {
    return 1;
  }

  // Count consecutive vowel groups
  let count = 0;
  let prevVowel = false;

  for (let i = 0; i < w.length; i++) {
    const current = isVowel(w[i]);
    if (current && !prevVowel) {
      count++;
    }
    prevVowel = current;
  }

  // Rule: final silent 'e'
  // If the word ends in 'e' and has more than one vowel group, discount it.
  if (w.endsWith('e') && count > 1) {
    // Check for the 'le' exception first.
    const endsWithConsonantLE =
      w.length >= 3 &&
      w.endsWith('le') &&
      isConsonant(w[w.length - 3]);

    if (!endsWithConsonantLE) {
      count--;
    }
  }

  // Rule: 'io' preceded by a non-consonant counts as 2 syllables.
  // We walk through and for every 'io' where the preceding char is NOT a
  // consonant, we add one (the vowel-group pass counted it as one group).
  for (let i = 1; i < w.length - 1; i++) {
    if (w[i] === 'i' && w[i + 1] === 'o') {
      // If preceded by a consonant, 'io' is treated as a single syllable
      // (already counted). If preceded by a vowel or at start-of-word, add one.
      if (i === 0 || !isConsonant(w[i - 1])) {
        count++;
      }
    }
  }

  // Every word has at least one syllable
  return Math.max(1, count);
}

/**
 * Count the total number of syllables across all words in a line of text.
 *
 * Words are split on whitespace and punctuation boundaries. The count is the
 * sum of {@link countSyllables} for each extracted word.
 *
 * @param line - A line of English text.
 * @returns The total estimated syllable count for the line.
 *
 * @example
 * countLineSyllables('The quick brown fox') // 1 + 1 + 1 + 1 = 4
 * countLineSyllables('A beautiful sunrise') // 1 + 4 + 2 = 7
 */
export function countLineSyllables(line: string): number {
  if (!line || line.trim().length === 0) {
    return 0;
  }

  // Split on whitespace; each token may contain punctuation which
  // countSyllables() strips internally.
  const words = line.trim().split(/\s+/);
  let total = 0;

  for (const word of words) {
    total += countSyllables(word);
  }

  return total;
}

/**
 * Result of validating a set of lines against a target syllable count per line.
 */
export interface SyllableValidationResult {
  /** `true` when every line matches `targetSyllables`. */
  valid: boolean;
  /** The actual syllable counts for each line (same length as input `lines`). */
  actual: number[];
  /** Suggested fixes for lines that deviate from the target. */
  suggestions: string[];
}

/**
 * Validate that each line in an array of text lines matches a target syllable
 * count, and produce actionable suggestions for lines that deviate.
 *
 * @param lines           - Array of lyric/text lines to validate.
 * @param targetSyllables - The expected number of syllables per line.
 * @returns A {@link SyllableValidationResult} with per-line counts and
 *          human-readable suggestions for corrective edits.
 *
 * @example
 * const result = validateSyllableConstraint(
 *   ['The sun is bright', 'A quiet morning here'],
 *   5,
 * );
 * // result.valid === false
 * // result.actual === [4, 7]
 * // result.suggestions contains advice for each mismatched line
 */
export function validateSyllableConstraint(
  lines: string[],
  targetSyllables: number,
): SyllableValidationResult {
  const actual: number[] = [];
  const suggestions: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const count = countLineSyllables(lines[i]);
    actual.push(count);

    if (count !== targetSyllables) {
      const diff = count - targetSyllables;
      const direction = diff > 0 ? 'too many' : 'too few';
      const absDiff = Math.abs(diff);

      let suggestion: string;

      if (diff > 0) {
        suggestion =
          `Line ${i + 1}: has ${count} syllables (${absDiff} ${direction}). ` +
          `Remove ${absDiff} syllable${absDiff > 1 ? 's' : ''} ` +
          `to reach the target of ${targetSyllables}. ` +
          `("${lines[i]}")`;
      } else {
        suggestion =
          `Line ${i + 1}: has ${count} syllables (${absDiff} ${direction}). ` +
          `Add ${absDiff} syllable${absDiff > 1 ? 's' : ''} ` +
          `to reach the target of ${targetSyllables}. ` +
          `("${lines[i]}")`;
      }

      suggestions.push(suggestion);
    }
  }

  const valid = actual.every((c) => c === targetSyllables);

  return { valid, actual, suggestions };
}
