$: s("bd*4").speed(1.083) // 130 BPM from base 120 (130/120 ≈ 1.083)
$: s("sd ~ sd ~").speed(1.083).gain(0.6)
$: s("hh*4, hh*4 ~ hh").speed(1.083).gain(0.5)
$: note("c2 e2 g2 c2").s("square").every(2, rev).gain(0.3)