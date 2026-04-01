const { Oscillator } = Tone;
const { Reverb, Delay, LFO } = Tone;

// Create a master oscillator node with an LFO for vibrato effect
const masterOsc = new Oscillator().toDestination();
masterOsc.start();
LFO.create()
  .frequency(0.5)
  .gain(masterOsc.gain).start();

// Create multiple oscillators with different frequencies and waveforms
const osc1 = new Oscillator('sine', 'noteA').frequency(440);
const osc2 = new Oscillator('square', 'noteC').frequency(880);
const osc3 = new Oscillator('sawtooth', 'noteD').frequency(1320);

// Create a reverb effect
const reverb = new Reverb();
reverb.amount.value = 0.5;

// Create a delay effect
const delay = new Delay(0.1, -8);
delay.delayTime.setValueAtTime(0, Tone.now());

// Play the oscillators through the master oscillator node
osc1.connect(masterOsc);
osc2.connect(masterOsc);
osc3.connect(masterOsc);

// Connect reverb and delay to the master oscillator node
masterOsc.chain(reverb, delay);

// Add play/stop buttons for user interaction
const btnPlay = document.createElement('button');
btnPlay.textContent = 'Play';
document.body.appendChild(btnPlay);
btnPlay.addEventListener('click', () => {
  btnPlay.disabled = true;
  masterOsc.start();
});

const btnStop = document.createElement('button');
btnStop.textContent = 'Stop';
document.body.appendChild(btnStop);
btnStop.addEventListener('click', () => {
  masterOsc.stop();
  btnStop.disabled = true;
});