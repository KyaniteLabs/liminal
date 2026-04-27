/**
 * StrudelGenerator - Generates Strudel (TidalCycles for JavaScript) patterns
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export interface StrudelGeneratorOptions extends TierBasedGeneratorOptions {
  bpm?: number;
}

export class StrudelGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('strudel', llmOrConfig);
  }

  async generate(prompt: string, options?: StrudelGeneratorOptions): Promise<string> {
    try {
      const code = await super.generate(prompt, options);
      return this.sanitizeCode(code);
    } catch (error) {
      const direct = await this.retryStrudelDirect(prompt, options);
      if (direct) return direct;
      throw error;
    }
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Must have at least one sound source
    if (!/\b(s\(|sound\(|note\()/.test(code)) {
      return { valid: false, error: 'No sound source found (need s(), sound(), or note())' };
    }
    return { valid: true };
  }

  private sanitizeCode(code: string): string {
    if (!code || code.trim().length === 0) {
      return '';
    }
    
    let clean = code;
    
    // Strip markdown code fences (only at start/end, preserve code inside)
    clean = clean.replace(/^```(?:javascript|js|strudel)?\n?/gm, '');
    clean = clean.replace(/\n?```$/gm, '');
    clean = clean.replace(/^```$/gm, '');
    
    // Strip <think> tags and their content (LLM reasoning contamination)
    clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Strip HTML-style comments
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');

    // If the model returned an HTML wrapper page, prefer extracting visible
    // Strudel code from a code/output container or from inline helper scripts.
    const codeDivMatch = clean.match(/<div[^>]*class=["'][^"']*code[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (codeDivMatch) {
      clean = codeDivMatch[1];
    } else {
      const preMatch = clean.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      if (preMatch) {
        clean = preMatch[1];
      }
    }

    clean = clean
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Only filter out lines that are pure explanation (no code patterns at all)
    const lines = clean.split('\n');
    const codeLines: string[] = [];
    let foundCode = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines at start
      if (trimmed === '' && !foundCode) continue;
      
      // Keep lines that:
      // 1. Are comments (start with //)
      // 2. Have code-like patterns (parentheses, operators, function calls)
      // 3. Have Strudel-specific syntax
      const isComment = trimmed.startsWith('//');
      const hasCodePattern = /[()=.,;]/.test(trimmed);
      const hasStrudelSyntax = /\b(stack|s\(|sound|note|\.out\(|$:|\.(gain|delay|room|pan|cutoff|resonance|attack|decay|sustain|release|clip|shape)|every\(|fast\(|slow\(|cat\(|seq\(|struct\()/.test(trimmed);
      
      if (isComment || hasCodePattern || hasStrudelSyntax) {
        codeLines.push(line);
        if (hasStrudelSyntax || hasCodePattern) {
          foundCode = true;
        }
      }
      // Skip pure explanation lines (natural language without code patterns)
    }
    
    clean = codeLines.join('\n');
    
    return clean.trim();
  }

  private async retryStrudelDirect(prompt: string, options?: StrudelGeneratorOptions): Promise<string | null> {
    const result = await this.llm.complete({
      systemPrompt: 'You write Strudel live-coding music patterns. Output only runnable Strudel code.',
      prompt: [
        `Create a Strudel pattern for: ${prompt}`,
        `Use bpm ${options?.bpm ?? 120} unless the prompt implies another tempo.`,
        'Return 3 to 8 compact lines.',
        'Include at least one s("bd ...") or note("...") pattern and call .out() or use $: lines.',
        'No markdown fences, prose, HTML, or hidden reasoning in the final answer.',
      ].join('\n'),
      maxTokens: options?.maxTokens ?? 1200,
      temperature: this.llm.getConfig().temperature,
      signal: options?.signal,
    });
    if (!result.success || !result.text) return null;

    const clean = this.sanitizeCode(this.recoverStrudelFromModelText(result.text) ?? result.text);
    return this.validateOutput(clean).valid ? clean : null;
  }

  private recoverStrudelFromModelText(text: string): string | null {
    const fenced = text.match(/```(?:javascript|js|strudel)?\s*\n([\s\S]*?)```/i)?.[1];
    if (fenced && this.validateOutput(this.sanitizeCode(fenced)).valid) {
      return fenced;
    }

    const lines = text
      .replace(/<\/?think[^>]*>/gi, '')
      .split('\n')
      .map(line => line.trim().replace(/^\s*(?:Line\s*)?\d+\s*:\s*/i, ''))
      .filter(line => line.length > 0)
      .filter(line => !/^[-*]\s+[A-Za-z]/.test(line))
      .filter(line => /\$:\s*|\b(?:s|sound|note|stack|bpm|setcps|setcpm|hush)\s*\(|\.(?:fast|slow|gain|room|delay|pan|cutoff|decay|attack|sustain|release|out)\s*\(/.test(line));

    return lines.some(line => /\b(?:s|sound|note)\s*\(/.test(line))
      ? lines.join('\n')
      : null;
  }

  /**
   * Wrap Strudel code for gallery iframe display.
   * Shows the pattern and links to the Strudel editor for hearable playback.
   */
  wrapForGallery(code: string): string {
    const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const editorUrl = `https://strudel.cc/?code=${encodeURIComponent(code)}`;
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Strudel</title>
<style>
body{background:#1a1a2e;color:#eee;font-family:monospace;min-height:100vh;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
pre{font-size:clamp(10px,2vw,18px);line-height:1.4;white-space:pre-wrap;max-width:90vw}
a{color:#67e8f9;margin-top:18px}
</style>
</head>
<body>
<pre id="code">${escaped}</pre>
<a href="${editorUrl}" target="_blank" rel="noopener noreferrer">Open in Strudel to hear this pattern</a>
<p style="color:#888;font-size:12px;margin-top:20px">Native audio proof is pending; this page preserves the generated pattern and provides a playback path.</p>
</body>
</html>`;
  }
}
