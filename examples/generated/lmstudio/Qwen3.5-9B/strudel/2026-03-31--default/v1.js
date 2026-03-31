const tempo = 120;
s4(t) => {
  // Kick drum (low frequency sine wave with envelope)
  t |-> kick(0, 'kick') |-> gain(0.8);
  // Snare sound using noise burst with envelope
  t |-> snare(3, 'snare') |-> gain(0.6);
  // Hi-hat pattern (high frequency sine/triangle with fast decay)
  s('hihat').fast(1).every(t / 8) |-> gain(0.4);
  // Bassline: arpeggiated low frequencies with distortion and room reverb
  s([25, 35, 49, 74]).every(t / 2).chop(0.1) |-> distort() |-> room('room');