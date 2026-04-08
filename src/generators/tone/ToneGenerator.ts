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
}
