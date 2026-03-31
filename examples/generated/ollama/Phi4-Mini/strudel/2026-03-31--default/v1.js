const s = strudel;
let tempo = {bpm: 120};
s(tempo).loop().addSoundSource({type: 'kick', rate: 60});
s(tempo).repeat().play();
s(tempo).every(1/8, () => {
    let snareSample = new Strudel.Sound('snare');
    s.add(snareSample);
}).join({
    type: 'chop',
    startTime: {bpm: 120},
    stopTime: {bpm: 120}, // last beat of the eighth note
});
s(tempo).slow().addSoundSource({type: 'hi-hat', rate: 240, patternType: 'staccato'});
let bassline = new Strudel.Sound('bass');
s.add(bassline);
s.gain(0.5);