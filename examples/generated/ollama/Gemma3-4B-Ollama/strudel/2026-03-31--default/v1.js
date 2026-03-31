var kick = 's kick 0.5, 1';
  var snare = 's snare 0.25, 0.75';
  var hihat = 's hihat 0.125, 0.25, 0.5';
  var bass = 's bass 0.5, 1';
  var pattern = struct({
    kick: [kick, 4],
    snare: [snare, 4],
    hihat: [hihat, 16],
    bass: [bass, 8]
  });
  var layeredPattern = struct({
    kick: [kick, 4, gain(0.8)],
    snare: [snare, 4, gain(0.6), delay(0.1)],
    hihat: [hihat, 16, speed(1.2), pan(-0.2, 0.2)],
    bass: [bass, 8, room(0.3), distort(0.2)]
  });
  strudel.play(layeredPattern, 1);
});