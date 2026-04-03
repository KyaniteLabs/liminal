/**
 * ToneValidator - Tone.js audio validation logic
 *
 * Tone.js is a Web Audio framework for creating interactive music.
 * It uses classes like Tone.Synth, Tone.Oscillator, Tone.Transport, etc.
 */

export interface ToneValidationResult {
  valid: boolean;
  errors: string[];
}

export class ToneValidator {
  /**
   * Valid Tone.js classes
   */
  private static readonly VALID_TONE_CLASSES = new Set([
    // Core
    'Transport', 'Destination', 'Master', 'Listener', 'Context', 'Draw',
    // Sources
    'Oscillator', 'PulseOscillator', 'PWMOscillator', 'FatOscillator',
    'AMSynth', 'FMSynth', 'MonoSynth', 'PolySynth', 'Synth', 'MembraneSynth',
    'MetalSynth', 'NoiseSynth', 'DuoSynth', 'PluckSynth', 'GrainSynth',
    // Effects
    'Reverb', 'Delay', 'FeedbackDelay', 'PingPongDelay',
    'Distortion', 'Chorus', 'Phaser', 'Tremolo', 'Vibrato',
    'Filter', 'EQ3', 'Compressor', 'Limiter', 'Gate',
    'AutoFilter', 'AutoPanner', 'AutoWah', 'BitCrusher', 'Chebyshev',
    'Convolver', 'JCReverb', 'StereoWidener', 'PitchShift', 'FrequencyShifter',
    // Components
    'Envelope', 'LFO', 'AmplitudeEnvelope', 'FrequencyEnvelope', 'ScaledEnvelope',
    'Meter', 'FFT', 'Waveform', 'DCMeter', 'LevelMeter',
    'Gain', 'Signal', 'Multiply', 'Add', 'Subtract', 'Abs', 'Negate', 'Pow',
    // Events
    'Loop', 'Part', 'Pattern', 'Sequence', 'Event',
    // Routing
    'PanVol', 'Panner', 'Panner3D', 'Merge', 'Split', 'Mono', 'Solo',
    // Utilities
    'ToneAudioBuffer', 'ToneAudioBuffers', 'Time', 'Frequency', 'Midi'
  ]);

  /**
   * Common Tone.js hallucinations (invalid APIs)
   */
  private static readonly HALLUCINATIONS = [
    { pattern: /Tone\.Reverberator/, suggestion: 'Tone.Reverb' },
    { pattern: /Tone\.DrivingPattern/, suggestion: 'Tone.Pattern or Tone.Loop' },
    { pattern: /Tone\.ReverbNode/, suggestion: 'Tone.Reverb' },
    { pattern: /Tone\.Echo/, suggestion: 'Tone.FeedbackDelay or Tone.PingPongDelay' },
    { pattern: /Tone\.Sound/, suggestion: 'Tone.Player or Tone.Synth' },
    { pattern: /Tone\.Play/, suggestion: 'Tone.Transport.start() or synth.triggerAttackRelease()' },
  ];

  /**
   * Validate Tone.js code structure
   */
  static validate(code: string): ToneValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    // Basic structure validation
    errors.push(...this.validateStructure(trimmed));

    // Check for Tone.js references
    errors.push(...this.validateToneReferences(trimmed));

    // Check for hallucinations
    errors.push(...this.validateHallucinations(trimmed));

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Tone.js structure
   */
  private static validateStructure(code: string): string[] {
    const errors: string[] = [];

    // Must have Tone. reference or import
    const hasTone = /\bTone\./.test(code) || /import.*['"]tone['"]/.test(code);
    if (!hasTone) {
      errors.push('Tone.js code must reference Tone object or import from "tone"');
    }

    return errors;
  }

  /**
   * Validate Tone.js class references
   */
  private static validateToneReferences(code: string): string[] {
    const errors: string[] = [];

    // Check for new Tone.XXX() calls
    const classMatches = code.matchAll(/new\s+Tone\.(\w+)/g);
    for (const match of classMatches) {
      const className = match[1];
      if (!this.VALID_TONE_CLASSES.has(className)) {
        errors.push(`Tone.js: Invalid class 'Tone.${className}'`);
      }
    }

    return errors;
  }

  /**
   * Validate against common hallucinations
   */
  private static validateHallucinations(code: string): string[] {
    const errors: string[] = [];

    for (const { pattern, suggestion } of this.HALLUCINATIONS) {
      if (pattern.test(code)) {
        errors.push(`Tone.js: Invalid API - did you mean '${suggestion}'?`);
      }
    }

    return errors;
  }

  /**
   * Get minimum size requirement for Tone.js code
   */
  static getMinSize(): number {
    return 100; // Tone.js can be concise
  }
}
