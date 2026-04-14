/**
 * ThreeGenerator - Three.js generation with tier-based prompts
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import type { LLMResponse } from '../../llm/LLMClient.js';
import { CodeValidator } from '../../core/CodeValidator.js';

export class ThreeGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('three', llmOrConfig);
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    const code = await super.generate(this.withThreeContract(prompt), options);
    return this.sanitizeSceneCode(code);
  }

  async generateFull(prompt: string, options?: TierBasedGeneratorOptions): Promise<LLMResponse> {
    const response = await super.generateFull(this.withThreeContract(prompt), options);
    response.code = this.sanitizeSceneCode(response.code);
    return response;
  }

  /**
   * Three.js-specific validation
   */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const sanitized = this.sanitizeSceneCode(code);
    const validation = CodeValidator.validate(sanitized, 'three');
    if (!validation.valid) {
      return { valid: false, error: validation.errors.join('; ') };
    }

    // Three.js code should reference THREE
    const hasThree = sanitized.includes('THREE') ||
                     sanitized.includes('import * as THREE') ||
                     sanitized.includes('from "three"') ||
                     sanitized.includes("from 'three'");
    
    if (!hasThree) {
      return {
        valid: false,
        error: 'Generated code does not appear to use Three.js',
      };
    }

    return { valid: true };
  }

  private withThreeContract(prompt: string): string {
    return [
      prompt,
      '',
      'Output contract:',
      '- Return only raw Three.js module scene code, not Markdown.',
      '- Use exactly one import: `import * as THREE from "three";`.',
      '- Do not import Three.js from a URL; the wrapper provides the importmap.',
      '- Use wrapper-provided `canvas`, `w`, and `h`; do not redeclare `canvas`, `w`, or `h`.',
      '- Create `scene`, `camera`, `renderer`, at least one mesh, and lights when useful.',
      '- Define and call `animate();`.',
      '- The animation loop must mutate scene state, e.g. `cube.rotation.x += 0.01;`, before rendering.',
    ].join('\n');
  }

  private sanitizeSceneCode(code: string): string {
    return code
      .replace(/^```(?:javascript|js)?\n?/gm, '')
      .replace(/\n?```$/gm, '')
      .replace(/^\s*(?:const|let|var)\s+canvas\s*=\s*[^;]+;\s*$/gm, '')
      .replace(/^\s*(?:const|let|var)\s+w\s*=\s*[^;]+;\s*$/gm, '')
      .replace(/^\s*(?:const|let|var)\s+h\s*=\s*[^;]+;\s*$/gm, '')
      .replace(/^\s*scene\.add\s*\(\s*renderer\.domElement\s*\)\s*;\s*$/gm, '')
      .trim();
  }

  /**
   * Wrap Three.js scene for gallery iframe display.
   * Injects Three.js CDN and creates a self-contained scene harness.
   */
  wrapForGallery(code: string): string {
    const trimmed = code.trim();
    if (/^(?:<!DOCTYPE\s+html|<html\b)/i.test(trimmed)) {
      return trimmed;
    }

    const hasThreeImport = /\bimport\s+\*\s+as\s+THREE\s+from\s+['"]three['"]/.test(code);
    const threeImport = hasThreeImport ? '' : "import*as THREE from'three';\n";
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
<canvas id="three-canvas"></canvas>
<script type="importmap">
{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"}}
</script>
<script type="module">
${threeImport}const canvas=document.getElementById('three-canvas');
let w=innerWidth;
let h=innerHeight;
${code}
if(typeof renderer!=='undefined'&&renderer.domElement){
  if(renderer.domElement!==canvas){
    canvas.remove();
    if(!document.body.contains(renderer.domElement))document.body.appendChild(renderer.domElement);
  }
}
addEventListener('resize',()=>{w=innerWidth;h=innerHeight;if(typeof renderer!=='undefined'&&renderer.setSize)renderer.setSize(w,h);if(typeof camera!=='undefined'&&camera.aspect){camera.aspect=w/h;camera.updateProjectionMatrix();}});
</script>
</body>
</html>`;
  }
}
