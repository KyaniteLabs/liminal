/**
 * Centralized HTML wrapping utility for Liminal outputs
 * Routes to domain-specific wrappers
 * 
 * Supported domains:
 * - p5: p5.js sketches with canvas (P5Wrapper)
 * - shader: GLSL fragment shaders (GenericWrapper)
 * - three: Three.js 3D scenes (ThreeWrapper)
 * - strudel: Strudel live music patterns (GenericWrapper)
 * - hydra: Hydra video synthesizer patterns (GenericWrapper)
 * - tone: Tone.js audio (GenericWrapper)
 * - revideo: Revideo video compositions (GenericWrapper)
 * - remotion: [DEPRECATED] Remotion - use revideo instead
 * - svg: Raw SVG documents displayed inline
 * - html: Complete HTML pages (pass-through)
 * - ascii: ASCII art display (GenericWrapper)
 */

import { P5Wrapper } from '../core/wrappers/P5Wrapper.js';
import { ThreeWrapper } from '../core/wrappers/ThreeWrapper.js';
import { GenericWrapper } from '../core/wrappers/GenericWrapper.js';

export type Domain = 'p5' | 'shader' | 'three' | 'strudel' | 'hydra' | 'tone' | 'revideo' | 'remotion' | 'hyperframes' | 'svg' | 'html' | 'ascii';

export interface WrapOptions {
  domain?: Domain;
  title?: string;
  includeP5Sound?: boolean;
  /** For Strudel: auto-start playback */
  autoPlay?: boolean;
  /** For Remotion: show code or try to render preview */
  showPreview?: boolean;
  /** For ASCII: use monospace styling */
  asciiWidth?: number;
  /** For Hydra: canvas resolution */
  hydraResolution?: { width: number; height: number };
}

export class HTMLWrapper {
  private static readonly BASE_SECURITY_HEADERS = [
    '<meta http-equiv="X-Content-Type-Options" content="nosniff">',
    '<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">',
  ];

  private static readonly DEFAULT_CSP = "default-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; font-src 'self';";

  private static readonly HYDRA_CSP = "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; worker-src blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://unpkg.com; font-src 'self';";

  private static readonly STRUDEL_CSP = "default-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; worker-src blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://raw.githubusercontent.com https://unpkg.com; font-src 'self';";

