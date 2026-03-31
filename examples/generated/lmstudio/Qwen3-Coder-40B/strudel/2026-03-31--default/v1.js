s(100)
stack(
  s(n(200, 200), every(4, rev(chop(4))))
,
  gain(.5, s("kick"))
,
  gain(.4, n(400, every(8, rev(slow(stack(
    s("snare"),
    speed(.5, s("hihat"))
  ))))))
,
  gain(.3, slow(n(120, every(3, stack(
    s("bassline"),
    distort(2, s("kick"))
  )))))
)