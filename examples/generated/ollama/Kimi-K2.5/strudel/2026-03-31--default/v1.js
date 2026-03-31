stack(
  s("bd*4").gain(1.1).shape(0.3),
  s("~ sd ~ sd").gain(0.9).room(0.3).shape(0.2),
  s("hh*16").gain("[0.5 0.7]*8").pan(sine.fast(2)).delay(0.5).delaytime(0.125).delayfeedback(0.4).sometimes(x => x.speed(2)),
  note("c2 [c2 ~] g1 [c2 ~]")
    .s("sawtooth")
    .cutoff(sine.slow(4).range(800, 2400))
    .resonance(12)
    .gain(0.6)
    .every(3, rev)
)
.every(8, fast(2))