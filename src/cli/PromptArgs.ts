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
  'operator',
  'preferences',
  'prompt',
  'quality',
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
