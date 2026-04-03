/**
 * P5.js-specific HTML wrapper
 * Wraps p5.js sketch code in a complete HTML document
 */

const P5_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
const P5_SOUND_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/addons/p5.sound.min.js';

export interface P5WrapOptions {
  title?: string;
  includeP5Sound?: boolean;
}

export class P5Wrapper {
  /**
   * Detect if code is p5.js code
   */
  static detect(code: string): boolean {
    // p5.js detection - default if no other domain matches
    // Check for p5.js patterns
    const hasSetup = /function\s+setup\s*\(/.test(code);
    const hasDraw = /function\s+draw\s*\(/.test(code);
    const hasCreateCanvas = /createCanvas\s*\(/.test(code);
    const hasP5Functions = /\b(background|fill|stroke|ellipse|rect|line|point)\s*\(/.test(code);

    return (hasSetup || hasDraw || hasCreateCanvas || hasP5Functions) &&
           !this.isOtherDomain(code);
  }

  private static isOtherDomain(code: string): boolean {
    // Check if it matches other domains
    const hasStrudel = /\bstack\s*\(|\bs\s*\(\s*["']/.test(code);
    const hasHydra = /\bosc\s*\(|\bshape\s*\(|\.kaleid\s*\(|\.out\s*\(/.test(code);
    const hasTone = /\bTone\.|\bSynth\b|\bTransport\b/.test(code);
    const hasThree = /\bTHREE\.|\bScene\s*\(|\bCamera\s*\(/.test(code);
    const hasShader = /void\s+main\s*\(|gl_FragColor|uniform\s+vec/.test(code);
    const hasRemotion = /useCurrentFrame|AbsoluteFill|from\s+['"]remotion['"]/.test(code);
    const hasASCII = /[█▓▒░@#%*+=\-~^]{10,}/.test(code) && !code.includes('function');

    return hasStrudel || hasHydra || hasTone || hasThree || hasShader || hasRemotion || hasASCII;
  }

  /**
   * Wrap p5.js code in HTML
   */
  static wrap(code: string, options: P5WrapOptions = {}): string {
    const { title = 'p5.js Sketch', includeP5Sound = false } = options;
    
    const safeCode = code.replace(/\u003c\/script\u003e/gi, '<\\/script>');
    const usesWebAudio = /AudioContext|createOscillator|p5\.sound/i.test(code);
    const soundComment = usesWebAudio
      ? '\n    <!-- Sound may require user click to start (browser policy). -->'
      : '';
    const p5SoundScript = includeP5Sound
      ? `\n    <script src="${P5_SOUND_CDN}"></script>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="${P5_CDN}"></script>${p5SoundScript}
    <style>
        body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
        main { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    </style>
</head>
<body>${soundComment}
    <main>
        <script>
${safeCode}
        </script>
    </main>
</body>
</html>`;
  }
}

export default P5Wrapper;
