/**
 * ToneGenerator - Generates Web Audio synthesis using Tone.js via LLM
 * 
 * NO TEMPLATES - Everything goes through the LLM
 * 
 * FIXED: Added comprehensive API reference to prevent hallucinations
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

VALID TONE.JS CLASSES (USE ONLY THESE):
// Sources
- Tone.Synth, Tone.PolySynth, Tone.FMSynth, Tone.AMSynth
- Tone.MembraneSynth, Tone.MetalSynth, Tone.NoiseSynth
- Tone.Oscillator, Tone.FatOscillator

// Effects  
- Tone.Reverb, Tone.Delay, Tone.FeedbackDelay, Tone.PingPongDelay
- Tone.Distortion, Tone.Chorus, Tone.Phaser, Tone.Tremolo
- Tone.Filter, Tone.EQ3, Tone.Compressor

// Components
- Tone.Gain, Tone.Panner, Tone.LFO
- Tone.Envelope, Tone.FrequencyEnvelope

// Transport
- Tone.Transport, Tone.Loop, Tone.Sequence, Tone.Part

CRITICAL RULES:
1. Output ONLY valid JavaScript using Tone.js
2. ALWAYS use: const synth = new Tone.Synth() — NOT Tone.Synthesizer or made-up names
3. Reverb is Tone.Reverb — NOT Tone.Reverberator or Tone.ReverbNode
4. ALWAYS wait for user interaction before starting audio
5. Use Tone.Transport for timing
6. Include play/stop buttons
7. Add visual feedback

OUTPUT FORMAT:
- Complete JavaScript code
- Initialize Tone.js properly
- NO markdown, NO explanations

EXAMPLE:
const synth = new Tone.PolySynth(Tone.Synth).toDestination();
const reverb = new Tone.Reverb(2).toDestination();
synth.connect(reverb);

function play() {
  Tone.start();
  synth.triggerAttackRelease(["C4", "E4", "G4"], "8n");
}`;

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
