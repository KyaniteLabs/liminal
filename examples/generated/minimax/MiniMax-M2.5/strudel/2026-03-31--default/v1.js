s("kick").struct("[t t] t t [t t] t t t").fast(1).gain(1).room(0.3),
s("snare").struct("[x .] . . [x .] . .").fast(1).gain(0.8).room(0.4),
s("hat").fast(2).struct("x~x~ x~x~ x~x~ x~x~").gain(0.35).shape(0.3),
s("hat").fast(4).struct("x[x~]x[x~]x[x~]x[x~]").gain(0.2),
stack(
  n("0 0 7 0 5 7 0 0").s("sawtooth").fast(1).gain(0.65).shape(0.8),
  n("0*2 7*2 5*2").s("square").fast(1).gain(0.4).room(0.5)
),
s("808").n("0 0 0 0 0 0 12 0").fast(1).gain(0.3).room(0.6).delay(0.25).delayfeedback(0.3)