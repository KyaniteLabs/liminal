<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ambient Drone Patch</title>
</head>
<body>
<button id="startBtn">Start Drone</button>

<script type="module">
import * as Tone from 'https://cdn.skypack.dev/tone';

async function createDrone() {
  await Tone.start();
  console.log('Audio context started');

  // ---- Effects ----
  const reverb = new Tone.Reverb({
    decay: 12,
    wet: 0.7
  }).toDestination();
  await reverb.generate();

  const delay = new Tone.FeedbackDelay({
    delayTime: '4n',
    feedback: 0.35,
    wet: 0.4
  }).connect(reverb);

  // ---- Filter ----
  const filter = new Tone.Filter({
    frequency: 1200,
    type: 'lowpass',
    rolloff: -24,
    Q: 1.5
  }).connect(delay);

  // ---- Master Gain ----
  const masterGain = new Tone.Gain(0.6).connect(filter);

  // ---- Oscillators ----
  // Fundamental (A1)
  const osc1 = new Tone.Oscillator({
    frequency: 55,
    type: 'sine'
  }).connect(masterGain);

  // Fifth (E2)
  const osc2 = new Tone.Oscillator({
    frequency: 82.41,
    type: 'triangle'
  }).connect(masterGain);

  // Octave (A2)
  const osc3 = new Tone.Oscillator({
    frequency: 110,
    type: 'sine'
  }).connect(masterGain);

  // ---- LFOs ----
  // Amplitude modulation on osc1
  const lfoAmp = new Tone.LFO({
    frequency: 0.15,
    min: -0.2,
    max: 0.2
  }).start();
  lfoAmp.connect(osc1.volume);

  // Filter cutoff modulation
  const lfoFilter = new Tone.LFO({
    frequency: 0.07,
    min: 600,
    max: 2500
  }).start();
  lfoFilter.connect(filter.frequency);

  // Subtle stereo movement via panner
  const panner = new Tone.Panner(0).connect(reverb);
  masterGain.connect(panner);

  const lfoPan = new Tone.LFO({
    frequency: 0.04,
    min: -0.8,
    max: 0.8
  }).start();
  lfoPan.connect(panner.pan);

  // ---- Start Oscillators ----
  osc1.start();
  osc2.start();
  osc3.start();
}

// Button to satisfy browser autoplay policies
document.getElementById('startBtn').addEventListener('click', createDrone);
</script>
</body>
</html>