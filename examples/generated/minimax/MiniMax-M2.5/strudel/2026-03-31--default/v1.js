sound("bd*4") |> gain(1.2) |> shape(0.3),
  sound("sd*2") |> struct("t(2,4)") |> gain(0.8) |> shape(0.4),
  sound("hh") |> fast(2) |> struct("t(0,2)") |> gain(0.5) |> room(0.3),
  sound("bass:0") |> struct("[0 1 2 3]*4") |> speed("1 2 1.5 2") |> shape(0.6) |> delay(0.25) |> gain(0.7)
) |> room(0.4) |> gain(0.9)