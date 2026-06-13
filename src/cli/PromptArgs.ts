// Every command that bin/sinter dispatches. Anything NOT here is treated as a
// natural-language creative prompt — so a missing command would be silently
// swallowed by the generate path instead of routing to its handler.
const KNOWN_COMMANDS = new Set([
  'archive',
  'bridge',
  'chat',
  'compose',
  'composite',
  'compost',
  'consolidate',
  'demo',
  'domains',
  'dream',
  'emergence',
  'fix',
  'fs',
  'g',
  'garden',
  'gen',
  'generate',
  'git',
  'improve',
  'ledger',
  'list',
  'live-music',
  'ls',
  'market',
  'model',
  'preferences',
  'prompt',
  'provider',
  'quality',
  'readiness',
  'release',
  'report',
  's',
  'self-improve',
  'serve',
  'ship',
  'site',
  'studio',
  'taste',
]);

export function commandPrompt(flagPrompt: string | undefined, cmdArgs: string[]): string | null {
  if (flagPrompt !== undefined) return flagPrompt;
  const joined = cmdArgs.join(' ').trim();
  return joined.length > 0 ? joined : null;
}

export function inferNaturalLanguagePrompt(cmd: string | null, cmdArgs: string[]): string | null {
  if (!cmd || KNOWN_COMMANDS.has(cmd)) return null;
  const joined = [cmd, ...cmdArgs].join(' ').trim();
  return joined.length > 0 ? joined : null;
}

/** What a command-shaped input near-miss looks like, for the front-door gate. */
export interface CommandTypoSuggestion {
  /** The known command the input most plausibly meant. */
  command: string;
  /** 'typo' = first token near-misses a command; 'quoted-phrase' = a single
   *  quoted argument whose first word IS a command (e.g. "taste status"). */
  reason: 'typo' | 'quoted-phrase';
}

const COMMAND_LIKE_MAX_WORDS = 4;
const BARE_WORD = /^[a-z][a-z0-9-]*$/i;

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}

/**
 * Guard the natural-language front door against command-shaped accidents:
 * the NL path silently spends a PAID generation, so a short bare-word input
 * whose first token near-misses a known command (`sinter grden status`), or a
 * single quoted argument whose first word IS a command (`sinter "taste
 * status"`), is far more likely a mistyped command than a creative prompt
 * (audit F8 — both shapes were observed launching real generations).
 * Real creative prompts pass untouched: longer phrases, punctuation, or first
 * tokens nowhere near a command name. Callers must offer `--prompt` as the
 * explicit escape hatch when they reject the input.
 */
export function suggestCommandForTypo(cmd: string | null, cmdArgs: string[]): CommandTypoSuggestion | null {
  if (!cmd || KNOWN_COMMANDS.has(cmd)) return null;

  // A single argument with internal whitespace (shell-quoted, or a shell that
  // didn't word-split) whose first word is a real command.
  if (cmdArgs.length === 0 && /\s/.test(cmd)) {
    const words = cmd.trim().split(/\s+/);
    if (words.length <= COMMAND_LIKE_MAX_WORDS && words.every(w => BARE_WORD.test(w)) && KNOWN_COMMANDS.has(words[0])) {
      return { command: words[0], reason: 'quoted-phrase' };
    }
    return null;
  }

  const words = [cmd, ...cmdArgs];
  if (words.length > COMMAND_LIKE_MAX_WORDS) return null;
  if (!words.every(w => BARE_WORD.test(w))) return null;

  const token = cmd.toLowerCase();
  let best: { command: string; distance: number } | null = null;
  for (const known of KNOWN_COMMANDS) {
    const distance = editDistance(token, known);
    if (!best || distance < best.distance) best = { command: known, distance };
  }
  const threshold = token.length <= 4 ? 1 : 2;
  return best && best.distance <= threshold ? { command: best.command, reason: 'typo' } : null;
}

const SELF_IMPROVEMENT_MARKERS = [
  'improve yourself',
  'self-improve',
  'self improve',
  'improves itself',
  'improve itself',
  'self-improvement loop',
  'finish yourself',
  'finish building yourself',
  'improve your own',
  'improve the actual sinter application',
  'prompt -> sinter acts -> sinter improves itself',
  'codex for art',
];

export function isSelfImprovementPrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return SELF_IMPROVEMENT_MARKERS.some(marker => normalized.includes(marker));
}
