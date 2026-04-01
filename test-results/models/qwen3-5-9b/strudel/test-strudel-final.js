$: s("bd*4").speed(1.05).room(0.6)
$: s("~ sd ~ sd *2, hh*8").gain(0.7).delay(0.3).every(4, rev)
$: note(["c4", "e4", "g4", "c5"]).s("sawtooth").speed(1.2).gain(0.5).room(0.3)