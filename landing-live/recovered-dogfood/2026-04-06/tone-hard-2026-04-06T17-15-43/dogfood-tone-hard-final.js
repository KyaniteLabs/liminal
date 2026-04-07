const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.4 }).toDestination();
const delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.3, wet: 0.3 }).connect(reverb);
const filter = new Tone.Filter({ frequency: 2000, type: "lowpass", Q: 5 });
const lfo = new Tone.LFO({ frequency: 0.5, min: 500, max: 4000 }).connect(filter.frequency);
lfo.start();