// Every command that bin/sinter dispatches. Anything NOT here is treated as a
// natural-language creative prompt — so a missing command would be silently
// swallowed by the generate path instead of routing to its handler.
const KNOWN_COMMANDS = new Set([
  'archive',
  'bridge',
  'bubbletea',
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
  'operator',
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
  'tui',
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
