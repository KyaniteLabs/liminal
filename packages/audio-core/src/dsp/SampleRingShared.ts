/**
 * Lock-free single-producer/single-consumer raw-sample ring over a (Shared)
 * ArrayBuffer.
 *
 * The AudioWorklet (producer) copies incoming sample quanta in — a trivial,
 * realtime-safe operation — and the main-thread render loop (consumer) reads the
 * most recent analysis window out and runs FFT/YIN there, off the audio thread.
 * This keeps heavy DSP away from the AudioWorklet's hard render deadline.
 *
 * Buffer layout: [ Int32 writePos, Int32 totalCapped ][ Float32 ring[capacity] ]
 */

const HEADER_INTS = 2;
const HEADER_BYTES = HEADER_INTS * Int32Array.BYTES_PER_ELEMENT; // 8

/** Total byte length needed for a ring of `capacity` Float32 samples. */
export function sampleRingByteLength(capacity: number): number {
  return HEADER_BYTES + capacity * Float32Array.BYTES_PER_ELEMENT;
}

/** Build the control (Int32) and ring (Float32) views over a shared buffer. */
export function createSampleRingViews(
  buffer: ArrayBufferLike,
  capacity: number,
): { control: Int32Array; ring: Float32Array } {
  return {
    control: new Int32Array(buffer, 0, HEADER_INTS),
    ring: new Float32Array(buffer, HEADER_BYTES, capacity),
  };
}

/** Producer: append a quantum of samples and publish the new write position. */
export function writeSamplesToRing(control: Int32Array, ring: Float32Array, samples: Float32Array): void {
  const cap = ring.length;
  let pos = Atomics.load(control, 0);
  let total = Atomics.load(control, 1);
  for (let i = 0; i < samples.length; i++) {
    ring[pos] = samples[i];
    pos += 1;
    if (pos >= cap) pos = 0;
    if (total < cap) total += 1;
  }
  Atomics.store(control, 1, total);
  Atomics.store(control, 0, pos);
}

/**
 * Consumer: copy the most recent `windowSize` samples (chronological,
 * oldest → newest) into `out`, zero-padding the front until enough samples
 * have been produced. `out.length` must be >= `windowSize`.
 */
export function readWindowFromRing(
  control: Int32Array,
  ring: Float32Array,
  windowSize: number,
  out: Float32Array,
): void {
  const cap = ring.length;
  const pos = Atomics.load(control, 0);
  const total = Atomics.load(control, 1);
  for (let i = 0; i < windowSize; i++) {
    const age = windowSize - i; // 1..windowSize samples back from pos
    if (age > total) {
      out[i] = 0;
      continue;
    }
    let idx = (pos - age) % cap;
    if (idx < 0) idx += cap;
    out[i] = ring[idx];
  }
}
