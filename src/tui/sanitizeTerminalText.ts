// eslint-disable-next-line no-control-regex -- intentionally matches ANSI escape sequences
const ANSI_ESCAPE_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
// eslint-disable-next-line no-control-regex -- intentionally matches control characters for sanitization
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const PROMPT_PREVIEW_REGEXES = [
  /prompt:\s*.*/i,
  /prompt=\s*.*/i,
];

export interface SanitizeTerminalTextOptions {
  maxLength?: number;
  singleLine?: boolean;
}

export function sanitizeTerminalText(
  text: string,
  options: SanitizeTerminalTextOptions = {},
): string {
  const { maxLength = 160, singleLine = false } = options;

  let sanitized = text
    .replace(ANSI_ESCAPE_REGEX, '')
    .replace(/\r/g, '')
    .replace(CONTROL_CHARS_REGEX, '');

  for (const regex of PROMPT_PREVIEW_REGEXES) {
    sanitized = sanitized.replace(regex, 'Prompt: [redacted]');
  }

  sanitized = sanitized.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  if (singleLine) {
    sanitized = sanitized.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, Math.max(0, maxLength - 1)) + '…';
  }

  return sanitized;
}
