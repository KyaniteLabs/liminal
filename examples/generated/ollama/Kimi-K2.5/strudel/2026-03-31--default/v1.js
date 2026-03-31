stack(
  s("bd*4").gain(0.95).shape(0.5).distort(0.1),
  s("~ sn ~ sn").gain(0.8).room(0.2).shape(0.3),
  s("hh*8").gain(0.6).pan(sine.fast(4)).room(0.1),
  note("<c2 c2 g2 c3>*2")
    .s("saw")
    .struct("x ~ x ~ x x ~ x")
    .cutoff(sine.fast(8).range(400, 2400))
    .resonance(18)
    .gain(0.7)
    .delay(0.4)
    .delaytime(0.125)
    .distort(0.3),
  s("stab").n("<0 2 4>*2").speed("1 1.5").gain(0.35).room(0.6).pan(sine.slow(2))
)
.every(4, rev)
.every(3, fast(2))
.sometimes(chop(8))