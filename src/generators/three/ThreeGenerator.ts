/**
 * ThreeGenerator - Three.js generation with tier-based prompts
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { THREE_CDN } from '../../constants.js';

export class ThreeGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('three', llmOrConfig);
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    const threePrompt = [
      prompt,
      '',
      'Return complete executable raw Three.js scene code only. Do not return a full HTML document.',
      'Do not return prose, design notes, markdown, excerpts, or partial snippets.',
      'Begin immediately with executable code such as const scene = new THREE.Scene();.',
      'Keep the scene concise: under 140 lines of JavaScript.',
      'The output must include THREE.Scene, THREE.WebGLRenderer, visible geometry/materials, and requestAnimationFrame or renderer.render.',
      'Do not include import statements; the gallery wrapper imports THREE.',
      'Use only the core Three.js module. Do not import OrbitControls or examples modules.',
      'Animate the camera manually with sin/cos in the render loop instead of using controls.',
      'Do not use ellipses, TODO comments, placeholder comments, or phrases like setup renderer, crystals, particles, or animation loop without implementing them.',
      'Include visible geometry, lights, camera, renderer setup, and a requestAnimationFrame render loop.',
    ].join('\n');
    const code = await super.generate(threePrompt, options);
    return this.sanitizeThreeCode(code);
  }

  /**
   * Three.js-specific validation
   */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    if (/<!DOCTYPE\s+html/i.test(code) || /<html[\s>]/i.test(code)) {
      return {
        valid: false,
        error: 'Generated Three.js output must be raw scene JavaScript, not a full HTML document',
      };
    }

    code = this.sanitizeThreeCode(code);
    // Three.js code should reference THREE
    const hasThree = code.includes('THREE') || 
                     code.includes('import * as THREE') ||
                     code.includes('from "three"') ||
                     code.includes("from 'three'");
    
    if (!hasThree) {
      return {
        valid: false,
        error: 'Generated code does not appear to use Three.js',
      };
    }

    if (this.isLikelyTruncated(code)) {
      return {
        valid: false,
        error: 'Generated Three.js output appears incomplete or truncated',
      };
    }

    if (/\bOrbitControls\b/.test(code) || /examples\/jsm\//.test(code)) {
      return {
        valid: false,
        error: 'Generated Three.js output must not import OrbitControls or examples modules; animate the camera manually',
      };
    }

    if (/\.\.\.|TODO|setup renderer|animation loop|\/\/\s*(?:Crystals|Particles)\s*$/im.test(code)) {
      return {
        valid: false,
        error: 'Generated Three.js output contains placeholder comments instead of complete scene code',
      };
    }

    if (!/\brequestAnimationFrame\s*\(/.test(code) && !/\brenderer\.render\s*\(/.test(code)) {
      return {
        valid: false,
        error: 'Generated Three.js output must include a render loop or renderer.render call',
      };
    }

    // Reject nested HTML documents inside helper script blocks; these create
    // malformed wrapper-on-wrapper artifacts instead of a single runnable scene.
    if (/<script[\s\S]*?<!DOCTYPE\s+html/i.test(code) || /<script[\s\S]*?<html[\s>]/i.test(code)) {
      return {
        valid: false,
        error: 'Generated Three.js output must not embed a second HTML document inside a <script> block',
      };
    }

    return { valid: true };
  }

  /**
   * Wrap Three.js scene for gallery iframe display.
   * Injects Three.js CDN and creates a self-contained scene harness.
   */
  wrapForGallery(code: string): string {
    code = this.sanitizeThreeCode(code);
    const trimmed = code.trim();
    if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
      return code;
    }

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Three.js Scene</title>
<style>
*{margin:0;padding:0;overflow:hidden}
body{background:#000}
canvas{display:block}
</style>
</head>
<body>
<script type="importmap">
{"imports":{"three":"${THREE_CDN}"}}
</script>
<script type="module">
import*as THREE from'three';
${code}
</script>
</body>
</html>`;
  }

  private sanitizeThreeCode(code: string): string {
    const fencedScript = code.match(/```(?:javascript|js)?\s*\n?([\s\S]*?)```/i);
    if (fencedScript?.[1] && /\bTHREE\b/.test(fencedScript[1])) {
      code = fencedScript[1];
    }

    const htmlScript = code.match(/<script[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/i)
      || code.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (htmlScript?.[1] && /\bTHREE\b/.test(htmlScript[1])) {
      return htmlScript[1]
        .replace(/^\s*import\s+.*?\bTHREE\b.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
        .trim();
    }
    return code
      .replace(/^```(?:html|javascript|js)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .replace(/^\s*import\s+.*?\bTHREE\b.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .trim();
  }

  private isLikelyTruncated(code: string): boolean {
    const stripped = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const openBraces = (stripped.match(/\{/g) || []).length;
    const closeBraces = (stripped.match(/\}/g) || []).length;
    const openParens = (stripped.match(/\(/g) || []).length;
    const closeParens = (stripped.match(/\)/g) || []).length;
    if (openBraces !== closeBraces || openParens !== closeParens) return true;
    const trimmed = stripped.trim();
    if (/\bTHREE\.[A-Za-z_][\w$]*$/.test(trimmed)) return true;
    return false;
  }
}
