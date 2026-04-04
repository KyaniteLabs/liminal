// Ensure Tone.js is loaded before running this code
const context = new Tone.Context();

// --- 1. Setup Oscillators (The Source) ---
// Create a base frequency and group multiple oscillators for detuning
const baseFreq = 60;
const osc1 = new Tone.Oscillator(baseFreq, "sine").toDestination();
const osc2 = new Tone.Oscillator(baseFreq * 0.98, "sine").toDestination();
const osc3 = new Tone.Oscillator(baseFreq * 1.02, "sine").toDestination();

// Use a single master output for the oscillators
const masterOsc = new Tone.Merger().toDestination();
osc1.connect(masterOsc);
osc2.connect(masterOsc);
osc3.connect(masterOsc);

// --- 2. Setup Effects Chain ---
// Reverb (Ambient Space)
const reverb = new Tone.Reverb({
    decay: 8,
    wet: 0.6
}).toDestination();

// Delay (Echoing/Rhythm)
const delay = new Tone.PingPongDelay("1n", 0.5).toDestination();

// Connect the signal chain: Oscillators -> Delay -> Reverb -> Destination
masterOsc.disconnect(); // Disconnect from the default destination
masterOsc.connect(delay);
delay.connect(reverb);


// --- 3. Modulation (LFOs) ---
// 1. Pitch Modulation (Slow, subtle wobble)
const lfoPitch = new Tone.LFO("0.1s", 0.99, 1.01).start();
// We will apply this modulation later in the loop structure, or directly to frequency if using a single synth.
// For multiple oscs, we will modulate the overall volume or use a low-pass filter sweep.

// 2. Filter Modulation (Warming/Shaping the drone)
const lfoFilter = new Tone.LFO("0.5s", 100, 300).start();

// Create a master Filter to shape the sound
const filter = new Tone.Filter(150, "lowpass").connect(delay);

// Connect the source to the filter
masterOsc.connect(filter);

// Apply LFO modulation to the filter cutoff
filter.frequency.value = 150; // Initial value
filter.frequency.mult(lfoFilter.toDestination());


// --- 4. Drone Playback Loop ---
Tone.Transport.bpm.value = 60; // Slow, ambient tempo

// Start the main drone source (constant tone)
osc1.frequency.value = baseFreq;
osc2.frequency.value = baseFreq * 0.98;
osc3.frequency.value = baseFreq * 1.02;

// Start the transport and the sound
Tone.Transport.start();

// Schedule a repeating event to maintain the subtle modulation
Tone.Transport.scheduleRepeat((time) => {
    // Gently change the LFO parameters over time to avoid static sound
    lfoFilter.frequency.value = Math.random() * 5 + 1;
}, "2n");

// Function to stop the drone after a time
setTimeout(() => {
    Tone.Transport.stop();
    osc1.stop();
    osc2.stop();
    osc3.stop();
    lfoPitch.stop();
    lfoFilter.stop();
    console.log("Drone stopped.");
}, 60000); // Runs for 60 seconds