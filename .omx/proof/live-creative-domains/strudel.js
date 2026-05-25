s("bd ~ bd ~ sn ~ [~ sn] ~ bd ~").out()
s("[~ hh] [hh hh] [~ hh] [hh hh]").out()
note("c1 c2 <c3 g3> <g2 e2>").saw().decay(0.25).out()
stack(
s("bd*4"),
s("sn(3,8)"),
s("hh(12,16)")
).out()
