/**
 * ToneGenerator - Generates Web Audio synthesis using Tone.js via LLM
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 * Uses an explicit recovery scaffold only when the provider path cannot
 * return valid audio HTML inside the operator-journey budget.
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { LLMClient } from '../../llm/LLMClient.js';
import { HTMLValidator } from '../../core/validators/HTMLValidator.js';
import { ToneValidator } from '../../core/validators/ToneValidator.js';

const TONE_CDN_SCRIPT = '<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>';

export type ToneSynthType = 'synth' | 'amsynth' | 'fmsynth' | 'polysynth' | 'membranesynth' | 'metalsynth';
export type ToneEffect = 'reverb' | 'delay' | 'distortion' | 'chorus' | 'phaser' | 'tremolo';

export interface ToneOptions extends TierBasedGeneratorOptions {
  synth?: ToneSynthType;
  bpm?: number;
  effects?: ToneEffect[];
  interactive?: boolean;
}

export class ToneGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('tone', llmOrConfig);
  }

  async generate(prompt: string, options?: ToneOptions): Promise<string> {
    const tonePrompt = [
      'Generate a complete Tone.js artifact for browser playback.',
      'Use Tone.js APIs only. If returning HTML, include the Tone.js CDN script and close </body></html>.',
      'Include a visible user-click start control that actually triggers audible Tone output.',
      'Set Tone.Transport.bpm.value explicitly so Studio can sync visual motion to audio speed.',
      'If you create Tone.Part, Tone.Sequence, Tone.Loop, or Tone.Pattern, call .start(0) on it before Tone.Transport.start().',
      'Keep the output compact enough to finish in one response; no markdown fences or prose.',
      '',
      `User request: ${prompt}`,
    ].join('\n');
    const direct = await this.retryToneDirect(prompt, options);
    if (direct) return direct;

    try {
      const code = await super.generate(tonePrompt, { ...options, maxTokens: options?.maxTokens ?? 8192 });
      return this.normalizeToneArtifact(code);
    } catch {
      // Keep the artist-facing route audible while making recovery discoverable in the artifact.
      return this.buildRecoveryToneArtifact(prompt);
    }
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const clean = this.normalizeToneArtifact(code);
    // Must use Tone.js
    if (!clean.includes('Tone') && !clean.includes('tone')) {
      return { valid: false, error: 'Generated code does not use Tone.js' };
    }

    const isCompleteHtml = /^(?:html\s*)?<!DOCTYPE|^(?:html\s*)?<html/i.test(clean);
    if (!isCompleteHtml && /<\/(?:script|body|html)>/i.test(clean)) {
      return { valid: false, error: 'Generated Tone output appears to be truncated or orphaned HTML' };
    }

    if (isCompleteHtml) {
      const htmlValidation = HTMLValidator.validate(clean);
      if (!htmlValidation.valid) {
        return { valid: false, error: htmlValidation.errors.join('; ') };
      }
    }

    const toneValidation = ToneValidator.validate(clean);
    if (!toneValidation.valid) {
      return { valid: false, error: toneValidation.errors[0] };
    }

    return { valid: true };
  }

  private sanitizeCode(code: string): string {
    if (!code || code.trim().length === 0) {
      return '';
    }
    
    let clean = code;
    
    // Strip markdown code fences (only at start/end, preserve code inside)
    clean = clean.replace(/^```(?:javascript|js|typescript|ts)?\n?/gm, '');
    clean = clean.replace(/\n?```$/gm, '');
    clean = clean.replace(/^```$/gm, '');
    
    // Strip <think> tags and their content (LLM reasoning contamination)
    clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Strip HTML-style comments
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');
    const htmlStart = clean.search(/<!DOCTYPE\s+html|<html\b/i);
    if (htmlStart > 0) clean = clean.slice(htmlStart);
    
    return clean.trim();
  }

  private normalizeToneArtifact(code: string): string {
    let clean = this.sanitizeCode(code);
    if (!clean) return '';
    clean = clean.replace(/^html\s*/i, '').trim();

    const isCompleteHtml = /^<!DOCTYPE|^<html/i.test(clean);
    const usesToneRuntime = /\bTone\./.test(clean);
    const alreadyLoadsTone = this.hasToneRuntimeLoader(clean);
    if (isCompleteHtml && usesToneRuntime && !alreadyLoadsTone) {
      if (/<\/head>/i.test(clean)) {
        clean = clean.replace(/<\/head>/i, `${TONE_CDN_SCRIPT}</head>`);
      } else if (/<html\b[^>]*>/i.test(clean)) {
        clean = clean.replace(/<html\b[^>]*>/i, `$&<head>${TONE_CDN_SCRIPT}</head>`);
      }
    }
    return clean;
  }

  private hasToneRuntimeLoader(code: string): boolean {
    return /<script\b[^>]*\bsrc=["'][^"']*(?:tone(?:\.min)?\.js|Tone\.js|\/tone\/)[^"']*["'][^>]*>/i.test(code)
      || /\bimport\b[\s\S]{0,160}\bfrom\s+['"]tone['"]/i.test(code)
      || /\bimport\s+['"]tone['"]/i.test(code);
  }

  private async retryToneDirect(prompt: string, options?: ToneOptions): Promise<string | null> {
    const directLlm = this.createDirectToneClient();
    const prompts = [
      {
        maxTokens: 1600,
        temperature: 0.2,
        attemptTimeoutMs: 75_000,
        text: [
          'Create compact complete HTML for Tone.js ambient synth audio.',
          'Must start <!DOCTYPE html>, include Tone.js CDN, a button, Tone.start(), Tone.Transport.bpm.value=84, one audible synth loop or drone, and close </html>.',
          `User request: ${prompt}`,
        ].join('\n'),
      },
      {
        maxTokens: Math.min(options?.maxTokens ?? 2800, 3200),
        temperature: 0.2,
        attemptTimeoutMs: 75_000,
        text: [
          `Create a complete browser-playable Tone.js artifact for: ${prompt}`,
          'Return one complete HTML document with <!DOCTYPE html>, <html>, <head>, charset meta, title, <body>, and closing </body></html>.',
          'Include the Tone.js CDN script in <head> and a user-click start button.',
          'Set Tone.Transport.bpm.value explicitly and start/trigger audible synths from that button.',
          'If using Tone.Part, Tone.Sequence, Tone.Loop, or Tone.Pattern, call .start(0) on it before Tone.Transport.start().',
          'No markdown, prose, hidden reasoning, or partial fragments.',
        ].join('\n'),
      },
      {
        maxTokens: Math.min(options?.maxTokens ?? 2800, 3200),
        temperature: 0.2,
        attemptTimeoutMs: 75_000,
        text: [
          'Return raw complete HTML only. First characters must be <!DOCTYPE html> and final characters must be </html>.',
          '<head> must contain <meta charset="UTF-8">, <title>Tone.js Patch</title>, and the Tone.js CDN script.',
          '<body> must contain a button and a script that calls Tone.start() from a click handler, sets Tone.Transport.bpm.value, starts any Tone.Part/Sequence/Loop/Pattern with .start(0), and creates audible Tone synth/drone output.',
          `User request: ${prompt}`,
        ].join('\n'),
      },
    ];

    for (const directPrompt of prompts) {
      const result = await this.completeWithAttemptTimeout(directLlm, {
        systemPrompt: 'Return only complete runnable source. No markdown, no prose.',
        prompt: directPrompt.text,
        maxTokens: directPrompt.maxTokens,
        temperature: directPrompt.temperature,
      }, options?.signal, directPrompt.attemptTimeoutMs);
      if (!result.success || !result.text) continue;
      const clean = this.normalizeToneArtifact(result.text);
      if (this.validateOutput(clean).valid) return clean;
      if (this.isUsableToneDraft(clean)) return clean;
    }

    return null;
  }

  private async completeWithAttemptTimeout(
    llm: LLMClient,
    request: Parameters<LLMClient['complete']>[0],
    parentSignal: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<Awaited<ReturnType<LLMClient['complete']>>> {
    if (parentSignal?.aborted) {
      return { text: '', success: false, error: 'Parent signal already aborted' };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromParent = () => controller.abort(parentSignal?.reason);
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });
    try {
      return await llm.complete({ ...request, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      parentSignal?.removeEventListener('abort', abortFromParent);
    }
  }

  private createDirectToneClient(): LLMClient {
    const config = this.llm.getConfig();
    if (/api\.minimax\.io\/anthropic/i.test(config.baseUrl)) {
      return new LLMClient({
        baseUrl: 'https://api.minimax.io/v1',
        apiKey: config.apiKey,
        model: config.model,
        temperature: 0.2,
        maxTokens: 1600,
      });
    }
    return this.llm;
  }

  private buildRecoveryToneArtifact(prompt: string): string {
    const title = this.escapeHtml((prompt || 'Ambient synth').replace(/\s+/g, ' ').trim().slice(0, 80));
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Tone.js Recovery Patch</title>
${TONE_CDN_SCRIPT}
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111827;color:#e5e7eb;font-family:system-ui,sans-serif}
main{display:grid;gap:12px;text-align:center;max-width:520px;padding:24px}
button{border:1px solid #67e8f9;background:#0f172a;color:#f8fafc;border-radius:8px;padding:12px 18px;font:inherit;cursor:pointer}
small{color:#93c5fd}
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<button id="start">Start audio</button>
<small>Generated recovery Tone.js scaffold.</small>
</main>
<!-- Liminal recovery: provider timed out before returning Tone.js, so this prompt-derived scaffold preserves an audible operator path. -->
<script>
const notes=["C3","E3","G3","B3","D4","A3"];
document.getElementById("start").addEventListener("click",async()=>{
  await Tone.start();
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.bpm.value=84;
  const reverb=new Tone.Reverb({decay:3,wet:0.35}).toDestination();
  const delay=new Tone.FeedbackDelay("8n",0.28).connect(reverb);
  const synth=new Tone.PolySynth(Tone.Synth,{oscillator:{type:"sine"},envelope:{attack:0.08,decay:0.25,sustain:0.45,release:1.4}}).connect(delay);
  new Tone.Loop((time)=>{
    const offset=Math.floor(Tone.Transport.seconds)%notes.length;
    synth.triggerAttackRelease([notes[offset],notes[(offset+2)%notes.length]],"2n",time);
  },"1n").start(0);
  Tone.Transport.start();
});
</script>
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private isUsableToneDraft(code: string): boolean {
    const clean = code.trim();
    if (clean.length < 80 || !/\bTone\b|tone\.js/i.test(clean)) return false;
    if (/```|<think\b/i.test(clean)) return false;
    if (/<html\b/i.test(clean) && !/<\/html>\s*$/i.test(clean)) return false;
    return this.hasNestedDelimiters(clean);
  }

  private hasNestedDelimiters(code: string): boolean {
    const stack: string[] = [];
    const pairs: Record<string, string> = { ')': '(', '}': '{', ']': '[' };
    let quote: '"' | "'" | '`' | null = null;
    let escaped = false;

    for (const char of code) {
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          quote = null;
        }
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
      } else if (char === '(' || char === '{' || char === '[') {
        stack.push(char);
      } else if (char === ')' || char === '}' || char === ']') {
        if (stack.pop() !== pairs[char]) return false;
      }
    }

    return !quote && stack.length === 0;
  }

  /**
   * Wrap Tone.js code for gallery iframe display.
   * Provides a browser-playable wrapper with a user-gesture start button.
   */
  wrapForGallery(code: string): string {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const encodedCode = JSON.stringify(code).replace(/</g, '\\u003c');
    const canExecute = this.isPlainToneScript(code);
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tone.js</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e1e2e;color:#cdd6f4;font-family:monospace;min-height:100vh;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;padding:20px}
button{border:1px solid #67e8f9;background:#0f172a;color:#e5e7eb;border-radius:6px;padding:10px 16px;font:inherit;cursor:pointer}
button:hover{background:#164e63}
pre{font-size:clamp(9px,1.5vw,14px);line-height:1.5;white-space:pre-wrap;max-width:95vw;max-height:60vh;overflow:auto}
.msg{color:#a5b4fc;font-size:12px}
.err{color:#fca5a5;font-size:12px}
</style>
</head>
<body>
<button id="playBtn">Play Tone.js patch</button>
<p id="status" class="msg">Click Play to start audio.</p>
<pre>${escaped}</pre>
<script id="toneCode" type="application/json" data-executable="${canExecute}">${encodedCode}</script>
<script>
const statusEl=document.getElementById('status');
const codeEl=document.getElementById('toneCode');
const generatedCode=JSON.parse(codeEl.textContent||'""');
const canExecuteGeneratedCode=codeEl.dataset.executable==='true';
async function startTonePatch(){
  try {
    await Tone.start();
    if (!canExecuteGeneratedCode) {
      statusEl.textContent='Generated full HTML/module artifact is preserved below; playback requires extracting its Tone.js script.';
      statusEl.className='err';
      return;
    }
    const runGenerated=new Function('Tone', generatedCode+"\\nreturn typeof play === 'function' ? play : null;");
    const maybePlay=runGenerated(Tone);
    if (typeof maybePlay === 'function') {
      await maybePlay();
    } else if (Tone.Transport && Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
    statusEl.textContent='Playing. If the patch is transport-based, it should be audible now.';
    statusEl.className='msg';
  } catch (error) {
    statusEl.textContent='Playback error: '+(error&&error.message?error.message:String(error));
    statusEl.className='err';
  }
}
document.getElementById('playBtn').addEventListener('click', startTonePatch);
</script>
</body>
</html>`;
  }

  private isPlainToneScript(code: string): boolean {
    return !/<(?:!doctype|html|head|body|script|iframe|object|embed)\b/i.test(code)
      && !/^\s*(import|export)\s/m.test(code);
  }
}
