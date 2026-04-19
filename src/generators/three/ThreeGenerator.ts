/**
 * ThreeGenerator - Three.js generation with tier-based prompts
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export class ThreeGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('three', llmOrConfig);
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    const threePrompt = [
      prompt,
      '',
      'Use only the core Three.js module. Do not import OrbitControls or examples modules.',
      'Animate the camera manually with sin/cos in the render loop instead of using controls.',
    ].join('\n');
    const code = await super.generate(threePrompt, options);
    return this.sanitizeThreeCode(code);
  }

  /**
   * Three.js-specific validation
   */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
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

    if (/\bOrbitControls\b/.test(code) || /examples\/jsm\//.test(code)) {
      return {
        valid: false,
        error: 'Generated Three.js output must not import OrbitControls or examples modules; animate the camera manually',
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
{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"}}
</script>
<script type="module">
import*as THREE from'three';
${code}
</script>
</body>
</html>`;
  }

  private sanitizeThreeCode(code: string): string {
    return code
      .replace(/^```(?:html|javascript|js)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
  }
}
