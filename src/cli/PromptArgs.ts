const KNOWN_COMMANDS = new Set([
  'archive',
  'bridge',
  'bubbletea',
  'chat',
  'composite',
  'compost',
  'consolidate',
  'demo',
  'fix',
  'g',
  'gen',
  'generate',
  'git',
  'improve',
  'ledger',
  'list',
  'live-music',
  'ls',
  'market',
  'operator',
  'preferences',
  'prompt',
  'quality',
  'readiness',
  'report',
  's',
  'serve',
  'ship',
  'studio',
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
  'finish yourself',
  'finish building yourself',
  'improve your own',
  'improve the actual liminal application',
  'prompt -> liminal acts -> liminal improves itself',
  'codex for art',
];

export function isSelfImprovementPrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return SELF_IMPROVEMENT_MARKERS.some(marker => normalized.includes(marker));
}
