stack(
  s("bd:3").gain(1.3).shape(1.2),
  s("sd:3").gain(0.9).shape(1.1),
  s("hh:2").fast(2).gain(0.35).hcutoff(10000),
  s("bass:2").note("<[0,7,5,3] [0,7,5,10] [0,7,5,7] [0,7,5,5]>").gain(0.7).room(0.2)
)