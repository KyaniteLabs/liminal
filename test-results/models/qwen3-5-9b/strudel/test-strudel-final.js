$: s("bd*4").gain(0.9).room(0.3),
  $: s("~ sd ~ sd").delay(0.25, "decay", 0.8, 0.1).gain(0.7).room(0.2),
  $: s("hh*8").distort().gain(0.4)