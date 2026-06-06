/**
 * Fixed-size analysis ring buffer with hop-based frame readout.
 *
 * Audio arrives in small render quanta (e.g. 128 samples). For stable pitch and
 * spectral analysis we need a longer window (e.g. 2048). This buffer accumulates
 * quanta and yields the most-recent `size` samples once `hop` new samples have
 * arrived since the last readout, so analysis runs on a sliding window at a
 * controlled rate instead of on every tiny quantum.
 */
export class AnalysisRingBuffer {
  private readonly buffer: Float32Array;
  private readonly size: number;
  private writePos = 0;
  private sinceFrame = 0;

  constructor(size: number) {
    if (size <= 0 || !Number.isInteger(size)) {
      throw new Error(`AnalysisRingBuffer: size must be a positive integer (got ${size})`);
    }
    this.size = size;
    this.buffer = new Float32Array(size); // starts zero-filled (front padding)
  }

  /** Append a quantum of samples (chronological order preserved). */
  push(quantum: Float32Array): void {
    for (let i = 0; i < quantum.length; i++) {
      this.buffer[this.writePos] = quantum[i];
      this.writePos = (this.writePos + 1) % this.size;
      this.sinceFrame++;
    }
  }

  /**
   * If at least `hop` samples have arrived since the last frame, consume one hop
   * and return a NEW Float32Array of the most recent `size` samples in
   * chronological order (oldest → newest), zero-padded at the front until the
   * buffer has filled. Otherwise returns null.
   */
  takeFrameIfReady(hop: number): Float32Array | null {
    if (hop <= 0) throw new Error(`AnalysisRingBuffer: hop must be positive (got ${hop})`);
    if (this.sinceFrame < hop) return null;
    this.sinceFrame -= hop;

    const frame = new Float32Array(this.size);
    // writePos is where the NEXT sample goes == position of the oldest sample.
    for (let i = 0; i < this.size; i++) {
      frame[i] = this.buffer[(this.writePos + i) % this.size];
    }
    return frame;
  }
}
