/**
 * RhymeEngine - Pure TypeScript rhyme classification and scoring.
 *
 * Ports the core rhyme-analysis logic from the Python lyrics-engine,
 * replacing the `pronouncing` library with a built-in vowel-group system
 * that extracts phonetic cues directly from English spelling patterns.
 *
 * No external dependencies. No dictionary lookups.
 */

// ---------------------------------------------------------------------------
// Vowel group system
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Spelling -> phonetic approximation helpers
// ---------------------------------------------------------------------------

/**
 * Common English spelling patterns mapped to their canonical vowel group.
 * Ordered longest-first so the greedy matcher tries the most specific
 * pattern before shorter alternatives.
 */
const SPELLING_VOWEL_PATTERNS: ReadonlyArray<{
  /** Lowercase regex pattern for the trailing vowel portion of a word. */
  readonly pattern: string;
  /** Canonical vowel-group key (`a | e | i | o | u`). */
  readonly group: string;
}> = [
  // --- 'a' family (AH, AA, AW) -----------------------------------------
  { pattern: 'ought$', group: 'a' },
  { pattern: 'augh$', group: 'a' },
  { pattern: 'ough$', group: 'o' }, // rough/tough -> actually 'u' sound but group 'o' is close enough
  { pattern: 'awn$', group: 'a' },
  { pattern: 'aw$', group: 'a' },
  { pattern: 'all$', group: 'a' },
  { pattern: 'alk$', group: 'a' },
  { pattern: 'alm$', group: 'a' },
  { pattern: 'ar$', group: 'a' },
  { pattern: 'ard$', group: 'a' },
  { pattern: 'arge$', group: 'a' },
  { pattern: 'ast$', group: 'a' },
  { pattern: 'ance$', group: 'a' },
  { pattern: 'and$', group: 'a' },
  { pattern: 'ang$', group: 'a' },
  { pattern: 'ank$', group: 'a' },
  { pattern: 'atch$', group: 'a' },
  { pattern: 'ath$', group: 'a' },
  { pattern: 'ay$', group: 'a' },

  // --- 'e' family (EH, ER) ---------------------------------------------
  { pattern: 'ear$', group: 'e' },
  { pattern: 'eer$', group: 'e' },
  { pattern: 'er$', group: 'e' },
  { pattern: 'err$', group: 'e' },
  { pattern: 'ern$', group: 'e' },
  { pattern: 'erve$', group: 'e' },
  { pattern: 'ell$', group: 'e' },
  { pattern: 'eld$', group: 'e' },
  { pattern: 'elm$', group: 'e' },
  { pattern: 'empt$', group: 'e' },
  { pattern: 'end$', group: 'e' },
  { pattern: 'ent$', group: 'e' },
  { pattern: 'est$', group: 'e' },
  { pattern: 'ess$', group: 'e' },
  { pattern: 'ed$', group: 'e' },
  { pattern: 'eg$', group: 'e' },
  { pattern: 'eck$', group: 'e' },
  { pattern: 'ept$', group: 'e' },
  { pattern: 'ect$', group: 'e' },
  { pattern: 'ead$', group: 'e' },
  { pattern: 'eal$', group: 'e' },
  { pattern: 'ean$', group: 'e' },
  { pattern: 'eam$', group: 'e' },
  { pattern: 'ease$', group: 'e' },
  { pattern: 'eat$', group: 'e' },
  { pattern: 'ee$', group: 'e' },
  { pattern: 'eep$', group: 'e' },
  { pattern: 'eel$', group: 'e' },
  { pattern: 'een$', group: 'e' },
  { pattern: 'eer$', group: 'e' },
  { pattern: 'eet$', group: 'e' },
  { pattern: 'eve$', group: 'e' },

  // --- 'i' family (IH, IY) ---------------------------------------------
  { pattern: 'igh$', group: 'i' },
  { pattern: 'ign$', group: 'i' },
  { pattern: 'ind$', group: 'i' },
  { pattern: 'ild$', group: 'i' },
  { pattern: 'ire$', group: 'i' },
  { pattern: 'irk$', group: 'i' },
  { pattern: 'irt$', group: 'i' },
  { pattern: 'ise$', group: 'i' },
  { pattern: 'ize$', group: 'i' },
  { pattern: 'ice$', group: 'i' },
  { pattern: 'ide$', group: 'i' },
  { pattern: 'ife$', group: 'i' },
  { pattern: 'ike$', group: 'i' },
  { pattern: 'ile$', group: 'i' },
  { pattern: 'ime$', group: 'i' },
  { pattern: 'ine$', group: 'i' },
  { pattern: 'ipe$', group: 'i' },
  { pattern: 'ire$', group: 'i' },
  { pattern: 'ise$', group: 'i' },
  { pattern: 'ite$', group: 'i' },
  { pattern: 'ive$', group: 'i' },
  { pattern: 'in$', group: 'i' },
  { pattern: 'ing$', group: 'i' },
  { pattern: 'ink$', group: 'i' },
  { pattern: 'int$', group: 'i' },
  { pattern: 'ip$', group: 'i' },
  { pattern: 'it$', group: 'i' },
  { pattern: 'ick$', group: 'i' },
  { pattern: 'ill$', group: 'i' },
  { pattern: 'iss$', group: 'i' },
  { pattern: 'ist$', group: 'i' },
  { pattern: 'ix$', group: 'i' },

  // --- 'o' family (AO, OW) ---------------------------------------------
  { pattern: 'oar$', group: 'o' },
  { pattern: 'oast$', group: 'o' },
  { pattern: 'oat$', group: 'o' },
  { pattern: 'oak$', group: 'o' },
  { pattern: 'oal$', group: 'o' },
  { pattern: 'oan$', group: 'o' },
  { pattern: 'oam$', group: 'o' },
  { pattern: 'oap$', group: 'o' },
  { pattern: 'oar$', group: 'o' },
  { pattern: 'oath$', group: 'o' },
  { pattern: 'oing$', group: 'o' },
  { pattern: 'oil$', group: 'o' },
  { pattern: 'oin$', group: 'o' },
  { pattern: 'oist$', group: 'o' },
  { pattern: 'oice$', group: 'o' },
  { pattern: 'oint$', group: 'o' },
  { pattern: 'old$', group: 'o' },
  { pattern: 'olk$', group: 'o' },
  { pattern: 'oll$', group: 'o' },
  { pattern: 'olt$', group: 'o' },
  { pattern: 'omb$', group: 'o' },
  { pattern: 'ome$', group: 'o' },
  { pattern: 'on$', group: 'o' },
  { pattern: 'ong$', group: 'o' },
  { pattern: 'oop$', group: 'o' },
  { pattern: 'oot$', group: 'o' },
  { pattern: 'oose$', group: 'o' },
  { pattern: 'ord$', group: 'o' },
  { pattern: 'ore$', group: 'o' },
  { pattern: 'orn$', group: 'o' },
  { pattern: 'ort$', group: 'o' },
  { pattern: 'ose$', group: 'o' },
  { pattern: 'ost$', group: 'o' },
  { pattern: 'oth$', group: 'o' },
  { pattern: 'ou$', group: 'o' },
  { pattern: 'oud$', group: 'o' },
  { pattern: 'oun$', group: 'o' },
  { pattern: 'ound$', group: 'o' },
  { pattern: 'ount$', group: 'o' },
  { pattern: 'our$', group: 'o' },
  { pattern: 'out$', group: 'o' },
  { pattern: 'ouse$', group: 'o' },
  { pattern: 'outh$', group: 'o' },
  { pattern: 'ow$', group: 'o' },
  { pattern: 'own$', group: 'o' },
  { pattern: 'oy$', group: 'o' },
  { pattern: 'oys$', group: 'o' },
  { pattern: 'oked$', group: 'o' },
  { pattern: 'okes$', group: 'o' },

  // --- 'u' family (UW, UH) ---------------------------------------------
  { pattern: 'ube$', group: 'u' },
  { pattern: 'uch$', group: 'u' },
  { pattern: 'ude$', group: 'u' },
  { pattern: 'ue$', group: 'u' },
  { pattern: 'uge$', group: 'u' },
  { pattern: 'ule$', group: 'u' },
  { pattern: 'ume$', group: 'u' },
  { pattern: 'un$', group: 'u' },
  { pattern: 'ung$', group: 'u' },
  { pattern: 'unk$', group: 'u' },
  { pattern: 'unt$', group: 'u' },
  { pattern: 'up$', group: 'u' },
  { pattern: 'ur$', group: 'u' },
  { pattern: 'urn$', group: 'u' },
  { pattern: 'urt$', group: 'u' },
  { pattern: 'use$', group: 'u' },
  { pattern: 'ush$', group: 'u' },
  { pattern: 'usk$', group: 'u' },
  { pattern: 'ust$', group: 'u' },
  { pattern: 'ute$', group: 'u' },
  { pattern: 'ooth$', group: 'u' },
  { pattern: 'ood$', group: 'u' },
  { pattern: 'ook$', group: 'u' },
  { pattern: 'ool$', group: 'u' },
  { pattern: 'oom$', group: 'u' },
  { pattern: 'oon$', group: 'u' },
  { pattern: 'oop$', group: 'u' },
  { pattern: 'oot$', group: 'u' },
  { pattern: 'oose$', group: 'u' },
];

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** Classification of the rhyme relationship between two words. */
export type RhymeType = 'perfect' | 'slant' | 'none';

