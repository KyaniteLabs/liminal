// Set BPM
setcpm(120/60);

// Create a layered pattern
stack(
  // Kick and snare pattern
  s("bd:2 sd:3").gain(0.8),
  
  // Hi-hat pattern
  s("hh:1").fast(2).gain(0.4),
  
  // Melodic pattern
  s("supersaw")
    .n("<0 2 4 5 7 5 4 2>")
    .gain(0.5)
    .delay(0.4)
    .delaytime(0.25),
  
  // Bass line
  s("sawtooth")
    .n("<0 0 5 5 7 7 5 5>")
    .gain(0.6)
    .room(0.5)
).fast(1)