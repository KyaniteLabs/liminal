import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { GenerationError } from '../../errors/GenerationError.js';
import { HydraValidator } from '../../core/validators/HydraValidator.js';

// Washout clamp constants (see capBlendWeights). Hydra's `.add(tex)` defaults to a
// full additive (amount 1.0), and high `.add`/`.blend` weights pile sources toward
// white. These cap the additive contribution at the source — the actual washout
// cause — without darkening renders that already sit in a healthy luminance band.
const HYDRA_DEFAULT_ADD_WEIGHT = 0.3; // weight given to an otherwise-unweighted .add
const HYDRA_MAX_ADD_WEIGHT = 0.4; // .add weights above this are clamped down
const HYDRA_MAX_BLEND_WEIGHT = 0.5; // .blend weights above this are clamped down

export type HydraGeneratorOptions = TierBasedGeneratorOptions;

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
      'Target a MID-range overall exposure with a FULL tonal range: include both bright highlights and clear dark/shadow regions. Do NOT force every channel bright (that washes the frame white) and do NOT let the whole frame go black — aim for balanced mid-tones with real darks and lights.',
      'Use numeric transform values like .brightness(0.35); include .brightness(0.2-0.45) as a gentle lift — hydra brightness() is ADDITIVE (it adds the value to every pixel), so values above ~0.5 wash the whole frame to fog. Do not pass osc(), noise(), or other sources into brightness(), saturate(), scale(), rotate(), or kaleid().',
      'CONTRAST IS REQUIRED — the frame must span a WIDE luminance range with deep DARK / shadow regions AND bright highlights, never a uniform bright, milky, or near-white field. Add .contrast(1.3-1.7) and shape tone with .luma(...) (or start from a darker base) so a meaningful portion of the frame reads dark. Do not let blended sources wash the whole frame to white.',
      'Use visible numeric source rates such as osc(4, 0.1, 1.0), noise(3, 0.2), or voronoi(5, 0.3, 0.2); avoid all-near-zero source values.',
      'For screenshot proof, combine at least two generated visual sources with .blend(..., 0.25-0.45), .mult(), .modulate(), .diff(), or weighted .add(..., 0.25-0.45); do not use unweighted .add(...).',
      'End the patch with .out(o0) and render(o0); do not use bare render(), which shows an output grid with black unused quadrants.',
      'Build a rich, layered patch — not a one-liner: combine 2-3 sources and apply several transforms (.color()/.colorama(), .modulate(), .rotate(), .scale(), .kaleid(), .repeat()) with deliberate numeric parameters. Aim for at least 8 chained operations and 150+ characters of substance.',
      'The patch must render in a headless browser preview without webcam, screen capture, microphone, or user permissions.',
      '',
      `User request: ${prompt}`,
    ].join('\n');
    let code: string;
    try {
      code = await super.generate(hydraPrompt, options);
    } catch (error) {
      const direct = await this.retryHydraDirect(prompt, options);
      if (direct) return direct;
      throw error;
    }
    const clean = this.sanitizeCode(code);
    const reliabilityIssue = this.findStaticRenderReliabilityIssue(clean);
    if (this.isUndersizedHydraCode(clean) || reliabilityIssue) {
      const direct = await this.retryHydraDirect(prompt, options);
      if (direct) return direct;
      const length = this.executableLength(clean);
      const reason = reliabilityIssue ?? `Generated hydra code is too small (${length} chars) - minimum is ${HydraValidator.getMinSize()} chars`;
      throw new GenerationError(
        `HydraGenerator: ${reason}`,
        'hydra',
        { codeLength: length, generatedCode: clean, validationError: reliabilityIssue },
      );
    }
    return clean;
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    code = this.sanitizeCode(code);
    if (/\bs0\.init(?:Cam|Screen)\s*\(/.test(code) || /\bsrc\s*\(\s*s0\s*\)/.test(code)) {
      return {
        valid: false,
        error: 'Hydra preview must not depend on camera or screen input (s0.initCam, s0.initScreen, or src(s0)); use generated visual sources so headless previews are visible',
      };
    }
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
    // Track paren depth across lines: a source call at the start of a line is
    // only a NEW chain when no enclosing call is still open. Without this,
    // valid multi-line arguments — `.modulate(\n  voronoi(...), 0.4\n)` — are
    // misread as chain breaks (live false positives, 2026-06-12).
    let parenDepth = 0;
    for (let i = 0; i < sourceLines.length; i++) {
      const line = sourceLines[i];
      if (i > 0 && parenDepth === 0 && /^(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(line)) {
        const previous = sourceLines[i - 1];
        if (!/\.out\s*\(|render\s*\(/.test(previous)) {
          return { valid: false, error: `Hydra output starts a new source in the middle of an unfinished chain (after "${previous.slice(0, 60)}"); combine it with .add(), .blend(), or finish the prior chain with .out()` };
        }
      }
      const codePart = line.replace(/\/\/.*$/, '');
      for (const ch of codePart) {
        if (ch === '(') parenDepth += 1;
        else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
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
    const overbright = this.findOverbrightBrightness(code);
    if (overbright !== null) {
      return {
        valid: false,
        error: `Hydra image proof must keep brightness() at or below 1.0 to avoid solid overexposed renders; found brightness(${overbright})`,
      };
    }
    return { valid: true };
  }

  private findOverbrightBrightness(code: string): number | null {
    for (const match of code.matchAll(/\.brightness\s*\(\s*([0-9]*\.?[0-9]+)/g)) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 1.0) return value;
    }
    return null;
  }

  private isUndersizedHydraCode(code: string): boolean {
    return this.executableLength(code) < HydraValidator.getMinSize();
  }

  private executableLength(code: string): number {
    return code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().length;
  }

  private findStaticRenderReliabilityIssue(code: string): string | null {
    const outOfRangeColor = this.findOutOfRangeColorChannel(code);
    if (outOfRangeColor !== null) {
      return `Hydra color() channels must stay between 0.0 and 1.0 for predictable headless renders; found ${outOfRangeColor}`;
    }

    const brightnesses = [...code.matchAll(/\.brightness\s*\(\s*([0-9]*\.?[0-9]+)/g)]
      .map(match => Number(match[1]))
      .filter(Number.isFinite);
    if (brightnesses.length === 0) {
      return 'Hydra image proof must include brightness(0.15-0.45) to avoid dark/blank headless renders';
    }
    const tooDark = brightnesses.find(value => value < 0.1);
    if (tooDark !== undefined) {
      return `Hydra brightness() below 0.1 renders near-black in headless proof — use brightness(0.15-0.45); found brightness(${tooDark})`;
    }
    // brightness() is additive in hydra (rgb + amount): a lift above ~0.55 pushes
    // even pure-black bases past mid-grey, leaving no dark anchor anywhere in the
    // frame (measured: brightness(0.84) -> mean luminance 0.69, brightFraction 1.0;
    // the same patch at 0.35 -> luminance 0.20 with full value structure).
    const foggy = brightnesses.find(value => value > 0.55);
    if (foggy !== undefined) {
      return `Hydra brightness() is additive; values above 0.55 wash the frame to uniform fog — use brightness(0.15-0.45); found brightness(${foggy})`;
    }
    return null;
  }

  private findOutOfRangeColorChannel(code: string): number | null {
    for (const match of code.matchAll(/\.color\s*\(([^)]*)\)/g)) {
      const args = this.splitTopLevelArgs(match[1]).map(arg => arg.trim());
      if (args.length < 3) continue;
      for (const arg of args.slice(0, 3)) {
        if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(arg)) continue;
        const value = Number(arg);
        if (Number.isFinite(value) && (value < 0 || value > 1)) return value;
      }
    }
    return null;
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
    clean = this.collapseRepeatedSourceCallTails(clean);

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
    clean = clean.replace(/\.draw\s*\(\s*\)\s*;?/g, '.out(o0)');
    // Some providers hallucinate kaleid() as a global source. In Hydra it is a
    // chain transform, so turn bare uses into an explicit visible source chain
    // before variable inlining runs.
    clean = clean.replace(/\b((?:const|let|var)\s+[A-Za-z_]\w*\s*=\s*)kaleid\s*\(([^)]*)\)[^\S\n]*;?/g, '$1osc(4, 0.1, 1.0).kaleid($2);');
    clean = clean.replace(/(^|[^.\w$])kaleid\s*\(([^)]*)\)/g, '$1osc(4, 0.1, 1.0).kaleid($2)');
    clean = clean.replace(/\bs0\.(osc|noise|shape|voronoi|gradient|solid)\s*\(/g, '$1(');
    // Catch remaining s0.anyMethod() patterns that the specific regex above missed
    clean = clean.replace(/\bs0\.(?!(?:initCam|initScreen)\s*\()([a-zA-Z_$][\w$]*)\s*\(/g, '$1(');
    // Strip bare s0 references used as chain roots (e.g. s0.out(o0))
    clean = clean.replace(/\bs0\s*\.(?!(?:initCam|initScreen)\s*\()/g, '');

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

    for (const line of clean.split('\n')) {
      const assignment = line.match(/^\s*(?:(?:const|let|var)\s+)?([a-zA-Z_]\w*)\s*=\s*(.+)\s*$/);
      if (!assignment) continue;
      const rhs = assignment[2].trim();
      const startsWithHydraSource = /^(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(rhs);
      const startsWithDerivedHydraVar = /^[a-zA-Z_]\w*\s*\.(?:modulate|blend|add|mult|diff|colorama|saturate|brightness|scale|rotate|kaleid|scroll|pixelate)\s*\(/.test(rhs);
      if (startsWithHydraSource || startsWithDerivedHydraVar) {
        allVarMap.set(assignment[1], rhs.replace(/;\s*$/, '').trim());
      }
    }

    // Pass 1: source-based assignments (osc/noise/shape/etc.)
    const sourceVarRegex = /^(?:(?:const|let|var)\s+)?([a-zA-Z_]\w*)\s*=\s*((?:osc|noise|shape|voronoi|gradient|solid)\s*\([^\n]*\s*)$/gm;
    let srcMatch: RegExpExecArray | null;
    while ((srcMatch = sourceVarRegex.exec(clean)) !== null) {
      allVarMap.set(srcMatch[1], srcMatch[2].replace(/;\s*$/, '').trim());
    }

    // Pass 2: derived assignments (varName = otherVar.method(...))
    const derivedVarRegex = /^(?:(?:const|let|var)\s+)?([a-zA-Z_]\w*)\s*=\s*((?:[a-zA-Z_]\w*)[^\S\n]*\.(?:modulate|blend|add|mult|diff|colorama|saturate|brightness|scale|rotate|kaleid|scroll|pixelate)[^\n]*;?\s*)$/gm;
    let drvMatch: RegExpExecArray | null;
    while ((drvMatch = derivedVarRegex.exec(clean)) !== null) {
      if (!allVarMap.has(drvMatch[1])) {
        allVarMap.set(drvMatch[1], drvMatch[2].replace(/;\s*$/, '').trim());
      }
    }

    const aliasVarRegex = /^(?:(?:const|let|var)\s+)?([a-zA-Z_]\w*)\s*=\s*([a-zA-Z_]\w*)\s*;?\s*$/gm;
    let aliasMatch: RegExpExecArray | null;
    while ((aliasMatch = aliasVarRegex.exec(clean)) !== null) {
      const target = allVarMap.get(aliasMatch[2]);
      if (target && !allVarMap.has(aliasMatch[1])) {
        allVarMap.set(aliasMatch[1], target);
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
      const assignLineRegex = new RegExp(`^\\s*(?:(?:const|let|var)\\s+)?(${varNames})\\s*=\\s*[^\\n]*\\s*$`, 'gm');
      clean = clean.replace(assignLineRegex, (match: string, varName: string, offset: number, full: string) => {
        const followingText = full.slice(offset + match.length);
        return /^\s*\n\s*\./.test(followingText) ? (allVarMap.get(varName) || '') : '';
      });

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

    const writtenOutputs = new Set<string>();
    for (const match of clean.matchAll(/\.out\s*\(\s*(o[0-3])?\s*\)/g)) {
      writtenOutputs.add(match[1] || 'o0');
    }
    clean = clean.replace(/\bsrc\s*\(\s*(o[0-3])\s*\)/g, (match, output: string) =>
      writtenOutputs.has(output) ? match : 'osc(4, 0.1, 1.0)',
    );

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

    // Headless screenshots need a full-frame output. Bare render() displays the
    // output grid, leaving unused quadrants black when only o0 is populated.
    if (/\.out\s*\(/.test(clean)) {
      if (!clean.includes('render(')) {
        clean += '\nrender(o0)';
      } else {
        clean = clean.replace(/render\s*\(\s*\)/g, 'render(o0)');
        clean = clean.replace(/render\s*\(\s*all\s*\)/g, 'render(o0)');
      }
    }

    // Washout cause: additive/blend blow-out. Unweighted .add(x) defaults to a
    // full additive (amount 1.0) and sums sources toward white; high .add/.blend
    // weights pile brightness the same way. Deterministically cap them here — give
    // unweighted .add a low default weight and clamp over-ceiling weights — so the
    // actual cause is targeted without blindly darkening already-good renders.
    clean = this.capBlendWeights(clean);

    return clean.trim();
  }

  /**
   * Deterministically cap the additive/blend weights that cause hydra washout.
   * Walks every `.add(...)` / `.blend(...)` call with balanced-paren parsing (a
   * plain regex can't handle nested source args like `.add(osc(4, 0.1), 0.8)`):
   *   - an unweighted `.add(src)` gets HYDRA_DEFAULT_ADD_WEIGHT appended (Hydra's
   *     default add amount is a full 1.0, which sums straight to white);
   *   - an `.add`/`.blend` whose trailing numeric weight exceeds its ceiling is
   *     clamped down to that ceiling.
   * Non-numeric weights (e.g. animated `() => ...`) and unweighted `.blend`
   * (whose default 0.5 is already moderate) are left untouched, and `.mult`/
   * `.diff`/`.modulate` are ignored since they darken or displace, not blow out.
   */
  private capBlendWeights(code: string): string {
    const callRegex = /\.(add|blend)\s*\(/g;
    let result = '';
    let appendFrom = 0;
    let match: RegExpExecArray | null;
    while ((match = callRegex.exec(code)) !== null) {
      const method = match[1] as 'add' | 'blend';
      const openParen = match.index + match[0].length - 1; // index of '('
      let depth = 1;
      let cursor = openParen + 1;
      while (cursor < code.length && depth > 0) {
        const char = code[cursor];
        if (char === '(') depth++;
        else if (char === ')') depth--;
        if (depth === 0) break;
        cursor++;
      }
      if (depth !== 0) break; // unbalanced parens — leave the remainder untouched
      const inner = code.slice(openParen + 1, cursor);
      const capped = this.capCallArgs(inner, method);
      result += code.slice(appendFrom, openParen + 1) + capped + ')';
      appendFrom = cursor + 1;
      callRegex.lastIndex = cursor + 1; // resume scanning after this whole call
    }
    result += code.slice(appendFrom);
    return result;
  }

  /** Cap or append the weight on the arguments of a single .add/.blend call. */
  private capCallArgs(inner: string, method: 'add' | 'blend'): string {
    const rawArgs = this.splitTopLevelArgs(inner);
    if (rawArgs.length === 0) return inner;
    // Recurse so a nested .add/.blend inside a source expression is capped too.
    const args = rawArgs.map(arg => this.capBlendWeights(arg).trim());
    const numericLiteral = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
    if (args.length === 1) {
      return method === 'add' ? `${args[0]}, ${HYDRA_DEFAULT_ADD_WEIGHT}` : args[0];
    }
    const last = args[args.length - 1];
    if (!numericLiteral.test(last)) return args.join(', '); // non-numeric weight
    const ceiling = method === 'add' ? HYDRA_MAX_ADD_WEIGHT : HYDRA_MAX_BLEND_WEIGHT;
    const cappedLast = Number(last) > ceiling ? String(ceiling) : last;
    return [...args.slice(0, -1), cappedLast].join(', ');
  }

  /** Split call arguments on top-level commas, respecting nested ()/[] groups. */
  private splitTopLevelArgs(inner: string): string[] {
    if (inner.trim() === '') return [];
    const args: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < inner.length; i++) {
      const char = inner[i];
      if (char === '(' || char === '[') depth++;
      else if (char === ')' || char === ']') depth--;
      else if (char === ',' && depth === 0) {
        args.push(inner.slice(start, i));
        start = i + 1;
      }
    }
    args.push(inner.slice(start));
    return args;
  }

  private async retryHydraDirect(prompt: string, options?: HydraGeneratorOptions): Promise<string | null> {
    const result = await this.llm.complete({
      systemPrompt: 'You write Hydra-synth 1.3 patches. Output only raw executable Hydra code.',
      prompt: [
        `Create a visible Hydra patch for: ${prompt}`,
        'Use one complete chain that combines at least two generated sources.',
        'Return a substantial 150+ character patch with at least 8 chained operations, not a tiny one-liner.',
        'Safe shape: solid(...).add(osc(...), 0.3).blend(voronoi(...), 0.35).modulate(noise(...), 0.2).color(...).contrast(...).kaleid(...).rotate(...).scale(...).brightness(0.35).out(o0); render(o0);',
        'Use numeric arguments only inside color(), brightness(), saturate(), scale(), rotate(), and kaleid().',
        'Keep color() channels between 0.0 and 1.0 and include brightness(0.2-0.45) — brightness() is additive, higher values wash the frame to fog.',
        'No camera/screen input, no prose, no markdown, no separate unfinished source chains.',
      ].join('\n'),
      maxTokens: options?.maxTokens ?? 1400,
      temperature: this.llm.getConfig().temperature,
      signal: options?.signal,
    });
    if (!result.success || !result.text) return null;
    const raw = this.recoverHydraFromModelText(result.text) ?? result.text;
    const clean = this.sanitizeCode(raw);
    return this.validateOutput(clean).valid && !this.isUndersizedHydraCode(clean) && !this.findStaticRenderReliabilityIssue(clean) ? clean : null;
  }

  private recoverHydraFromModelText(text: string): string | null {
    const snippets = [...text.matchAll(/`([^`]*(?:osc|noise|shape|voronoi|gradient|solid)[^`]*)`/g)]
      .map(match => match[1].trim())
      .filter(snippet => /\.out\s*\(/.test(snippet));
    if (snippets.length > 0) return snippets[snippets.length - 1];

    const lines = text
      .replace(/<\/?think[^>]*>/gi, '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !/^[-*]\s+[A-Za-z]/.test(line))
      .filter(line => /\b(?:osc|noise|shape|voronoi|gradient|solid|render)\s*\(|^\.(?:add|blend|mult|diff|modulate|color|colorama|saturate|brightness|scale|rotate|kaleid|out)\s*\(/.test(line));

    return lines.some(line => /\b(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(line))
      ? lines.join('\n')
      : null;
  }

  private collapseRepeatedSourceCallTails(code: string): string {
    let clean = code;
    let previous: string;
    do {
      previous = clean;
      clean = clean.replace(
        /\b(osc|noise|shape|voronoi|gradient|solid)\(([^()\n]*)\)\s*\([^()\n]*\)/g,
        '$1($2)',
      );
    } while (clean !== previous);
    return clean;
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
html,body{width:100%;height:100%;background:#000}
canvas{display:block;width:100vw;height:100vh}
</style>
</head>
<body>
<canvas id="c" width="1280" height="720"></canvas>
<script src="https://cdn.jsdelivr.net/npm/hydra-synth@1.3.10/dist/hydra-synth.js"></script>
<script>
const hydraCanvas = document.getElementById('c');
function sizeHydraCanvas() {
  const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1280);
  const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 720);
  hydraCanvas.width = width;
  hydraCanvas.height = height;
  return { width, height };
}
const hydraSize = sizeHydraCanvas();
const hydra = new Hydra({
  canvas: hydraCanvas,
  detectAudio: false,
  enableStreamCapture: false,
  width: hydraSize.width,
  height: hydraSize.height
});
if (typeof setResolution === 'function') setResolution(hydraSize.width, hydraSize.height);
window.addEventListener('resize', () => {
  const nextHydraSize = sizeHydraCanvas();
  if (typeof setResolution === 'function') setResolution(nextHydraSize.width, nextHydraSize.height);
});
${code}
</script>
</body>
</html>`;
  }
}