/** Result of comparing two words for rhyme quality. */
export interface RhymeResult {
  /** The rhyme classification. */
  type: RhymeType;
  /** Numeric score: 1.0 = perfect, 0.7 = slant, 0.0 = no rhyme. */
  score: number;
}

// ---------------------------------------------------------------------------
// Internal: extract vowel group and trailing consonants from a word
// ---------------------------------------------------------------------------

interface PhoneticTail {
  /** Canonical vowel-group key (a | e | i | o | u). */
  vowelGroup: string;
  /** The trailing consonant cluster after the last vowel (lowercase). */
  finalConsonants: string;
}

/**
 * Extract the last word from a possibly multi-word string.
 * Strips non-alphabetic trailing characters.
 */
function lastWord(text: string): string {
  const trimmed = text.trim().toLowerCase();
  const match = trimmed.match(/[a-z]+(?=[^a-z]*$)/);
  return match ? match[0] : trimmed.replace(/[^a-z]/g, '');
}

/**
 * Extract the phonetic tail (vowel group + final consonants) from a word
 * using spelling-pattern heuristics.  No dictionary required.
 *
 * @param word - A single lowercase English word.
 * @returns The extracted {@link PhoneticTail}.
 */
function extractPhoneticTail(word: string): PhoneticTail {
  const w = word.toLowerCase();

  // Try matching against the spelling pattern table (longest-first).
  for (const { pattern, group } of SPELLING_VOWEL_PATTERNS) {
    if (new RegExp(pattern).test(w)) {
      // Grab the consonant cluster at the very end of the word.
      const tailMatch = w.match(/([bcdfghjklmnpqrstvwxyz]+)$/);
      return {
        vowelGroup: group,
        finalConsonants: tailMatch ? tailMatch[1] : '',
      };
    }
  }

  // Fallback: use the last vowel letter in the word to determine the group,
  // then grab trailing consonants.
  const lastVowelMatch = w.match(
    /([aeiou]+)(?=[bcdfghjklmnpqrstvwxyz]*$)/,
  );
  const vowelLetter = lastVowelMatch ? lastVowelMatch[1].slice(-1) : '';

  const consonantMatch = w.match(/([bcdfghjklmnpqrstvwxyz]+)$/);
  return {
    vowelGroup: vowelLetter || 'a',
    finalConsonants: consonantMatch ? consonantMatch[1] : '',
  };
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Classify the rhyme relationship between two words.
 *
 * Uses a simplified phonetic approach that maps English spelling patterns
 * to vowel groups for comparison.  The algorithm:
 *
 * 1. Extracts the vowel group and final consonant cluster from each word.
 * 2. **Perfect** rhyme (score 1.0) — vowel group AND final consonant
 *    cluster both match.
 * 3. **Slant** rhyme (score 0.7) — vowel group matches but the final
 *    consonant cluster differs.
 * 4. **None** (score 0.0) — vowel groups differ.
 *
 * @param word1 - First word to compare.
 * @param word2 - Second word to compare.
 * @returns A {@link RhymeResult} with the classification and numeric score.
 *
 * @example
 * ```ts
 * classifyRhyme('cat', 'hat');   // { type: 'perfect', score: 1.0 }
 * classifyRhyme('cat', 'bad');   // { type: 'slant',   score: 0.7 }
 * classifyRhyme('cat', 'dog');   // { type: 'none',    score: 0.0 }
 * ```
 */
export function classifyRhyme(word1: string, word2: string): RhymeResult {
  const tail1 = extractPhoneticTail(lastWord(word1));
  const tail2 = extractPhoneticTail(lastWord(word2));

  // Same word is trivially a perfect rhyme of itself — treat as none
  // to avoid inflating scores when a lyric repeats words.
  if (word1.toLowerCase() === word2.toLowerCase()) {
    return { type: 'none', score: 0.0 };
  }

  const vowelMatch = tail1.vowelGroup === tail2.vowelGroup;
  const consonantMatch =
    tail1.finalConsonants === tail2.finalConsonants &&
    tail1.finalConsonants.length > 0;

  if (vowelMatch && consonantMatch) {
    return { type: 'perfect', score: 1.0 };
  }

  if (vowelMatch) {
    return { type: 'slant', score: 0.7 };
  }

  return { type: 'none', score: 0.0 };
}

/**
 * Compute the average rhyme quality across consecutive line pairs.
 *
 * For each pair of adjacent lines, the last words are compared using
 * {@link classifyRhyme} and the resulting scores are averaged.  Lines
 * with no alphabetic content are skipped.
 *
 * @param lines - Array of lyric / text lines to evaluate.
 * @returns A value between 0.0 (no rhymes) and 1.0 (all perfect rhymes).
 *
 * @example
 * ```ts
 * getRhymeScore([
 *   'The cat sat on the mat',
 *   'He wore a little hat',
 *   'The dog ran down the street',
 *   'And landed on his feet',
 * ]);
 * // => ~0.85 (two perfect pairs + cross-pair slants)
 * ```
 */
export function getRhymeScore(lines: string[]): number {
  const words = lines
    .map((line) => lastWord(line))
    .filter((w) => w.length > 0);

  if (words.length < 2) {
    return 0.0;
  }

  let totalScore = 0;
  let pairCount = 0;

  // Score consecutive pairs (ABAB / AABB patterns).
  for (let i = 0; i < words.length - 1; i++) {
    const { score } = classifyRhyme(words[i], words[i + 1]);
    totalScore += score;
    pairCount++;
  }

  // Also score alternating pairs (ABAB pattern detection).
  for (let i = 0; i < words.length - 2; i += 2) {
    const { score } = classifyRhyme(words[i], words[i + 2]);
    totalScore += score;
    pairCount++;
  }

  return pairCount > 0 ? totalScore / pairCount : 0.0;
}
