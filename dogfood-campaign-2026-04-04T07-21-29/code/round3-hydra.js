// Hydra Video Synth - Feedback + Color Shifting + Geometric Patterns

// Initialize with feedback texture
s0.initVideo("https://media.giphy.com/media/3o7btNhMBytxAM6YBa/giphy.mp4")
s1.initVideo("https://media.giphy.com/media/l0MYt5jPR6VK5S2uU/giphy.mp4")

// Pattern 1: Kaleidoscope with feedback
src(s0).modulateRotate(s1,0.5).kaleidoscope(0.9,0.6).colorShift(0.4).out(o0)

// Pattern 2: Geometric grid distortion with shift
src(s1).modulateScale(src(s0).rotate(2),0.2).kaleidoscope(0.5,0.2).colorShift(0.7).out(o1)

// Pattern 3: Feedback loop effect
src(s0).feedback(s1.rotate(0.8).scale(1.1).colorShift(0.3)).rotate(0.5).modulateRotate(s1,0.8).out(o2)

// Pattern 4: Complex geometric pattern
src(s1).kaleidoscope(0.8,0.4).modulateScale(src(s0).rotate(0.3),0.5).colorShift(0.6).out(o3)

// Pattern 5: Fast rotating pattern
src(s0).rotate(3).kaleidoscope(0.7,0.5).modulateScale(s1,0.4).colorShift(0.8).out(o4)

// Pattern 6: Distortion effect
src(s1).modulateRotate(src(s0).kaleidoscope(0.9,0.3).colorShift(0.5),0.9).scale(1.2).out(o5)

// Pattern 7: Final combined effect
src(s0).feedback(s1.rotate(1.5).scale(1.05)).kaleidoscope(0.85,0.6).colorShift(0.6).modulateRotate(s1,0.7).out(o6)

// Pattern 8: Chromatic pattern
src(s1).colorShift(0.9).kaleidoscope(0.6,0.8).modulateScale(src(s0).rotate(0.5),0.6).out(o7)

// Render each pattern with different blend modes and speeds
render(o0)
updateTime(1)
setBlend("add")