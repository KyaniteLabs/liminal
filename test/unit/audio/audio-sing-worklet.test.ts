import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

class TestAudioWorkletProcessor {
  port = {
    messages: [] as unknown[],
    postMessage(message: unknown) {
      this.messages.push(message);
    },
  };
}

function loadProcessor(): TestAudioWorkletProcessor {
  let processorCtor: typeof TestAudioWorkletProcessor | null = null;
  const source = readFileSync('gui/public/audio-sing-worklet.js', 'utf8');
  const context = vm.createContext({
    AudioWorkletProcessor: TestAudioWorkletProcessor,
    Float32Array,
    Math,
    sampleRate: 48_000,
    registerProcessor(_name: string, ctor: typeof TestAudioWorkletProcessor) {
      processorCtor = ctor;
    },
  });

  vm.runInContext(source, context);
  if (!processorCtor) throw new Error('audio-sing-processor was not registered');
  return new processorCtor();
}

function processBlocks(processor: TestAudioWorkletProcessor, blockCount: number): void {
  for (let block = 0; block < blockCount; block += 1) {
    const samples = new Float32Array(128);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = Math.sin((block * samples.length + i) / 8) * 0.1;
    }
    processor.process([[samples]]);
  }
}

describe('audio-sing-worklet cadence', () => {
  it('keeps a 2048-sample analysis window but emits on an overlapping hop after warmup', () => {
    const processor = loadProcessor();

    processBlocks(processor, 15);
    expect(processor.port.messages).toHaveLength(0);

    processBlocks(processor, 1);
    expect(processor.port.messages).toHaveLength(1);

    processBlocks(processor, 5);
    expect(processor.port.messages).toHaveLength(1);

    processBlocks(processor, 1);
    expect(processor.port.messages).toHaveLength(2);
  });
});
