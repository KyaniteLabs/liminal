import { describe, it, expect } from 'vitest';
import { ToneValidator } from '../../../src/core/validators/ToneValidator.js';

describe('ToneValidator', () => {
  describe('validate', () => {
    it('should validate valid Tone.js code with Synth', () => {
      const code = `
const synth = new Tone.Synth().toDestination();
synth.triggerAttackRelease("C4", "8n");
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid Tone.js code with multiple synths', () => {
      const code = `
const synth = new Tone.PolySynth(Tone.Synth).toDestination();
const membrane = new Tone.MembraneSynth().toDestination();
const metal = new Tone.MetalSynth().toDestination();

synth.triggerAttackRelease(["C4", "E4", "G4"], "4n");
membrane.triggerAttackRelease("C2", "8n");
metal.triggerAttackRelease("32n");
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Tone.js code with effects', () => {
      const code = `
const reverb = new Tone.Reverb(2).toDestination();
const delay = new Tone.FeedbackDelay("8n", 0.5).connect(reverb);
const synth = new Tone.Synth().connect(delay);

synth.triggerAttackRelease("A4", "4n");
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Tone.js code with Transport', () => {
      const code = `
const synth = new Tone.Synth().toDestination();

const loop = new Tone.Loop(time => {
  synth.triggerAttackRelease("C4", "8n", time);
}, "4n").start(0);

Tone.Transport.start();
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Tone.js code with import statement', () => {
      const code = `
import * as Tone from 'tone';

const synth = new Tone.AMSynth().toDestination();
synth.triggerAttackRelease("C4", "4n");
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
      // Valid Tone.js with import - may have no errors or just structure warnings
    });

    it('should reject code without Tone reference', () => {
      const code = `
const synth = { triggerAttackRelease: () => {} };
synth.triggerAttackRelease("C4", "4n");
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tone.js code must reference Tone object or import from "tone"');
    });

    it('should reject empty code', () => {
      const result = ToneValidator.validate('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should reject invalid Tone.js classes', () => {
      const code = `
const synth = new Tone.InvalidSynth();
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Tone.js: Invalid class 'Tone.InvalidSynth'");
    });

    it('should detect Tone.Reverberator hallucination', () => {
      const code = `
const reverb = new Tone.Reverberator();
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Tone.js: Invalid API - did you mean 'Tone.Reverb'?");
    });

    it('should detect Tone.DrivingPattern hallucination', () => {
      const code = `
const pattern = new Tone.DrivingPattern();
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Tone.js: Invalid API - did you mean 'Tone.Pattern or Tone.Loop'?");
    });

    it('should validate code with Transport reference', () => {
      const code = `
Tone.Transport.start();
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
    });

    it('should validate FM Synthesis', () => {
      const code = `
const fmSynth = new Tone.FMSynth().toDestination();
fmSynth.triggerAttackRelease("C4", "2n");
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
    });

    it('should validate complex Tone.js composition', () => {
      const code = `
const reverb = new Tone.Reverb({ decay: 4, wet: 0.5 }).toDestination();
const filter = new Tone.Filter(800, "lowpass").connect(reverb);
const chorus = new Tone.Chorus(4, 2.5, 0.5).connect(filter);
const synth = new Tone.PolySynth(Tone.Synth).connect(chorus);

const sequence = new Tone.Sequence((time, note) => {
  synth.triggerAttackRelease(note, "8n", time);
}, ["C4", "E4", "G4", "B4"], "4n").start(0);

Tone.Transport.bpm.value = 120;
Tone.Transport.start();
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Tone.js code with LFO', () => {
      const code = `
const lfo = new Tone.LFO("4n", 200, 1000).start();
const filter = new Tone.Filter(400, "lowpass").toDestination();
lfo.connect(filter.frequency);
const synth = new Tone.Synth().connect(filter);
synth.triggerAttackRelease("C4", "2n");
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Tone.js code with Pattern', () => {
      const code = `
const synth = new Tone.Synth().toDestination();
const pattern = new Tone.Pattern((time, note) => {
  synth.triggerAttackRelease(note, "8n", time);
}, ["C4", "E4", "G4", "A4"], "upDown");
pattern.interval = "4n";
pattern.start(0);
Tone.Transport.start();
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Tone.js code with AuxNode and Analyser', () => {
      const code = `
const aux = new Tone.AuxNode().toDestination();
const analyser = new Tone.Analyser().connect(aux);
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid synth graph property assumptions', () => {
      const code = `
const droneVoices = [
  new Tone.PolySynth("sawtooth").toDestination(),
  new Tone.PolySynth(Tone.Synth).toDestination()
];
const filter = droneVoices[0].filter;
const detune = droneVoices[1].detune.value;
const lfo = new Tone.LFO("sine", { rate: 0.1, depth: 5 }).connect(droneVoices[0].filter.lfo);
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tone.js: PolySynth/Synth instances do not expose .filter; create Tone.Filter and connect through it');
      expect(result.errors).toContain('Tone.js: Do not mutate synth.detune.value directly on PolySynth; use supported oscillator/frequency parameters or an explicit LFO target');
      expect(result.errors).toContain('Tone.js: Invalid LFO target .filter.lfo; connect LFO to an explicit Tone.Filter frequency parameter');
      expect(result.errors).toContain('Tone.js: Tone.PolySynth constructor should receive a synth class/config object, not an oscillator type string');
    });

    it('should reject common LFO casing and method hallucinations', () => {
      const code = `
const lfo = new Tone.Lfo().startAttack(0.1).setFrequency(0.5);
      `;

      const result = ToneValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Tone.js: Invalid class 'Tone.Lfo'");
      expect(result.errors).toContain("Tone.js: Invalid API - did you mean 'Tone.LFO'?");
      expect(result.errors).toContain("Tone.js: Invalid API - did you mean 'lfo.start()'?");
      expect(result.errors).toContain("Tone.js: Invalid API - did you mean 'lfo.frequency.value = ...'?");
    });
  });

  describe('getMinSize', () => {
    it('should return 100 bytes as minimum size', () => {
      expect(ToneValidator.getMinSize()).toBe(100);
    });
  });
});
