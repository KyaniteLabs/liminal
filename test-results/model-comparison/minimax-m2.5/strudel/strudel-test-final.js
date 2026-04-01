$: s("bd*4 [bd ~ bd ~]").struct("t(5,8,0)"),
  $: s("hh*8"),
  $: s("~ cp ~ cp ~ cp ~").struct("t(5,8,4)"),
  $: note("c2 c2 f2 g2").s("sawtooth").gain(0.4),
  $: note("c3 e3 g3").s("square").gain(0.15).struct("t(3,16)")