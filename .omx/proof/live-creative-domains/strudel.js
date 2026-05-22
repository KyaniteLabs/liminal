s("bd ~ bd ~ sn ~ [~ sn:2] ~")
.layer(s("~ [~ hh] ~ hh").fast(2))
.layer(note("c1, c1, g0, f0, c1, bb0, a0, g0").saw().decay(.15).cutoff(600))
.out()