  private static securityHeadersFor(domain: Domain): string[] {
    const csp = domain === 'hydra'
      ? this.HYDRA_CSP
      : domain === 'strudel'
        ? this.STRUDEL_CSP
        : this.DEFAULT_CSP;
    return [
      ...this.BASE_SECURITY_HEADERS,
      `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    ];
  }

  private static injectSecurityHeaders(html: string, domain: Domain): string {
    const sanitized = this.stripInvalidMetaHeaders(html);
    const headers = this.securityHeadersFor(domain).join('\n    ');
    return sanitized.replace('</head>', `    ${headers}\n</head>`);
  }

  private static stripInvalidMetaHeaders(html: string): string {
    return html
      .replace(/^\s*<meta\s+http-equiv=["']X-Frame-Options["'][^>]*>\s*$/gim, '')
      .replace(/^\s*<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>\s*$/gim, '');
  }

  private static escapeHTML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Detect if code is already wrapped in HTML
   * Checks for complete, valid HTML document structure
   */
  static isAlreadyWrapped(code: string): boolean {
    if (!code || typeof code !== 'string') return false;
    
    const cleaned = this.stripLLMContaminants(code).trim();
    
    const hasDoctype = /^<!DOCTYPE\s+html/i.test(cleaned) ||
                       /^<!doctype\s+html/i.test(cleaned);
    const hasHtmlTag = /^<html/i.test(cleaned);
    const hasHtmlEnd = /<\/html>\s*$/i.test(cleaned);
    
    return (hasDoctype || hasHtmlTag) && hasHtmlEnd;
  }
  
  /**
   * Strip common LLM output contaminants that break HTML detection
   */
  private static stripLLMContaminants(code: string): string {
    return code
      .replace(/```\w*\n/g, '')
      .replace(/```\s*$/g, '')
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/^Here is (the|your|a) (code|HTML|sketch|shader|scene):?\s*/i, '')
      .replace(/^\*\*[^*]+\*\*\s*/g, '');
  }

  /**
   * Detect domain from code content
   */
  static detectDomain(code: string): Domain {
    if (this.isAlreadyWrapped(code)) {
      // Already wrapped - try to detect from content
      if (code.includes('@strudel/repl') || code.includes('strudel')) return 'strudel';
      if (code.includes('hydra-synth') || code.includes('new Hydra(')) return 'hydra';
      if (code.includes('import * as THREE') || 
          code.includes('from "three"') || 
          code.includes("from 'three'") ||
          /<script\s+type="importmap"[^>]*>[\s\S]*?"three"[\s\S]*?<\/script>/i.test(code)) {
        return 'three';
      }
      if (code.includes('makeScene') || code.includes('createSignal') || code.includes('useTime') || code.includes('@revideo/core')) return 'revideo';
      if (code.includes('remotion') || code.includes('useCurrentFrame')) return 'remotion';
      if (code.includes('font-family: monospace') && code.includes('<pre>') && !code.includes('createCanvas')) {
        const bodyMatch = code.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
        if (bodyMatch && /[█▓▒░@#%]/.test(bodyMatch[1])) return 'ascii';
      }
      if (code.includes('p5.js') || code.includes('p5.min.js')) return 'p5';
      return 'html';
    }

    // Use GenericWrapper detection for most domains
    const genericDomain = GenericWrapper.detectDomain(code);
    if (genericDomain) return genericDomain;

    if (/^<svg\b/i.test(code.trim())) return 'svg';

    // Use specific wrappers for P5 and Three
    if (ThreeWrapper.detect(code)) return 'three';
    if (P5Wrapper.detect(code)) return 'p5';

    // Complete HTML detection
    if (/<!DOCTYPE html/i.test(code) || (/<html/i.test(code) && /<body/i.test(code))) {
      return 'html';
    }

    // Default to p5
    return 'p5';
  }

  /**
   * Wrap code in appropriate HTML template
   */
  static wrap(code: string, options?: WrapOptions | Domain): string {
    // Support legacy call with just domain string
    let domain: Domain | undefined;
    let includeP5Sound = false;
    let title = 'Generated Output';
    let autoPlay = false;
    let showPreview = false;
    let asciiWidth = 60;
    let hydraResolution = { width: 1280, height: 720 };

    if (typeof options === 'string') {
      domain = options;
    } else if (options) {
      domain = options.domain;
      includeP5Sound = options.includeP5Sound ?? false;
      title = options.title ?? 'Generated Output';
      autoPlay = options.autoPlay ?? false;
      showPreview = options.showPreview ?? false;
      asciiWidth = options.asciiWidth ?? 60;
      hydraResolution = options.hydraResolution ?? { width: 1280, height: 720 };
    }

    // Don't double-wrap
    if (this.isAlreadyWrapped(code)) {
      return this.stripInvalidMetaHeaders(code);
    }

    // Detect domain if not specified
    const detectedDomain = domain || this.detectDomain(code);

    // Route to appropriate wrapper
    let wrapped: string;
    switch (detectedDomain) {
      case 'strudel':
        wrapped = GenericWrapper.wrap(code, { domain: 'strudel', autoPlay });
        break;
      case 'hydra':
        wrapped = GenericWrapper.wrap(code, { domain: 'hydra', hydraResolution });
        break;
      case 'tone':
        wrapped = GenericWrapper.wrap(code, { domain: 'tone' });
        break;
      case 'shader':
        wrapped = GenericWrapper.wrap(code, { domain: 'shader' });
        break;
      case 'three':
        wrapped = ThreeWrapper.wrap(code, { title });
        break;
      case 'revideo':
        wrapped = GenericWrapper.wrap(code, { domain: 'revideo', showPreview });
        break;
      case 'remotion':
        // Deprecated: use revideo instead
        wrapped = GenericWrapper.wrap(code, { domain: 'revideo', showPreview });
        break;
      case 'ascii':
        wrapped = GenericWrapper.wrap(code, { domain: 'ascii', asciiWidth });
        break;
      case 'svg':
        wrapped = this.wrapSVG(code, title);
        break;
      case 'html':
        return this.stripInvalidMetaHeaders(code);
      case 'p5':
      default:
        wrapped = P5Wrapper.wrap(code, { includeP5Sound, title });
        break;
    }

    // Inject security headers at a single central point for all wrapped outputs
    return this.injectSecurityHeaders(wrapped, detectedDomain);
  }

  private static wrapSVG(code: string, title: string): string {
    const svg = code.trim();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHTML(title)}</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8fafc;
        }
        main {
            width: min(92vw, 900px);
            min-height: min(92vh, 900px);
            display: grid;
            place-items: center;
        }
        svg {
            max-width: 100%;
            max-height: 92vh;
            height: auto;
        }
    </style>
</head>
<body>
    <main aria-label="Generated SVG">
        ${svg}
    </main>
</body>
</html>`;
  }

  /**
   * Get all supported domains
   */
  static getSupportedDomains(): Domain[] {
    return ['p5', 'shader', 'three', 'strudel', 'hydra', 'tone', 'revideo', 'remotion', 'svg', 'html', 'ascii'];
  }

  /**
   * Validate if a domain is supported
   */
  static isValidDomain(domain: string): domain is Domain {
    return this.getSupportedDomains().includes(domain as Domain);
  }
}

export default HTMLWrapper;
