import { analyzeVoiceFrame, type VoiceFeatureFrame } from '@liminal/audio-core/VoiceFeatureStream.js';

declare const currentTime: number;
declare const sampleRate: number;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][]): boolean;
}

declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void;

class SingVoiceProcessor extends AudioWorkletProcessor {
  private previousSpectrum: Float32Array | null = null;
  private sharedFrame: Float32Array | null = null;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'shared-frame' && event.data.buffer instanceof SharedArrayBuffer) {
        this.sharedFrame = new Float32Array(event.data.buffer);
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) return true;

    const frame = analyzeVoiceFrame({
      samples: channel,
      sampleRate,
      previousSpectrum: this.previousSpectrum,
      nowMs: currentTime * 1000,
    });
    this.previousSpectrum = frame.spectrum;
    this.writeSharedFrame(frame);
    this.port.postMessage({ type: 'voice-frame', frame: serializeFrame(frame) });
    return true;
  }

  private writeSharedFrame(frame: VoiceFeatureFrame): void {
    if (!this.sharedFrame) return;
    this.sharedFrame[0] = frame.rms;
    this.sharedFrame[1] = frame.pitchHz;
    this.sharedFrame[2] = frame.centroid;
    this.sharedFrame[3] = frame.spectralFlux;
    this.sharedFrame[4] = frame.onset ? 1 : 0;
    this.sharedFrame[5] = frame.voiced ? 1 : 0;
    this.sharedFrame[6] = frame.confidence;
    this.sharedFrame[7] = frame.capturedAt / 1000;
  }
}

function serializeFrame(frame: VoiceFeatureFrame): Omit<VoiceFeatureFrame, 'spectrum'> {
  return {
    rms: frame.rms,
    pitchHz: frame.pitchHz,
    centroid: frame.centroid,
    spectralFlux: frame.spectralFlux,
    onset: frame.onset,
    voiced: frame.voiced,
    confidence: frame.confidence,
    capturedAt: frame.capturedAt,
  };
}

registerProcessor('sing-voice-processor', SingVoiceProcessor);
