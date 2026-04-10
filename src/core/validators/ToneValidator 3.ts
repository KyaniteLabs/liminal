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
   * Valid Tone.js classes - comprehensive whitelist of all Tone.js API classes
   */
  private static readonly VALID_TONE_CLASSES = new Set([
    // Core
    'Transport', 'Destination', 'Master', 'Listener', 'Context', 'Draw', 'Tone',
    // Sources - Oscillators
    'Oscillator', 'PulseOscillator', 'PWMOscillator', 'FatOscillator', 'AMOscillator', 'FMOscillator',
    // Sources - Synths
    'AMSynth', 'FMSynth', 'MonoSynth', 'PolySynth', 'Synth', 'MembraneSynth',
    'MetalSynth', 'NoiseSynth', 'DuoSynth', 'PluckSynth', 'GrainSynth', 'Sampler', 'Player',
    // Sources - Noise
    'Noise', 'Microphone', 'UserMedia',
    // Effects - Time
    'Reverb', 'Delay', 'FeedbackDelay', 'PingPongDelay', 'PreDelay',
    // Effects - Distortion
    'Distortion', 'Chebyshev', 'BitCrusher', 'WaveShaper',
    // Effects - Modulation
    'Chorus', 'Phaser', 'Tremolo', 'Vibrato', 'Tremolo', 'AutoPanner',
    // Effects - Filters
    'Filter', 'EQ3', 'AutoFilter', 'LowpassCombFilter', 'HighpassCombFilter',
    // Effects - Dynamics
    'Compressor', 'Limiter', 'Gate', 'MultibandCompressor', 'MidSideCompressor',
    // Effects - Spatial
    'Panner', 'Panner3D', 'StereoWidener', 'JCReverb', 'Convolver',
    // Effects - Pitch/Spectral
    'PitchShift', 'FrequencyShifter',
    // Effects - Utility
    'Gain', 'Volume', 'StereoFeedbackEffect', 'StereoEffect', 'Effect',
    // Components - Envelopes
    'Envelope', 'AmplitudeEnvelope', 'FrequencyEnvelope', 'ScaledEnvelope',
    // Components - Analysis
    'Meter', 'FFT', 'Waveform', 'DCMeter', 'LevelMeter', 'Scope',
    // Components - Math
    'Signal', 'Multiply', 'Add', 'Subtract', 'Abs', 'Negate', 'Pow', 'Divide', 'Modulo', 'Max', 'Min', 'Clip', 'Scale', 'Pow',
    // Components - Core
    'Param', 'Timeline', 'Clock', 'Emitter', 'TimelineState',
    // Instruments
    'Instrument', 'Monophonic', 'Polyphonic',
    // Events
    'Loop', 'Part', 'Pattern', 'Sequence', 'Event', 'ToneEvent',
    // Transport
    'Transport', 'TransportTime', 'Ticks', 'Time', 'Frequency', 'Midi', 'BarsBeatsSixteenths',
    // Routing
    'PanVol', 'Panner', 'Panner3D', 'Merge', 'Split', 'Mono', 'Solo', 'Channel', 'Master',
    // Utilities
    'ToneAudioBuffer', 'ToneAudioBuffers', 'Buffer', 'Buffers',
    'Interval', 'Timeout', 'Draw', 'Context', 'OfflineContext',
    // Type conversion
    'TimeBase', 'FrequencyClass', 'TransportTimeClass',
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
