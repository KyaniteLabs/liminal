import { createSampleRingViews, writeSamplesToRing } from '@liminal/audio-core/dsp/SampleRingShared.js';

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][]): boolean;
}

declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void;

/**
 * Realtime-safe producer: copies mic sample quanta into a shared raw-sample ring
 * and does NO analysis. FFT/YIN run off the audio thread (main-thread render
 * loop), so this processor never risks missing the audio render deadline.
 */
class SingVoiceProcessor extends AudioWorkletProcessor {
  private control: Int32Array | null = null;
  private ring: Float32Array | null = null;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent) => {
      if (
        event.data?.type === 'sample-ring' &&
        event.data.buffer instanceof SharedArrayBuffer &&
        typeof event.data.capacity === 'number'
      ) {
        const views = createSampleRingViews(event.data.buffer, event.data.capacity);
        this.control = views.control;
        this.ring = views.ring;
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0 || !this.control || !this.ring) return true;
    writeSamplesToRing(this.control, this.ring, channel);
    return true;
  }
}

registerProcessor('sing-voice-processor', SingVoiceProcessor);
