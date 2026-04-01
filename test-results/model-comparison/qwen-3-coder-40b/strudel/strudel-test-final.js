$: s("bd*4").gain(0.7).speed(130/120)
$: s("~ sd ~ sd").every(2, rev).gain(0.5).speed(130/120)
$: s("hh*8").gain(0.6).speed(130/120)
$: note("c2 e2 g2 c3").s("sawtooth").chop(4, 8).gain(0.2).room(0.4)