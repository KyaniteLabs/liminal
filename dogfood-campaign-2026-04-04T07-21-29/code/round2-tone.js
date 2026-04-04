<!DOCTYPE html>
<html>
<head>
  <title>Ambient Drone</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
</head>
<body>
<button id="start">Start Drone</button>
<script>
document.getElementById('start').addEventListener('click', async () => {
  await Tone.start();
  const drone = new AmbientDrone();
  drone.start();
});

class AmbientDrone {
  constructor() {
    // Effects chain
    this.reverb = new Tone.Reverb({ decay: 12, wet: 0.7 });
    this.delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.4, wet: 0.35 });
    this.filter = new Tone.Filter({ frequency: 1500, type: 'lowpass', rolloff: -24 });

    // Connect: filter → delay → reverb → destination
    this.filter.connect(this.delay);
    this.delay.connect(this.reverb);
    this.reverb.toDestination();

    // Master amplitude gain (LFO target)
    this.masterGain = new Tone.Gain(0.5);

    // LFOs
    this.ampLFO = new Tone.LFO({ frequency: 0.07, min: 0.4, max: 1.0 }).connect(this.masterGain.gain);
    this.filterLFO = new Tone.LFO({ frequency: 0.04, min: 400, max: 3500 }).connect(this.filter.frequency);

    // Oscillator bank (multiple timbres)
    this.oscillators = [
      { freq: 55,    type: 'sine',     amp: 0.6 },
      { freq: 55.5,  type: 'triangle', amp: 0.4 },
      { freq: 82.5,  type: 'sawtooth', amp: 0.3 },
      { freq: 110,   type: 'sine',     amp: 0.25 },
      { freq: 165,   type: 'sine',     amp: 0.15 },
      { freq: 220,   type: 'triangle', amp: 0.1 }
    ].map(({ freq, type, amp }) => {
      const osc = new Tone.Oscillator(freq, type);
      const g = new Tone.Gain(amp);
      osc.connect(g);
      osc.start();
      return { osc, g };
    });

    // Connect oscillators → masterGain → filter
    this.oscillators.forEach(({ g }) => g.connect(this.masterGain));
    this.masterGain.connect(this.filter);
  }

  start() {
    this.ampLFO.start();
    this.filterLFO.start();
  }
}
</script>
</body>
</html>