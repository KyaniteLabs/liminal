stack(
  s("bd:1").gain(1.3).speed("1 2 1 2"),
  s("sd:3").gain(0.8).pan("0.3 -0.3").every(2, "fast 2"),
  s("hh:2").gain(0.4).fast(2).every(3, "rev"),
  s("sawtooth").n("0 0 7 5 3 0 5 7").gain(0.6).room(0.3).delay(0.4).delaytime(0.25)
).fast(2)