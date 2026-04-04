/**
 * Ambient Drone Synthesizer Patch
 * Uses multiple oscillators, LFOs, Reverb, and Delay for rich, evolving soundscapes.
 */

// --- 1. Initialize Effects ---
const reverb = new Tone.Reverb({
    decay: 8,
    wet: 0.7
}).toDestination();

const delay = new Tone.FeedbackDelay("4n", 0.5).connect(reverb);

// --- 2. Initialize Oscillators (The core sound source) ---
const osc1 = new Tone.Oscillator(440, "sine").start();
const osc2 = new Tone.Oscillator(220, "sawtooth").start();
const osc3 = new Tone.Oscillator(330, "triangle").start();

// --- 3. Initialize Modulators (LFOs) ---
// LFO 1: Slow pitch wobble for the primary oscillator
const lfo1 = new Tone.LFO("1s", 0.05, 0.2).start();
// LFO 2: Slow amplitude modulation for overall movement
const lfo2 = new Tone.LFO("3s", 0.5, 1.5).start();

// --- 4. Connecting Signal Flow ---
// Oscillators feed into the delay
osc1.connect(delay);
osc2.connect(delay);
osc3.connect(delay);

// Modulating Frequency (Pitch wobble)
lfo1.connect(osc1.frequency);

// Modulating Amplitude (Volume pulsation on osc2)
lfo2.connect(osc2.volume);

// --- 5. Grouping and Output ---
// Connect the delay output to the reverb (which outputs to destination)
delay.connect(reverb);

// Set initial volumes (optional, but good practice)
osc1.volume.value = -10;
osc2.volume.value = -12;
osc3.volume.value = -10;

/**
 * Start the drone patch
 */
async function startDrone() {
    await Tone.start();
    console.log("Ambient Drone Started.");
}

/**
 * Stop the drone patch
 */
function stopDrone() {
    Tone.Transport.stop();
    console.log("Ambient Drone Stopped.");
}

// --- 6. User Interaction (Example) ---
document.addEventListener('click', async () => {
    if (Tone.context.state !== 'running') {
        await startDrone();
    }
}, { once: true });

// Optional: Auto-start for demonstration
// startDrone();