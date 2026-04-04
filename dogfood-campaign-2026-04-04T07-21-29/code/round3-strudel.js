// Kick
const kick = s("bd:1").gain(1).decay(0.1).swing(0.1).late(0).fast(2);

// Snare
const snare = s("sd:2").gain(0.8).decay(0.2).late(0.5).fast(2);

// Hi-hat
const hihat = s("hh:3").gain(0.5).decay(0.05).fast(4);

// Bassline
const bass = s("bass:4").gain(1).decay(0.3).sustain(0.1).fast(1);

// Mix
const pattern = stack(kick, snare, hihat, bass).run();