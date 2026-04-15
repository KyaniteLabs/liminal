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
    const code = await super.generate(this.withToneContract(prompt), options);
    return this.sanitizeCode(code);
  }

  private withToneContract(prompt: string): string {
    return [
      prompt,
      '',
      'Output contract:',
      '- Return only Tone.js code, not HTML and not Markdown.',
      '- Use a simple reliable chain: synth voices -> Tone.Filter -> Tone.Reverb -> Tone.Destination.',
      '- Use real Tone classes only: Synth, PolySynth, AMSynth, FMSynth, Filter, Reverb, FeedbackDelay, LFO, Loop, Sequence, Transport.',
      '- Do not use Tone.Analyser, Tone.AuxNode, Tone.RampTo, raw AudioContext visualizers, or canvas code.',
      '- Do not access `.filter`, `.filter.lfo`, or `.detune.value` on Synth/PolySynth instances.',
      '- For LFO movement, create `const filter = new Tone.Filter(...); const lfo = new Tone.LFO(...).connect(filter.frequency);`.',
      '- Include Tone.Transport.start() and at least one scheduled repeating pulse.',
    ].join('\n');
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
   * Shows code as display-only (audio not available in sandboxed iframe).
   */
  wrapForGallery(code: string): string {
    const escaped=code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tone.js</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e1e2e;color:#cdd6f4;font-family:monospace;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
pre{font-size:clamp(9px,1.5vw,14px);line-height:1.5;white-space:pre-wrap;max-width:95vw;overflow:auto}
.msg{color:#888;font-size:12px;margin-top:20px}
</style>
</head>
<body>
<pre>${escaped}</pre>
<p class="msg">Tone.js — audio not available in iframe</p>
</body>
</html>`;
  }
}
