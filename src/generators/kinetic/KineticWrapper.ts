/**
 * KineticWrapper - Iframe-safe HTML wrapper for CSS-kinetic artworks.
 *
 * Wraps pure CSS/SVG compositions in a minimal HTML shell with
 * security headers and viewport-fitted display.
 */

const SECURITY_HEADERS = [
  '<meta http-equiv="X-Frame-Options" content="DENY">',
  '<meta http-equiv="X-Content-Type-Options" content="nosniff">',
  '<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">',
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' blob:; connect-src \'none\'; font-src \'self\';">',
];

export interface KineticWrapOptions {
  title?: string;
}

export class KineticWrapper {
  /**
   * Wrap CSS-kinetic code in iframe-safe HTML.
   */
  static wrap(code: string, options?: KineticWrapOptions): string {
    if (this.isAlreadyWrapped(code)) {
      return code;
    }

    const title = options?.title ?? 'Kinetic Artwork';
    const headers = SECURITY_HEADERS.join('\n    ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${headers}
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a0f; }
      body { display: flex; justify-content: center; align-items: center; }
      .kinetic-canvas { width: 100%; max-width: 1200px; aspect-ratio: 4/3; position: relative; overflow: hidden; }
    </style>
</head>
<body>
    <div class="kinetic-canvas">
${this.extractBody(code)}
    </div>
</body>
</html>`;
  }

  private static isAlreadyWrapped(code: string): boolean {
    const trimmed = code.trim();
    return /^<!DOCTYPE\s+html/i.test(trimmed) ||
           (/<html/i.test(trimmed) && /<\/html>\s*$/i.test(trimmed));
  }

  private static extractBody(code: string): string {
    const bodyMatch = code.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      return bodyMatch[1].trim();
    }
    return code.replace(/^[\s\S]*?(?=<body)/i, '').replace(/<\/body>[\s\S]*/i, '').trim() || code;
  }
}
