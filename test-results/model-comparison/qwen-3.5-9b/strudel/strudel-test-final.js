$: s("bd*4").gain(0.8).room(0.5)
stack(
  $: s("~ sd ~ sd").speed(1.67),
  $: s("hh*8").every(2, rev),
  $: note("c3 e3 g3 c4").s("square").gain(0.3).distort().room(0.2)