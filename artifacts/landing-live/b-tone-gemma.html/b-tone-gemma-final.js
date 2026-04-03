const Tone = require('tone');

let bpm = 120;
let synth;
let reverb;
let transport;

function setup() {
  Tone.setDefaultSampleRate(44100);
  Tone.cancelAnimationFrameManager();

  synth = new Tone.Noise();
  synth.detune.value = 0;
  synth.amp.setValueAtTime(0.1, Tone.now());

  reverb = new Tone.ReverbNode();
  reverb.room.value = 0.6;
  reverb.decay.value = 0.7;
  reverb.wet.value = 0.8;

  synth.connect(reverb);
  reverb.connect(Tone.MasterNode);

  transport = new Tone.Transport();
  transport.schedule((t) => {
    synth.play('C4').detune.value = -20;
    synth.play('G4').detune.value = -10;
    synth.play('E4').detune.value = 0;
    synth.play('C4').detune.value = 10;
    synth.play('G4').detune.value = 20;
  }, t);

  transport.loop = true;
  transport.start();

  document.getElementById('playButton').addEventListener('click', () => {
    if (!transport.isRunning) {
      transport.start();
      document.getElementById('playButton').textContent = 'Pause';
    } else {
      transport.stop();
      document.getElementById('playButton').textContent = 'Play';
    }
  });

  document.getElementById('bpmInput').addEventListener('change', (event) => {
    bpm = parseInt(event.target.value);
    transport.bpm.setValue(bpm);
  });

}

setup();