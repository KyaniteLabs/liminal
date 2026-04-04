import * as Tone from 'tone';

const createAmbientDrone = async () => {
  await Tone.start();

  // Effects Chain
  const reverb = new Tone.Reverb({
    decay: 5,
    wet: 0.5
  }).toDestination();

  const delay = new Tone.FeedbackDelay("8n", 0.4).connect(reverb);

  const chorus = new Tone.Chorus(4, 2.5, 0.5).connect(delay);

  // Master Volume
  const master = new Tone.Gain(0.4).connect(chorus);

  // Oscillators
  const osc1 = new Tone.Oscillator({ frequency: "C2", type: "sine" });
  const osc2 = new Tone.Oscillator({ frequency: "G2", type: "triangle" });
  const osc3 = new Tone.Oscillator({ frequency: "C3", type: "sawtooth" });

  // Detune for richness
  osc2.detune.value = 15;
  osc3.detune.value = -15;

  // Filter for Oscillator 3
  const filter = new Tone.Filter({ frequency: 600, type: "lowpass", Q: 1 });
  osc3.connect(filter);
  filter.connect(master);

  // Connect Osc 1 and 2 directly to master
  osc1.connect(master);
  osc2.connect(master);

  // LFOs for Modulation
  const lfoPitch = new Tone.LFO("16n", 0, 10).start();
  const lfoFilter = new Tone.LFO("4n", 200, 2000).start();
  const lfoGain = new Tone.LFO("2n", 0, 0.2).start();

  // Connect LFOs
  lfoPitch.connect(osc1.frequency);
  lfoPitch.connect(osc2.frequency);
  lfoFilter.connect(filter.frequency);
  lfoGain.connect(master.gain);

  // Start Oscillators
  osc1.start();
  osc2.start();
  osc3.start();
};

createAmbientDrone();