stack(
  s("kick", every(4, n(0, 0.2, 0.1))),
  s("snare", sometimes(n(1, 0.1), every(2, n(1, 0.15)))),
  s("hihat", every(1, n(3, 0.08, 0.05))),
  s("bassline", fast(rev(slow(stack(
    n(4, 0.3),
    n(6, 0.25),
    n(7, 0.2),
    n(5, 0.25)
  )))))
).effects(
  gain(0.8),
  room(0.3),
  delay(0.1, 0.4, 0.3)
)