osc(80).scale(1.5, 0.7).rotate(0.02).modulate(osc(120, 0.3)).color([0.9, 0.6, 0.2]).scrollX(0.01).out()
src().rotate(0.04).scale(1.2).modulate(noise(5, 0.5)).blend(osc(60, 0.8), 0.3).color([0.7, 0.4, 0.9]).scrollY(-0.008).out()
shape(7).scale(1.8, 0.9).rotate(0.015).modulate(osc(40, 0.6)).hue(0.3).contrast(1.2).scrollX(0.005).out()
src(s0).blend(src(s1), 0.7).modulateRotate(noise(3, 0.4)).speed(0.8).scale(1.1).out()