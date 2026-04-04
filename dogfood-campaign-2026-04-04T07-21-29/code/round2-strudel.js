// Kick – two hits per cycle, with gain, delay and room
$: s("bd:0")
  .fast(2)

// Snare – accent on the 2 and 4
$: s("sd:0")
  .fast(2)

// Hi‑hat – fast 16th‑note pattern
$: s("hh:0")
  .fast(4)

// Bassline – minor scale notes, sawtooth oscillator, filtered
  .s("sawtooth")
  .slow(2)