/**
 * ToneGenerator - Generates Web Audio synthesis using Tone.js via LLM
 * 
 * NO TEMPLATES - Everything goes through the LLM
 */

import { LLMClient } from '../../llm/LLMClient.js';

export type ToneSynthType = 'synth' | 'amsynth' | 'fmsynth' | 'polysynth' | 'membranesynth' | 'metalsynth';
export type ToneEffect = 'reverb' | 'delay' | 'distortion' | 'chorus' | 'phaser' | 'tremolo';

export interface ToneOptions {
  synth?: ToneSynthType;
  bpm?: number;
  effects?: ToneEffect[];
  interactive?: boolean;
}

export class ToneGenerator {
  private llmClient: LLMClient;

  constructor(llmClient?: LLMClient) {
    this.llmClient = llmClient || new LLMClient();
  }

  async generate(prompt: string, options: ToneOptions = {}): Promise<string> {
    if (!LLMClient.isConfigured()) {
      throw new Error('ToneGenerator: No LLM configured. Set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL.');
    }
    
    const systemPrompt = `You are an expert in Web Audio synthesis using Tone.js.

Generate Tone.js code for interactive audio experiences.

CONSTRAINTS:
- Output ONLY valid JavaScript code using Tone.js
- Must wait for user interaction to start audio (browser policy)
- Use Tone.Transport for timing
- Include BPM control
- Add visual feedback for audio

OUTPUT FORMAT:
- Complete JavaScript code
- Initialize Tone.js properly
- Create synths, sequences, and effects
- Add play/stop controls
- NO markdown, NO explanations`;

    const userPrompt = `Create Tone.js audio: ${prompt}

${options.bpm ? `BPM: ${options.bpm}` : ''}
${options.synth ? `Preferred synth: ${options.synth}` : ''}
${options.effects ? `Effects: ${options.effects.join(', ')}` : ''}

Generate ONLY the JavaScript code (no markdown, no explanations):`;

    const response = await this.llmClient.generate(systemPrompt, userPrompt);
    const code = typeof response === 'string' ? response : (response.code || '');
    
    if (!code || code.trim() === '') {
      throw new Error('ToneGenerator: LLM returned empty code');
    }
    
    return this.sanitizeCode(code);
  }

  private sanitizeCode(code: string): string {
    // Strip markdown fences
    let clean = code.replace(/```(?:javascript|js)?\n/g, '').replace(/```/g, '');
    
    // Strip <think> tags
    clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Ensure it uses Tone.js
    if (!clean.includes('Tone') && !clean.includes('tone')) {
      throw new Error('ToneGenerator: Generated code does not use Tone.js');
    }
    
    return clean.trim();
  }
}
