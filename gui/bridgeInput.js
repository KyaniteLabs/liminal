const OPTIONAL_TUI_INPUT_FIELDS = [
  'executionMode',
  'maxIterations',
  'candidateCount',
  'timeoutMinutes',
  'creativePreferences',
  'guidanceAnswers',
];

export function buildGuiBridgeInput(body = {}) {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const input = {
    mode: source.mode || 'chat',
    text: source.text || '',
    clientIntent: source.clientIntent,
  };

  for (const field of OPTIONAL_TUI_INPUT_FIELDS) {
    if (source[field] !== undefined) input[field] = source[field];
  }

  return input;
}
