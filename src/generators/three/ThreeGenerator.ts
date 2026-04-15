/**
 * ThreeGenerator - Three.js generation with tier-based prompts
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export class ThreeGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('three', llmOrConfig);
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    return super.generate(prompt, options);
  }

  /**
   * Three.js-specific validation
   */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
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
}
