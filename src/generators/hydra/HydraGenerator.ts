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
      'Never use saturation(), feedback(), kaleidoscope(), colorShift(), post(), screen(), output(), s0 chains, s0.osc()/s0.noise(), initFBOTriangle(), or chained source methods like .osc().',
      'For image-proof visibility, include explicit .color(...) or .colorama(...) on the rendered chain.',
      'Use numeric color values like .color(0.95, 0.61, 0.62); do not pass osc(), noise(), or other sources into color().',
      'Use numeric transform values like .brightness(1.2); do not pass osc(), noise(), or other sources into brightness(), saturate(), scale(), rotate(), or kaleid().',
      'Use visible numeric source rates such as osc(4, 0.1, 1.0), noise(3, 0.2), or voronoi(5, 0.3, 0.2); avoid all-near-zero source values.',
      'For screenshot proof, combine at least two generated visual sources with .add(), .blend(), .mult(), .modulate(), or .diff().',
      'The patch must render in a headless browser preview without webcam, screen capture, microphone, or user permissions.',
      '',
      `User request: ${prompt}`,
    ].join('\n');
    const code = await super.generate(hydraPrompt, options);
    return this.sanitizeCode(code);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    if (/\bs0\.init(?:Cam|Screen)\s*\(/.test(code) || /\bsrc\s*\(\s*s0\s*\)/.test(code)) {
      return {
        valid: false,
        error: 'Hydra preview must not depend on camera or screen input (s0.initCam, s0.initScreen, or src(s0)); use generated visual sources so headless previews are visible',
      };
    }
    code = this.sanitizeCode(code);
    if (/^\s*[-*]\s|\*\*|```|✅|ready to paste|Hydra editor|—/im.test(code)) {
      return {
        valid: false,
        error: 'Hydra output must be raw executable Hydra code only, not markdown or prose explanation',
      };
    }
    if (!/\b(osc|shape|noise|voronoi|src|render|out)\b/.test(code)) {
      return { valid: false, error: 'No Hydra syntax found' };
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
    const sourceLines = code.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));
    for (let i = 1; i < sourceLines.length; i++) {
      if (/^(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(sourceLines[i])) {
        const previous = sourceLines[i - 1];
        if (!/\.out\s*\(|render\s*\(/.test(previous)) {
          return { valid: false, error: 'Hydra output starts a new source in the middle of an unfinished chain; combine it with .add(), .blend(), or finish the prior chain with .out()' };
        }
      }
    }
    if (/\.(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(code)) {
      return { valid: false, error: 'Hydra output uses source functions as chained methods; use .add(osc(...)), .blend(noise(...)), or start a new source chain' };
    }
    const unsupportedMethods = ['saturation', 'feedback', 'kaleidoscope', 'colorShift', 'post', 'screen', 'output', 'initFBOTriangle'];
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
    const sourceCount = (code.match(/\b(?:osc|shape|noise|voronoi|gradient|solid)\s*\(/g) || []).length;
    if (sourceCount < 2 && !/\.(?:add|blend|mult|modulate|diff)\s*\(/.test(code)) {
      return {
        valid: false,
        error: 'Hydra image proof must combine at least two generated visual sources so screenshots are visibly nonblank',
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

    // Strip hallucinated initFBOTriangle calls (not in hydra-synth 1.3 public API)
    clean = clean.replace(/\bs\d*\.initFBOTriangle\s*\(\s*\)\s*;?\s*/g, '');
    clean = clean.replace(/\binitFBOTriangle\s*\(\s*\)\s*;?\s*/g, '');
    const outputBufferFor = (index: string) => `o${Math.min(Number(index), 3)}`;

    // Some providers confuse source buffers s1/s2/s3 with output buffers o1/o2/o3.
    // Normalize these into Hydra's output-buffer contract.
    clean = clean.replace(/^\s*s\d+\.init\s*\(\s*\)\s*;?\s*$/gm, '');
    clean = clean.replace(/\bo([4-9]\d*)\b/g, (_match, index: string) => outputBufferFor(index));
    clean = clean.replace(/\.out\s*\(\s*s(\d+)\s*\)/g, (_match, index: string) => `.out(${outputBufferFor(index)})`);
    clean = clean.replace(/\bs(\d+)\s*\n\s*\./g, (_match, index: string) => `src(${outputBufferFor(index)})\n  .`);
    clean = clean.replace(/([,(]\s*)s(\d+)(\s*[,)\]])/g, (_match, prefix: string, index: string, suffix: string) => `${prefix}src(${outputBufferFor(index)})${suffix}`);
    clean = clean.replace(/\.(add|blend|mult|diff|modulate)\s*\(\s*o([0-3])/g, '.$1(src(o$2)');
    clean = clean.replace(/\bsrc\s*\(\s*((?:osc|noise|shape|voronoi|gradient|solid)\s*\([^)]*\))\s*\)/g, '$1');

    const inlineHydraSnippets = [...clean.matchAll(/`([^`\n]*(?:osc|noise|shape|voronoi|gradient|solid)[^`]*)`/g)]
      .map(match => match[1].trim())
      .filter(snippet => snippet.includes('.out(') || snippet.includes('.out()'));
    if (inlineHydraSnippets.length > 0) {
      clean = inlineHydraSnippets[inlineHydraSnippets.length - 1];
    } else {
      const sourceSnippets = [...clean.matchAll(/`([^`\n]*(?:osc|noise|shape|voronoi|gradient|solid)[^`]*)`/g)]
        .map(match => match[1].trim());
      if (sourceSnippets.length > 0 && /\.out\s*\(/.test(clean)) {
        clean = `${sourceSnippets[sourceSnippets.length - 1]}\n.out(o0)`;
      }
    }

    // Local models sometimes start a chain with ".solid(...)" or end an
    // unsupported screen chain with a fresh ".out(...)" statement.
    clean = clean.replace(/(^|\n)(\s*)\.(solid|osc|noise|shape|voronoi|gradient|src)\s*\(/g, '$1$2$3(');
    clean = clean.replace(/\.screen\s*\(\s*\)\s*;\s*\n\s*\.out\s*\(/g, '.out(');
    clean = clean.replace(/\.output\s*\(\s*\)\s*;\s*\n\s*\.out\s*\(/g, '.out(');
    clean = clean.replace(/\bs0\.(osc|noise|shape|voronoi|gradient|solid)\s*\(/g, '$1(');
    // Catch remaining s0.anyMethod() patterns that the specific regex above missed
    clean = clean.replace(/\bs0\.([a-zA-Z_$][\w$]*)\s*\(/g, '$1(');
    // Strip bare s0 references used as chain roots (e.g. s0.out(o0))
    clean = clean.replace(/\bs0\s*\./g, '');

    // Avoid shadowing Hydra source function names with variables, e.g.
    // `const noise = noise(...)` makes later calls crash in the browser.
    const sourceNames = ['osc', 'noise', 'shape', 'voronoi', 'gradient', 'solid'];
    for (const sourceName of sourceNames) {
      const alias = `${sourceName}Layer`;
      const declarationRegex = new RegExp(`\\b(const|let|var)\\s+${sourceName}\\s*=`, 'g');
      if (declarationRegex.test(clean)) {
        clean = clean.replace(declarationRegex, `$1 ${alias} =`);
        const referenceRegex = new RegExp(`([,(]\\s*)${sourceName}(\\s*[,)\\]])`, 'g');
        clean = clean.replace(referenceRegex, `$1${alias}$2`);
      }
    }

    // Models sometimes assign sources to named variables: a0 = osc(...), b0 = noise(...)
    // Hydra doesn't support this — convert to inline source references.
    // Multi-pass: collect source assignments, then derived assignments, inline all.
    const allVarMap = new Map<string, string>();

    // Pass 1: source-based assignments (osc/noise/shape/etc.)
    const sourceVarRegex = /^(?:(?:const|let|var)\s+)?([a-zA-Z_]\w*)\s*=\s*((?:osc|noise|shape|voronoi|gradient|solid)\s*\([\s\S]*?(?:\.(?:kaleid|rotate|color|saturate|brightness|scale|scroll|modulate|pixelate|speed|blend|add|mult|diff|colorama)\s*\([^)]*\))*\s*;?\s*)$/gm;
    let srcMatch: RegExpExecArray | null;
    while ((srcMatch = sourceVarRegex.exec(clean)) !== null) {
      allVarMap.set(srcMatch[1], srcMatch[2].replace(/;\s*$/, '').trim());
    }

    // Pass 2: derived assignments (varName = otherVar.method(...))
    const derivedVarRegex = /^(?:(?:const|let|var)\s+)?([a-zA-Z_]\w*)\s*=\s*((?:[a-zA-Z_]\w*)\s*\.(?:modulate|blend|add|mult|diff|colorama|saturate|brightness|scale|rotate|kaleid|scroll|pixelate)\s*\([\s\S]*?\s*;\s*)$/gm;
    let drvMatch: RegExpExecArray | null;
    while ((drvMatch = derivedVarRegex.exec(clean)) !== null) {
      if (!allVarMap.has(drvMatch[1])) {
        allVarMap.set(drvMatch[1], drvMatch[2].replace(/;\s*$/, '').trim());
      }
    }

    // Iteratively inline variable references (handles chains like a→b→c)
    for (let pass = 0; pass < 8 && allVarMap.size > 0; pass++) {
      let changed = false;
      for (const [varName] of allVarMap) {
        for (const [otherName, otherExpr] of allVarMap) {
          if (otherName === varName) continue;
          const current = allVarMap.get(varName)!;
          const refRegex = new RegExp(`\\b${otherName}\\b`, 'g');
          const expanded = current.replace(refRegex, otherExpr);
          if (expanded !== current) {
            allVarMap.set(varName, expanded);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }

    // Remove assignment lines and inline remaining references
    if (allVarMap.size > 0) {
      const varNames = [...allVarMap.keys()].join('|');
      const assignLineRegex = new RegExp(`^\\s*(?:(?:const|let|var)\\s+)?(${varNames})\\s*=\\s*[\\s\\S]*?;?\\s*$`, 'gm');
      clean = clean.replace(assignLineRegex, '');

      for (const [varName, expr] of allVarMap) {
        const refRegex = new RegExp(`\\b${varName}\\b`, 'g');
        clean = clean.replace(refRegex, expr);
      }
    }

    // Fix orphaned method chains: lines starting with .add/.blend/.mult/.diff
    // that have no base expression. Glue them to the previous non-empty line.
    const chainMethods = /^\.?(add|blend|mult|diff|modulate|color|colorama|saturate|brightness|scale|rotate|kaleid|scroll|pixelate)\s*\(/;
    const fixLines = clean.split('\n');
    for (let i = 1; i < fixLines.length; i++) {
      const trimmed = fixLines[i].trim();
      if (chainMethods.test(trimmed)) {
        // Find the last non-empty, non-comment line above
        let j = i - 1;
        while (j >= 0 && fixLines[j].trim() === '') j--;
        if (j >= 0) {
          const previous = fixLines[j].trim();
          if (previous.startsWith('//') || /\.out\s*\(|render\s*\(/.test(previous)) {
            fixLines[i] = '';
            continue;
          }
          // Remove trailing semicolons from the base, then append the method
          const base = fixLines[j].replace(/;\s*$/, '');
          const method = trimmed.startsWith('.') ? trimmed : trimmed.replace(/^/, '.');
          fixLines[j] = `${base}\n  ${method}`;
          fixLines[i] = '';
        }
      }
    }
    clean = fixLines.join('\n');

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
    const hasMultipleOutputs = clean.includes('.out(o1)') || clean.includes('.out(o2)') || clean.includes('.out(o3)');
    if (hasMultipleOutputs) {
      if (!clean.includes('render(')) {
        clean += '\nrender()';
      } else {
        // render(o0) with multiple outputs often shows a blank/minimal buffer;
        // use render() (no args) so every output is composited in the headless preview
        clean = clean.replace(/render\s*\(\s*o0\s*\)/g, 'render()');
        clean = clean.replace(/render\s*\(\s*all\s*\)/g, 'render()');
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
