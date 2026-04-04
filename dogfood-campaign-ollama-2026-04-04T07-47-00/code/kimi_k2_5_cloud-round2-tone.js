// --- SETUP ---
// Ensure tone context is ready and start
Tone.start();

// --- EFFECTS CHAIN ---
// 1. Reverb (Creates large space)
const reverb = new Tone.Reverb({
    decay: 8,
    wet: 0.6
}).toDestination();

// 2. Delay (Creates echo and depth)
const delay = new Tone.FeedbackDelay("8n", 0.5).connect(reverb);

// --- OSCILLATORS (The Drone Sources) ---
// Three oscillators tuned to a low, consonant chord (e.g., C-G-C)
const osc1 = new Tone.Oscillator({ frequency: 80, type: "sine" }).start();
const osc2 = new Tone.Oscillator({ frequency: 120, type: "sine" }).start();
const osc3 = new Tone.Oscillator({ frequency: 160, type: "sine" }).start();

// Connect oscillators to the delay
osc1.connect(delay);
osc2.connect(delay);
osc3.connect(delay);


// --- MODULATION (LFOs) ---
// 1. Slow Pitch Wobble (Affects Osc 1)
const lfoPitch = new Tone.LFO("1.5s", -5, 5).start();
// Apply the LFO to the frequency of osc1
osc1.frequency.value = 80;
osc1.frequency.connect(lfoPitch); // LFO output connects to frequency parameter

// 2. Subtle Volume Pulse (Affects Osc 2)
const lfoVolume = new Tone.LFO("2s", 0.8, 1.2).start();
// Use a Gain node to control the volume based on the LFO
const gainVolume = new Tone.Filter(20000).toDestination(); // Dummy connection point
osc2.connect(gainVolume);
gainVolume.connect(delay); // Re-route the signal through the gain node
gainVolume.volume.value = 0; // Start muted

// Connect the LFO to the gain node's volume parameter
lfoVolume.connect(gainVolume.volume);
gainVolume.volume.value = 1; // Restore volume

// 3. Slow Frequency Drift (Affects Osc 3 - very subtle)
const lfoDrift = new Tone.LFO("10s", 0.1, 0.5).start();
osc3.frequency.value = 160;
osc3.frequency.connect(lfoDrift);


// --- MASTER CONNECTION ---
// Connect the final output (Reverb) to the speakers
reverb.connect(Tone.Destination);


// --- SCHEDULING (Keep the drone playing indefinitely) ---
Tone.Transport.bpm.value = 60; // Sets a stable, slow rhythm
Tone.Transport.start();

console.log("Ambient Drone Activated. Listen for the evolving textures.");