/**
 * ToneGenerator - Generates Web Audio synthesis using Tone.js via LLM
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 * NO TEMPLATES - Everything goes through the LLM
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

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
    const code = await super.generate(prompt, options);
    return this.sanitizeCode(code);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Must use Tone.js
    if (!code.includes('Tone') && !code.includes('tone')) {
      return { valid: false, error: 'Generated code does not use Tone.js' };
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

  /**
   * Wrap Tone.js code for gallery iframe display.
   * Provides a browser-playable wrapper with a user-gesture start button.
   */
  wrapForGallery(code: string): string {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const scriptCode = code.replace(/<\/script/gi, '<\\/script');
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
<script>
const statusEl=document.getElementById('status');
try {
${scriptCode}
} catch (error) {
  statusEl.textContent='Setup error: '+(error&&error.message?error.message:String(error));
  statusEl.className='err';
}
async function startTonePatch(){
  try {
    await Tone.start();
    if (typeof play === 'function') {
      await play();
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
}
