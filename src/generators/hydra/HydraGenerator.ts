import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export interface HydraGeneratorOptions extends TierBasedGeneratorOptions {}

export class HydraGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('hydra', llmOrConfig);
  }

  async generate(prompt: string, options?: HydraGeneratorOptions): Promise<string> {
    const hydraPrompt = [
      'Generate Hydra-synth code only.',
      'Use visible generated sources: osc(), noise(), shape(), voronoi(), gradient(), or solid().',
      'Do not use camera or screen input: no s0.initCam(), no s0.initScreen(), no src(s0).',
      'Use hydra-synth 1.3 runtime-safe method names: saturate(), brightness(), kaleid().',
      'Never use saturation(), feedback(), kaleidoscope(), colorShift(), post(), screen(), output(), s0 chains, or s0.osc()/s0.noise().',
      'For image-proof visibility, include explicit .color(...) or .colorama(...) on the rendered chain.',
      'Use numeric color values like .color(0.95, 0.61, 0.62); do not pass osc(), noise(), or other sources into color().',
      'Use numeric transform values like .brightness(1.2); do not pass osc(), noise(), or other sources into brightness(), saturate(), scale(), rotate(), or kaleid().',
      'Use visible numeric source rates such as osc(4, 0.1, 1.0), noise(3, 0.2), or voronoi(5, 0.3, 0.2); avoid all-near-zero source values.',
      'The patch must render in a headless browser preview without webcam, screen capture, microphone, or user permissions.',
      '',
      `User request: ${prompt}`,
    ].join('\n');
    const code = await super.generate(hydraPrompt, options);
    return this.sanitizeCode(code);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    code = this.sanitizeCode(code);
    if (/^\s*[-*]\s|\*\*|```|✅|ready to paste|Hydra editor|—/im.test(code)) {
      return {
        valid: false,
        error: 'Hydra output must be raw executable Hydra code only, not markdown or prose explanation',
      };
    }
    // Basic Hydra validation - must have Hydra-specific syntax
    if (!/\b(osc|shape|noise|voronoi|src|render|out)\b/.test(code)) {
      return { valid: false, error: 'No Hydra syntax found' };
    }
    if (/\bs0\.init(?:Cam|Screen)\s*\(/.test(code) || /\bsrc\s*\(\s*s0\s*\)/.test(code)) {
      return {
        valid: false,
        error: 'Hydra preview must not depend on camera or screen input (s0.initCam, s0.initScreen, or src(s0)); use generated visual sources so headless previews are visible',
      };
    }
    if (/\bs0\.(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(code)) {
      return { valid: false, error: 'Hydra output uses invalid s0 source methods; use osc(), noise(), shape(), voronoi(), gradient(), or solid() directly' };
    }
    if (/\bs0\.[A-Za-z_][\w$]*\s*\(/.test(code)) {
      return { valid: false, error: 'Hydra output must not use s0 as a chain root; start with generated sources such as osc(), noise(), or solid()' };
    }
    if (/\b(?:osc|noise|shape|voronoi|gradient|solid)\s*\([^)]*\)\s*\n\s*(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(code)) {
      return { valid: false, error: 'Hydra output has adjacent bare source calls; combine sources with .add(), .blend(), .mult(), or separate .out() chains' };
    }
    const unsupportedMethods = ['saturation', 'feedback', 'kaleidoscope', 'colorShift', 'post', 'screen', 'output'];
    for (const method of unsupportedMethods) {
      if (new RegExp(`\\.${method}\\s*\\(`).test(code)) {
        return { valid: false, error: `Hydra output uses unsupported method .${method}(); use hydra-synth 1.3 runtime-safe APIs` };
      }
    }
    if (/\bloop\s*\(/.test(code)) {
      return { valid: false, error: 'Hydra output uses unsupported loop(); use Hydra chaining and .out() only' };
    }
    if (!/\b(osc|shape|noise|voronoi|gradient|solid)\s*\(/.test(code)) {
      return {
        valid: false,
        error: 'Hydra preview must include a visible source such as osc(), noise(), shape(), voronoi(), gradient(), or solid(); screen-only src(s0) patches render blank in headless proof',
      };
    }
    if (!/\.(?:color|colorama)\s*\(/.test(code) && !/\bsolid\s*\(/.test(code)) {
      return {
        valid: false,
        error: 'Hydra image proof must include explicit color(), colorama(), or solid() output so headless screenshots are visibly nonblank',
      };
    }
    if (/\.color\s*\([^)]*\b(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(code)) {
      return {
        valid: false,
        error: 'Hydra image proof must use numeric color() arguments; source functions inside color() can render blank',
      };
    }
    if (/\.(?:brightness|saturate|scale|rotate|kaleid)\s*\([^)]*\b(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(code)) {
      return {
        valid: false,
        error: 'Hydra image proof must use numeric transform arguments; source functions inside scalar transforms can render blank',
      };
    }
    return { valid: true };
  }

  private sanitizeCode(code: string): string {
    if (!code || code.trim().length === 0) {
      return '';
    }
    
    let clean = code;
    
    // Strip markdown code fences (only at start/end, preserve code inside)
    clean = clean.replace(/^```(?:javascript|js)?\n?/gm, '');
    clean = clean.replace(/\n?```$/gm, '');
    clean = clean.replace(/^```$/gm, '');
    
    // Strip <think> tags and their content (LLM reasoning contamination)
    clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Strip HTML-style comments
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');

    // Local models sometimes start a chain with ".solid(...)" or end an
    // unsupported screen chain with a fresh ".out(...)" statement.
    clean = clean.replace(/(^|\n)(\s*)\.(solid|osc|noise|shape|voronoi|gradient|src)\s*\(/g, '$1$2$3(');
    clean = clean.replace(/\.screen\s*\(\s*\)\s*;\s*\n\s*\.out\s*\(/g, '.out(');
    clean = clean.replace(/\.output\s*\(\s*\)\s*;\s*\n\s*\.out\s*\(/g, '.out(');
    clean = clean.replace(/\bs0\.(osc|noise|shape|voronoi|gradient|solid)\s*\(/g, '$1(');
    
    // Only filter out lines that are pure explanation (no code patterns at all)
    const lines = clean.split('\n');
    const codeLines: string[] = [];
    let foundCode = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines at start
      if (trimmed === '' && !foundCode) continue;
      if (/^[-*]\s/.test(trimmed) || /\*\*|✅|ready to paste|Hydra editor|—/.test(trimmed)) continue;
      
      // Keep lines that:
      // 1. Are comments (start with //)
      // 2. Have code-like patterns (parentheses, method chains, operators)
      // 3. Have Hydra-specific syntax
      const isComment = trimmed.startsWith('//');
      const hasCodePattern = /[()=.,;]/.test(trimmed);
      const hasHydraSyntax = /\b(osc|shape|noise|voronoi|src|render|out|speed|scale|color|blend|modulate|pixelate|rotate|scroll|post|fast|slow|mask)\b/.test(trimmed);
      
      if (isComment || hasCodePattern || hasHydraSyntax) {
        codeLines.push(line);
        if (hasHydraSyntax || hasCodePattern) {
          foundCode = true;
        }
      }
      // Skip pure explanation lines (natural language without code patterns)
    }
    
    clean = codeLines.join('\n');
    
    // Ensure it ends with .out() if no render
    const hasVisibleSource = /\b(osc|shape|noise|voronoi|gradient|solid)\s*\(/.test(clean);
    if (hasVisibleSource && !clean.includes('.out(') && !clean.includes('render(')) {
      clean += '\n.out(o0)';
    }
    
    // Ensure there's a render call if multiple outputs
    if (clean.includes('.out(o1)') || clean.includes('.out(o2)') || clean.includes('.out(o3)')) {
      if (!clean.includes('render(')) {
        clean += '\nrender(o0)';
      }
    }
    
    return clean.trim();
  }

  /**
   * Wrap Hydra code for gallery iframe display.
   * Uses Hydra-synth CDN with a self-contained harness.
   */
  wrapForGallery(code: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hydra Synth</title>
<style>
*{margin:0;padding:0;overflow:hidden}
body{background:#000}
canvas{display:block;width:100vw;height:100vh}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script src="https://cdn.jsdelivr.net/npm/hydra-synth@1.3.10/dist/hydra-synth.js"></script>
<script>
const h=new Hydra({canvas:document.getElementById('c'),detectAudio:false,width:innerWidth,height:innerHeight});
${code}
</script>
</body>
</html>`;
  }
}
