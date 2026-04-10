import path from 'node:path';

const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a']);
const ALLOWED_BROWSER_EXTENSIONS = new Set(['.html', '.htm', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']);

function isUnsafePath(filePath: string): boolean {
  if (!filePath.trim()) return true;
  if (path.isAbsolute(filePath)) return true;
  const normalized = path.normalize(filePath);
  return normalized.startsWith('..') || normalized.includes(`..${path.sep}`);
}

export function validateAudioPreviewPath(filePath: string): string | null {
  if (isUnsafePath(filePath)) return 'Unsafe audio path. Relative non-traversing paths only.';
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) return 'Unsupported audio file type.';
  return null;
}

export function validateBrowserPreviewPath(filePath: string): string | null {
  if (isUnsafePath(filePath)) return 'Unsafe preview path. Relative non-traversing paths only.';
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_BROWSER_EXTENSIONS.has(ext)) return 'Unsupported browser preview file type.';
  return null;
}
