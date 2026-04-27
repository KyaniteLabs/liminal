/**
 * ToneGenerator - Generates Web Audio synthesis using Tone.js via LLM
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 * NO TEMPLATES - Everything goes through the LLM
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { HTMLValidator } from '../../core/validators/HTMLValidator.js';
import { ToneValidator } from '../../core/validators/ToneValidator.js';

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
      'Keep the output compact enough to finish in one response; no markdown fences or prose.',
      '',
      `User request: ${prompt}`,
    ].join('\n');
    try {
      const code = await super.generate(tonePrompt, { ...options, maxTokens: options?.maxTokens ?? 8192 });
      return this.sanitizeCode(code);
    } catch (error) {
      const direct = await this.retryToneDirect(prompt, options);
      if (direct) return direct;
      throw error;
    }
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const clean = this.sanitizeCode(code);
    // Must use Tone.js
    if (!clean.includes('Tone') && !clean.includes('tone')) {
      return { valid: false, error: 'Generated code does not use Tone.js' };
    }

    if (/^(?:html\s*)?<!DOCTYPE|^(?:html\s*)?<html/i.test(clean)) {
      const html = clean.replace(/^html\s*/i, '').trim();
      const htmlValidation = HTMLValidator.validate(html);
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
    
    return clean.trim();
  }

  private async retryToneDirect(prompt: string, options?: ToneOptions): Promise<string | null> {
    const prompts = [
      [
        `Create a complete browser-playable Tone.js artifact for: ${prompt}`,
        'Return one complete HTML document with <!DOCTYPE html>, <html>, <head>, charset meta, title, <body>, and closing </body></html>.',
        'Include the Tone.js CDN script in <head> and a user-click start button.',
        'No markdown, prose, hidden reasoning, or partial fragments.',
      ].join('\n'),
      [
        'Return raw complete HTML only. First characters must be <!DOCTYPE html> and final characters must be </html>.',
        '<head> must contain <meta charset="UTF-8">, <title>Tone.js Patch</title>, and the Tone.js CDN script.',
        '<body> must contain a button and a script that calls Tone.start() from a click handler and creates a Tone synth/drone.',
        `User request: ${prompt}`,
      ].join('\n'),
    ];

    for (const directPrompt of prompts) {
      const result = await this.llm.complete({
        systemPrompt: 'You write complete Tone.js browser artifacts. Output only runnable HTML or Tone.js source.',
        prompt: directPrompt,
        maxTokens: options?.maxTokens ?? 4096,
        temperature: this.llm.getConfig().temperature,
        signal: options?.signal,
      });
      if (!result.success || !result.text) continue;
      const clean = this.sanitizeCode(result.text);
      if (this.validateOutput(clean).valid) return clean;
    }

    return null;
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
