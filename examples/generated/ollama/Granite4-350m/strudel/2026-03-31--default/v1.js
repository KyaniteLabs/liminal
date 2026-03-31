const sample = require('tone-sample'); // Tone.js samples
// Sample the techno beat
const technoBeat = sample(0, 120, { sampleRate: 44100 });
const beat = new Instrument(technoBeat);
const patternFunction = () => {
  const kickSample = sample(0, 2);
  const snareSample = sample(0, 3);
  const hiHatSample = sample(0, 4);
  const basslineSample = sample(0, 5);
  // Apply patterns
  beat.play(kickSample, {
    gain: { gainLevel: 1.1 },
    delay: { delayDuration: 100 },
    pan: { panPosition: -50 },
  });
  beat.play(snareSample, {
    delay: { delayDuration: 200 },
    amplitude: 0.8,
  });
  beat.play(hiHatSample, {
    repeat: 'every',
    volume: { increaseBy: 1 },
    speed: 2,
  });
  beat.play(basslineSample, {
    repeat: 'every',
    pan: { increaseBy: -30 },
  });
};
// Create the Strudel pattern
const strudelPattern = new Pattern({
  name: "Strudel",
  input: [patternFunction],
});
strudelPattern.play();