import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const LOCAL_P5_SCRIPTS = {
  p5: 'p5/lib/p5.min.js',
  p5Sound: 'p5/lib/addons/p5.sound.min.js',
} as const;

type LocalP5ScriptKey = keyof typeof LOCAL_P5_SCRIPTS;

const cachedScripts = new Map<LocalP5ScriptKey, Promise<string>>();

function localP5ScriptKeyForUrl(rawUrl: string): LocalP5ScriptKey | null {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== 'cdnjs.cloudflare.com') return null;

    const pathname = url.pathname.toLowerCase();
    if (!pathname.includes('/p5.js/')) return null;

    // cdnjs has published p5.sound both at the version root and under
    // /addons; keep both forms offline-safe for generated sketches.
    if (
      pathname.endsWith('/p5.sound.min.js')
      || pathname.endsWith('/p5.sound.js')
      || pathname.endsWith('/addons/p5.sound.min.js')
      || pathname.endsWith('/addons/p5.sound.js')
    ) {
      return 'p5Sound';
    }
    if (pathname.endsWith('/p5.min.js') || pathname.endsWith('/p5.js')) {
      return 'p5';
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Browser renderers use CDN URLs in generated HTML for customer portability.
 * In local QA, fulfill those same p5 URLs from the installed package so render
 * proof does not silently depend on external network availability.
 */
export async function getLocalP5ScriptForUrl(rawUrl: string): Promise<string | null> {
  const key = localP5ScriptKeyForUrl(rawUrl);
  if (!key) return null;

  let script = cachedScripts.get(key);
  if (!script) {
    script = readFile(require.resolve(LOCAL_P5_SCRIPTS[key]), 'utf8');
    cachedScripts.set(key, script);
  }

  return script;
}
