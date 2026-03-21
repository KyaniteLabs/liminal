import { P5_CDN, P5_SOUND_CDN } from '../constants.js';

export interface GenerateHTMLOptions {
  code: string;
  title?: string;
  includeP5Sound?: boolean;
  bodyStyle?: string;
  fullscreen?: boolean;
}

/**
 * Generate a standalone HTML page with p5.js CDN and embedded sketch code.
 * Always escapes </script> to prevent breaking out of the script tag.
 */
export function generateHTML(options: GenerateHTMLOptions): string {
  const {
    code,
    title = 'p5.js Sketch',
    includeP5Sound = false,
    bodyStyle = 'margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0;',
    fullscreen = false,
  } = options;

  const escaped = code.replace(/<\/script>/gi, '<\\/script>');
  const p5SoundScript = includeP5Sound
    ? `\n    <script src="${P5_SOUND_CDN}"></script>`
    : '';
  const usesWebAudio = /AudioContext|createOscillator|p5\.sound/i.test(code);
  const soundComment = usesWebAudio
    ? '\n    <!-- Sound may require user click to start (browser policy). -->'
    : '';
  const container = fullscreen ? '' : '\n    <main>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="${P5_CDN}"></script>${p5SoundScript}
    <style>
        body {
            ${bodyStyle}
        }
        ${fullscreen ? 'canvas { display: block; }' : 'main { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }'}
    </style>
</head>
<body>${soundComment}${container}
        <script>
${escaped}
        </script>
    ${fullscreen ? '' : '</main>'}
</body>
</html>`;
}
